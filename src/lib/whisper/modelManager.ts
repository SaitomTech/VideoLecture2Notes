import { ensureModelFiles, type ModelDownloadProgress, type ModelFile } from '../models/download'

const WHISPER_CPP_REVISION = '5359861c739e955e79d9a303bcbc70fb988958b1'
const WHISPER_CPP_MODEL_BASE_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/${WHISPER_CPP_REVISION}`
const KOTOBA_MODEL_REVISION = 'e3a0cf6a62b95911703cfb97d819292e058f12c3'
const KOTOBA_MODEL_BASE_URL = `https://huggingface.co/kotoba-tech/kotoba-whisper-v2.0-ggml/resolve/${KOTOBA_MODEL_REVISION}`

function createModelFile(
  baseUrl: string,
  filename: string,
  sizeBytes: number,
  sha256: string,
): ModelFile {
  return {
    filename,
    url: `${baseUrl}/${filename}?download=true`,
    sizeBytes,
    sha256,
  }
}

export const WHISPER_MODELS = [
  {
    id: 'large-v3-turbo-q5_0',
    label: 'Whisper large-v3-turbo Q5_0',
    accuracy: '高',
    speed: '高速',
    languageLabel: '多言語（日本語対応）',
    languageSupport: 'multilingual',
    description: '現在の標準モデル。速度と精度のバランスに優れています。',
    totalSizeBytes: 574_041_195,
    files: [
      createModelFile(
        WHISPER_CPP_MODEL_BASE_URL,
        'ggml-large-v3-turbo-q5_0.bin',
        574_041_195,
        '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2',
      ),
    ],
  },
  {
    id: 'large-v3-q5_0',
    label: 'Whisper large-v3 Q5_0',
    accuracy: '最高級',
    speed: '低速',
    languageLabel: '多言語（日本語対応）',
    languageSupport: 'multilingual',
    description: 'turboより大きなデコーダーを使う高精度版。処理時間は長くなります。',
    totalSizeBytes: 1_080_732_091,
    files: [
      createModelFile(
        WHISPER_CPP_MODEL_BASE_URL,
        'ggml-large-v3-q5_0.bin',
        1_080_732_091,
        'd75795ecff3f83b5faa89d1900604ad8c780abd5739fae406de19f23ecd98ad1',
      ),
    ],
  },
  {
    id: 'large-v3',
    label: 'Whisper large-v3',
    accuracy: '最高',
    speed: '最遅',
    languageLabel: '多言語（日本語対応）',
    languageSupport: 'multilingual',
    description: '非量子化の最大モデル。精度を最優先する場合の候補です。',
    totalSizeBytes: 3_095_033_483,
    files: [
      createModelFile(
        WHISPER_CPP_MODEL_BASE_URL,
        'ggml-large-v3.bin',
        3_095_033_483,
        '64d182b440b98d5203c4f9bd541544d84c605196c4f7b845dfa11fb23594d1e2',
      ),
    ],
  },
  {
    id: 'large-v3-turbo',
    label: 'Whisper large-v3-turbo',
    accuracy: '高',
    speed: '高速',
    languageLabel: '多言語（日本語対応）',
    languageSupport: 'multilingual',
    description: '現行turboの非量子化版。Q5_0より容量は増えますが品質寄りです。',
    totalSizeBytes: 1_624_555_275,
    files: [
      createModelFile(
        WHISPER_CPP_MODEL_BASE_URL,
        'ggml-large-v3-turbo.bin',
        1_624_555_275,
        '1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69',
      ),
    ],
  },
  {
    id: 'large-v3-turbo-q8_0',
    label: 'Whisper large-v3-turbo Q8_0',
    accuracy: '高+',
    speed: '高速',
    languageLabel: '多言語（日本語対応）',
    languageSupport: 'multilingual',
    description: 'Q5_0より量子化を弱めたturbo。容量と品質のバランスを少し品質寄りにします。',
    totalSizeBytes: 874_188_075,
    files: [
      createModelFile(
        WHISPER_CPP_MODEL_BASE_URL,
        'ggml-large-v3-turbo-q8_0.bin',
        874_188_075,
        '317eb69c11673c9de1e1f0d459b253999804ec71ac4c23c17ecf5fbe24e259a1',
      ),
    ],
  },
  {
    id: 'medium-q5_0',
    label: 'Whisper medium Q5_0',
    accuracy: '中〜高',
    speed: '中速',
    languageLabel: '多言語（日本語対応）',
    languageSupport: 'multilingual',
    description: '大モデルより軽く、small以下より精度を保ちやすい実用的な中間モデルです。',
    totalSizeBytes: 539_212_467,
    files: [
      createModelFile(
        WHISPER_CPP_MODEL_BASE_URL,
        'ggml-medium-q5_0.bin',
        539_212_467,
        '19fea4b380c3a618ec4723c3eef2eb785ffba0d0538cf43f8f235e7b3b34220f',
      ),
    ],
  },
  {
    id: 'small-q5_1',
    label: 'Whisper small Q5_1',
    accuracy: '中',
    speed: '高速',
    languageLabel: '多言語（日本語対応）',
    languageSupport: 'multilingual',
    description: '軽量で速いモデル。音声が明瞭な講義や試行用に向いています。',
    totalSizeBytes: 190_085_487,
    files: [
      createModelFile(
        WHISPER_CPP_MODEL_BASE_URL,
        'ggml-small-q5_1.bin',
        190_085_487,
        'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb',
      ),
    ],
  },
  {
    id: 'base-q5_1',
    label: 'Whisper base Q5_1',
    accuracy: '低',
    speed: '非常に高速',
    languageLabel: '多言語（日本語対応）',
    languageSupport: 'multilingual',
    description: '小容量・高速ですが、長い日本語講義では誤認識が増えやすいモデルです。',
    totalSizeBytes: 59_707_625,
    files: [
      createModelFile(
        WHISPER_CPP_MODEL_BASE_URL,
        'ggml-base-q5_1.bin',
        59_707_625,
        '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898',
      ),
    ],
  },
  {
    id: 'tiny-q5_1',
    label: 'Whisper tiny Q5_1',
    accuracy: '最低',
    speed: '最速',
    languageLabel: '多言語（日本語対応）',
    languageSupport: 'multilingual',
    description: '最小・最速クラス。下書きや動作確認向けで、講義ノート用途には非推奨です。',
    totalSizeBytes: 32_152_673,
    files: [
      createModelFile(
        WHISPER_CPP_MODEL_BASE_URL,
        'ggml-tiny-q5_1.bin',
        32_152_673,
        '818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7',
      ),
    ],
  },
  {
    id: 'kotoba-whisper-v2-q5_0',
    label: 'Kotoba-Whisper v2.0 Q5_0',
    accuracy: '日本語向け高',
    speed: '高速',
    languageLabel: '日本語専用',
    languageSupport: 'ja',
    description: '日本語音声向けに調整されたWhisper派生モデル。日本語講義で試す価値があります。',
    totalSizeBytes: 537_819_875,
    files: [
      createModelFile(
        KOTOBA_MODEL_BASE_URL,
        'ggml-kotoba-whisper-v2.0-q5_0.bin',
        537_819_875,
        '4a3b92192b5d3578ff854a5876213e2e27af0c2d357492c2d14271e82c303658',
      ),
    ],
  },
] as const

export type WhisperModel = (typeof WHISPER_MODELS)[number]
export type WhisperModelId = WhisperModel['id']

export const DEFAULT_WHISPER_MODEL =
  WHISPER_MODELS.find((model) => model.id === 'large-v3-turbo-q5_0') ?? WHISPER_MODELS[0]

export function getWhisperModel(id: string | undefined) {
  return WHISPER_MODELS.find((model) => model.id === id) ?? DEFAULT_WHISPER_MODEL
}

const MODEL_DIRECTORY = 'models/whisper'

export async function ensureWhisperModel({
  modelId = DEFAULT_WHISPER_MODEL.id,
  onProgress,
  signal,
}: {
  modelId?: WhisperModelId
  onProgress?: (progress: ModelDownloadProgress) => void
  signal?: AbortSignal
} = {}) {
  const model = getWhisperModel(modelId)
  const [modelPath] = await ensureModelFiles({
    directory: MODEL_DIRECTORY,
    files: model.files,
    onProgress,
    signal,
  })
  return modelPath
}
