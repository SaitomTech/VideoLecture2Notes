import { Link2, Link2Off } from 'lucide-react'
import { useCallback, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import type { SlideBoundary, SlideData } from '../../../types/project'
import { SlideDetectionTimeline } from './SlideDetectionTimeline'
import { SlideDetectionVideo } from './SlideDetectionVideo'
import { SlideSegmentList } from './SlideSegmentList'

type SlideDetectionResultPanelProps = {
  path: string
  boundaries: SlideBoundary[]
  slides: SlideData[]
  onChange: (boundaries: SlideBoundary[]) => void
}

export function SlideDetectionResultPanel({
  path,
  boundaries,
  slides,
  onChange,
}: SlideDetectionResultPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [durationMs, setDurationMs] = useState(() => slides.at(-1)?.endMs ?? 0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [followPlayback, setFollowPlayback] = useState(true)
  const activeSlideIndex = useMemo(
    () =>
      slides.findIndex(
        (slide, index) =>
          currentTimeMs >= slide.startMs &&
          (currentTimeMs < slide.endMs || index === slides.length - 1),
      ),
    [currentTimeMs, slides],
  )
  const activeSlide = activeSlideIndex >= 0 ? slides[activeSlideIndex] : undefined

  const handleLoadedMetadata = (event: SyntheticEvent<HTMLVideoElement>) => {
    const loadedDurationMs = event.currentTarget.duration * 1000
    if (Number.isFinite(loadedDurationMs) && loadedDurationMs > 0) setDurationMs(loadedDurationMs)
  }

  const handleTimeUpdate = (event: SyntheticEvent<HTMLVideoElement>) => {
    setCurrentTimeMs(event.currentTarget.currentTime * 1000)
  }

  const handleTogglePlayback = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play().catch((error) => console.error(error))
    else video.pause()
  }, [])

  const handleSeek = useCallback((timestampMs: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = timestampMs / 1000
    setCurrentTimeMs(timestampMs)
  }, [])

  const handleSelectSlide = useCallback(
    (index: number) => {
      const slide = slides[index]
      if (slide) handleSeek(slide.startMs)
    },
    [handleSeek, slides],
  )

  const handleRemoveBoundary = useCallback(
    (boundaryId: string) => {
      onChange(boundaries.filter((boundary) => boundary.id !== boundaryId))
    },
    [boundaries, onChange],
  )

  return (
    <section
      className="mt-10 border-t border-[#d8e1dc] pt-8"
      aria-labelledby="analysis-result-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="analysis-result-heading" className="text-[21px] font-bold tracking-[-0.05em]">
          解析結果
        </h2>
        <button
          className={`inline-flex items-center gap-1.5 rounded-[9px] border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 ${followPlayback ? 'border-[#b7cbc0] bg-[#e2eee8] text-[#1d6b50] hover:border-[#1d6b50]' : 'border-[#d8e1dc] bg-[#fbfcfa] text-[#71807b] hover:border-[#b7cbc0] hover:text-[#1d6b50]'}`}
          type="button"
          aria-pressed={followPlayback}
          aria-label={
            followPlayback ? '動画再生位置への追従をオフにする' : '動画再生位置への追従をオンにする'
          }
          onClick={() => setFollowPlayback((current) => !current)}
        >
          {followPlayback ? <Link2 size={14} /> : <Link2Off size={14} />}
          {followPlayback ? '追従中' : '追従オフ'}
        </button>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)] lg:items-start">
        <SlideDetectionVideo
          path={path}
          videoRef={videoRef}
          activeSlide={activeSlide}
          isPlaying={isPlaying}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onToggle={handleTogglePlayback}
        >
          <SlideDetectionTimeline
            boundaries={boundaries}
            durationMs={durationMs}
            slides={slides}
            currentTimeMs={currentTimeMs}
            activeSlideIndex={activeSlideIndex}
            onChange={onChange}
            onSeek={handleSeek}
          />
        </SlideDetectionVideo>

        <SlideSegmentList
          boundaries={boundaries}
          slides={slides}
          followPlayback={followPlayback}
          activeSlideIndex={activeSlideIndex}
          onSelectSlide={handleSelectSlide}
          onRemoveBoundary={handleRemoveBoundary}
        />
      </div>
    </section>
  )
}
