import { FilePenLine } from 'lucide-react'
import { SlideThumbnail } from '../../../components/SlideThumbnail'
import { formatTimestamp } from '../../../lib/time'
import type { SlideData } from '../../../types/project'

type AnalysisResultPreviewProps = {
  slides: SlideData[]
  onEdit: () => void
}

function ResultBlock({ label, value, emptyLabel }: { label: string; value: string; emptyLabel: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">{label}</p>
      <p className={`mt-1 whitespace-pre-wrap text-sm leading-7 ${value ? 'text-[#33413c]' : 'text-[#9aa6a1]'}`}>
        {value || emptyLabel}
      </p>
    </div>
  )
}

export function AnalysisResultPreview({ slides, onEdit }: AnalysisResultPreviewProps) {
  const hasArticle = slides.some((slide) => slide.transcript?.articleBody?.trim())
  const hasAnyResult = slides.some((slide) => slide.ocr || slide.transcript)

  return (
    <section className="mt-8 pt-4" aria-labelledby="analysis-result-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="analysis-result-heading" className="text-[21px] font-bold tracking-[-0.05em]">
            2. 解析結果の確認
          </h2>
          <p className="mt-1 text-xs text-[#71807b]">Slideごとに、画像・OCR・文字起こし・本文を確認できます。</p>
        </div>
        {hasArticle && (
          <button
            className="inline-flex items-center gap-2 rounded-[9px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30"
            type="button"
            onClick={onEdit}
          >
            <FilePenLine size={14} />
            記事を編集
          </button>
        )}
      </div>

      {hasAnyResult ? (
        <div className="mt-5 space-y-5">
          {slides.map((slide) => (
            <article
              className="grid gap-5 rounded-[12px] border border-[#d8e1dc] bg-[#fbfcfa] p-4 md:grid-cols-[minmax(340px,1fr)_minmax(0,1.45fr)] md:p-5"
              key={slide.id}
            >
              <div>
                <SlideThumbnail slide={slide} />
                <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold text-[#18211f]">
                    Slide {String(slide.index + 1).padStart(2, '0')}
                  </h3>
                  <span className="font-mono text-[10px] text-[#1d6b50]">
                    {formatTimestamp(slide.startMs)} — {formatTimestamp(slide.endMs)}
                  </span>
                </div>
              </div>

              <div className="min-w-0 space-y-5">
                <ResultBlock
                  label="スライド内の文字（OCR）"
                  value={slide.ocr?.rawText.trim() ?? ''}
                  emptyLabel="OCR結果はありません。"
                />
                <ResultBlock
                  label="音声データの文字起こし（補正前）"
                  value={slide.transcript?.raw.trim() ?? ''}
                  emptyLabel="この区間に発話はありません。"
                />
                <ResultBlock
                  label="本文"
                  value={slide.transcript?.articleBody?.trim() ?? ''}
                  emptyLabel="本文はまだ生成されていません。"
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 border-y border-dashed border-[#b7cbc0] px-4 py-8 text-center text-xs text-[#71807b]">
          解析を実行すると、ここにSlideごとの結果が表示されます。
        </div>
      )}
    </section>
  )
}
