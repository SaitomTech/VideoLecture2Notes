import { DEFAULT_TEXT_MODEL } from '../../lib/llama/textModel'
import { DEFAULT_CORRECTION_LEVEL } from '../correction/correction'
import type { CorrectionLevel, SlideData } from '../../types/project'

const ARTICLE_PROMPT_VERSION = 'content-processing-v6-style-aware-level-contract'

export function articleInputFingerprint(
  slide: SlideData,
  modelId = slide.transcript?.articleModel ?? DEFAULT_TEXT_MODEL.id,
  level = slide.transcript?.correctionLevel ?? DEFAULT_CORRECTION_LEVEL,
) {
  return JSON.stringify([
    slide.id,
    slide.transcript?.raw ?? '',
    slide.ocr?.rawText ?? '',
    modelId,
    level,
    ARTICLE_PROMPT_VERSION,
  ])
}

export function hasCurrentArticle(
  slide: SlideData,
  modelId?: string,
  level?: CorrectionLevel,
) {
  const articleModelId = modelId ?? slide.transcript?.articleModel ?? DEFAULT_TEXT_MODEL.id
  const articleLevel = level ?? slide.transcript?.correctionLevel ?? DEFAULT_CORRECTION_LEVEL
  return (
    Boolean(slide.transcript?.articleBody?.trim()) &&
    slide.transcript?.articleInputFingerprint ===
      articleInputFingerprint(slide, articleModelId, articleLevel)
  )
}
