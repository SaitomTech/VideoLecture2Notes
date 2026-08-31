import { ensureModelFiles, type ModelDownloadProgress } from '../models/download'

export const DEFAULT_OCR_MODEL = {
  id: 'glm-ocr-q8_0',
  label: 'GLM-OCR Q8_0',
  totalSizeBytes: 1_434_837_056,
  files: [
    {
      filename: 'GLM-OCR-Q8_0.gguf',
      url: 'https://huggingface.co/ggml-org/GLM-OCR-GGUF/resolve/main/GLM-OCR-Q8_0.gguf?download=true',
      sizeBytes: 950_433_408,
      sha256: '45bc244a6446aff850521dc41f18bc8d7105ad5f0c2c8c28af04e7cc4f4d50b1',
    },
    {
      filename: 'mmproj-GLM-OCR-Q8_0.gguf',
      url: 'https://huggingface.co/ggml-org/GLM-OCR-GGUF/resolve/main/mmproj-GLM-OCR-Q8_0.gguf?download=true',
      sizeBytes: 484_403_648,
      sha256: '9c4b58e33e316ed142eb5dcb41abec3844d3e6e5dc361ffb782c3fa9d175141f',
    },
  ],
} as const

const MODEL_DIRECTORY = 'models/glm-ocr'

export type OcrModelPaths = {
  modelPath: string
  mmprojPath: string
}

export async function ensureOcrModel({
  onProgress,
  signal,
}: {
  onProgress?: (progress: ModelDownloadProgress) => void
  signal?: AbortSignal
} = {}): Promise<OcrModelPaths> {
  const [modelPath, mmprojPath] = await ensureModelFiles({
    directory: MODEL_DIRECTORY,
    files: DEFAULT_OCR_MODEL.files,
    onProgress,
    signal,
  })

  return { modelPath, mmprojPath }
}
