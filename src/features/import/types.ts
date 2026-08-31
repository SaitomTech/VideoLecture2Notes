import type { VideoExtension } from '../../types/media'
import type { MediaMetadata } from '../../types/project'

export type SelectedVideo = {
  name: string
  path: string
  extension: VideoExtension
  sizeBytes?: number
  metadata?: MediaMetadata
}

export type VideoLoadStatus = 'checking' | 'ready' | 'error'

export type MetadataLoadStatus = 'idle' | 'checking' | 'ready' | 'error'
