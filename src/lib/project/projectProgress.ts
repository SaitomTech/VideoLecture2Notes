import type { PersistedProject, ProjectStep, ProjectSummary } from '../../types/project'

function active(project: PersistedProject) {
  return (
    project.articles.find((article) => article.id === project.activeArticleId) ??
    project.articles[0]
  )
}

export function getProjectResumeStep(project: PersistedProject): ProjectStep {
  const article = active(project)
  if (!article) return 'detect-slides'
  if (!article.slideDetection || article.slides.length === 0) return 'detect-slides'
  if (article.slides.some((slide) => !slide.image.representativeFramePath)) return 'detect-slides'
  if (article.workflow.lastVisitedStep === 'export') return 'export'
  if (article.workflow.lastVisitedStep === 'article-review') return 'article-review'
  return 'generate-notes'
}

export function getProjectProgress(project: PersistedProject) {
  const article = active(project)
  const slides = article?.slides ?? []
  const articleTarget = slides.filter((slide) => slide.transcript?.raw.trim()).length
  return {
    slideCount: slides.length,
    ocrCompleted: slides.filter((slide) => slide.ocr?.rawText.trim()).length,
    articleCompleted: slides.filter((slide) => slide.transcript?.articleBody?.trim()).length,
    articleTarget,
  }
}

export function buildProjectSummary(project: PersistedProject): ProjectSummary {
  const video = project.videos[0]
  const article = active(project)
  const progress = getProjectProgress(project)
  return {
    projectVersion: project.version,
    id: project.id,
    title: project.title,
    sourceName: video?.media.name ?? '動画未追加',
    sourcePath: video?.media.path ?? '',
    extension: video?.media.extension ?? 'mp4',
    durationMs: video?.media.metadata.durationMs ?? 0,
    ...progress,
    videoCount: project.videos.length,
    articleCount: project.articles.length,
    thumbnailPath:
      article?.inputMedia.thumbnailPath ??
      article?.slides.find((slide) => slide.image.representativeFramePath)?.image
        .representativeFramePath,
    resumeStep: getProjectResumeStep(project),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    lastOpenedAt: article?.workflow.lastOpenedAt ?? project.updatedAt,
    health: project.videos.every((videoEntry) => Boolean(videoEntry.media.path))
      ? 'ready'
      : 'needs-repair',
  }
}
