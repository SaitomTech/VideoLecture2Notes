import { convertFileSrc } from '@tauri-apps/api/core'
import type { ReactNode, RefObject, SyntheticEvent } from 'react'
import { VideoPlayButton } from '../../../components/VideoPlaybackControls'
import type { SlideData } from '../../../types/project'
import { formatTimestamp } from '../utils'

type SlideDetectionVideoProps = {
  path: string
  videoRef: RefObject<HTMLVideoElement | null>
  activeSlide?: SlideData
  isPlaying: boolean
  onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void
  onPlay: () => void
  onPause: () => void
  onEnded: () => void
  onTimeUpdate: (event: SyntheticEvent<HTMLVideoElement>) => void
  onToggle: () => void
  children?: ReactNode
}

export function SlideDetectionVideo({
  path,
  videoRef,
  activeSlide,
  isPlaying,
  onLoadedMetadata,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  onToggle,
  children,
}: SlideDetectionVideoProps) {
  return (
    <section className="min-w-0" aria-labelledby="slide-detection-video-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="slide-detection-video-heading" className="text-[13px] font-semibold text-[#18211f]">
          動画プレビュー
        </h2>
        {activeSlide && (
          <span className="font-mono text-[10px] text-[#1d6b50]">
            Slide {String(activeSlide.index + 1).padStart(2, '0')} ·{' '}
            {formatTimestamp(activeSlide.startMs)} — {formatTimestamp(activeSlide.endMs)}
          </span>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-[12px] border border-[#b7cbc0] bg-[#0b1712] shadow-[0_14px_36px_rgba(22,54,42,0.1)]">
        <video
          ref={videoRef}
          className="block aspect-video w-full bg-[#0b1712] object-contain"
          playsInline
          preload="metadata"
          src={convertFileSrc(path)}
          aria-label="スライド検出対象の動画"
          onLoadedMetadata={onLoadedMetadata}
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
          onTimeUpdate={onTimeUpdate}
        />
      </div>

      {children && (
        <div className="mt-3 flex items-center gap-3">
          <VideoPlayButton isPlaying={isPlaying} onToggle={onToggle} />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      )}
    </section>
  )
}
