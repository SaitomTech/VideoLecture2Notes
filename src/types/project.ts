import type { VideoExtension } from './media'

export const PROJECT_VERSION = 5

export type ProjectStep = 'crop' | 'detect-slides' | 'generate-notes' | 'article-review' | 'export'

export type ProjectWorkflow = {
  cropConfirmedAt?: string
  lastVisitedStep: ProjectStep
  lastOpenedAt: string
  lastExportedAt?: string
}

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
  id: string
  startMs: number
  endMs: number
  text: string
}

export type TranscriptUnit = {
  id: string
  sourceSegmentId: string
  startMs: number
  endMs: number
  text: string
  textStart: number
  textEnd: number
  timingQuality: 'source' | 'estimated'
}

export type TranscriptPlacement = {
  unitId: string
  slideId: string
  method: 'time' | 'semantic' | 'manual'
  confidence?: number
  reason?: string
}

export type TranscriptAlignmentSuggestion = {
  unitId: string
  fromSlideId: string
  toSlideId: string
  confidence: number
  reason?: string
  status: 'pending' | 'auto-applied' | 'accepted' | 'reverted'
}

export type TranscriptAlignment = {
  version: 1
  units: TranscriptUnit[]
  placements: TranscriptPlacement[]
  suggestions: TranscriptAlignmentSuggestion[]
  model: string
  inputFingerprint: string
  alignedAt: string
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

export type ArticleSummary = {
  overview: string
  mainMessage: string
  keyPoints: string[]
  keywords: string[]
  model: string
  inputFingerprint: string
}

export type ContentProcessingResult = {
  article: ArticleFormattingResult
}

export type ArticleData = {
  title: string
  summary?: ArticleSummary
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

export type ProjectHealth = 'ready' | 'source-missing' | 'needs-repair'

export type ProjectSummary = {
  projectVersion: number
  id: string
  title: string
  sourceName: string
  sourcePath: string
  extension: VideoExtension
  durationMs: number
  slideCount: number
  ocrCompleted: number
  articleCompleted: number
  articleTarget: number
  thumbnailPath?: string
  resumeStep: ProjectStep
  createdAt: string
  updatedAt: string
  lastOpenedAt: string
  health: ProjectHealth
}

export type ProjectListEntry =
  | { kind: 'project'; summary: ProjectSummary }
  | { kind: 'invalid'; id: string; error: string }

export type ProjectOpenResult =
  | { kind: 'ready'; project: MediaProject; step: ProjectStep }
  | { kind: 'source-missing'; project: MediaProject }
  | { kind: 'invalid'; message: string }

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
    segments: TranscriptUnit[]
    alignmentMethod: 'time' | 'semantic' | 'manual'
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
  transcriptAlignment?: TranscriptAlignment
  article?: ArticleData
  workflow: ProjectWorkflow
  createdAt: string
  updatedAt: string
}
