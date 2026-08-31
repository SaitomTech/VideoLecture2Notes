import { SlideThumbnail } from '../../../components/SlideThumbnail'
import { formatTimestamp } from '../../../lib/time'
import type { SlideData } from '../../../types/project'

type TranscriptPreviewProps = {
  slides: SlideData[]
}

export function TranscriptPreview({ slides }: TranscriptPreviewProps) {
  return (
    <section className="mt-10 border-t border-[#d8e1dc] pt-8" aria-labelledby="transcript-preview-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="transcript-preview-heading" className="text-[21px] font-bold tracking-[-0.05em]">
            文字起こし結果
          </h2>
          <p className="mt-1 text-xs text-[#71807b]">Slideの区間ごとに発話を確認できます。</p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#1d6b50]">
          {slides.length} slides
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {slides.map((slide) => {
          const transcript = slide.transcript?.raw.trim() ?? ''
          return (
            <article className="grid gap-4 rounded-[12px] border border-[#d8e1dc] bg-[#fbfcfa] p-3 md:grid-cols-[220px_minmax(0,1fr)] md:p-4" key={slide.id}>
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
                <p className={`mt-3 whitespace-pre-wrap text-sm leading-7 ${transcript ? 'text-[#33413c]' : 'text-[#9aa6a1]'}`}>
                  {transcript || 'この区間に発話はありません。'}
                </p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
