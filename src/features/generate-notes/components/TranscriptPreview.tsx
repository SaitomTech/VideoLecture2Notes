import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { SlideThumbnail } from '../../../components/SlideThumbnail'
import { formatTimestamp } from '../../../lib/time'
import type { SlideData } from '../../../types/project'

type TranscriptPreviewProps = {
  slides: SlideData[]
}

export function TranscriptPreview({ slides }: TranscriptPreviewProps) {
  const [transcriptView, setTranscriptView] = useState<'corrected' | 'raw'>('corrected')
  const hasCorrection = slides.some((slide) => Boolean(slide.transcript?.corrected))

  return (
    <section className="mt-10 border-t border-[#d8e1dc] pt-8" aria-labelledby="transcript-preview-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="transcript-preview-heading" className="text-[21px] font-bold tracking-[-0.05em]">
            解析結果
          </h2>
          <p className="mt-1 text-xs text-[#71807b]">
            Slideごとに発話とスライド内の文字を確認できます。
          </p>
        </div>
        {hasCorrection && (
          <div
            className="inline-flex rounded-[8px] border border-[#b7cbc0] bg-[#f7faf7] p-0.5"
            role="group"
            aria-label="発話の表示切り替え"
          >
            <button
              className={`rounded-[6px] px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 ${transcriptView === 'corrected' ? 'bg-[#1d6b50] text-[#f3faf6]' : 'text-[#71807b] hover:bg-[#e2eee8] hover:text-[#174d3c]'}`}
              type="button"
              aria-pressed={transcriptView === 'corrected'}
              onClick={() => setTranscriptView('corrected')}
            >
              補正済み
            </button>
            <button
              className={`rounded-[6px] px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 ${transcriptView === 'raw' ? 'bg-[#1d6b50] text-[#f3faf6]' : 'text-[#71807b] hover:bg-[#e2eee8] hover:text-[#174d3c]'}`}
              type="button"
              aria-pressed={transcriptView === 'raw'}
              onClick={() => setTranscriptView('raw')}
            >
              raw
            </button>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-4">
        {slides.map((slide) => {
          const rawTranscript = slide.transcript?.raw.trim() ?? ''
          const correctedTranscript = slide.transcript?.corrected?.trim() ?? ''
          const showingCorrection = transcriptView === 'corrected' && Boolean(correctedTranscript)
          const transcript = showingCorrection ? correctedTranscript : rawTranscript
          const corrections = slide.transcript?.corrections ?? []
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
                <div className="mt-3 space-y-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">
                      {showingCorrection ? '補正済みの発話' : 'raw 発話'}
                    </p>
                    <p className={`whitespace-pre-wrap text-sm leading-7 ${transcript ? 'text-[#33413c]' : 'text-[#9aa6a1]'}`}>
                      {transcript || 'この区間に発話はありません。'}
                    </p>
                  </div>
                  {corrections.length > 0 && (
                    <div className="border-t border-[#e0e8e3] pt-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">補正箇所</p>
                        <span className="font-mono text-[10px] text-[#1d6b50]">{corrections.length}件</span>
                      </div>
                      <ul className="mt-2 space-y-2">
                        {corrections.map((item) => (
                          <li
                            className="rounded-[8px] bg-[#f0f5f1] px-3 py-2 text-xs text-[#33413c]"
                            key={`${item.before}-${item.after}-${item.reason ?? ''}`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="min-w-0 flex-1 break-words line-through decoration-[#b6533a]/60">
                                {item.before}
                              </span>
                              <ArrowRight className="mt-0.5 shrink-0 text-[#1d6b50]" size={13} />
                              <span className="min-w-0 flex-1 break-words font-semibold">
                                {item.after || '（削除）'}
                              </span>
                            </div>
                            {item.reason && <p className="mt-1 text-[11px] text-[#71807b]">{item.reason}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="border-t border-[#e0e8e3] pt-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">スライド内の文字</p>
                    <p className={`mt-1 whitespace-pre-wrap text-sm leading-7 ${slide.ocr?.rawText ? 'text-[#33413c]' : 'text-[#9aa6a1]'}`}>
                      {slide.ocr?.rawText || 'OCR未実行'}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
