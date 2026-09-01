import { DEFAULT_TEXT_MODEL } from '../../lib/llama/textModel'
import type { SlideData } from '../../types/project'

const ARTICLE_PROMPT_VERSION = 'content-processing-v9-server-reasoning-off'

export function articleInputFingerprint(
  slide: SlideData,
  modelId = slide.transcript?.articleModel ?? DEFAULT_TEXT_MODEL.id,
) {
  return JSON.stringify([
    slide.id,
    slide.transcript?.raw ?? '',
    slide.ocr?.rawText ?? '',
    modelId,
    ARTICLE_PROMPT_VERSION,
  ])
}

export function hasCurrentArticle(
  slide: SlideData,
  modelId?: string,
) {
  const articleModelId = modelId ?? slide.transcript?.articleModel ?? DEFAULT_TEXT_MODEL.id
  return (
    Boolean(slide.transcript?.articleBody?.trim()) &&
    slide.transcript?.articleInputFingerprint ===
      articleInputFingerprint(slide, articleModelId)
  )
}
