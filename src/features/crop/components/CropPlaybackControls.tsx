import { RotateCcw } from 'lucide-react'
import { useCallback, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react'
import { VideoPlayButton } from '../../../components/VideoPlaybackControls'
import type { VideoTrimRange } from '../../../types/project'
import { clampTrimRange, formatTrimTime, MINIMUM_TRIM_DURATION_MS } from '../../trim/utils'

type CropPlaybackControlsProps = {
  currentTime: number
  duration: number
  isPlaying: boolean
  isApplying: boolean
  trimRange: VideoTrimRange
  onToggle: () => void
  onSeek: (time: number) => void
  onTrimChange: (range: VideoTrimRange) => void
  onTrimReset: () => void
}

type TrimHandle = 'start' | 'end'

function formatPlaybackTime(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function position(timestampMs: number, durationMs: number) {
  if (durationMs <= 0) return 0
  return Math.min(Math.max(timestampMs / durationMs, 0), 1) * 100
}

export function CropPlaybackControls({
  currentTime,
  duration,
  isPlaying,
  isApplying,
  trimRange,
  onToggle,
  onSeek,
  onTrimChange,
  onTrimReset,
}: CropPlaybackControlsProps) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0
  const durationMs = Math.max(MINIMUM_TRIM_DURATION_MS, Math.round(safeDuration * 1000))
  const safeCurrentTime = Math.min(Math.max(currentTime, 0), safeDuration)
  const safeTrimRange = clampTrimRange(trimRange, durationMs)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [draggingHandle, setDraggingHandle] = useState<TrimHandle | null>(null)

  const timestampAtClientX = useCallback(
    (clientX: number) => {
      const bounds = timelineRef.current?.getBoundingClientRect()
      if (!bounds || bounds.width === 0 || durationMs <= 0) return null
      const ratio = Math.min(Math.max((clientX - bounds.left) / bounds.width, 0), 1)
      return Math.round((ratio * durationMs) / 100) * 100
    },
    [durationMs],
  )

  const moveHandle = useCallback(
    (handle: TrimHandle, clientX: number) => {
      const timestampMs = timestampAtClientX(clientX)
      if (timestampMs === null) return

      const nextRange = clampTrimRange(
        handle === 'start'
          ? { startMs: timestampMs, endMs: safeTrimRange.endMs }
          : { startMs: safeTrimRange.startMs, endMs: timestampMs },
        durationMs,
      )
      onTrimChange(nextRange)
      onSeek((handle === 'start' ? nextRange.startMs : nextRange.endMs) / 1000)
    },
    [durationMs, onSeek, onTrimChange, safeTrimRange.endMs, safeTrimRange.startMs, timestampAtClientX],
  )

  const startHandleDrag = (event: PointerEvent<HTMLButtonElement>, handle: TrimHandle) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraggingHandle(handle)
    if (isPlaying) onToggle()
    onSeek((handle === 'start' ? safeTrimRange.startMs : safeTrimRange.endMs) / 1000)
  }

  const handleHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, handle: TrimHandle) => {
    const stepMs = event.shiftKey ? 1_000 : 100
    const currentMs = handle === 'start' ? safeTrimRange.startMs : safeTrimRange.endMs
    let nextMs: number | null = null

    if (event.key === 'ArrowLeft') nextMs = currentMs - stepMs
    if (event.key === 'ArrowRight') nextMs = currentMs + stepMs
    if (event.key === 'Home') nextMs = handle === 'start' ? 0 : safeTrimRange.startMs + MINIMUM_TRIM_DURATION_MS
    if (event.key === 'End') nextMs = handle === 'end' ? durationMs : safeTrimRange.endMs - MINIMUM_TRIM_DURATION_MS
    if (nextMs === null) return

    event.preventDefault()
    const nextRange = clampTrimRange(
      handle === 'start'
        ? { startMs: nextMs, endMs: safeTrimRange.endMs }
        : { startMs: safeTrimRange.startMs, endMs: nextMs },
      durationMs,
    )
    onTrimChange(nextRange)
    onSeek((handle === 'start' ? nextRange.startMs : nextRange.endMs) / 1000)
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[10px] border border-[#d8e1dc] bg-[#f4f7f4] px-3.5 py-3">
      <VideoPlayButton isPlaying={isPlaying} onToggle={onToggle} disabled={safeDuration === 0 || isApplying} />

      <span className="min-w-[82px] font-mono text-[10px] tabular-nums text-[#71807b]">
        {formatPlaybackTime(safeCurrentTime)} / {formatPlaybackTime(safeDuration)}
      </span>

      <div className="min-w-[220px] flex-1">
        <div
          ref={timelineRef}
          className="relative h-7 select-none touch-none"
          onPointerDown={(event) => {
            if (event.button !== 0) return
            const timestampMs = timestampAtClientX(event.clientX)
            if (timestampMs !== null) onSeek(timestampMs / 1000)
          }}
          role="group"
          aria-label="動画の再生位置とカット範囲"
        >
          <div className="absolute inset-x-0 top-3 h-2 rounded-full bg-[#d8e1dc]" />
          <div
            className="pointer-events-none absolute top-3 h-2 rounded-full bg-[#79aa93] shadow-[inset_0_0_0_1px_rgba(23,77,60,0.3)]"
            style={{
              left: `${position(safeTrimRange.startMs, durationMs)}%`,
              width: `${Math.max(0, position(safeTrimRange.endMs, durationMs) - position(safeTrimRange.startMs, durationMs))}%`,
            }}
          />
          <div
            className="pointer-events-none absolute inset-y-1 left-0 rounded-l-full bg-[#18211f]/18"
            style={{ width: `${position(safeTrimRange.startMs, durationMs)}%` }}
          />
          <div
            className="pointer-events-none absolute inset-y-1 right-0 rounded-r-full bg-[#18211f]/18"
            style={{ width: `${Math.max(0, 100 - position(safeTrimRange.endMs, durationMs))}%` }}
          />

          {(['start', 'end'] as const).map((handle) => {
            const timestampMs = handle === 'start' ? safeTrimRange.startMs : safeTrimRange.endMs
            return (
              <button
                key={handle}
                className={`absolute inset-y-[-5px] z-10 w-6 -translate-x-1/2 cursor-ew-resize rounded-md bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/40 disabled:cursor-not-allowed ${draggingHandle === handle ? 'opacity-70' : ''}`}
                style={{ left: `${position(timestampMs, durationMs)}%` }}
                type="button"
                disabled={safeDuration === 0 || isApplying}
                title={`${handle === 'start' ? '開始' : '終了'} ${formatTrimTime(timestampMs)}`}
                aria-label={`${handle === 'start' ? '開始' : '終了'}位置 ${formatTrimTime(timestampMs)}を移動`}
                onPointerDown={(event) => startHandleDrag(event, handle)}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    moveHandle(handle, event.clientX)
                  }
                }}
                onPointerUp={() => setDraggingHandle(null)}
                onPointerCancel={() => setDraggingHandle(null)}
                onKeyDown={(event) => handleHandleKeyDown(event, handle)}
              >
                {draggingHandle === handle && (
                  <span className="absolute bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#18211f] px-1.5 py-1 font-mono text-[9px] text-[#f3faf6] shadow-[0_3px_8px_rgba(22,54,42,0.2)]">
                    {formatTrimTime(timestampMs)}
                  </span>
                )}
                <span className="absolute left-1/2 top-0 h-9 w-1.5 -translate-x-1/2 rounded-full border border-[#174d3c] bg-[#f3faf6] shadow-[0_1px_3px_rgba(22,54,42,0.22)]" />
              </button>
            )
          })}

          <div
            className="pointer-events-none absolute inset-y-1 z-20 w-px bg-[#b6533a]"
            style={{ left: `${position(safeCurrentTime * 1000, durationMs)}%` }}
          />
        </div>
        <div className="flex justify-between font-mono text-[9px] text-[#9aa6a1]">
          <span>{formatTrimTime(0)}</span>
          <span className="text-[#1d6b50]">
            {formatTrimTime(safeTrimRange.startMs)} — {formatTrimTime(safeTrimRange.endMs)}
          </span>
          <span>{formatTrimTime(durationMs)}</span>
        </div>
      </div>

      <button
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-2 text-[10px] font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        onClick={onTrimReset}
        disabled={isApplying}
        title="カット範囲を全範囲に戻す"
      >
        <RotateCcw size={13} strokeWidth={1.8} />
        全範囲
      </button>
    </div>
  )
}
