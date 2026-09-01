import { extractAudio } from '../../lib/media/ffmpeg'
import { UserFacingError, withUserFacingError } from '../../lib/errors'
import { getAudioAssetPath } from '../../lib/storage/projectAssets'
import { fileExists } from '../../lib/tauri/filesystem'
import {
  ensureWhisperModel,
  getWhisperModel,
  type WhisperModelId,
} from '../../lib/whisper/modelManager'
import { runWhisper } from '../../lib/whisper/whisper'
import type { MediaProject, TranscriptionResult } from '../../types/project'

export type TranscriptionLanguage = 'auto' | 'ja' | 'en'
export type TranscriptionStage = 'preparing-model' | 'extracting-audio' | 'transcribing' | 'saving'

type RunTranscriptionInput = {
  project: MediaProject
  language: TranscriptionLanguage
  modelId: WhisperModelId
  onStage?: (stage: TranscriptionStage) => void
  onProgress?: (progress: number | null) => void
  signal?: AbortSignal
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('処理を中止しました。', 'AbortError')
}

function inputFingerprint(project: MediaProject, modelId: WhisperModelId, language: string) {
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

export async function runTranscription({
  project,
  language,
  modelId,
  onStage,
  onProgress,
  signal,
}: RunTranscriptionInput): Promise<TranscriptionResult> {
  const model = getWhisperModel(modelId)
  const effectiveLanguage = model.languageSupport === 'ja' ? 'ja' : language
  throwIfAborted(signal)
  onStage?.('preparing-model')
  onProgress?.(null)
  const modelPath = await withUserFacingError(
    '文字起こしモデルを準備できませんでした。通信状況と空き容量を確認して、再試行してください。',
    () =>
      ensureWhisperModel({
        modelId,
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
    language: rawTranscript.language ?? effectiveLanguage,
    audioPath,
    segments: rawTranscript.segments,
    transcribedAt: new Date().toISOString(),
    inputFingerprint: inputFingerprint(project, model.id, effectiveLanguage),
  }
}
