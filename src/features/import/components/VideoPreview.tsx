import { describeVideoPlaybackError, logVideoPlaybackError } from '../../../lib/media/videoError'
import { useVideoSourceUrl } from '../../../lib/media/useVideoSourceUrl'
import type { SelectedVideo } from '../types'

type VideoPreviewProps = {
  video: SelectedVideo
  videoStatus: 'checking' | 'ready' | 'error'
  onVideoReady: () => void
  onVideoError: (message?: string) => void
}

export function VideoPreview({
  video,
  videoStatus,
  onVideoReady,
  onVideoError,
}: VideoPreviewProps) {
  const videoSource = useVideoSourceUrl(video.path)

  return (
    <div
      className={`overflow-hidden rounded-[10px] border bg-[#14231d] shadow-[0_18px_52px_rgba(22,54,42,0.07)] transition-[border-color,box-shadow] duration-200 ${videoStatus === 'error' ? 'border-[#b6533a]' : 'border-[#b7cbc0]'}`}
    >
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
