import { UserFacingError, withUserFacingError } from '../../lib/errors'
import {
  extractAudio,
  extractAudioChunkForLocalTranscription,
  extractAudioChunkForOpenAi,
} from '../../lib/media/ffmpeg'
import { transcribeOpenAiAudio } from '../../lib/openai/openai'
import {
  getAudioAssetPath,
  getTranscriptionAudioChunkPath,
} from '../../lib/storage/projectAssets'
import { fileExists } from '../../lib/tauri/filesystem'
import {
  getTranscriptionModel,
  type TranscriptionModel,
  type TranscriptionModelId,
} from '../../lib/transcription/transcriptionModel'
import { ensureWhisperModel } from '../../lib/whisper/modelManager'
import { runWhisper } from '../../lib/whisper/whisper'
import type { MediaProject, TranscriptSegment, TranscriptionResult } from '../../types/project'

export type TranscriptionLanguage = 'auto' | 'ja' | 'en'
export type TranscriptionStage =
  | 'preparing-model'
  | 'extracting-audio'
  | 'preparing-chunks'
  | 'transcribing'
  | 'saving'

export type TranscriptionChunkProgress = {
  completed: number
  total: number
}

type RunTranscriptionInput = {
  project: MediaProject
  language: TranscriptionLanguage
  modelId: TranscriptionModelId
  onStage?: (stage: TranscriptionStage) => void
  onProgress?: (progress: number | null) => void
  onChunkProgress?: (progress: TranscriptionChunkProgress | null) => void
  signal?: AbortSignal
}

type ChunkRange = {
  startMs: number
  endMs: number
}

type PreparedChunk = ChunkRange & {
  path: string
}

type TranscriptionProvider = {
  provider: 'local' | 'openai'
  chunking: 'duration' | 'slides'
  effectiveLanguage: TranscriptionLanguage
  prepare: () => Promise<void>
  prepareChunk: (audioPath: string, outputPath: string, range: ChunkRange) => Promise<void>
  transcribeChunk: (chunk: PreparedChunk) => Promise<{
    language?: string
    segments: TranscriptSegment[]
  }>
}

const MAX_TRANSCRIPTION_CHUNK_MS = 30 * 60 * 1000

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('処理を中止しました。', 'AbortError')
}

function inputFingerprint(
  project: MediaProject,
  modelId: TranscriptionModelId,
  language: string,
) {
  const metadata = project.source.metadata
  return [
    project.source.path,
    project.source.sizeBytes ?? 'unknown-size',
    metadata.durationMs,
    metadata.width,
    metadata.height,
    modelId,
    language,
  ].join(':')
}

function splitRange(range: ChunkRange) {
  const chunks: ChunkRange[] = []
  for (let startMs = range.startMs; startMs < range.endMs; startMs += MAX_TRANSCRIPTION_CHUNK_MS) {
    chunks.push({
      startMs,
      endMs: Math.min(range.endMs, startMs + MAX_TRANSCRIPTION_CHUNK_MS),
    })
  }
  return chunks
}

function createChunkRanges(project: MediaProject, chunking: TranscriptionProvider['chunking']) {
  const durationMs = Math.max(1, project.source.metadata.durationMs)
  if (chunking === 'duration') {
    return splitRange({ startMs: 0, endMs: durationMs })
  }
  const slideRanges: ChunkRange[] = []
  for (const slide of project.slides) {
    const range = {
      startMs: Math.max(0, Math.min(durationMs, slide.startMs)),
      endMs: Math.max(0, Math.min(durationMs, slide.endMs)),
    }
    if (range.endMs > range.startMs) slideRanges.push(range)
  }
  slideRanges.sort((first, second) => first.startMs - second.startMs)
  const ranges = slideRanges.length ? slideRanges : [{ startMs: 0, endMs: durationMs }]
  return ranges.flatMap(splitRange)
}

function assertNever(value: never): never {
  throw new Error(`未対応の文字起こしプロバイダーです: ${JSON.stringify(value)}`)
}

function createLocalProvider({
  project,
  model,
  language,
  onProgress,
  signal,
}: Omit<RunTranscriptionInput, 'modelId' | 'onStage' | 'onChunkProgress'> & {
  model: Extract<TranscriptionModel, { provider: 'local' }>
}): TranscriptionProvider {
  const effectiveLanguage = model.model.languageSupport === 'ja' ? 'ja' : language
  let modelPath: string | null = null

  return {
    provider: 'local',
    chunking: 'duration',
    effectiveLanguage,
    prepare: async () => {
      modelPath = await withUserFacingError(
        '文字起こしモデルを準備できませんでした。通信状況と空き容量を確認して、再試行してください。',
        () =>
          ensureWhisperModel({
            modelId: model.id,
            signal,
            onProgress: ({ receivedBytes, totalBytes }) => {
              onProgress?.(totalBytes > 0 ? receivedBytes / totalBytes : null)
            },
          }),
      )
    },
    prepareChunk: async (audioPath, outputPath, range) => {
      await extractAudioChunkForLocalTranscription({
        path: audioPath,
        outputPath,
        startMs: range.startMs,
        durationMs: range.endMs - range.startMs,
        signal,
      })
    },
    transcribeChunk: async (chunk) => {
      if (!modelPath) throw new Error('ローカル文字起こしモデルが準備されていません')
      return runWhisper({
        projectId: project.id,
        audioPath: chunk.path,
        modelPath,
        language: effectiveLanguage,
        signal,
      })
    },
  }
}

function createOpenAiProvider({
  language,
  signal,
}: Omit<RunTranscriptionInput, 'modelId' | 'onStage' | 'onProgress' | 'onChunkProgress'> & {
  model: Extract<TranscriptionModel, { provider: 'openai' }>
}): TranscriptionProvider {
  const effectiveLanguage = language

  return {
    provider: 'openai',
    chunking: 'slides',
    effectiveLanguage,
    prepare: async () => undefined,
    prepareChunk: async (audioPath, outputPath, range) => {
      await extractAudioChunkForOpenAi({
        path: audioPath,
        outputPath,
        startMs: range.startMs,
        durationMs: range.endMs - range.startMs,
        signal,
      })
    },
    transcribeChunk: async (chunk) => {
      const result = await transcribeOpenAiAudio({
        audioPath: chunk.path,
        language: effectiveLanguage === 'auto' ? undefined : effectiveLanguage,
        signal,
      })
      const text = result.text.trim()
      return {
        language: result.language,
        segments: text
          ? [{ startMs: 0, endMs: chunk.endMs - chunk.startMs, text }]
          : [],
      }
    },
  }
}

function createTranscriptionProvider(
  input: RunTranscriptionInput,
  model: TranscriptionModel,
): TranscriptionProvider {
  switch (model.provider) {
    case 'local':
      return createLocalProvider({ ...input, model })
    case 'openai':
      return createOpenAiProvider({ ...input, model })
    default:
      return assertNever(model)
  }
}

function reportChunkProgress(
  completed: number,
  total: number,
  onProgress?: (progress: number | null) => void,
  onChunkProgress?: (progress: TranscriptionChunkProgress | null) => void,
) {
  onProgress?.(total > 0 ? completed / total : null)
  onChunkProgress?.({ completed, total })
}

function offsetSegments(chunk: PreparedChunk, segments: TranscriptSegment[]) {
  return segments.map((segment) => {
    const startMs = Math.min(chunk.endMs, chunk.startMs + Math.max(0, segment.startMs))
    return {
      startMs,
      endMs: Math.max(
        startMs,
        Math.min(chunk.endMs, chunk.startMs + Math.max(0, segment.endMs)),
      ),
      text: segment.text,
    }
  })
}

export async function runTranscription(input: RunTranscriptionInput): Promise<TranscriptionResult> {
  const { project, modelId, onStage, onProgress, onChunkProgress, signal } = input
  const model = getTranscriptionModel(modelId)
  const provider = createTranscriptionProvider(input, model)

  throwIfAborted(signal)
  onStage?.('preparing-model')
  onProgress?.(null)
  onChunkProgress?.(null)
  await provider.prepare()

  throwIfAborted(signal)
  onStage?.('extracting-audio')
  onProgress?.(null)
  const audioError =
    '動画から音声を準備できませんでした。音声トラックを確認して、再試行してください。'
  const audioPath = await withUserFacingError(audioError, async () => {
    const path = await getAudioAssetPath(project.id)
    if (!(await fileExists(path))) {
      await extractAudio({ path: project.source.path, outputPath: path, signal })
    }
    if (!(await fileExists(path))) throw new UserFacingError(audioError)
    return path
  })

  const ranges = createChunkRanges(project, provider.chunking)
  const chunks: PreparedChunk[] = []
  onStage?.('preparing-chunks')
  reportChunkProgress(0, ranges.length, onProgress, onChunkProgress)
  for (let chunkIndex = 0; chunkIndex < ranges.length; chunkIndex += 1) {
    throwIfAborted(signal)
    const range = ranges[chunkIndex]
    const path = await getTranscriptionAudioChunkPath(project.id, provider.provider, chunkIndex)
    await provider.prepareChunk(audioPath, path, range)
    chunks.push({ ...range, path })
    reportChunkProgress(chunkIndex + 1, ranges.length, onProgress, onChunkProgress)
  }

  onStage?.('transcribing')
  reportChunkProgress(0, chunks.length, onProgress, onChunkProgress)
  const segments: TranscriptSegment[] = []
  let detectedLanguage: string | undefined
  const transcriptionError =
    model.provider === 'openai'
      ? 'OpenAI APIで音声を文字起こしできませんでした。APIキーと利用上限を確認してください。'
      : '音声を文字起こしできませんでした。アプリを再起動して、再試行してください。'
  await withUserFacingError(transcriptionError, async () => {
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      throwIfAborted(signal)
      const chunk = chunks[chunkIndex]
      const result = await provider.transcribeChunk(chunk)
      detectedLanguage ??= result.language
      segments.push(...offsetSegments(chunk, result.segments))
      reportChunkProgress(chunkIndex + 1, chunks.length, onProgress, onChunkProgress)
    }
  })

  return {
    model: model.id,
    provider: model.provider,
    language: detectedLanguage ?? provider.effectiveLanguage,
    audioPath,
    segments: segments.sort((first, second) => first.startMs - second.startMs),
    transcribedAt: new Date().toISOString(),
    inputFingerprint: inputFingerprint(project, model.id, provider.effectiveLanguage),
  }
}
