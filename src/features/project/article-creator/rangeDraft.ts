import type { PerspectiveCorners, PerspectiveCrop } from '../../../types/project'
import type { QuadCorner } from '../../crop/components/QuadCropSelector'
import type { NormalizedCropRegion } from '../../crop/types'

export type CropMode = 'rect' | 'perspective'
export const CORNER_GRID_ORDER: QuadCorner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']

export type RangeDraft = {
  id: string
  title: string
  start: string
  end: string
  thumbnailPath?: string
  thumbnailVersion?: number
}

export type CropSnapshot = {
  start: string
  end: string
  crop: NormalizedCropRegion
  cropMode: CropMode
  cropCorners: PerspectiveCorners
  aspectRatioMode: PerspectiveCrop['aspectRatio']['mode']
  aspectRatio: number
}

export type TrimHandle = 'start' | 'end'

const RANGE_COLORS = [
  { bar: '#3caa78', soft: '#e4f5eb', border: '#18744f', text: '#10603e' },
  { bar: '#4d8fc6', soft: '#e8f2fc', border: '#2d6698', text: '#1f527e' },
  { bar: '#d98759', soft: '#fff0e8', border: '#b45a33', text: '#8f3f22' },
  { bar: '#9b72c7', soft: '#f4edfc', border: '#76509e', text: '#5c3b82' },
  { bar: '#d2a63d', soft: '#fff8df', border: '#a37b18', text: '#765711' },
] as const

export function rangeColor(index: number) {
  return RANGE_COLORS[index % RANGE_COLORS.length]
}

export function rectToCorners(region: NormalizedCropRegion): PerspectiveCorners {
  return {
    topLeft: { x: region.x, y: region.y },
    topRight: { x: region.x + region.width, y: region.y },
    bottomRight: { x: region.x + region.width, y: region.y + region.height },
    bottomLeft: { x: region.x, y: region.y + region.height },
  }
}

export function cornersToRegion(corners: PerspectiveCorners): NormalizedCropRegion {
  const points = Object.values(corners)
  const left = Math.min(...points.map((point) => point.x))
  const top = Math.min(...points.map((point) => point.y))
  const right = Math.max(...points.map((point) => point.x))
  const bottom = Math.max(...points.map((point) => point.y))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function distance(first: { x: number; y: number }, second: { x: number; y: number }) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

export function estimatedAspectRatio(corners: PerspectiveCorners) {
  const width =
    (distance(corners.topLeft, corners.topRight) +
      distance(corners.bottomLeft, corners.bottomRight)) /
    2
  const height =
    (distance(corners.topLeft, corners.bottomLeft) +
      distance(corners.topRight, corners.bottomRight)) /
    2
  return height > 0 ? width / height : 16 / 9
}

export function cloneCorners(corners: PerspectiveCorners): PerspectiveCorners {
  return {
    topLeft: { ...corners.topLeft },
    topRight: { ...corners.topRight },
    bottomRight: { ...corners.bottomRight },
    bottomLeft: { ...corners.bottomLeft },
  }
}

export function parseTime(value: string, fallback: number) {
  const trimmed = value.trim()
  if (!trimmed) return fallback
  const parts = trimmed.split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return Number.NaN
  if (parts.length === 1) return parts[0] * 1000
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000
  return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000
}

export function formatRangeInput(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatPlaybackTime(timestampMs: number) {
  const totalSeconds = Math.max(0, Math.floor(timestampMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatTrimTime(timestampMs: number) {
  const safeTimestampMs = Math.max(0, Math.round(timestampMs / 100) * 100)
  const totalSeconds = Math.floor(safeTimestampMs / 1000)
  const tenths = Math.floor((safeTimestampMs % 1000) / 100)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`
    : `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`
}
