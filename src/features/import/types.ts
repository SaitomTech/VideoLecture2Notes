import type { VideoExtension } from '../../types/media'

export type SelectedVideo = {
  name: string
  path: string
  extension: VideoExtension
  sizeBytes?: number
}

export type VideoLoadStatus = 'checking' | 'ready' | 'error'
