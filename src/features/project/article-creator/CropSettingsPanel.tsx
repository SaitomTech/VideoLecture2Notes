import { ZoomIn } from 'lucide-react'
import { CropPreview } from '../../crop/components/CropPreview'
import { CornerPositionIcon } from '../../crop/components/QuadCropSelector'
import type { ProjectVideo } from '../../../types/project'
import { CORNER_GRID_ORDER } from './rangeDraft'
import type { ArticleRangeEditor } from './useArticleRangeEditor'

export function CropSettingsPanel({
  projectId,
  video,
  editor,
}: {
  projectId: string
  video: ProjectVideo
  editor: ArticleRangeEditor
}) {
  const {
    cropMode,
    cropCorners,
    selectedCorner,
    isZoomed,
    aspectRatioMode,
    aspectRatio,
    busy,
    isDetecting,
    currentTime,
    activePixelCrop,
    activePerspectiveCrop,
    previewAspectRatio,
    setSelectedCorner,
    setIsZoomed,
    handleAspectRatioChange,
    handleCornerCoordinateChange,
  } = editor

  return (
    <aside className="min-w-0 bg-white p-4 lg:min-h-[600px] lg:row-span-2 lg:border-l lg:border-[#d8e1dc]">
      <h3 className="text-[17px] font-bold tracking-[-0.04em]">スライド領域のプレビュー</h3>
      <CropPreview
        projectId={projectId}
        sourcePath={video.media.path}
        crop={activePixelCrop}
        perspectiveCrop={activePerspectiveCrop}
        metadata={video.media.metadata}
        aspectRatio={previewAspectRatio}
        timestampMs={currentTime}
        isPlaying={editor.isPlaying}
      />
      {cropMode === 'perspective' && (
        <fieldset className="mt-3">
          <legend className="text-[12px] font-semibold text-[#18211f]">出力比率</legend>
          <div className="mt-2 grid grid-cols-4 overflow-hidden rounded-md border border-[#b7cbc0] text-[10px] font-semibold">
            {(['16:9', '4:3', 'estimated', 'custom'] as const).map((ratioMode) => (
              <button
                key={ratioMode}
                type="button"
                className={`border-r border-[#b7cbc0] px-1.5 py-2 last:border-r-0 ${aspectRatioMode === ratioMode ? 'bg-[#1d6b50] text-[#f3faf6]' : 'text-[#71807b] hover:bg-[#edf4ef] hover:text-[#174d3c]'}`}
                onClick={() => handleAspectRatioChange(ratioMode)}
                disabled={busy || isDetecting}
              >
                {ratioMode === 'estimated'
                  ? '推定'
                  : ratioMode === 'custom'
                    ? 'カスタム'
                    : ratioMode}
              </button>
            ))}
          </div>
          {aspectRatioMode === 'custom' && (
            <label className="mt-2 flex items-center gap-2 text-[10px] text-[#71807b]">
              <input
                className="w-16 rounded border border-[#b7cbc0] bg-white px-2 py-1.5 font-mono text-right text-xs text-[#18211f]"
                type="number"
                min="0.1"
                step="0.01"
                value={Number(aspectRatio.toFixed(2))}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (value > 0)
                    editor.saveCropSelection(
                      editor.cropRegion,
                      cropCorners,
                      'perspective',
                      'custom',
                      value,
                    )
                }}
                disabled={busy || isDetecting}
              />
              <span>横 ÷ 縦</span>
            </label>
          )}
        </fieldset>
      )}
      {cropMode === 'perspective' && (
        <fieldset className="mt-5">
          <div className="flex items-center justify-between gap-2">
            <legend className="text-[12px] font-semibold text-[#18211f]">四隅の座標</legend>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-[#71807b] transition hover:bg-[#edf4ef] hover:text-[#174d3c]"
              onClick={() => setIsZoomed((value) => !value)}
              disabled={busy || isDetecting}
            >
              <ZoomIn size={12} />
              {isZoomed ? '全体表示' : '拡大して調整'}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {CORNER_GRID_ORDER.map((corner) => {
              const point = cropCorners[corner]
              const isSelected = selectedCorner === corner
              return (
                <div
                  className={`rounded-md border p-2 transition-colors ${isSelected ? 'border-[#1d6b50] bg-[#edf4ef]' : 'border-[#d8e1dc] bg-white'}`}
                  key={corner}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30"
                    onClick={() => setSelectedCorner(corner)}
                    aria-label={`${corner}の座標を選択`}
                    aria-pressed={isSelected}
                    disabled={busy || isDetecting}
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
                          className="min-w-0 flex-1 rounded border border-[#b7cbc0] bg-white px-2 py-1.5 font-mono text-[11px] text-[#18211f]"
                          type="number"
                          min="0"
                          max={
                            axis === 'x' ? video.media.metadata.width : video.media.metadata.height
                          }
                          value={Math.round(
                            point[axis] *
                              (axis === 'x'
                                ? video.media.metadata.width
                                : video.media.metadata.height),
                          )}
                          onFocus={() => setSelectedCorner(corner)}
                          onChange={(event) =>
                            handleCornerCoordinateChange(corner, axis, Number(event.target.value))
                          }
                          disabled={busy || isDetecting}
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
  )
}
