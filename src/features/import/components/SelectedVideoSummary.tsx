import { ChevronDown, Download, FolderOpen } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatDuration, formatSize } from '../utils'
import type { SelectedVideo } from '../types'

type SelectedVideoSummaryProps = {
  video: SelectedVideo
  disabled: boolean
  isSelecting: boolean
  onChoose: () => void | Promise<void>
  onYoutubeDownload: () => void
}

export function SelectedVideoSummary({
  video,
  disabled,
  isSelecting,
  onChoose,
  onYoutubeDownload,
}: SelectedVideoSummaryProps) {
  const youtubeOrigin = video.origin?.kind === 'youtube' ? video.origin : null
  const [isChangeMenuOpen, setIsChangeMenuOpen] = useState(false)
  const changeMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isChangeMenuOpen) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!changeMenuRef.current?.contains(event.target as Node)) setIsChangeMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsChangeMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isChangeMenuOpen])

  return (
    <div
      className="relative flex flex-wrap items-center justify-between gap-3 border-b border-[#d8e1dc] px-4 py-3"
      aria-live="polite"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[#18211f]" title={video.path}>
          {video.name}
        </p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-[#71807b]">
          {video.metadata ? `${video.metadata.width} × ${video.metadata.height}` : '解析中…'} ·{' '}
          {formatDuration(video.metadata?.durationMs)} · {formatSize(video.sizeBytes)}
          {youtubeOrigin && (
            <>
              {' · '}
              <a
                className="underline decoration-[#b7cbc0] underline-offset-2 transition hover:text-[#1d6b50]"
                href={youtubeOrigin.originalUrl}
                target="_blank"
                rel="noreferrer"
                title={youtubeOrigin.originalUrl}
              >
                YouTubeで開く
              </a>
            </>
          )}
        </p>
      </div>
      <div className="relative shrink-0" ref={changeMenuRef}>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-[#b7cbc0] bg-[#fbfcfa] px-2.5 py-2 text-[10px] font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#edf4ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => setIsChangeMenuOpen((open) => !open)}
          disabled={disabled || isSelecting}
          aria-haspopup="menu"
          aria-expanded={isChangeMenuOpen && !disabled && !isSelecting}
        >
          {isSelecting ? '選択中…' : '動画を変更'}
          {!isSelecting && <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />}
        </button>

        {isChangeMenuOpen && !disabled && !isSelecting && (
          <div
            className="absolute right-0 top-full z-30 mt-2 w-[224px] overflow-hidden rounded-[10px] border border-[#d8e1dc] bg-[#fbfcfa] p-1.5 shadow-[0_16px_38px_rgba(22,54,42,0.16)]"
            role="menu"
          >
            <button
              className="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2.5 text-left text-[11px] font-semibold text-[#53615b] transition hover:bg-[#eef5f0] hover:text-[#1d6b50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25"
              type="button"
              role="menuitem"
              onClick={() => {
                setIsChangeMenuOpen(false)
                void onChoose()
              }}
            >
              <FolderOpen size={15} strokeWidth={1.7} aria-hidden="true" />
              Finderで選択…
            </button>
            <hr className="my-1 h-px border-0 bg-[#d8e1dc]" />
            <button
              className="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2.5 text-left text-[11px] font-semibold text-[#71807b] transition hover:bg-[#eef5f0] hover:text-[#1d6b50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25"
              type="button"
              role="menuitem"
              onClick={() => {
                setIsChangeMenuOpen(false)
                onYoutubeDownload()
              }}
            >
              <Download size={15} strokeWidth={1.7} aria-hidden="true" />
              YouTubeからダウンロード…
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
