import { ArrowLeft, Check, RotateCcw, ScanLine } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { AppHeader } from '../../components/AppHeader'
import { WorkflowBar } from '../../components/WorkflowBar'
import type { WorkflowStep } from '../../lib/workflow'
import { detectAutomaticCrop, type AutoCropProgress } from './autoCrop'
import type { CropRegion, MediaProject, VideoTrimRange } from '../../types/project'
import { getActiveMediaSource } from '../../types/project'
import { CropPlaybackControls } from './components/CropPlaybackControls'
import { CropSelector } from './components/CropSelector'
import { clampTrimRange, MINIMUM_TRIM_DURATION_MS } from '../trim/utils'
import type { NormalizedCropRegion } from './types'
import { normalizedToPixelCrop, pixelToNormalizedCrop } from './utils'

type CropPageProps = {
  project: MediaProject
  onBack: () => void
  onApply: (value: { crop: CropRegion; trim: VideoTrimRange }) => void | Promise<void>
  onHome: () => void
  maxReachedStep: WorkflowStep
  onStepClick: (step: WorkflowStep) => void
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

export function CropPage({
  project,
  onBack,
  onApply,
  onHome,
  maxReachedStep,
  onStepClick,
}: CropPageProps) {
  const source = project.source
  const activeSource = getActiveMediaSource(project)
  const metadata = source.metadata
  const initialRegion = pixelToNormalizedCrop(project.crop, metadata)
  const initialTrimRange = clampTrimRange(
    project.trim
      ? { startMs: project.trim.startMs, endMs: project.trim.endMs }
      : { startMs: 0, endMs: metadata.durationMs },
    metadata.durationMs,
  )
  const savedRegionRef = useRef(initialRegion)
  const savedTrimRangeRef = useRef(initialTrimRange)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [region, setRegion] = useState<NormalizedCropRegion>(initialRegion)
  const [trimRange, setTrimRange] = useState<VideoTrimRange>(initialTrimRange)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(metadata.durationMs / 1000)
  const [isApplying, setIsApplying] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [autoCropProgress, setAutoCropProgress] = useState<AutoCropProgress | null>(null)
  const [autoCropConfidence, setAutoCropConfidence] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const autoCropControllerRef = useRef<AbortController | null>(null)
  const initialAutoCropStartedRef = useRef(false)

  const pixelRegion = normalizedToPixelCrop(region, metadata)
  const durationMs = Math.max(MINIMUM_TRIM_DURATION_MS, Math.round(duration * 1000))

  const handleTogglePlayback = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      if (
        video.currentTime * 1000 < trimRange.startMs ||
        video.currentTime * 1000 >= trimRange.endMs
      ) {
        video.currentTime = trimRange.startMs / 1000
        setCurrentTime(video.currentTime)
      }
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

  const handleTimeUpdate = (event: SyntheticEvent<HTMLVideoElement>) => {
    const time = event.currentTarget.currentTime
    if (time * 1000 >= trimRange.endMs && !event.currentTarget.paused) event.currentTarget.pause()
    setCurrentTime(Math.min(time, duration))
  }

  const handleAutomaticCrop = useCallback(async () => {
    if (autoCropControllerRef.current) return

    setIsDetecting(true)
    setAutoCropProgress(null)
    setAutoCropConfidence(null)
    setNotice(null)
    setError(null)

    const controller = new AbortController()
    autoCropControllerRef.current = controller
    try {
      const result = await detectAutomaticCrop({
        projectId: project.id,
        path: activeSource.path,
        metadata: activeSource.metadata,
        signal: controller.signal,
        onProgress: setAutoCropProgress,
      })

      if (!result) {
        setError('スライド領域を自動検出できませんでした。手動で範囲を指定してください。')
        return
      }

      setRegion(pixelToNormalizedCrop(result.crop, metadata))
      setAutoCropConfidence(result.confidence)
      setNotice(
        `スライド領域を自動推定しました（信頼度 ${Math.round(result.confidence * 100)}%）。必要なら調整してください。`,
      )
    } catch (detectionError) {
      console.error(detectionError)
      setError('スライド領域の自動検出に失敗しました。手動で範囲を指定してください。')
    } finally {
      if (autoCropControllerRef.current === controller) autoCropControllerRef.current = null
      setIsDetecting(false)
      setAutoCropProgress(null)
    }
  }, [activeSource.metadata, activeSource.path, metadata, project.id])

  useEffect(() => {
    if (project.workflow.cropConfirmedAt || initialAutoCropStartedRef.current) return

    initialAutoCropStartedRef.current = true
    void handleAutomaticCrop()
  }, [handleAutomaticCrop, project.workflow.cropConfirmedAt])

  const handleTrimChange = (nextRange: VideoTrimRange) => {
    setTrimRange(clampTrimRange(nextRange, durationMs))
    setNotice(null)
    setError(null)
  }

  const handleApply = async () => {
    setIsApplying(true)
    setNotice(null)
    setError(null)
    try {
      const nextTrimRange = clampTrimRange(trimRange, durationMs)
      await onApply({ crop: pixelRegion, trim: nextTrimRange })
      savedRegionRef.current = region
      savedTrimRangeRef.current = nextTrimRange
      setTrimRange(nextTrimRange)
      setNotice('時間範囲とスライド領域を保存しました')
    } catch (applyError) {
      console.error(applyError)
      setError(
        applyError instanceof Error
          ? applyError.message
          : '時間範囲とスライド領域を保存できませんでした。もう一度お試しください。',
      )
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader onHome={onHome} homeDisabled={isApplying || isDetecting} />
      <WorkflowBar
        activeStep="crop"
        maxReachedStep={maxReachedStep}
        onStepClick={onStepClick}
        disabled={isApplying || isDetecting}
      />

      <section className="mx-auto flex w-[calc(100%-48px)] max-w-[720px] flex-1 flex-col pb-8 md:w-[calc(100%-11.6vw)]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">02 / CROP &amp; TRIM</p>
            <h1 className="mt-1 text-[27px] font-bold tracking-[-0.06em]">動画の範囲とスライド領域を指定</h1>
            <p className="mt-1 text-xs text-[#71807b]">解析する時間範囲と、スライドだけが入る範囲を選択してください。</p>
          </div>
          <button
            className="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onBack}
            disabled={isApplying || isDetecting}
          >
            <ArrowLeft size={15} strokeWidth={1.8} />
            動画を選び直す
          </button>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#b7cbc0] bg-[#fbfcfa] shadow-[0_18px_52px_rgba(22,54,42,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8e1dc] px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#18211f]" title={source.path}>{source.name}</p>
              <p className="mt-0.5 font-mono text-[10px] text-[#71807b]">{metadata.width} × {metadata.height} · {formatTime(metadata.durationMs)}</p>
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-md border border-[#b7cbc0] px-2.5 py-2 text-[10px] font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#edf4ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={() => void handleAutomaticCrop()}
              disabled={isApplying || isDetecting}
            >
              <ScanLine size={14} strokeWidth={1.8} />
              {isDetecting ? '自動検出中…' : 'スライド領域を自動検出'}
            </button>
          </div>

          <div className="p-4 md:p-5">
            <div className="relative overflow-hidden rounded-[10px]" style={{ aspectRatio: `${metadata.width} / ${metadata.height}` }}>
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full bg-[#0b1712] object-contain"
                playsInline
                preload="metadata"
                src={convertFileSrc(source.path)}
                aria-label="Crop対象の動画"
                onLoadedMetadata={(event) => {
                  const loadedDuration = event.currentTarget.duration
                  if (Number.isFinite(loadedDuration) && loadedDuration > 0) setDuration(loadedDuration)
                }}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
              <CropSelector
                region={region}
                onChange={(nextRegion) => {
                  setRegion(nextRegion)
                  setAutoCropConfidence(null)
                  setNotice(null)
                }}
              />
            </div>

            <CropPlaybackControls
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              isApplying={isApplying}
              trimRange={trimRange}
              onToggle={handleTogglePlayback}
              onSeek={handleSeek}
              onTrimChange={handleTrimChange}
              onTrimReset={() => {
                setTrimRange({ startMs: 0, endMs: durationMs })
                setNotice(null)
                setError(null)
              }}
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
                  onClick={() => {
                    setRegion(savedRegionRef.current)
                    setTrimRange(savedTrimRangeRef.current)
                    setAutoCropConfidence(null)
                    setNotice(null)
                    setError(null)
                  }}
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
              {!error && !notice && isDetecting && autoCropProgress && (
                <p className="text-[#71807b]">
                  {autoCropProgress.phase === 'extracting' ? '動画のフレームを準備中' : '矩形候補を解析中'}
                  … {autoCropProgress.completed} / {autoCropProgress.total}
                </p>
              )}
              {!error && !notice && !isDetecting && (
                <p className="text-[#9aa6a1]">
                  {autoCropConfidence === null
                    ? '時間範囲と座標をまとめて保存し、解析に進みます。'
                    : '自動推定結果です。必要なら枠を調整してください。'}
                </p>
              )}
            </div>
            <button
              className="inline-flex items-center justify-center gap-[18px] rounded-[9px] bg-[#1d6b50] px-5 py-3.5 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:-translate-y-0.5 hover:bg-[#174d3c] hover:shadow-[0_9px_20px_rgba(29,107,80,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              type="button"
              onClick={() => void handleApply()}
              disabled={isApplying || isDetecting}
            >
              <span>{isApplying ? '動画と範囲を保存中…' : '保存して検出へ'}</span>
              <span className="text-[17px] font-normal leading-none" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
