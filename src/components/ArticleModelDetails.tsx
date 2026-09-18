import { OpenAiApiKeySettings } from './OpenAiApiKeySettings'
import { ModelDescription } from './ModelDescription'
import { OPENAI_LUNA_MODEL, type ArticleModel } from '../lib/article/articleModel'

function formatModelSize(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(2)}GB`
}

function assertNever(value: never): never {
  throw new Error(`未対応の本文生成プロバイダーです: ${JSON.stringify(value)}`)
}

export function ArticleModelDetails({
  model,
  disabled,
}: {
  model: ArticleModel
  disabled: boolean
}) {
  switch (model.provider) {
    case 'apple':
      return (
        <ModelDescription
          description={model.description}
          annotation="文字起こしとOCRテキストはMac内で処理します。macOS 26以降、対応するApple Silicon MacでApple Intelligenceを有効にしてください。"
        />
      )
    case 'local':
      return (
        <ModelDescription
          description={model.model.description}
          annotation={`初回のみモデルをダウンロードします（約${formatModelSize(model.model.totalSizeBytes)}）。`}
        />
      )
    case 'openai':
      return (
        <ModelDescription
          description={model.description}
          annotation="文字起こしとOCRテキストを外部送信します。動画・音声・画像は送信しません。Slide単位で最大8件を並列処理します。"
        >
          <OpenAiApiKeySettings
            verificationModel={OPENAI_LUNA_MODEL.apiModel}
            verificationLabel={OPENAI_LUNA_MODEL.label}
            billingNote="API利用料は、入力したAPIキーに紐づくOpenAI APIの請求先に発生します。"
            disabled={disabled}
          />
        </ModelDescription>
      )
    default:
      return assertNever(model)
  }
}
