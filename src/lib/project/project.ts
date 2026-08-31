import type { SelectedVideo } from '../../features/import/types'
import { assignTranscriptToSlides } from '../pipeline/assignTranscriptToSlides'
import {
  PROJECT_VERSION,
  type ArticleDraft,
  type ArticleFormattingResult,
  type CropRegion,
  type MediaMetadata,
  type MediaProject,
  type SlideData,
  type SlideDetectionResult,
  type SlideOcrResult,
  type TranscriptCorrectionResult,
  type TranscriptionResult,
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

export function createMediaProject(video: SelectedVideo, metadata: MediaMetadata): MediaProject {
  const now = new Date().toISOString()

  return {
    version: PROJECT_VERSION,
    id: crypto.randomUUID(),
    source: {
      path: video.path,
      name: video.name,
      extension: video.extension,
      sizeBytes: video.sizeBytes,
      metadata,
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
    createdAt: now,
    updatedAt: now,
  }
}

export function updateProjectCrop(project: MediaProject, crop: CropRegion): MediaProject {
  const cropChanged =
    project.crop.x !== crop.x ||
    project.crop.y !== crop.y ||
    project.crop.width !== crop.width ||
    project.crop.height !== crop.height

  return {
    ...project,
    crop,
    ...(cropChanged
      ? {
          slides: [],
          slideDetection: undefined,
        }
      : {}),
    updatedAt: new Date().toISOString(),
  }
}

export function updateProjectSlideDetection(project: MediaProject, result: SlideDetectionResult, slides: SlideData[]): MediaProject {
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
  return {
    ...project,
    transcription,
    slides: assignTranscriptToSlides(project.slides, transcription.segments, transcription.model),
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

export function updateProjectSlideCorrection(
  project: MediaProject,
  slideId: string,
  correction: TranscriptCorrectionResult,
): MediaProject {
  return {
    ...project,
    slides: project.slides.map((slide) => {
      if (slide.id !== slideId || !slide.transcript) return slide

      return {
        ...slide,
        transcript: {
          ...slide.transcript,
          corrected: correction.corrected,
          corrections: correction.corrections,
          correctionModel: correction.model,
          correctionInputFingerprint: correction.inputFingerprint,
          articleBody: undefined,
          articleModel: undefined,
          articleInputFingerprint: undefined,
        },
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}

export function updateProjectSlideArticle(
  project: MediaProject,
  slideId: string,
  article: ArticleFormattingResult,
): MediaProject {
  return {
    ...project,
    slides: project.slides.map((slide) => {
      if (slide.id !== slideId || !slide.transcript) return slide

      return {
        ...slide,
        transcript: {
          ...slide.transcript,
          articleBody: article.body,
          articleModel: article.model,
          articleInputFingerprint: article.inputFingerprint,
        },
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}

export function updateProjectArticleDraft(project: MediaProject, draft: ArticleDraft): MediaProject {
  const title = draft.title.trim() || project.article?.title || project.source.name.replace(/\.[^.]+$/, '')
  const updatedAt = new Date().toISOString()

  return {
    ...project,
    article: { title },
    slides: project.slides.map((slide) => {
      const body = draft.bodies[slide.id]
      if (body === undefined || !slide.transcript || body === slide.transcript.articleBody) return slide

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
