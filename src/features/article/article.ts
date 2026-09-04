import { DEFAULT_ARTICLE_MODEL_ID } from '../../lib/article/articleModel'
import type { MediaProject, SlideData } from '../../types/project'

const ARTICLE_PROMPT_VERSION = 'content-processing-v14-preserve-all-content'
const ARTICLE_SUMMARY_PROMPT_VERSION = 'article-summary-v2-talk-lecture-core-fields'

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

export function articleSummaryInput(project: MediaProject) {
  return project.slides
    .flatMap((slide) => {
      const body = slide.transcript?.articleBody?.trim()
      return body
        ? [
            `<SLIDE ${String(slide.index + 1).padStart(2, '0')} ARTICLE BODY>\n${body}\n</SLIDE ARTICLE BODY>`,
          ]
        : []
    })
    .join('\n\n')
}

export function articleSummaryInputFingerprint(
  project: MediaProject,
  modelId = project.article?.summary?.model ?? DEFAULT_ARTICLE_MODEL_ID,
) {
  return JSON.stringify([
    project.slides.map((slide) => [slide.id, slide.transcript?.articleBody ?? '']),
    modelId,
    ARTICLE_SUMMARY_PROMPT_VERSION,
  ])
}

export function hasCurrentArticleSummary(
  project: MediaProject,
  modelId = project.article?.summary?.model ?? DEFAULT_ARTICLE_MODEL_ID,
) {
  const summary = project.article?.summary
  return Boolean(
    summary?.overview.trim() &&
      summary.mainMessage.trim() &&
      summary.keyPoints.length > 0 &&
      summary.keywords.length > 0 &&
      summary.inputFingerprint === articleSummaryInputFingerprint(project, modelId),
  )
}
