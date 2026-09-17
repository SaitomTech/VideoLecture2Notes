import { FilePenLine, Save, X } from 'lucide-react'
import { useRef } from 'react'
import { SlideThumbnail } from '../../../components/SlideThumbnail'
import { formatTimestamp } from '../../../lib/time'
import { useVideoSourceUrl } from '../../../lib/media/useVideoSourceUrl'
import type { SlideData } from '../../../types/project'

type ArticleSectionEditorProps = {
  slide: SlideData
  videoPath: string
  body: string
  editing: boolean
  editDisabled?: boolean
  saving?: boolean
  canSave?: boolean
  error?: string | null
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onBodyChange: (body: string) => void
}

function SegmentVideoPreview({ slide, videoPath }: { slide: SlideData; videoPath: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoSource = useVideoSourceUrl(videoPath)
  const startTime = Math.max(0, slide.startMs / 1000)
  const endTime = Math.max(startTime, slide.endMs / 1000)

  return videoSource.src ? (
    <video
      ref={videoRef}
      className="block aspect-video w-full max-w-[420px] rounded-[8px] border border-[#d8e1dc] bg-[#0b1712] object-contain"
      src={videoSource.src}
      playsInline
      preload="metadata"
      controls
      onLoadedMetadata={(event) => {
        event.currentTarget.currentTime = startTime
      }}
      onTimeUpdate={(event) => {
        const video = event.currentTarget
        if (video.currentTime < startTime) {
          video.currentTime = startTime
          return
        }
        if (video.currentTime >= endTime) {
          video.pause()
          video.currentTime = startTime
        }
      }}
      onEnded={(event) => {
        event.currentTarget.currentTime = startTime
      }}
      aria-label={`Slide ${String(slide.index + 1).padStart(2, '0')}の区間動画`}
    />
  ) : (
    <div className="grid aspect-video w-full max-w-[420px] place-items-center rounded-[8px] border border-[#d8e1dc] bg-[#0b1712] text-[10px] text-[#b7cbc0]">
      動画を読み込んでいます…
    </div>
  )
}

export function ArticleSectionEditor({
  slide,
  videoPath,
  body,
  editing,
  editDisabled = false,
  saving = false,
  canSave = false,
  error = null,
  onEdit,
  onCancel,
  onSave,
  onBodyChange,
}: ArticleSectionEditorProps) {
  const rawTranscript = slide.transcript?.raw.trim() || 'この区間に発話はありません。'
  const ocrText = slide.ocr?.rawText.trim() || 'OCR結果はありません。'

  return (
    <article className="overflow-hidden rounded-[12px] border border-[#d8e1dc] bg-[#fbfcfa]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8e1dc] px-4 py-3 md:px-5">
        <div className="flex min-w-0 items-baseline gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold text-[#18211f]">
            Slide {String(slide.index + 1).padStart(2, '0')}
          </h2>
          <span className="font-mono text-[10px] text-[#1d6b50]">
            {formatTimestamp(slide.startMs)} — {formatTimestamp(slide.endMs)}
          </span>
          {editing && <span className="text-[10px] font-semibold text-[#9a7a35]">編集中</span>}
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#d8e1dc] px-2.5 py-2 text-[11px] font-semibold text-[#71807b] transition hover:border-[#9aa6a1] hover:bg-[#f1f3f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={onCancel}
              disabled={saving}
            >
              <X size={13} />
              キャンセル
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#1d6b50] px-2.5 py-2 text-[11px] font-semibold text-[#f3faf6] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={onSave}
              disabled={!canSave || saving}
            >
              <Save size={13} />
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        ) : (
          <button
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#b7cbc0] bg-[#f7faf7] px-2.5 py-2 text-[11px] font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-45"
            type="button"
            onClick={onEdit}
            disabled={editDisabled}
          >
            <FilePenLine size={13} />
            編集
          </button>
        )}
      </header>

      <div className="p-4 md:p-5">
        <div className="grid gap-5 md:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.4fr)]">
          <SlideThumbnail slide={slide} />
          <div className="min-w-0">
            {editing ? (
              <>
                <label
                  className="block text-xs font-semibold text-[#18211f]"
                  htmlFor={`article-body-${slide.id}`}
                >
                  記事本文
                </label>
                <textarea
                  className="mt-2 min-h-44 w-full resize-y rounded-[8px] border border-[#b7cbc0] bg-white px-3 py-3 text-sm leading-7 text-[#33413c] outline-none transition placeholder:text-[#9aa6a1] focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/15 disabled:cursor-not-allowed disabled:bg-[#f0f5f1]"
                  id={`article-body-${slide.id}`}
                  value={body}
                  disabled={saving}
                  onChange={(event) => onBodyChange(event.target.value)}
                  placeholder="このSlideの記事本文を入力"
                />
                {error && <p className="mt-2 text-xs text-[#b6533a]">{error}</p>}
              </>
            ) : (
              <div aria-label={`Slide ${slide.index + 1}の記事本文プレビュー`}>
                <p className="text-xs font-semibold text-[#71807b]">記事本文プレビュー</p>
                <p
                  className={`mt-3 whitespace-pre-wrap text-[15px] leading-8 ${body.trim() ? 'text-[#33413c]' : 'text-[#9aa6a1]'}`}
                >
                  {body.trim() || '本文はまだ生成されていません。'}
                </p>
              </div>
            )}
          </div>
        </div>

        <details className="mt-5 border-t border-[#e0e8e3] pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-[#71807b] outline-none marker:text-[#1d6b50] focus-visible:text-[#1d6b50]">
            元データを確認
          </summary>
          <div className="mt-4 grid gap-4 text-xs leading-6 text-[#53615b] md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">
                区間動画
              </p>
              <SegmentVideoPreview slide={slide} videoPath={videoPath} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">
                文字起こし結果
              </p>
              <p className="mt-1 whitespace-pre-wrap">{rawTranscript}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">
                OCR結果
              </p>
              <p className="mt-1 whitespace-pre-wrap">{ocrText}</p>
            </div>
          </div>
        </details>
      </div>
    </article>
  )
}
