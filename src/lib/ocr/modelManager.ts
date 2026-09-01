import { ensureModelFiles, type ModelDownloadProgress } from '../models/download'

export const OCR_MODELS = [
  {
    id: 'glm-ocr-q8_0',
    label: 'GLM-OCR Q8_0',
    totalSizeBytes: 1_434_837_056,
    directory: 'models/glm-ocr',
    prompt: 'Text Recognition:',
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
  },
  {
    id: 'paddleocr-vl-1.6',
    label: 'PaddleOCR-VL 1.6',
    totalSizeBytes: 1_817_539_616,
    directory: 'models/paddleocr-vl-1.6',
    prompt: 'OCR:',
    files: [
      {
        filename: 'PaddleOCR-VL-1.6-GGUF.gguf',
        url: 'https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6-GGUF/resolve/main/PaddleOCR-VL-1.6-GGUF.gguf?download=true',
        sizeBytes: 935_769_056,
        sha256: 'f3ae46ec885050acf4b3d31944431e1fd90d50664fb09126af4a3c050ba14ee8',
      },
      {
        filename: 'PaddleOCR-VL-1.6-GGUF-mmproj.gguf',
        url: 'https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6-GGUF/resolve/main/PaddleOCR-VL-1.6-GGUF-mmproj.gguf?download=true',
        sizeBytes: 881_770_560,
        sha256: '204d757d7610d9b3faab10d506d69e5b244e32bf765e2bab2d0167e65e0a058a',
      },
    ],
  },
] as const

export type OcrModel = (typeof OCR_MODELS)[number]
export type OcrModelId = OcrModel['id']

export const DEFAULT_OCR_MODEL =
  OCR_MODELS.find((model) => model.id === 'paddleocr-vl-1.6') ?? OCR_MODELS[0]

export function getOcrModel(id: string | undefined) {
  return OCR_MODELS.find((model) => model.id === id) ?? DEFAULT_OCR_MODEL
}

export type OcrModelPaths = {
  modelPath: string
  mmprojPath: string
  contextSize: number
}

export async function ensureOcrModel({
  modelId = DEFAULT_OCR_MODEL.id,
  onProgress,
  signal,
}: {
  modelId?: OcrModelId
  onProgress?: (progress: ModelDownloadProgress) => void
  signal?: AbortSignal
} = {}): Promise<OcrModelPaths> {
  const model = getOcrModel(modelId)
  const [modelPath, mmprojPath] = await ensureModelFiles({
    directory: model.directory,
    files: model.files,
    onProgress,
    signal,
  })

  return { modelPath, mmprojPath, contextSize: 16_384 }
}
