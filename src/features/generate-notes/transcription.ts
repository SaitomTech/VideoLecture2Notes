import { UserFacingError, withUserFacingError } from '../../lib/errors'
import { extractAudio, extractAudioChunkForOpenAi } from '../../lib/media/ffmpeg'
import { transcribeOpenAiAudio } from '../../lib/openai/openai'
import { getAudioAssetPath, getTranscriptionAudioChunkPath } from '../../lib/storage/projectAssets'
import { fileExists } from '../../lib/tauri/filesystem'
import { runAppleSpeech } from '../../lib/speech/appleSpeech'
import {
  getTranscriptionModel,
  type TranscriptionModel,
  type TranscriptionModelId,
} from '../../lib/transcription/transcriptionModel'
import { ensureWhisperModel } from '../../lib/whisper/modelManager'
import { runWhisper } from '../../lib/whisper/whisper'
import { normalizeTranscriptSegments } from '../../lib/pipeline/assignTranscriptToSlides'
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

type OpenAiTranscriptionProvider = {
  provider: 'openai'
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

function inputFingerprint(project: MediaProject, modelId: TranscriptionModelId, language: string) {
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

async function prepareAudio(
  project: MediaProject,
  signal: AbortSignal | undefined,
  onStage?: (stage: TranscriptionStage) => void,
) {
  throwIfAborted(signal)
  onStage?.('extracting-audio')
  const audioError =
    '動画から音声を準備できませんでした。音声トラックを確認して、再試行してください。'
  return withUserFacingError(audioError, async () => {
    const path = await getAudioAssetPath(project.id)
    if (!(await fileExists(path))) {
      await extractAudio({ path: project.source.path, outputPath: path, signal })
    }
    if (!(await fileExists(path))) throw new UserFacingError(audioError)
    return path
  })
}

async function runAppleTranscription({
  project,
  language,
  model,
  onStage,
  onProgress,
  onChunkProgress,
  signal,
}: RunTranscriptionInput & {
  model: Extract<TranscriptionModel, { provider: 'apple' }>
}): Promise<TranscriptionResult> {
  throwIfAborted(signal)
  onStage?.('preparing-model')
  onProgress?.(null)
  onChunkProgress?.(null)
  const audioPath = await prepareAudio(project, signal, onStage)

  throwIfAborted(signal)
  onStage?.('transcribing')
  onProgress?.(null)
  const recognition = await withUserFacingError(
    'Apple SpeechTranscriberで音声を文字起こしできませんでした。macOSの対応状況と音声を確認して、再試行してください。',
    () =>
      runAppleSpeech({
        audioPath,
        language,
        onProgress,
        signal,
      }),
  )

  const normalizedLanguage = recognition.language.toLowerCase().startsWith('ja')
    ? 'ja'
    : recognition.language.toLowerCase().startsWith('en')
      ? 'en'
      : recognition.language

  return {
    model: model.id,
    provider: model.provider,
    engineVersion: recognition.engineVersion,
    language: normalizedLanguage,
    audioPath,
    segments: normalizeTranscriptSegments(recognition.segments),
    transcribedAt: new Date().toISOString(),
    inputFingerprint: inputFingerprint(project, model.id, language),
  }
}

function createAudioRanges(project: MediaProject) {
  const durationMs = Math.max(1, project.source.metadata.durationMs)
  return splitRange({ startMs: 0, endMs: durationMs })
}

async function runLocalTranscription({
  project,
  language,
  model,
  onStage,
  onProgress,
  signal,
}: RunTranscriptionInput & {
  model: Extract<TranscriptionModel, { provider: 'local' }>
}): Promise<TranscriptionResult> {
  const effectiveLanguage = model.model.languageSupport === 'ja' ? 'ja' : language
  throwIfAborted(signal)
  onStage?.('preparing-model')
  onProgress?.(null)

  const modelPath = await withUserFacingError(
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

  throwIfAborted(signal)
  onStage?.('transcribing')
  onProgress?.(null)
  const rawTranscript = await withUserFacingError(
    '音声を文字起こしできませんでした。アプリを再起動して、再試行してください。',
    () =>
      runWhisper({
        projectId: project.id,
        audioPath,
        modelPath,
        language: effectiveLanguage,
        onProgress,
        signal,
      }),
  )

  return {
    model: model.id,
    provider: model.provider,
    language: rawTranscript.language ?? effectiveLanguage,
    audioPath,
    segments: normalizeTranscriptSegments(rawTranscript.segments),
    transcribedAt: new Date().toISOString(),
    inputFingerprint: inputFingerprint(project, model.id, effectiveLanguage),
  }
}

function createOpenAiProvider({
  language,
  signal,
}: Omit<RunTranscriptionInput, 'modelId' | 'onStage' | 'onProgress' | 'onChunkProgress'> & {
  model: Extract<TranscriptionModel, { provider: 'openai' }>
}): OpenAiTranscriptionProvider {
  const effectiveLanguage = language

  return {
    provider: 'openai',
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
      const segments =
        result.segments
          ?.map((segment) => ({
            id: `segment-${segment.startSeconds}-${segment.endSeconds}`,
            startMs: Math.max(0, segment.startSeconds * 1000),
            endMs: Math.max(0, segment.endSeconds * 1000),
            text: segment.text.trim(),
          }))
          .filter((segment) => segment.text && segment.endMs >= segment.startMs) ?? []
      return {
        language: result.language,
        segments:
          segments.length > 0
            ? segments
            : text
              ? [
                  {
                    id: `segment-0-${chunk.startMs}-${chunk.endMs}`,
                    startMs: 0,
                    endMs: chunk.endMs - chunk.startMs,
                    text,
                  },
                ]
              : [],
      }
    },
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
      id: segment.id,
      startMs,
      endMs: Math.max(startMs, Math.min(chunk.endMs, chunk.startMs + Math.max(0, segment.endMs))),
      text: segment.text,
    }
  })
}

export async function runTranscription(input: RunTranscriptionInput): Promise<TranscriptionResult> {
  const { project, modelId, onStage, onProgress, onChunkProgress, signal } = input
  const model = getTranscriptionModel(modelId)
  if (model.provider === 'apple') {
    return runAppleTranscription({ ...input, model })
  }
  if (model.provider === 'local') {
    return runLocalTranscription({ ...input, model })
  }

  const provider = createOpenAiProvider({ ...input, model })

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

  const ranges = createAudioRanges(project)
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
    segments: normalizeTranscriptSegments(
      segments.sort((first, second) => first.startMs - second.startMs),
    ),
    transcribedAt: new Date().toISOString(),
    inputFingerprint: inputFingerprint(project, model.id, provider.effectiveLanguage),
  }
}
