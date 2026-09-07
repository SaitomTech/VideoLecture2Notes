import type { VideoTrimRange } from '../../types/project'

export const MINIMUM_TRIM_DURATION_MS = 500

export function clampTrimRange(range: VideoTrimRange, durationMs: number): VideoTrimRange {
  const safeDurationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : MINIMUM_TRIM_DURATION_MS
  const minimumDurationMs = Math.min(MINIMUM_TRIM_DURATION_MS, safeDurationMs)
  const startMs = Math.min(
    Math.max(0, Math.round(range.startMs)),
    safeDurationMs - minimumDurationMs,
  )
  const endMs = Math.min(
    safeDurationMs,
    Math.max(startMs + minimumDurationMs, Math.round(range.endMs)),
  )
  return { startMs, endMs }
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
