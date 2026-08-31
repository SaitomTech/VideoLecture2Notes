import { Pause, Play } from 'lucide-react'

type CropPlaybackControlsProps = {
  currentTime: number
  duration: number
  isPlaying: boolean
  onToggle: () => void
  onSeek: (time: number) => void
}

function formatTime(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

export function CropPlaybackControls({ currentTime, duration, isPlaying, onToggle, onSeek }: CropPlaybackControlsProps) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0
  const safeCurrentTime = Math.min(Math.max(currentTime, 0), safeDuration)

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[10px] border border-[#d8e1dc] bg-[#f4f7f4] px-3.5 py-3">
      <button
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1d6b50] text-[#f3faf6] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        onClick={onToggle}
        disabled={safeDuration === 0}
        aria-label={isPlaying ? '動画を一時停止' : '動画を再生'}
      >
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>

      <span className="min-w-[82px] font-mono text-[10px] tabular-nums text-[#71807b]">
        {formatTime(safeCurrentTime)} / {formatTime(safeDuration)}
      </span>

      <input
        className="min-w-[180px] flex-1 accent-[#1d6b50]"
        type="range"
        min={0}
        max={safeDuration || 1}
        step={0.01}
        value={safeCurrentTime}
        onChange={(event) => onSeek(Number(event.currentTarget.value))}
        aria-label="動画の再生位置"
        disabled={safeDuration === 0}
      />

    </div>
  )
}
