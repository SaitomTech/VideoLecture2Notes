import type { YoutubeImportQuality } from '../../types/project'
import type { VideoFormatAdjustment } from '../../types/media'

export type YoutubeVideoInfo = {
  originalUrl: string
  videoId: string
  canonicalUrl: string
  title: string
  channelTitle?: string
  thumbnailUrl?: string
  durationMs: number
}

export type YoutubeDownloadStage = 'downloading' | 'checking' | 'converting' | 'saving'

export type YoutubeDownloadProgress = {
  percent?: number
  speed?: string
  eta?: string
  stage: YoutubeDownloadStage
  adjustment?: VideoFormatAdjustment
}

export type YoutubeDownloadInput = {
  projectId: string
  info: YoutubeVideoInfo
  quality: YoutubeImportQuality
  signal?: AbortSignal
  onProgress?: (progress: YoutubeDownloadProgress) => void
}
