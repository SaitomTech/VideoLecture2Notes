import { Video } from 'lucide-react'
import { formatDuration, formatSize } from '../utils'
import type { SelectedVideo } from '../types'

type SelectedVideoSummaryProps = {
  video: SelectedVideo
  disabled: boolean
  isSelecting: boolean
  onChoose: () => void | Promise<void>
}

export function SelectedVideoSummary({
  video,
  disabled,
  isSelecting,
  onChoose,
}: SelectedVideoSummaryProps) {
  const youtubeOrigin = video.origin?.kind === 'youtube' ? video.origin : null

  return (
    <div
      className="rounded-[12px] border border-[#d8e1dc] bg-[#f7faf7] px-4 py-3"
      aria-live="polite"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Video size={17} className="mt-0.5 shrink-0 text-[#1d6b50]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#71807b]">
            選択した動画
          </p>
          <div className="mt-2 flex min-w-0 items-baseline gap-2.5">
            <p
              className="min-w-0 truncate text-[13px] font-semibold text-[#18211f]"
              title={video.path}
            >
              {video.name}
            </p>
            <span className="shrink-0 font-mono text-[10px] text-[#1d6b50]">
              .{video.extension}
            </span>
          </div>
          <dl className="mt-4 space-y-2 text-[10px]">
            <div className="flex min-w-0 items-baseline gap-5">
              <dt className="w-20 shrink-0 text-[#9aa6a1]">サイズ</dt>
              <dd className="min-w-0 font-mono text-[#71807b]">{formatSize(video.sizeBytes)}</dd>
            </div>
            <div className="flex min-w-0 items-baseline gap-5">
              <dt className="w-20 shrink-0 text-[#9aa6a1]">長さ</dt>
              <dd className="min-w-0 font-mono text-[#71807b]">
                {formatDuration(video.metadata?.durationMs)}
              </dd>
            </div>
            <div className="flex min-w-0 items-baseline gap-5">
              <dt className="w-20 shrink-0 text-[#9aa6a1]">解像度</dt>
              <dd className="min-w-0 font-mono text-[#71807b]">
                {video.metadata ? `${video.metadata.width} × ${video.metadata.height}` : '解析中…'}
              </dd>
            </div>
            {youtubeOrigin && (
              <div className="flex min-w-0 items-baseline gap-5">
                <dt className="w-20 shrink-0 text-[#9aa6a1]">元のURL</dt>
                <dd className="min-w-0 flex-1 truncate text-left">
                  <a
                    className="text-[#1d6b50] underline decoration-[#b7cbc0] underline-offset-2 transition hover:text-[#174d3c]"
                    href={youtubeOrigin.originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={youtubeOrigin.originalUrl}
                  >
                    {youtubeOrigin.originalUrl}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>
        <button
          className="inline-flex w-full shrink-0 items-center justify-center rounded-[8px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2 text-[11px] font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          type="button"
          onClick={() => void onChoose()}
          disabled={disabled || isSelecting}
        >
          {isSelecting ? '選択中…' : '別の動画を選択'}
        </button>
      </div>
    </div>
  )
}
