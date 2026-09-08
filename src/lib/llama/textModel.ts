import { ensureModelFiles, type ModelDownloadProgress } from '../models/download'

export const TEXT_MODELS = [
  {
    id: 'qwen3-1.7b-q8_0',
    label: 'Qwen3 1.7B Q8_0',
    description: '軽量・高速。メモリ使用量を抑えたい場合に向いています。',
    totalSizeBytes: 1_834_426_016,
    directory: 'models/qwen3-1.7b',
    files: [
      {
        filename: 'Qwen3-1.7B-Q8_0.gguf',
        url: 'https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/resolve/90862c4b9d2787eaed51d12237eafdfe7c5f6077/Qwen3-1.7B-Q8_0.gguf?download=true',
        sizeBytes: 1_834_426_016,
        sha256: '061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a',
      },
    ],
  },
  {
    id: 'qwen3-4b-instruct-2507-q8_0',
    label: 'Qwen3-4B-Instruct-2507 Q8_0',
    description: '品質と速度のバランス型。非思考モデルで本文生成が安定します。',
    totalSizeBytes: 4_280_403_520,
    directory: 'models/qwen3-4b-instruct-2507',
    files: [
      {
        filename: 'qwen3-4b-instruct-2507-q8_0.gguf',
        url: 'https://huggingface.co/ggml-org/Qwen3-4B-Instruct-2507-Q8_0-GGUF/resolve/e6f794d/qwen3-4b-instruct-2507-q8_0.gguf?download=true',
        sizeBytes: 4_280_403_520,
        sha256: 'ae916ede1c010a26955ee8ae2e908bf8815a3f135ec860439ab924701c69d5f1',
      },
    ],
  },
  {
    id: 'qwen3-8b-q4_k_m',
    label: 'Qwen3 8B Q4_K_M',
    description: '高品質。複雑な内容や自然な日本語に強い一方、処理と初回ダウンロードは重めです。',
    totalSizeBytes: 5_027_783_488,
    directory: 'models/qwen3-8b',
    files: [
      {
        filename: 'Qwen3-8B-Q4_K_M.gguf',
        url: 'https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/7c41481/Qwen3-8B-Q4_K_M.gguf?download=true',
        sizeBytes: 5_027_783_488,
        sha256: 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785',
      },
    ],
  },
] as const

export type TextModel = (typeof TEXT_MODELS)[number]
export type TextModelId = TextModel['id']

export const DEFAULT_TEXT_MODEL = TEXT_MODELS[0]

export function getTextModel(id: string | undefined) {
  return TEXT_MODELS.find((model) => model.id === id) ?? DEFAULT_TEXT_MODEL
}

export async function ensureTextModel({
  model = DEFAULT_TEXT_MODEL,
  onProgress,
  signal,
}: {
  model?: TextModel
  onProgress?: (progress: ModelDownloadProgress) => void
  signal?: AbortSignal
} = {}) {
  const [modelPath] = await ensureModelFiles({
    directory: model.directory,
    files: model.files,
    onProgress,
    signal,
  })

  return { modelPath, contextSize: 32_768 }
}
