import { DEFAULT_TEXT_MODEL } from '../../lib/llama/textModel'
import { hasCurrentCorrection } from '../correction/correction'
import type { CorrectionLevel, SlideData } from '../../types/project'

const ARTICLE_PROMPT_VERSION = 'content-processing-v1'

export function articleInputFingerprint(
  slide: SlideData,
  modelId = slide.transcript?.articleModel ?? DEFAULT_TEXT_MODEL.id,
) {
  return JSON.stringify([
    slide.id,
    slide.transcript?.corrected ?? '',
    slide.transcript?.correctionInputFingerprint ?? '',
    modelId,
    ARTICLE_PROMPT_VERSION,
  ])
}

export function hasCurrentArticle(
  slide: SlideData,
  modelId?: string,
  level?: CorrectionLevel,
) {
  const articleModelId = modelId ?? slide.transcript?.articleModel ?? DEFAULT_TEXT_MODEL.id
  const correctionModelId = modelId ?? slide.transcript?.correctionModel
  const correctionLevel = level ?? slide.transcript?.correctionLevel
  return (
    Boolean(slide.transcript?.articleBody?.trim()) &&
    hasCurrentCorrection(slide, correctionModelId, correctionLevel) &&
    slide.transcript?.articleInputFingerprint === articleInputFingerprint(slide, articleModelId)
  )
}
