import { FileVideo } from 'lucide-react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { useState } from 'react'
import { useVideoSourceUrl } from '../../../lib/media/useVideoSourceUrl'
import type { ProjectVideo } from '../../../types/project'

export function VideoThumbnail({
  video,
  thumbnailPath,
  thumbnailVersion,
}: {
  video: ProjectVideo
  thumbnailPath?: string
  thumbnailVersion?: number
}) {
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null)
  const source = useVideoSourceUrl(video.media.path)
  const youtubeThumbnail =
    video.media.origin?.kind === 'youtube' ? video.media.origin.thumbnailUrl : undefined
  const localThumbnail = thumbnailPath
    ? `${convertFileSrc(thumbnailPath)}?v=${thumbnailVersion ?? 0}`
    : video.media.thumbnailPath
      ? convertFileSrc(video.media.thumbnailPath)
      : null
  const usableLocalThumbnail =
    localThumbnail && localThumbnail !== failedThumbnail ? localThumbnail : null
  const usableYoutubeThumbnail =
    youtubeThumbnail && youtubeThumbnail !== failedThumbnail ? youtubeThumbnail : null
  return (
    <div className="h-14 w-24 shrink-0 overflow-hidden rounded-[7px] border border-[#d8e1dc] bg-[#e8f2ec]">
      {usableLocalThumbnail ? (
        <img
          className="h-full w-full object-cover"
          src={usableLocalThumbnail}
          alt=""
          onError={() => setFailedThumbnail(usableLocalThumbnail)}
        />
      ) : usableYoutubeThumbnail ? (
        <img
          className="h-full w-full object-cover"
          src={usableYoutubeThumbnail}
          alt=""
          onError={() => setFailedThumbnail(usableYoutubeThumbnail)}
        />
      ) : source.src ? (
        <video
          className="h-full w-full object-cover"
          src={source.src}
          autoPlay
          muted
          playsInline
          preload="auto"
          onLoadedData={(event) => event.currentTarget.pause()}
          aria-label={`${video.title} サムネイル`}
        />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <FileVideo className="text-[#8da79a]" size={20} />
        </div>
      )}
    </div>
  )
}
