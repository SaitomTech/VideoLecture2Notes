import { SlideThumbnail } from '../../../components/SlideThumbnail'
import { formatTimestamp } from '../../../lib/time'
import type { SlideData } from '../../../types/project'

type ArticleSectionEditorProps = {
  slide: SlideData
  body: string
  disabled?: boolean
  onBodyChange: (body: string) => void
}

export function ArticleSectionEditor({
  slide,
  body,
  disabled = false,
  onBodyChange,
}: ArticleSectionEditorProps) {
  const rawTranscript = slide.transcript?.raw.trim() || 'この区間に発話はありません。'
  const ocrText = slide.ocr?.rawText.trim() || 'OCR結果はありません。'

  return (
    <article className="rounded-[12px] border border-[#d8e1dc] bg-[#fbfcfa] p-4 md:p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-[#18211f]">
          Slide {String(slide.index + 1).padStart(2, '0')}
        </h2>
        <span className="font-mono text-[10px] text-[#1d6b50]">
          {formatTimestamp(slide.startMs)} — {formatTimestamp(slide.endMs)}
        </span>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.4fr)]">
        <SlideThumbnail slide={slide} />
        <div className="min-w-0">
          <label className="block text-xs font-semibold text-[#18211f]" htmlFor={`article-body-${slide.id}`}>
            記事本文
          </label>
          <textarea
            className="mt-2 min-h-44 w-full resize-y rounded-[8px] border border-[#b7cbc0] bg-white px-3 py-3 text-sm leading-7 text-[#33413c] outline-none transition placeholder:text-[#9aa6a1] focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/15 disabled:cursor-not-allowed disabled:bg-[#f0f5f1]"
            id={`article-body-${slide.id}`}
            value={body}
            disabled={disabled}
            onChange={(event) => onBodyChange(event.target.value)}
            placeholder="このSlideの記事本文を入力"
          />
        </div>
      </div>

      <details className="mt-5 border-t border-[#e0e8e3] pt-3">
        <summary className="cursor-pointer text-xs font-semibold text-[#71807b] outline-none marker:text-[#1d6b50] focus-visible:text-[#1d6b50]">
          元データを確認
        </summary>
        <div className="mt-4 grid gap-4 text-xs leading-6 text-[#53615b] md:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">raw 発話</p>
            <p className="mt-1 whitespace-pre-wrap">{rawTranscript}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">スライド内の文字</p>
            <p className="mt-1 whitespace-pre-wrap">{ocrText}</p>
          </div>
        </div>
      </details>
    </article>
  )
}
