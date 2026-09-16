import { describeVideoPlaybackError, logVideoPlaybackError } from '../../../lib/media/videoError'
import { useVideoSourceUrl } from '../../../lib/media/useVideoSourceUrl'
import type { SelectedVideo } from '../types'

type VideoPreviewProps = {
  video: SelectedVideo
  videoStatus: 'checking' | 'ready' | 'error'
  isDragging: boolean
  isSelecting: boolean
  onChoose: () => void | Promise<void>
  onVideoReady: () => void
  onVideoError: (message?: string) => void
}

export function VideoPreview({
  video,
  videoStatus,
  isDragging,
  isSelecting,
  onChoose,
  onVideoReady,
  onVideoError,
}: VideoPreviewProps) {
  const videoSource = useVideoSourceUrl(video.path)

  return (
    <div
      className={`overflow-hidden rounded-[18px] border bg-[#14231d] shadow-[0_18px_52px_rgba(22,54,42,0.07)] transition-[border-color,box-shadow] duration-200 ${videoStatus === 'error' ? 'border-[#b6533a]' : isDragging ? 'border-[#1d6b50] shadow-[0_22px_70px_rgba(22,54,42,0.14)]' : 'border-[#b7cbc0]'}`}
    >
      <div className="flex justify-end border-b border-[#d8e1dc] bg-[#fbfcfa] px-4 py-2.5">
        <button
          className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#1d6b50] transition hover:bg-[#e2eee8] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => void onChoose()}
          disabled={isSelecting}
        >
          {isSelecting ? '選択中…' : '別の動画を選択'}
        </button>
      </div>

      <video
        key={`${video.path}:${videoSource.src ?? 'loading'}`}
        className="block aspect-video w-full bg-[#0b1712] object-contain"
        controls
        playsInline
        preload="auto"
        src={videoSource.src ?? undefined}
        aria-label="動画プレビュー"
        onCanPlay={onVideoReady}
        onError={(event) => {
          const video = event.currentTarget
          logVideoPlaybackError(video)
          onVideoError(describeVideoPlaybackError(video))
        }}
      />
    </div>
  )
}
