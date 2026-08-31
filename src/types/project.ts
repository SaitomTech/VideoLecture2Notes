import type { VideoExtension } from './media'

export const PROJECT_VERSION = 1

export type MediaMetadata = {
  path: string
  durationMs: number
  width: number
  height: number
  fps?: number
  videoCodec?: string
  audioCodec?: string
}

export type MediaSource = {
  path: string
  name: string
  extension: VideoExtension
  sizeBytes?: number
  metadata: MediaMetadata
}

/** Coordinates are always expressed in the original video's pixel space. */
export type CropRegion = {
  x: number
  y: number
  width: number
  height: number
}

export type ProjectSettings = {
  slideDetection: {
    sampleIntervalMs: number
    threshold: number
  }
  transcription: boolean
  ocr: boolean
  correction: boolean
  articleFormatting: boolean
}

export type SlideData = {
  id: string
  index: number
  startMs: number
  endMs: number
  detection: {
    source: 'auto' | 'manual'
    hash?: string
    distance?: number
  }
  image: {
    representativeFramePath?: string
  }
  ocr?: {
    rawText: string
    title?: string | null
    terms?: string[]
    model: string
  }
  transcript?: {
    raw: string
    corrected?: string
    articleBody?: string
    model: string
  }
}

export type MediaProject = {
  version: number
  id: string
  source: MediaSource
  crop: CropRegion
  settings: ProjectSettings
  slides: SlideData[]
  article?: unknown
  createdAt: string
  updatedAt: string
}
