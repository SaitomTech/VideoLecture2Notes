import { Check, Download, Link, LoaderCircle, Search } from 'lucide-react'
import { formatDuration } from '../utils'
import type { YoutubeDownloadProgress, YoutubeVideoInfo } from '../../../lib/youtube/types'
import type { YoutubeImportQuality } from '../../../types/project'
import type { YoutubeResolveStatus } from '../types'

type YoutubeImportPanelProps = {
  url: string
  info: YoutubeVideoInfo | null
  status: YoutubeResolveStatus
  error: string | null
  quality: YoutubeImportQuality
  isImporting: boolean
  progress: YoutubeDownloadProgress | null
  externalError: string | null
  onUrlChange: (value: string) => void
  onResolve: () => void | Promise<void>
  onQualityChange: (quality: YoutubeImportQuality) => void
  onImport: () => void | Promise<void>
  onCancel: () => void
}

function progressLabel(progress: YoutubeDownloadProgress | null) {
  if (!progress) return '動画を取得しています…'
  if (progress.phase === 'merging') return '映像と音声を結合しています…'
  if (progress.phase === 'transcoding') return '再生用に動画を変換しています…'
  if (progress.phase === 'checking') return '動画を確認しています…'
  if (progress.phase === 'finalizing') return '動画を保存しています…'
  if (progress.percent === undefined) return '動画を取得しています…'
  const streamLabel = progress.stream === 'audio' ? '音声' : '映像'
  return `${streamLabel}を取得しています… ${Math.round(progress.percent)}%`
}

function isPostProcessing(progress: YoutubeDownloadProgress | null) {
  return Boolean(progress && progress.phase !== 'downloading')
}

export function YoutubeImportPanel({
  url,
  info,
  status,
  error,
  quality,
  isImporting,
  progress,
  externalError,
  onUrlChange,
  onResolve,
  onQualityChange,
  onImport,
  onCancel,
}: YoutubeImportPanelProps) {
  const canImport = Boolean(info && !isImporting)

  return (
    <section
      className="rounded-[18px] border border-[#b7cbc0] bg-[#fbfcfa] p-5 shadow-[0_18px_52px_rgba(22,54,42,0.05)] sm:p-6"
      aria-labelledby="youtube-import-title"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#e2eee8] text-[#1d6b50]">
          <Link size={19} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <div>
          <h2
            id="youtube-import-title"
            className="text-[17px] font-semibold tracking-[-0.04em] text-[#18211f]"
          >
            YouTube URLから読み込む
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#71807b]">
            公開済みの単一動画をMacに保存して、通常の動画として解析します。
          </p>
        </div>
      </div>

      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault()
          void onResolve()
        }}
      >
        <label className="text-xs font-semibold text-[#53615b]" htmlFor="youtube-url">
          YouTube URL
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="youtube-url"
            className="h-11 min-w-0 flex-1 rounded-[9px] border border-[#b7cbc0] bg-white px-3 text-sm text-[#18211f] outline-none transition placeholder:text-[#9aa6a1] focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/15 disabled:cursor-not-allowed disabled:bg-[#eef3ef]"
            type="url"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            autoComplete="url"
            spellCheck={false}
            disabled={isImporting}
            aria-describedby="youtube-url-help"
          />
          <button
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[9px] border border-[#b7cbc0] bg-[#eef3ef] px-4 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={isImporting || status === 'resolving' || !url.trim()}
          >
            {status === 'resolving' ? (
              <LoaderCircle className="animate-spin" size={15} />
            ) : (
              <Search size={15} />
            )}
            {status === 'resolving' ? '解析中…' : '動画を確認'}
          </button>
        </div>
        <p id="youtube-url-help" className="mt-2 text-[10px] leading-5 text-[#9aa6a1]">
          watch / youtu.be / shorts / embed に対応。プレイリストとライブ配信中の動画は対象外です。
        </p>
      </form>

      {info && (
        <div className="mt-5 rounded-[12px] border border-[#d8e1dc] bg-[#f4f7f4] p-4">
          <div className="flex gap-3">
            {info.thumbnailUrl ? (
              <img
                className="aspect-video w-[128px] shrink-0 rounded-[7px] border border-[#d8e1dc] bg-[#e5eee8] object-cover"
                src={info.thumbnailUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="grid aspect-video w-[128px] shrink-0 place-items-center rounded-[7px] border border-[#d8e1dc] bg-[#e5eee8] text-[#9aada3]">
                <Link size={21} strokeWidth={1.4} aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0">
              <p className="line-clamp-3 text-sm font-semibold leading-5 text-[#18211f]">
                {info.title}
              </p>
              {info.channelTitle && (
                <p className="mt-1 truncate text-xs text-[#53615b]">{info.channelTitle}</p>
              )}
              <p className="mt-2 font-mono text-[10px] text-[#71807b]">
                {formatDuration(info.durationMs)}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-[#d8e1dc] pt-4">
            <label className="block text-xs font-semibold text-[#53615b]" htmlFor="youtube-quality">
              取得画質
              <select
                id="youtube-quality"
                className="mt-1.5 block h-10 w-full rounded-[8px] border border-[#b7cbc0] bg-white px-2.5 text-xs font-normal text-[#18211f] outline-none focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/15 sm:w-[180px]"
                value={quality}
                onChange={(event) => onQualityChange(event.target.value as YoutubeImportQuality)}
                disabled={isImporting}
              >
                <option value="720p">720p（推奨）</option>
                <option value="1080p">1080p</option>
                <option value="best">最高画質</option>
              </select>
            </label>
          </div>

          {isImporting ? (
            <div className="mt-4 border-t border-[#d8e1dc] pt-4" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#1d6b50]">
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle className="animate-spin" size={14} />
                  {progressLabel(progress)}
                </span>
                {progress?.eta && (
                  <span className="font-mono text-[10px] font-normal text-[#71807b]">
                    ETA {progress.eta}
                  </span>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#d8e1dc]">
                {isPostProcessing(progress) ? (
                  <div className="h-full w-1/3 rounded-full bg-[#1d6b50] animate-pulse" />
                ) : (
                  <div
                    className="h-full rounded-full bg-[#1d6b50] transition-[width] duration-300"
                    style={{ width: `${Math.min(100, Math.max(4, progress?.percent ?? 4))}%` }}
                  />
                )}
              </div>
              <button
                className="mt-3 rounded-md px-2 py-1.5 text-[10px] font-semibold text-[#a4573e] transition hover:bg-[#fff0e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/25"
                type="button"
                onClick={onCancel}
              >
                取得をキャンセル
              </button>
            </div>
          ) : (
            <button
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[9px] bg-[#1d6b50] px-4 py-3 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:-translate-y-0.5 hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
              type="button"
              onClick={() => void onImport()}
              disabled={!canImport}
            >
              <Download size={15} />
              動画を取得してスライド領域を設定
            </button>
          )}
        </div>
      )}

      {(error || externalError) && (
        <p className="mt-3 text-xs leading-5 text-[#b6533a]">{error || externalError}</p>
      )}

      {info && !isImporting && !error && !externalError && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-[#1d6b50]">
          <Check size={13} />
          取得後は動画をプロジェクト内に保存します。
        </p>
      )}
    </section>
  )
}
