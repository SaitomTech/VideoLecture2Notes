import { Eye, ScanLine, Undo2 } from 'lucide-react'
import { VideoPlayButton } from '../../../components/VideoPlaybackControls'
import { formatPlaybackTime, formatTrimTime } from './rangeDraft'
import { CropSelector } from '../../crop/components/CropSelector'
import { QuadCropSelector } from '../../crop/components/QuadCropSelector'
import type { ProjectVideo } from '../../../types/project'
import type { ArticleRangeEditor } from './useArticleRangeEditor'

export function RangeEditor({
  video,
  editor,
  onOpenCropPreview,
}: {
  video: ProjectVideo
  editor: ArticleRangeEditor
  onOpenCropPreview?: () => void
}) {
  const {
    duration,
    videoSource,
    videoRef,
    timelineRef,
    cropRegion,
    cropMode,
    cropCorners,
    selectedCorner,
    isZoomed,
    isDetecting,
    autoCropProgress,
    currentTime,
    isPlaying,
    busy,
    editingIndex,
    draggingHandle,
    startMs,
    endMs,
    startPercent,
    endPercent,
    activeRangeColor,
    timelineRanges,
    setCurrentTime,
    handleCropModeChange,
    handleAutomaticCrop,
    setSelectedCorner,
    handleCornerChange,
    togglePlayback,
    timestampAtClientX,
    moveHandle,
    startHandleDrag,
    setDraggingHandle,
    handleHandleKeyDown,
    hasResetChanges,
    resetRange,
    saveCropSelection,
  } = editor

  return (
    <div className="min-w-0">
      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-[#b7cbc0] p-0.5 text-[10px] font-semibold">
              <button
                type="button"
                className={`rounded px-2.5 py-1.5 transition ${cropMode === 'rect' ? 'bg-[#edf4ef] text-[#174d3c]' : 'text-[#71807b] hover:text-[#174d3c]'}`}
                onClick={() => handleCropModeChange('rect')}
                disabled={busy || isDetecting}
              >
                長方形
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1.5 transition ${cropMode === 'perspective' ? 'bg-[#1d6b50] text-[#f3faf6]' : 'text-[#71807b] hover:text-[#174d3c]'}`}
                onClick={() => handleCropModeChange('perspective')}
                disabled={busy || isDetecting}
              >
                四隅で補正
              </button>
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-md border border-[#b7cbc0] px-2.5 py-2 text-[10px] font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#edf4ef] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={() => void handleAutomaticCrop()}
              disabled={busy || isDetecting}
            >
              <ScanLine size={14} strokeWidth={1.8} />
              {isDetecting
                ? autoCropProgress
                  ? `検出中 ${Math.round((autoCropProgress.completed / Math.max(autoCropProgress.total, 1)) * 100)}%`
                  : '検出中…'
                : '四隅を自動検出'}
            </button>
            {onOpenCropPreview && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#b7cbc0] px-2.5 py-2 text-[10px] font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#edf4ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={onOpenCropPreview}
                disabled={busy || isDetecting}
                aria-label="スライド領域のプレビューを表示"
              >
                <Eye size={14} strokeWidth={1.8} aria-hidden="true" />
                プレビューを表示
              </button>
            )}
          </div>
        </div>
        <div
          className="relative w-full overflow-hidden rounded-[10px] border border-[#d8e1dc] bg-[#14231d]"
          style={{ aspectRatio: `${video.media.metadata.width} / ${video.media.metadata.height}` }}
        >
          <div
            className={`absolute inset-0 transition-transform duration-200 ${isZoomed ? 'scale-[1.5]' : ''}`}
            style={{
              transformOrigin: `${(cropMode === 'perspective' ? cropCorners[selectedCorner].x : cropRegion.x + cropRegion.width / 2) * 100}% ${(cropMode === 'perspective' ? cropCorners[selectedCorner].y : cropRegion.y + cropRegion.height / 2) * 100}%`,
            }}
          >
            {videoSource.src ? (
              <video
                ref={videoRef}
                className="block h-full w-full object-contain"
                src={videoSource.src}
                playsInline
                preload="metadata"
                onTimeUpdate={(event) => {
                  const element = event.currentTarget
                  const timeMs = element.currentTime * 1000
                  if (timeMs >= endMs) {
                    if (!element.paused) element.pause()
                    element.currentTime = endMs / 1000
                    setCurrentTime(endMs)
                    return
                  }
                  setCurrentTime(Math.min(timeMs, duration))
                }}
                onPlay={() => editor.setIsPlaying(true)}
                onPause={() => editor.setIsPlaying(false)}
                onEnded={() => editor.setIsPlaying(false)}
                aria-label="記事区間の動画プレビュー"
              />
            ) : (
              <div className="grid aspect-video place-items-center text-xs text-[#b7cbc0]">
                動画を読み込んでいます…
              </div>
            )}
            {cropMode === 'perspective' ? (
              <QuadCropSelector
                corners={cropCorners}
                selectedCorner={selectedCorner}
                onSelect={setSelectedCorner}
                onChange={handleCornerChange}
                disabled={busy || isDetecting}
                visualScale={isZoomed ? 1.5 : 1}
              />
            ) : (
              <CropSelector
                region={cropRegion}
                onChange={(nextRegion) => saveCropSelection(nextRegion, cropCorners, 'rect')}
              />
            )}
          </div>
        </div>
      </div>
      <div className="relative mt-0 flex flex-wrap items-center gap-3 px-4 pb-9 pt-2">
        <div className="translate-y-1">
          <VideoPlayButton isPlaying={isPlaying} onToggle={togglePlayback} disabled={!duration} />
        </div>
        <span className="min-w-[82px] translate-y-1 font-mono text-[10px] tabular-nums text-[#71807b]">
          {formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration)}
        </span>
        <div className="min-w-[220px] flex-1 translate-y-1">
          <div
            ref={timelineRef}
            className="relative h-7 select-none touch-none"
            onPointerDown={(event) => {
              if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
              const timestampMs = timestampAtClientX(event.clientX)
              if (timestampMs !== null) {
                setCurrentTime(timestampMs)
                if (videoRef.current) videoRef.current.currentTime = timestampMs / 1000
              }
            }}
            role="group"
            aria-label="動画の再生位置と記事区間"
          >
            <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#d8e1dc]" />
            <div
              className="pointer-events-none absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-l-full bg-[#18211f]/18"
              style={{ width: `${startPercent}%` }}
            />
            <div
              className="pointer-events-none absolute right-0 top-1/2 h-2 -translate-y-1/2 rounded-r-full bg-[#18211f]/18"
              style={{ width: `${Math.max(0, 100 - endPercent)}%` }}
            />
            <div
              className="pointer-events-none absolute top-1/2 z-[2] h-2 -translate-y-1/2 rounded-full"
              style={{
                left: `${startPercent}%`,
                width: `${Math.max(0, endPercent - startPercent)}%`,
                backgroundColor: activeRangeColor.bar,
                boxShadow: `inset 0 0 0 1px ${activeRangeColor.border}99`,
                opacity: editingIndex === null ? 0.55 : 1,
              }}
            />
            {timelineRanges
              .filter((range) => range.index !== editingIndex)
              .map((range) => (
                <div
                  className="pointer-events-none absolute inset-0 z-[1]"
                  key={`timeline-range-${range.index}`}
                >
                  <span
                    className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${range.left}%`,
                      width: `${range.width}%`,
                      backgroundColor: range.color.bar,
                      boxShadow: `inset 0 0 0 1px ${range.color.border}55`,
                      opacity: 0.48,
                    }}
                  />
                </div>
              ))}
            {(['start', 'end'] as const).map((handle) => {
              const timestampMs = handle === 'start' ? startMs : endMs
              return (
                <button
                  key={handle}
                  className={`group absolute inset-y-[-5px] z-10 w-6 -translate-x-1/2 cursor-ew-resize rounded-md bg-transparent focus-visible:outline-none ${draggingHandle === handle ? 'opacity-70' : ''}`}
                  style={{ left: `${handle === 'start' ? startPercent : endPercent}%` }}
                  type="button"
                  role="slider"
                  aria-orientation="horizontal"
                  aria-valuemin={handle === 'start' ? 0 : startMs + 100}
                  aria-valuemax={handle === 'start' ? endMs - 100 : duration}
                  aria-valuenow={timestampMs}
                  aria-valuetext={formatTrimTime(timestampMs)}
                  title={`${handle === 'start' ? '開始' : '終了'} ${formatTrimTime(timestampMs)}`}
                  aria-label={`${handle === 'start' ? '開始' : '終了'}位置 ${formatTrimTime(timestampMs)}を移動`}
                  onPointerDown={(event) => startHandleDrag(event, handle)}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                      moveHandle(handle, event.clientX)
                  }}
                  onPointerUp={() => setDraggingHandle(null)}
                  onPointerCancel={() => setDraggingHandle(null)}
                  onKeyDown={(event) => handleHandleKeyDown(event, handle)}
                >
                  <span
                    className="absolute bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-1 py-0.5 font-mono text-[9px] font-medium"
                    style={{ color: activeRangeColor.text }}
                  >
                    {formatTrimTime(timestampMs)}
                  </span>
                  <span
                    className="absolute left-1/2 top-1/2 h-7 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-[#f3faf6] shadow-[0_1px_3px_rgba(22,54,42,0.22)] group-focus-visible:ring-2 group-focus-visible:ring-[#1d6b50]/40"
                    style={{ borderColor: activeRangeColor.border }}
                  />
                </button>
              )
            })}
            <div
              className="pointer-events-none absolute -top-1 z-20 h-8 w-4 -translate-x-1/2"
              style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              aria-hidden="true"
            >
              <span className="absolute left-1/2 top-0 h-8 w-0.5 -translate-x-1/2 bg-[#b6533a]" />
              <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-[#b6533a]" />
            </div>
          </div>
        </div>
        {editingIndex !== null && (
          <div className="flex shrink-0 items-center gap-1 self-center translate-y-1">
            <button
              className="inline-flex h-8 items-center gap-1.5 px-1.5 text-xs font-semibold text-[#8b9892] hover:text-[#71807b] disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              disabled={!hasResetChanges()}
              onClick={resetRange}
            >
              <Undo2 size={14} strokeWidth={1.8} aria-hidden="true" />
              リセット
            </button>
          </div>
        )}
        <p className="pointer-events-none absolute bottom-2 left-3.5 text-[10px] leading-4 text-[#71807b]">
          左右のつまみで記事にする区間を指定できます。フォーカス後は矢印キーで1秒ずつ、Shift +
          矢印キーで10秒ずつ移動できます。
        </p>
      </div>
    </div>
  )
}
