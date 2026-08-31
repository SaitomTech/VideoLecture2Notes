import { ensureModelFiles, type ModelDownloadProgress } from '../models/download'

export const DEFAULT_WHISPER_MODEL = {
  id: 'large-v3-turbo-q5_0',
  label: 'Whisper large-v3-turbo Q5_0',
  filename: 'ggml-large-v3-turbo-q5_0.bin',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin?download=true',
  sizeBytes: 574_041_195,
  sha256: '394221709cd5ad1f40c46e6031ca85bce88931e6e088c188294c6d5a55ffa7e2',
} as const

const MODEL_DIRECTORY = 'models/whisper'

export async function ensureWhisperModel(
  {
    onProgress,
    signal,
  }: {
    onProgress?: (progress: ModelDownloadProgress) => void
    signal?: AbortSignal
  } = {},
) {
  const [modelPath] = await ensureModelFiles({
    directory: MODEL_DIRECTORY,
    files: [DEFAULT_WHISPER_MODEL],
    onProgress,
    signal,
  })
  return modelPath
}
