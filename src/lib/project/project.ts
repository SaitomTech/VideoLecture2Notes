import type { SelectedVideo } from '../../features/import/types'
import { assignTranscriptToSlides } from '../pipeline/assignTranscriptToSlides'
import {
  PROJECT_VERSION,
  type ArticleDraft,
  type ContentProcessingResult,
  type CropRegion,
  type MediaMetadata,
  type MediaProject,
  type SlideData,
  type SlideDetectionResult,
  type SlideOcrResult,
  type SlideResultEdits,
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
    article: { title },
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
