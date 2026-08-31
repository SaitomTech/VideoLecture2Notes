import { ensureModelFiles, type ModelDownloadProgress } from '../models/download'

export const DEFAULT_CORRECTION_MODEL = {
  id: 'qwen3-1.7b-q8_0',
  label: 'Qwen3 1.7B Q8_0',
  totalSizeBytes: 1_834_426_016,
  files: [
    {
      filename: 'Qwen3-1.7B-Q8_0.gguf',
      url: 'https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q8_0.gguf?download=true',
      sizeBytes: 1_834_426_016,
      sha256: '061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a',
    },
  ],
} as const

const MODEL_DIRECTORY = 'models/qwen3-1.7b'

export async function ensureCorrectionModel({
  onProgress,
  signal,
}: {
  onProgress?: (progress: ModelDownloadProgress) => void
  signal?: AbortSignal
} = {}) {
  const [modelPath] = await ensureModelFiles({
    directory: MODEL_DIRECTORY,
    files: DEFAULT_CORRECTION_MODEL.files,
    onProgress,
    signal,
  })

  return { modelPath }
}
