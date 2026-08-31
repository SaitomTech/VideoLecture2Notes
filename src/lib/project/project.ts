import type { SelectedVideo } from '../../features/import/types'
import { PROJECT_VERSION, type CropRegion, type MediaMetadata, type MediaProject, type SlideData, type SlideDetectionResult } from '../../types/project'

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
    createdAt: now,
    updatedAt: now,
  }
}

export function updateProjectCrop(project: MediaProject, crop: CropRegion): MediaProject {
  return {
    ...project,
    crop,
    updatedAt: new Date().toISOString(),
  }
}

export function updateProjectSlideDetection(project: MediaProject, result: SlideDetectionResult, slides: SlideData[]): MediaProject {
  return {
    ...project,
    slideDetection: result,
    slides,
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
