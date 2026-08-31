import { FilePenLine } from 'lucide-react'
import { SlideThumbnail } from '../../../components/SlideThumbnail'
import { formatTimestamp } from '../../../lib/time'
import type { SlideData } from '../../../types/project'

type ArticlePreviewProps = {
  slides: SlideData[]
  onEdit: () => void
}

export function ArticlePreview({ slides, onEdit }: ArticlePreviewProps) {
  return (
    <section className="mt-10 border-t border-[#d8e1dc] pt-8" aria-labelledby="article-preview-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="article-preview-heading" className="text-[21px] font-bold tracking-[-0.05em]">
            記事プレビュー
          </h2>
          <p className="mt-1 text-xs text-[#71807b]">
            スライド画像と、整形した本文を確認できます。
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-[9px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30"
          type="button"
          onClick={onEdit}
        >
          <FilePenLine size={14} />
          記事を編集
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {slides.map((slide) => (
          <article
            className="grid gap-4 rounded-[12px] border border-[#d8e1dc] bg-[#fbfcfa] p-3 md:grid-cols-[220px_minmax(0,1fr)] md:p-4"
            key={slide.id}
          >
            <SlideThumbnail slide={slide} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-sm font-semibold text-[#18211f]">
                  Slide {String(slide.index + 1).padStart(2, '0')}
                </h3>
                <span className="font-mono text-[10px] text-[#1d6b50]">
                  {formatTimestamp(slide.startMs)} — {formatTimestamp(slide.endMs)}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#33413c]">
                {slide.transcript?.articleBody}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
