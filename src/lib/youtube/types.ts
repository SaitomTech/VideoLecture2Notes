import type { YoutubeImportQuality } from '../../types/project'
import type { VideoFormatAdjustment } from '../../types/media'

export type YoutubeVideoInfo = {
  videoId: string
  canonicalUrl: string
  title: string
  channelTitle?: string
  thumbnailUrl?: string
  durationMs: number
}

export type YoutubeDownloadProgress = {
  stage: 'downloading' | 'checking' | 'converting' | 'saving'
  percent?: number
  speed?: string
  eta?: string
  adjustment?: VideoFormatAdjustment
}

export type YoutubeDownloadInput = {
  projectId: string
  info: YoutubeVideoInfo
  quality: YoutubeImportQuality
  signal?: AbortSignal
  onProgress?: (progress: YoutubeDownloadProgress) => void
}
