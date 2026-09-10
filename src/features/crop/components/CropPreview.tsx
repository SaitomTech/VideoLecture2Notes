import { convertFileSrc } from '@tauri-apps/api/core'
import { ImageOff, Maximize2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CropRegion, MediaMetadata, PerspectiveCrop } from '../../../types/project'
import { extractRepresentativeFrame } from '../../../lib/media/ffmpeg'
import { getCropPreviewAssetPath } from '../../../lib/storage/projectAssets'

type CropPreviewProps = {
  projectId: string
  sourcePath: string
  crop: CropRegion
  perspectiveCrop?: PerspectiveCrop
  metadata: Pick<MediaMetadata, 'width' | 'height'>
  aspectRatio: number
  timestampMs: number
  isPlaying: boolean
}

type PreviewState = {
  path: string | null
  revision: number
  error: string | null
  isRendering: boolean
}

export function CropPreview({
  projectId,
  sourcePath,
  crop,
  perspectiveCrop,
  metadata,
  aspectRatio,
  timestampMs,
  isPlaying,
}: CropPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [state, setState] = useState<PreviewState>({
    path: null,
    revision: 0,
    error: null,
    isRendering: false,
  })

  useEffect(() => {
    if (isPlaying) return
    let disposed = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setState((current) => ({ ...current, error: null, isRendering: true }))
      void (async () => {
        const outputPath = await getCropPreviewAssetPath(projectId)
        await extractRepresentativeFrame({
          path: sourcePath,
          crop,
          perspectiveCrop,
          metadata,
          timestampMs,
          outputPath,
          signal: controller.signal,
        })
        if (disposed) return
        setState({ path: outputPath, revision: Date.now(), error: null, isRendering: false })
      })().catch((error: unknown) => {
        if (disposed || controller.signal.aborted) return
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : String(error),
          isRendering: false,
        }))
      })
    }, 220)

    return () => {
      disposed = true
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [aspectRatio, crop, isPlaying, metadata, perspectiveCrop, projectId, sourcePath, timestampMs])

  const imageSrc = state.path ? `${convertFileSrc(state.path)}?v=${state.revision}` : null

  useEffect(() => {
    if (!isExpanded) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsExpanded(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded])

  return (
    <>
      <div
        className="relative min-h-[160px] overflow-hidden rounded-[8px] border border-[#d8e1dc] bg-[#dce8e0]"
        style={{ aspectRatio: `${Math.max(aspectRatio, 0.1)}` }}
      >
        {imageSrc ? (
          <img
            key={`${state.path}-${state.revision}`}
            className={`h-full w-full object-cover transition-opacity ${state.isRendering ? 'opacity-60' : 'opacity-100'}`}
            src={imageSrc}
            alt="プレビュー"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center text-[#9aa6a1]"
            aria-label="プレビュー画像なし"
          >
            <ImageOff size={18} strokeWidth={1.5} />
          </div>
        )}
        {imageSrc && (
          <button
            type="button"
            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#18211f]/72 text-[#f3faf6] shadow-[0_2px_8px_rgba(0,0,0,0.22)] transition hover:bg-[#18211f]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            onClick={() => setIsExpanded(true)}
            aria-label="プレビューを拡大"
            title="プレビューを拡大"
          >
            <Maximize2 size={15} strokeWidth={1.8} />
          </button>
        )}
        {state.isRendering && state.path && (
          <span className="absolute bottom-2 left-2 rounded bg-[#18211f]/75 px-2 py-1 text-[10px] text-[#f3faf6]">
            補正中…
          </span>
        )}
        {state.error && !state.path && (
          <span className="absolute inset-x-3 bottom-2 text-center text-[10px] text-[#b6533a]">
            補正プレビューを作成できませんでした
          </span>
        )}
      </div>

      {isExpanded && imageSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#07110d]/82 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="拡大プレビュー"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsExpanded(false)
          }}
        >
          <div className="relative max-h-full max-w-full overflow-hidden rounded-[10px] border border-[#d8e1dc]/40 bg-[#0b1712] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
            <img
              key={`expanded-${state.path}-${state.revision}`}
              className="block max-h-[88vh] max-w-[92vw] object-contain"
              src={imageSrc}
              alt="プレビュー（拡大）"
            />
            <button
              type="button"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#18211f]/78 text-[#f3faf6] transition hover:bg-[#18211f]/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              onClick={() => setIsExpanded(false)}
              aria-label="拡大プレビューを閉じる"
              title="閉じる"
            >
              <X size={17} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
