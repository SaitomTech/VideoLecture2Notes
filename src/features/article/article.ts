import { DEFAULT_ARTICLE_MODEL_ID } from '../../lib/article/articleModel'
import type { SlideData } from '../../types/project'

const ARTICLE_PROMPT_VERSION = 'content-processing-v14-preserve-all-content'

export function articleInputFingerprint(
  slide: SlideData,
  modelId = slide.transcript?.articleModel ?? DEFAULT_ARTICLE_MODEL_ID,
) {
  return JSON.stringify([
    slide.id,
    slide.transcript?.raw ?? '',
    slide.ocr?.rawText ?? '',
    modelId,
    ARTICLE_PROMPT_VERSION,
  ])
}

export function hasCurrentArticle(slide: SlideData, modelId?: string) {
  const articleModelId = modelId ?? slide.transcript?.articleModel ?? DEFAULT_ARTICLE_MODEL_ID
  return (
    Boolean(slide.transcript?.articleBody?.trim()) &&
    slide.transcript?.articleInputFingerprint === articleInputFingerprint(slide, articleModelId)
  )
}
