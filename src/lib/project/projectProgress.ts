import { hasCurrentArticle } from '../../features/article/article'
import type { MediaProject, ProjectHealth, ProjectStep, ProjectSummary } from '../../types/project'

export function getProjectTitle(project: MediaProject) {
  return project.article?.title?.trim() || project.source.name.replace(/\.[^.]+$/, '')
}

export function getProjectResumeStep(project: MediaProject): ProjectStep {
  if (!project.workflow.cropConfirmedAt) return 'crop'
  if (!project.slideDetection || project.slides.length === 0) return 'detect-slides'
  if (project.slides.some((slide) => !slide.image.representativeFramePath)) return 'detect-slides'

  if (project.workflow.lastVisitedStep === 'export') return 'export'
  if (project.workflow.lastVisitedStep === 'article-review') return 'article-review'

  const articleTarget = project.slides.filter((slide) => slide.transcript?.raw.trim())
  const articleCompleted = articleTarget.filter((slide) => hasCurrentArticle(slide)).length
  if (articleTarget.length === 0 || articleCompleted < articleTarget.length) return 'generate-notes'

  return 'article-review'
}

export function getProjectProgress(project: MediaProject) {
  const articleTarget = project.slides.filter((slide) => slide.transcript?.raw.trim())

  return {
    ocrCompleted: project.slides.filter((slide) => slide.ocr?.rawText.trim()).length,
    articleCompleted: articleTarget.filter((slide) => hasCurrentArticle(slide)).length,
    articleTarget: articleTarget.length,
  }
}

export function buildProjectSummary(
  project: MediaProject,
  health: ProjectHealth = 'ready',
): ProjectSummary {
  const progress = getProjectProgress(project)

  return {
    projectVersion: project.version,
    id: project.id,
    title: getProjectTitle(project),
    sourceName: project.source.name,
    sourcePath: project.source.path,
    extension: project.source.extension,
    durationMs: project.source.metadata.durationMs,
    slideCount: project.slides.length,
    ...progress,
    thumbnailPath: project.slides.find((slide) => slide.image.representativeFramePath)?.image
      .representativeFramePath,
    resumeStep: getProjectResumeStep(project),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    lastOpenedAt: project.workflow.lastOpenedAt,
    health,
  }
}
