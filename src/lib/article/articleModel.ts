import {
  DEFAULT_TEXT_MODEL,
  getTextModel,
  TEXT_MODELS,
  type TextModel,
  type TextModelId,
} from '../llama/textModel'

export const OPENAI_LUNA_MODEL = {
  id: 'openai:gpt-5.6-luna',
  provider: 'openai',
  apiModel: 'gpt-5.6-luna',
  label: 'GPT-5.6 Luna',
  description:
    'OpenAI APIを使う高速・低コストなクラウドモデルです。文字起こしとOCRテキストを外部送信します。',
  reasoningEffort: 'none',
} as const

export type OpenAiArticleModel = typeof OPENAI_LUNA_MODEL
export type ArticleModel =
  | { provider: 'local'; id: TextModelId; model: TextModel }
  | OpenAiArticleModel
export type ArticleModelId = TextModelId | OpenAiArticleModel['id']

export const DEFAULT_ARTICLE_MODEL_ID: ArticleModelId = DEFAULT_TEXT_MODEL.id

export const ARTICLE_MODELS: readonly ArticleModel[] = [
  ...TEXT_MODELS.map((model) => ({ provider: 'local' as const, id: model.id, model })),
  OPENAI_LUNA_MODEL,
]

export function getArticleModel(id: string | undefined): ArticleModel {
  if (id === OPENAI_LUNA_MODEL.id) return OPENAI_LUNA_MODEL
  const model = getTextModel(id)
  return { provider: 'local', id: model.id, model }
}
