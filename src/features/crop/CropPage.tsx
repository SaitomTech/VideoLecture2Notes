import { ArrowLeft, Check, RotateCcw, ScanLine, ZoomIn } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { WorkflowBar } from '../../components/WorkflowBar'
import type { WorkflowStep } from '../../lib/workflow'
import { detectAutomaticCrop, type AutoCropProgress } from './autoCrop'
import type {
  CropRegion,
  MediaProject,
  PerspectiveCorners,
  PerspectiveCrop,
  VideoTrimRange,
} from '../../types/project'
import { getActiveMediaSource } from '../../types/project'
import { CropPlaybackControls } from './components/CropPlaybackControls'
import { CropSelector } from './components/CropSelector'
import {
  CornerPositionIcon,
  type QuadCorner,
  QuadCropSelector,
} from './components/QuadCropSelector'
import { CropPreview } from './components/CropPreview'
import { clampTrimRange, MINIMUM_TRIM_DURATION_MS } from '../trim/utils'
import type { NormalizedCropRegion } from './types'
import { normalizedToPixelCrop, pixelToNormalizedCrop } from './utils'
import { describeVideoPlaybackError, logVideoPlaybackError } from '../../lib/media/videoError'
import { useVideoSourceUrl } from '../../lib/media/useVideoSourceUrl'

type CropPageProps = {
  project: MediaProject
  onBack: () => void
  onApply: (value: {
    crop: CropRegion
    trim: VideoTrimRange
    perspectiveCrop?: PerspectiveCrop
  }) => void | Promise<void>
  onHome: () => void
  maxReachedStep: WorkflowStep
  onStepClick: (step: WorkflowStep) => void
}

type CropMode = 'rect' | 'perspective'

const CORNER_GRID_ORDER: QuadCorner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']

function rectToCorners(region: NormalizedCropRegion): PerspectiveCorners {
  return {
    topLeft: { x: region.x, y: region.y },
    topRight: { x: region.x + region.width, y: region.y },
    bottomRight: { x: region.x + region.width, y: region.y + region.height },
    bottomLeft: { x: region.x, y: region.y + region.height },
  }
}

function cornersToRegion(corners: PerspectiveCorners): NormalizedCropRegion {
  const points = Object.values(corners)
  const left = Math.min(...points.map((point) => point.x))
  const top = Math.min(...points.map((point) => point.y))
  const right = Math.max(...points.map((point) => point.x))
  const bottom = Math.max(...points.map((point) => point.y))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function distance(first: { x: number; y: number }, second: { x: number; y: number }) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function estimatedAspectRatio(corners: PerspectiveCorners) {
  const width =
    (distance(corners.topLeft, corners.topRight) +
      distance(corners.bottomLeft, corners.bottomRight)) /
    2
  const height =
    (distance(corners.topLeft, corners.bottomLeft) +
      distance(corners.topRight, corners.bottomRight)) /
    2
  return height > 0 ? width / height : 16 / 9
}

function cloneCorners(corners: PerspectiveCorners): PerspectiveCorners {
  return {
    topLeft: { ...corners.topLeft },
    topRight: { ...corners.topRight },
    bottomRight: { ...corners.bottomRight },
    bottomLeft: { ...corners.bottomLeft },
  }
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
  const initialCorners = project.perspectiveCrop?.corners ?? rectToCorners(initialRegion)
  const initialMode: CropMode = project.perspectiveCrop ? 'perspective' : 'rect'
  const initialAspectRatio = project.perspectiveCrop?.aspectRatio ?? {
    mode: '16:9' as const,
    value: 16 / 9,
  }
  const initialTrimRange = clampTrimRange(
    project.trim
      ? { startMs: project.trim.startMs, endMs: project.trim.endMs }
      : { startMs: 0, endMs: metadata.durationMs },
    metadata.durationMs,
  )
  const savedRegionRef = useRef(initialRegion)
  const savedCornersRef = useRef(cloneCorners(initialCorners))
  const savedModeRef = useRef<CropMode>(initialMode)
  const savedAspectRatioRef = useRef(initialAspectRatio)
  const savedTrimRangeRef = useRef(initialTrimRange)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoSource = useVideoSourceUrl(source.path)
  const [region, setRegion] = useState<NormalizedCropRegion>(initialRegion)
  const [corners, setCorners] = useState<PerspectiveCorners>(initialCorners)
  const [mode, setMode] = useState<CropMode>(initialMode)
  const [selectedCorner, setSelectedCorner] = useState<QuadCorner>('topLeft')
  const [isZoomed, setIsZoomed] = useState(false)
  const [aspectRatioMode, setAspectRatioMode] = useState(initialAspectRatio.mode)
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio.value)
  const [trimRange, setTrimRange] = useState<VideoTrimRange>(initialTrimRange)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(metadata.durationMs / 1000)
  const [isApplying, setIsApplying] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [autoCropProgress, setAutoCropProgress] = useState<AutoCropProgress | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const autoCropControllerRef = useRef<AbortController | null>(null)
  const initialAutoCropStartedRef = useRef(false)

  const pixelRegion = normalizedToPixelCrop(region, metadata)
  const pixelQuadRegion =
    mode === 'perspective' ? normalizedToPixelCrop(cornersToRegion(corners), metadata) : undefined
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
        logVideoPlaybackError(video, playError)
        setError(describeVideoPlaybackError(video, playError))
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

  const clearFeedback = () => {
    setNotice(null)
    setError(null)
  }

  const handleModeChange = (nextMode: CropMode) => {
    if (nextMode === mode) return
    setMode(nextMode)
    if (nextMode === 'rect') setIsZoomed(false)
    clearFeedback()
  }

  const handleAspectRatioChange = (nextMode: typeof aspectRatioMode) => {
    setAspectRatioMode(nextMode)
    if (nextMode === '16:9') setAspectRatio(16 / 9)
    if (nextMode === '4:3') setAspectRatio(4 / 3)
    if (nextMode === 'estimated') setAspectRatio(estimatedAspectRatio(corners))
    clearFeedback()
  }

  const handleCornerCoordinateChange = (corner: QuadCorner, axis: 'x' | 'y', value: number) => {
    if (!Number.isFinite(value)) return
    const nextCorners = {
      ...corners,
      [corner]: {
        ...corners[corner],
        [axis]: Math.min(
          Math.max(value / (axis === 'x' ? metadata.width : metadata.height), 0.005),
          0.995,
        ),
      },
    }
    setCorners(nextCorners)
    clearFeedback()
  }

  const handleAutomaticCrop = useCallback(async () => {
    if (autoCropControllerRef.current) return

    setIsDetecting(true)
    setAutoCropProgress(null)
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

      const nextRegion = pixelToNormalizedCrop(result.crop, metadata)
      setRegion(nextRegion)
      const detectedCorners = mode === 'perspective' ? result.corners : rectToCorners(nextRegion)
      setCorners(detectedCorners)
      if (mode === 'perspective' && aspectRatioMode === 'estimated') {
        setAspectRatio(estimatedAspectRatio(detectedCorners))
      }
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
  }, [activeSource.metadata, activeSource.path, aspectRatioMode, metadata, mode, project.id])

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
      const nextPerspectiveCrop =
        mode === 'perspective'
          ? {
              corners: cloneCorners(corners),
              aspectRatio: { mode: aspectRatioMode, value: aspectRatio },
              transformVersion: 1 as const,
            }
          : undefined
      await onApply({
        crop: mode === 'perspective' && pixelQuadRegion ? pixelQuadRegion : pixelRegion,
        trim: nextTrimRange,
        perspectiveCrop: nextPerspectiveCrop,
      })
      savedRegionRef.current = region
      savedCornersRef.current = cloneCorners(corners)
      savedModeRef.current = mode
      savedAspectRatioRef.current = { mode: aspectRatioMode, value: aspectRatio }
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

  const sourceError = videoSource.error
    ? `動画ソースを準備できませんでした（${videoSource.error}）。`
    : null
  const displayedError = error ?? sourceError
  const selectedPoint = corners[selectedCorner]
  const previewAspectRatio =
    mode === 'perspective' ? aspectRatio : pixelRegion.width / Math.max(pixelRegion.height, 1)

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader onHome={onHome} homeDisabled={isApplying || isDetecting} />
      <WorkflowBar
        activeStep="crop"
        maxReachedStep={maxReachedStep}
        onStepClick={onStepClick}
        disabled={isApplying || isDetecting}
      />

      <section className="mx-auto flex w-[calc(100%-48px)] max-w-[1040px] flex-1 flex-col pb-12 md:w-[calc(100%-11.6vw)]">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">
              02 / CROP &amp; TRIM
            </p>
            <h1 className="mt-1 text-[27px] font-bold tracking-[-0.06em]">
              動画の範囲とスライド領域を設定
            </h1>
            <p className="mt-1 text-xs text-[#71807b]">
              解析する時間範囲と、スライドの切り出し位置・形を設定します。
            </p>
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8e1dc] px-5 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#18211f]" title={source.path}>
                {source.name}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-[#71807b]">
                {metadata.width} × {metadata.height} · {formatTime(metadata.durationMs)}
              </p>
            </div>
          </div>

          <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_312px] lg:gap-0">
            <section className="min-w-0 lg:border-r lg:border-[#d8e1dc]">
              <div className="p-3.5 md:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-semibold text-[#18211f]">元動画</span>
                    <span className="font-mono text-[10px] text-[#71807b]">
                      {formatTime(Math.round(currentTime * 1000))}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-md border border-[#b7cbc0] p-0.5 text-[10px] font-semibold">
                      <button
                        type="button"
                        className={`rounded px-2.5 py-1.5 transition ${mode === 'rect' ? 'bg-[#edf4ef] text-[#174d3c]' : 'text-[#71807b] hover:text-[#174d3c]'}`}
                        onClick={() => handleModeChange('rect')}
                        disabled={isApplying || isDetecting}
                      >
                        長方形
                      </button>
                      <button
                        type="button"
                        className={`rounded px-2.5 py-1.5 transition ${mode === 'perspective' ? 'bg-[#1d6b50] text-[#f3faf6]' : 'text-[#71807b] hover:text-[#174d3c]'}`}
                        onClick={() => handleModeChange('perspective')}
                        disabled={isApplying || isDetecting}
                      >
                        四隅で補正
                      </button>
                    </div>
                    <button
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#b7cbc0] px-2.5 py-2 text-[10px] font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#edf4ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      onClick={() => void handleAutomaticCrop()}
                      disabled={isApplying || isDetecting}
                    >
                      <ScanLine size={14} strokeWidth={1.8} />
                      {isDetecting ? '検出中…' : '四隅を自動検出'}
                    </button>
                  </div>
                </div>
                <div
                  className="relative overflow-hidden rounded-[10px] bg-[#0b1712]"
                  style={{ aspectRatio: `${metadata.width} / ${metadata.height}` }}
                >
                  <div
                    className={`absolute inset-0 transition-transform duration-200 ${isZoomed ? 'scale-[1.5]' : ''}`}
                    style={{
                      transformOrigin: `${selectedPoint.x * 100}% ${selectedPoint.y * 100}%`,
                    }}
                  >
                    <video
                      ref={videoRef}
                      key={videoSource.src ?? source.path}
                      className="absolute inset-0 h-full w-full bg-[#0b1712] object-contain"
                      crossOrigin="anonymous"
                      playsInline
                      preload="metadata"
                      src={videoSource.src ?? undefined}
                      aria-label="補正前の動画"
                      onLoadedMetadata={(event) => {
                        const loadedDuration = event.currentTarget.duration
                        if (Number.isFinite(loadedDuration) && loadedDuration > 0)
                          setDuration(loadedDuration)
                      }}
                      onError={(event) => {
                        const video = event.currentTarget
                        logVideoPlaybackError(video)
                        setError(describeVideoPlaybackError(video))
                      }}
                      onTimeUpdate={handleTimeUpdate}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    />
                    {mode === 'perspective' ? (
                      <QuadCropSelector
                        corners={corners}
                        selectedCorner={selectedCorner}
                        onSelect={setSelectedCorner}
                        onChange={(nextCorners) => {
                          setCorners(nextCorners)
                          if (aspectRatioMode === 'estimated')
                            setAspectRatio(estimatedAspectRatio(nextCorners))
                          clearFeedback()
                        }}
                        disabled={isApplying || isDetecting}
                        visualScale={isZoomed ? 1.5 : 1}
                      />
                    ) : (
                      <CropSelector
                        region={region}
                        onChange={(nextRegion) => {
                          setRegion(nextRegion)
                          clearFeedback()
                        }}
                      />
                    )}
                  </div>
                </div>

                <CropPlaybackControls
                  currentTime={currentTime}
                  duration={duration}
                  isPlaying={isPlaying}
                  isApplying={isApplying || isDetecting}
                  trimRange={trimRange}
                  onToggle={handleTogglePlayback}
                  onSeek={handleSeek}
                  onTrimChange={handleTrimChange}
                  onTrimReset={() => {
                    setTrimRange({ startMs: 0, endMs: durationMs })
                    clearFeedback()
                  }}
                />
              </div>
            </section>

            <aside className="flex min-w-0 flex-col p-3.5 md:p-4">
              <h2 className="text-[17px] font-bold tracking-[-0.04em]">プレビュー</h2>
              <p className="mt-1 text-[11px] text-[#71807b]">
                現在のフレームを選択範囲に合わせて表示します。
              </p>

              <div className="mt-3">
                <CropPreview
                  projectId={project.id}
                  sourcePath={source.path}
                  crop={mode === 'perspective' && pixelQuadRegion ? pixelQuadRegion : pixelRegion}
                  perspectiveCrop={
                    mode === 'perspective'
                      ? {
                          corners,
                          aspectRatio: {
                            mode: aspectRatioMode,
                            value: aspectRatio,
                          },
                          transformVersion: 1,
                        }
                      : undefined
                  }
                  metadata={metadata}
                  aspectRatio={previewAspectRatio}
                  timestampMs={Math.round(currentTime * 1000)}
                  isPlaying={isPlaying}
                />
              </div>

              <fieldset className="mt-5">
                <legend className="text-[13px] font-semibold text-[#18211f]">出力比率</legend>
                <div className="mt-2 grid grid-cols-4 overflow-hidden rounded-md border border-[#b7cbc0] text-[11px] font-semibold">
                  {(['16:9', '4:3', 'estimated', 'custom'] as const).map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={`border-r border-[#b7cbc0] px-2 py-2 last:border-r-0 ${aspectRatioMode === value ? 'bg-[#1d6b50] text-[#f3faf6]' : 'text-[#71807b] hover:bg-[#edf4ef] hover:text-[#174d3c]'}`}
                      onClick={() => handleAspectRatioChange(value)}
                      disabled={mode !== 'perspective' || isApplying || isDetecting}
                    >
                      {value === 'estimated' ? '推定' : value === 'custom' ? 'カスタム' : value}
                    </button>
                  ))}
                </div>
                {aspectRatioMode === 'custom' && (
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-[#71807b]">
                    <input
                      className="w-16 rounded border border-[#b7cbc0] bg-[#fbfcfa] px-2 py-1.5 font-mono text-right text-xs text-[#18211f]"
                      type="number"
                      min="0.1"
                      step="0.01"
                      value={Number(aspectRatio.toFixed(2))}
                      onChange={(event) => {
                        const value = Number(event.target.value)
                        if (value > 0) setAspectRatio(value)
                      }}
                    />
                    <span>横 ÷ 縦</span>
                  </label>
                )}
              </fieldset>

              {mode === 'perspective' && (
                <fieldset className="mt-5 border-t border-[#e0e8e3] pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <legend className="text-[13px] font-semibold text-[#18211f]">四隅の座標</legend>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-semibold text-[#71807b] transition hover:bg-[#edf4ef] hover:text-[#174d3c]"
                      onClick={() => setIsZoomed((value) => !value)}
                    >
                      <ZoomIn size={13} />
                      {isZoomed ? '全体表示' : '拡大して調整'}
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {CORNER_GRID_ORDER.map((corner) => {
                      const point = corners[corner]
                      const isSelected = selectedCorner === corner
                      return (
                        <div
                          className={`rounded-md border p-2 transition-colors ${isSelected ? 'border-[#1d6b50] bg-[#edf4ef] shadow-[0_4px_12px_rgba(29,107,80,0.1)]' : 'border-[#d8e1dc] bg-[#fbfcfa]'}`}
                          key={corner}
                        >
                          <button
                            type="button"
                            className="flex w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30"
                            onClick={() => setSelectedCorner(corner)}
                            aria-label={`${corner === 'topLeft' ? '左上' : corner === 'topRight' ? '右上' : corner === 'bottomLeft' ? '左下' : '右下'}の座標を選択`}
                            aria-pressed={isSelected}
                            disabled={isApplying || isDetecting}
                          >
                            <CornerPositionIcon corner={corner} active={isSelected} />
                          </button>
                          <div className="mt-1.5 grid gap-2">
                            {(['x', 'y'] as const).map((axis) => (
                              <label
                                key={axis}
                                className="flex items-center gap-1.5 text-[10px] text-[#71807b]"
                              >
                                <span className="font-mono uppercase">{axis}</span>
                                <input
                                  className="min-w-0 flex-1 rounded border border-[#b7cbc0] bg-[#fbfcfa] px-2 py-1.5 font-mono text-[11px] text-[#18211f]"
                                  type="number"
                                  min="0"
                                  max={axis === 'x' ? metadata.width : metadata.height}
                                  value={Math.round(
                                    point[axis] * (axis === 'x' ? metadata.width : metadata.height),
                                  )}
                                  onFocus={() => setSelectedCorner(corner)}
                                  onChange={(event) =>
                                    handleCornerCoordinateChange(
                                      corner,
                                      axis,
                                      Number(event.target.value),
                                    )
                                  }
                                  disabled={isApplying || isDetecting}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </fieldset>
              )}
            </aside>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#d8e1dc] px-5 py-4 sm:px-7 sm:py-5">
            <div className="min-h-5 text-[11px]" aria-live="polite">
              {displayedError && <p className="text-[#b6533a]">{displayedError}</p>}
              {!displayedError && notice && (
                <p className="inline-flex items-center gap-1.5 text-[#1d6b50]">
                  <Check size={13} />
                  {notice}
                </p>
              )}
              {!displayedError && !notice && isDetecting && autoCropProgress && (
                <p className="text-[#71807b]">
                  {autoCropProgress.phase === 'extracting'
                    ? '動画のフレームを準備中'
                    : '矩形候補を解析中'}
                  … {autoCropProgress.completed} / {autoCropProgress.total}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30"
                type="button"
                onClick={() => {
                  setRegion(savedRegionRef.current)
                  setCorners(cloneCorners(savedCornersRef.current))
                  setMode(savedModeRef.current)
                  setAspectRatioMode(savedAspectRatioRef.current.mode)
                  setAspectRatio(savedAspectRatioRef.current.value)
                  setTrimRange(savedTrimRangeRef.current)
                  clearFeedback()
                }}
                disabled={isApplying || isDetecting}
              >
                <RotateCcw size={14} strokeWidth={1.8} />
                元に戻す
              </button>
              <button
                className="inline-flex items-center justify-center gap-3 rounded-[9px] bg-[#1d6b50] px-4 py-3 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:-translate-y-0.5 hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => void handleApply()}
                disabled={isApplying || isDetecting}
              >
                <span>{isApplying ? '保存中…' : '保存して検出へ'}</span>
                <span className="text-[17px] font-normal leading-none" aria-hidden="true">
                  →
                </span>
              </button>
            </div>
          </footer>
        </div>
      </section>
    </main>
  )
}
