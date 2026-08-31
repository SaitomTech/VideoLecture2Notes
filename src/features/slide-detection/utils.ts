import type { SlideData } from '../../types/project'

export function formatTimestamp(timestampMs: number) {
  const totalSeconds = Math.max(0, Math.floor(timestampMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function timelinePosition(timestampMs: number, durationMs: number) {
  if (durationMs <= 0) return 0
  return Math.min(Math.max(timestampMs / durationMs, 0), 1) * 100
}

export function slideDuration(slide: SlideData) {
  return Math.max(0, slide.endMs - slide.startMs)
}
