import type { SelectedVideo } from '../../features/import/types'
import {
  assignTranscriptToSlides,
  normalizeTranscriptSegments,
} from '../pipeline/assignTranscriptToSlides'
import {
  PROJECT_VERSION,
  type ArticleDraft,
  type ArticleSummary,
  type ContentProcessingResult,
  type CropRegion,
  type MediaMetadata,
  type MediaProject,
  type MediaSource,
  type ProjectStep,
  type SlideData,
  type SlideDetectionResult,
  type SlideOcrResult,
  type SlideResultEdits,
  type TranscriptionResult,
  type VideoTrim,
} from '../../types/project'

const DEFAULT_SETTINGS = {
  slideDetection: {
    sampleIntervalMs: 500,
    threshold: 12,
  },
  transcription: true,
  ocr: true,
  correction: true,
  articleFormatting: true,
}

export function createMediaProject(
  video: SelectedVideo,
  metadata: MediaMetadata,
  projectId = crypto.randomUUID(),
): MediaProject {
  const now = new Date().toISOString()

  return {
    version: PROJECT_VERSION,
    id: projectId,
    source: {
      path: video.path,
      name: video.name,
      extension: video.extension,
      sizeBytes: video.sizeBytes,
      metadata,
      origin: video.origin ?? { kind: 'local-file' },
    },
    crop: {
      x: 0,
      y: 0,
      width: metadata.width,
      height: metadata.height,
    },
    settings: DEFAULT_SETTINGS,
    slides: [],
    article: {
      title: video.name.replace(/\.[^.]+$/, ''),
    },
    workflow: {
      lastVisitedStep: 'crop',
      lastOpenedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  }
}

export function updateProjectWorkflow(
  project: MediaProject,
  step: ProjectStep,
  options: { cropConfirmed?: boolean } = {},
): MediaProject {
  const now = new Date().toISOString()

  return {
    ...project,
    workflow: {
      ...project.workflow,
      lastVisitedStep: step,
      ...(options.cropConfirmed ? { cropConfirmedAt: now } : {}),
    },
    updatedAt: project.updatedAt,
  }
}

export function markProjectOpened(project: MediaProject, step: ProjectStep): MediaProject {
  const now = new Date().toISOString()

  return {
    ...project,
    workflow: {
      ...project.workflow,
      lastVisitedStep: step,
      lastOpenedAt: now,
    },
    updatedAt: project.updatedAt,
  }
}

export function updateProjectSource(project: MediaProject, source: MediaSource): MediaProject {
  return {
    ...project,
    source,
    updatedAt: new Date().toISOString(),
  }
}

export function updateProjectCropAndTrim(
  project: MediaProject,
  crop: CropRegion,
  trim?: VideoTrim,
): MediaProject {
  const previousTrim = project.trim
  const trimChanged =
    previousTrim?.startMs !== trim?.startMs ||
    previousTrim?.endMs !== trim?.endMs ||
    previousTrim?.source.path !== trim?.source.path
  const cropChanged =
    project.crop.x !== crop.x ||
    project.crop.y !== crop.y ||
    project.crop.width !== crop.width ||
    project.crop.height !== crop.height
  const mediaChanged = trimChanged || cropChanged
  const now = new Date().toISOString()

  return {
    ...project,
    ...(trim ? { trim } : { trim: undefined }),
    crop,
    workflow: {
      ...project.workflow,
      cropConfirmedAt: now,
      lastVisitedStep: 'detect-slides',
      lastExportedAt: undefined,
    },
    ...(mediaChanged
      ? {
          slides: [],
          slideDetection: undefined,
        }
      : {}),
    ...(trimChanged
      ? {
          transcription: undefined,
          article: project.article ? { title: project.article.title } : undefined,
        }
      : {}),
    updatedAt: now,
  }
}

export function updateProjectSlideDetection(
  project: MediaProject,
  result: SlideDetectionResult,
  slides: SlideData[],
): MediaProject {
  const nextSlides = project.transcription
    ? assignTranscriptToSlides(slides, project.transcription.segments, project.transcription.model)
    : slides

  return {
    ...project,
    slideDetection: result,
    slides: nextSlides,
    settings: {
      ...project.settings,
      slideDetection: {
        sampleIntervalMs: result.sampleIntervalMs,
        threshold: result.threshold,
      },
    },
    updatedAt: new Date().toISOString(),
  }
}

export function updateProjectTranscription(
  project: MediaProject,
  transcription: TranscriptionResult,
): MediaProject {
  const normalizedTranscription = {
    ...transcription,
    segments: normalizeTranscriptSegments(transcription.segments),
  }
  return {
    ...project,
    transcription: normalizedTranscription,
    slides: assignTranscriptToSlides(
      project.slides,
      normalizedTranscription.segments,
      normalizedTranscription.model,
    ),
    updatedAt: new Date().toISOString(),
  }
}

export function updateProjectSlideOcr(
  project: MediaProject,
  slideId: string,
  ocr: SlideOcrResult,
): MediaProject {
  return {
    ...project,
    slides: project.slides.map((slide) => {
      if (slide.id !== slideId) return slide

      return {
        ...slide,
        ocr,
        transcript: slide.transcript
          ? {
              raw: slide.transcript.raw,
              model: slide.transcript.model,
            }
          : undefined,
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}

export function updateProjectSlideContent(
  project: MediaProject,
  slideId: string,
  result: ContentProcessingResult,
): MediaProject {
  return {
    ...project,
    slides: project.slides.map((slide) => {
      if (slide.id !== slideId || !slide.transcript) return slide

      return {
        ...slide,
        transcript: {
          raw: slide.transcript.raw,
          model: slide.transcript.model,
          articleBody: result.article.body,
          articleModel: result.article.model,
          articleInputFingerprint: result.article.inputFingerprint,
          articleProvider: result.article.provider,
          articleEngineVersion: result.article.engineVersion,
          articleInputTokens: result.article.usage?.inputTokens,
          articleOutputTokens: result.article.usage?.outputTokens,
          articleRequestId: result.article.requestId,
          articleGeneratedAt: result.article.generatedAt,
        },
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}

export function updateProjectSlideResultEdits(
  project: MediaProject,
  slideId: string,
  edits: SlideResultEdits,
): MediaProject {
  return {
    ...project,
    slides: project.slides.map((slide) => {
      if (slide.id !== slideId) return slide

      return {
        ...slide,
        ocr: slide.ocr
          ? {
              ...slide.ocr,
              rawText: edits.ocrText,
            }
          : undefined,
        transcript: slide.transcript
          ? {
              ...slide.transcript,
              raw: edits.transcriptRaw,
              articleBody: edits.articleBody,
            }
          : undefined,
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}

export function updateProjectArticleDraft(
  project: MediaProject,
  draft: ArticleDraft,
): MediaProject {
  const title =
    draft.title.trim() || project.article?.title || project.source.name.replace(/\.[^.]+$/, '')
  const updatedAt = new Date().toISOString()

  return {
    ...project,
    article: { ...project.article, title },
    slides: project.slides.map((slide) => {
      const body = draft.bodies[slide.id]
      if (body === undefined || !slide.transcript || body === slide.transcript.articleBody)
        return slide

      return {
        ...slide,
        transcript: {
          ...slide.transcript,
          articleBody: body,
        },
      }
    }),
    updatedAt,
  }
}

export function updateProjectArticleSummary(
  project: MediaProject,
  summary: ArticleSummary,
): MediaProject {
  const title = project.article?.title?.trim() || project.source.name.replace(/\.[^.]+$/, '')

  return {
    ...project,
    article: { ...project.article, title, summary },
    updatedAt: new Date().toISOString(),
  }
}
