import { ArrowLeft, Check, RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { AppHeader } from '../../components/AppHeader'
import { WorkflowBar } from '../../components/WorkflowBar'
import { VideoPlaybackControls } from '../../components/VideoPlaybackControls'
import type { MediaProject, CropRegion } from '../../types/project'
import { CropSelector } from './components/CropSelector'
import type { NormalizedCropRegion } from './types'
import { normalizedToPixelCrop, pixelToNormalizedCrop } from './utils'

type CropPageProps = {
  project: MediaProject
  onBack: () => void
  onApply: (crop: CropRegion) => void | Promise<void>
  onHome: () => void
}

function formatTime(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function CropPage({ project, onBack, onApply, onHome }: CropPageProps) {
  const metadata = project.source.metadata
  const initialRegion = pixelToNormalizedCrop(project.crop, metadata)
  const savedRegionRef = useRef(initialRegion)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [region, setRegion] = useState<NormalizedCropRegion>(initialRegion)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(metadata.durationMs / 1000)
  const [isApplying, setIsApplying] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pixelRegion = normalizedToPixelCrop(region, metadata)

  const handleTogglePlayback = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      void video.play().catch((playError) => {
        console.error(playError)
        setError('動画を再生できませんでした。')
      })
    } else {
      video.pause()
    }
  }

  const handleSeek = (time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = time
    setCurrentTime(time)
  }

  const handleApply = async () => {
    setIsApplying(true)
    setNotice(null)
    setError(null)
    try {
      await onApply(pixelRegion)
      savedRegionRef.current = region
      setNotice('スライド領域を保存しました')
    } catch (applyError) {
      console.error(applyError)
      setError('スライド領域を保存できませんでした。もう一度お試しください。')
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader onHome={onHome} homeDisabled={isApplying} />
      <WorkflowBar activeStep="crop" />

      <section className="mx-auto flex w-[calc(100%-48px)] max-w-[720px] flex-1 flex-col pb-8 md:w-[calc(100%-11.6vw)]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">02 / CROP</p>
            <h1 className="mt-1 text-[27px] font-bold tracking-[-0.06em]">スライド領域を指定</h1>
            <p className="mt-1 text-xs text-[#71807b]">スライドだけが入る範囲を選択してください。</p>
          </div>
          <button
            className="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30"
            type="button"
            onClick={onBack}
          >
            <ArrowLeft size={15} strokeWidth={1.8} />
            動画を選び直す
          </button>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#b7cbc0] bg-[#fbfcfa] shadow-[0_18px_52px_rgba(22,54,42,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8e1dc] px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#18211f]" title={project.source.path}>{project.source.name}</p>
              <p className="mt-0.5 font-mono text-[10px] text-[#71807b]">{metadata.width} × {metadata.height} · {formatTime(metadata.durationMs)}</p>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#1d6b50]">CROP READY</span>
          </div>

          <div className="p-4 md:p-5">
            <div className="relative overflow-hidden rounded-[10px]" style={{ aspectRatio: `${metadata.width} / ${metadata.height}` }}>
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full bg-[#0b1712] object-contain"
                playsInline
                preload="metadata"
                src={convertFileSrc(project.source.path)}
                aria-label="Crop対象の動画"
                onLoadedMetadata={(event) => {
                  const loadedDuration = event.currentTarget.duration
                  if (Number.isFinite(loadedDuration) && loadedDuration > 0) setDuration(loadedDuration)
                }}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
              <CropSelector region={region} onChange={(nextRegion) => { setRegion(nextRegion); setNotice(null) }} />
            </div>

            <VideoPlaybackControls
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onToggle={handleTogglePlayback}
              onSeek={handleSeek}
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e0e8e3] pt-4">
              <div className="flex items-center gap-2 font-mono text-[10px] text-[#71807b]">
                <span className="text-[#9aa6a1]">範囲</span>
                <span className="rounded bg-[#edf4ef] px-2 py-1 text-[#1d6b50]">{pixelRegion.x}, {pixelRegion.y}</span>
                <span>·</span>
                <span>{pixelRegion.width} × {pixelRegion.height}px</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30"
                  type="button"
                  onClick={() => { setRegion(savedRegionRef.current); setNotice(null) }}
                >
                  <RotateCcw size={14} strokeWidth={1.8} />
                  リセット
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#d8e1dc] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5 text-xs" aria-live="polite">
              {error && <p className="text-[#b6533a]">{error}</p>}
              {!error && notice && <p className="inline-flex items-center gap-1.5 text-[#1d6b50]"><Check size={14} />{notice}</p>}
              {!error && !notice && <p className="text-[#9aa6a1]">座標は元動画のピクセル単位で保存されます。</p>}
            </div>
            <button
              className="inline-flex items-center justify-center gap-[18px] rounded-[9px] bg-[#1d6b50] px-5 py-3.5 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:-translate-y-0.5 hover:bg-[#174d3c] hover:shadow-[0_9px_20px_rgba(29,107,80,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              type="button"
              onClick={() => void handleApply()}
              disabled={isApplying}
            >
              <span>{isApplying ? '保存中…' : '保存して検出へ'}</span>
              <span className="text-[17px] font-normal leading-none" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
