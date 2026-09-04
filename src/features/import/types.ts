import type { VideoExtension } from '../../types/media'
import type { MediaMetadata, MediaSourceOrigin, YoutubeImportQuality } from '../../types/project'
import type { YoutubeDownloadProgress, YoutubeVideoInfo } from '../../lib/youtube/types'

export type SelectedVideo = {
  name: string
  path: string
  extension: VideoExtension
  sizeBytes?: number
  metadata?: MediaMetadata
  origin?: MediaSourceOrigin
}

export type YoutubeImportRequest = {
  info: YoutubeVideoInfo
  quality: YoutubeImportQuality
}

export type YoutubeImportOptions = {
  signal: AbortSignal
  onProgress: (progress: YoutubeDownloadProgress) => void
}

export type YoutubeResolveStatus = 'idle' | 'resolving' | 'ready' | 'error'

export type VideoLoadStatus = 'checking' | 'ready' | 'error'

export type MetadataLoadStatus = 'idle' | 'checking' | 'ready' | 'error'
