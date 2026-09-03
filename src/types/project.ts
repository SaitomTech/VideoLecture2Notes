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

export type SlideBoundary = {
  id: string
  timestampMs: number
  distance: number
  source: 'auto' | 'manual'
}

export type SlideDetectionResult = {
  sampleIntervalMs: number
  threshold: number
  framesAnalyzed: number
  boundaries: SlideBoundary[]
  detectedAt: string
}

export type TranscriptSegment = {
  startMs: number
  endMs: number
  text: string
}

export type TranscriptionResult = {
  model: string
  provider?: 'local' | 'openai' | 'apple'
  engineVersion?: string
  language?: string
  audioPath: string
  segments: TranscriptSegment[]
  transcribedAt: string
  inputFingerprint: string
}

export type SlideOcrResult = {
  rawText: string
  model: string
  provider?: 'local' | 'vision' | 'openai'
  blocks?: OcrTextBlock[]
  engineVersion?: string
  language?: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  requestId?: string
  inputFingerprint?: string
}

export type OcrTextBlock = {
  text: string
  confidence?: number
  polygon?: Array<{
    x: number
    y: number
  }>
}

export type ArticleFormattingResult = {
  body: string
  model: string
  inputFingerprint: string
  provider?: 'local' | 'openai' | 'apple'
  engineVersion?: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  requestId?: string
  generatedAt?: string
}

export type ContentProcessingResult = {
  article: ArticleFormattingResult
}

export type ArticleData = {
  title: string
}

export type ArticleDraft = {
  title: string
  bodies: Record<string, string>
}

export type SlideResultEdits = {
  ocrText: string
  transcriptRaw: string
  articleBody: string
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
  ocr?: SlideOcrResult
  transcript?: {
    raw: string
    articleBody?: string
    articleModel?: string
    articleInputFingerprint?: string
    articleProvider?: 'local' | 'openai' | 'apple'
    articleEngineVersion?: string
    articleInputTokens?: number
    articleOutputTokens?: number
    articleRequestId?: string
    articleGeneratedAt?: string
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
  slideDetection?: SlideDetectionResult
  transcription?: TranscriptionResult
  article?: ArticleData
  createdAt: string
  updatedAt: string
}
