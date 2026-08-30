import { VIDEO_EXTENSIONS, type VideoExtension } from '../../types/media'

export function getFileName(path: string) {
  return path.split(/[\\/]/).pop() || path
}

export function getExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() || ''
}

export function isSupportedVideo(name: string): name is `${string}.${VideoExtension}` {
  return VIDEO_EXTENSIONS.includes(getExtension(name) as VideoExtension)
}

export function formatSize(bytes?: number) {
  if (bytes === undefined) return '解析中…'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
