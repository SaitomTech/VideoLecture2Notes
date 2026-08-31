import { extractAudio } from '../../lib/media/ffmpeg'
import { getAudioAssetPath } from '../../lib/storage/projectAssets'
import { fileExists } from '../../lib/tauri/filesystem'
import { DEFAULT_WHISPER_MODEL, ensureWhisperModel } from '../../lib/whisper/modelManager'
import { runWhisper } from '../../lib/whisper/whisper'
import type { MediaProject, TranscriptionResult } from '../../types/project'

export type TranscriptionLanguage = 'auto' | 'ja' | 'en'
export type TranscriptionStage =
  | 'preparing-model'
  | 'extracting-audio'
  | 'transcribing'
  | 'saving'

type RunTranscriptionInput = {
  project: MediaProject
  language: TranscriptionLanguage
  onStage?: (stage: TranscriptionStage) => void
  onProgress?: (progress: number | null) => void
}

function inputFingerprint(project: MediaProject, language: TranscriptionLanguage) {
  const metadata = project.source.metadata
  return [
    project.source.path,
    project.source.sizeBytes ?? 'unknown-size',
    metadata.durationMs,
    metadata.width,
    metadata.height,
    DEFAULT_WHISPER_MODEL.id,
    language,
  ].join(':')
}

export async function runTranscription({
  project,
  language,
  onStage,
  onProgress,
}: RunTranscriptionInput): Promise<TranscriptionResult> {
  onStage?.('preparing-model')
  onProgress?.(null)
  const modelPath = await ensureWhisperModel({
    onProgress: ({ receivedBytes, totalBytes }) => {
      onProgress?.(totalBytes > 0 ? receivedBytes / totalBytes : null)
    },
  })

  onStage?.('extracting-audio')
  onProgress?.(null)
  const audioPath = await getAudioAssetPath(project.id)
  if (!(await fileExists(audioPath))) {
    await extractAudio({ path: project.source.path, outputPath: audioPath })
  }
  if (!(await fileExists(audioPath))) {
    throw new Error('音声ファイルを作成できませんでした。動画に音声トラックがあるか確認してください。')
  }

  onStage?.('transcribing')
  onProgress?.(null)
  const rawTranscript = await runWhisper({
    projectId: project.id,
    audioPath,
    modelPath,
    language,
    onProgress,
  })

  return {
    model: DEFAULT_WHISPER_MODEL.id,
    language: rawTranscript.language ?? language,
    audioPath,
    segments: rawTranscript.segments,
    transcribedAt: new Date().toISOString(),
    inputFingerprint: inputFingerprint(project, language),
  }
}
