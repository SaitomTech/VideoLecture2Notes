import { ChevronDown } from 'lucide-react'
import type { TranscriptionKeywordContext } from '../../../types/project'
import { formatTimestamp } from '../../../lib/time'

type TranscriptionKeywordsPanelProps = {
  context?: TranscriptionKeywordContext
}

export function TranscriptionKeywordsPanel({ context }: TranscriptionKeywordsPanelProps) {
  if (!context || context.chunks.length === 0) return null

  const keywordCount = context.chunks.reduce((total, chunk) => total + chunk.keywords.length, 0)

  return (
    <details className='group mt-4 rounded-[12px] border border-[#d8e1dc] bg-[#f7faf7]'>
      <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold text-[#315d4c] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1d6b50]/30 md:px-5'>
        <span>
          文字起こしに渡したOCRキーワード
          <span className='ml-2 font-mono text-[10px] font-normal text-[#71807b]'>
            {keywordCount}件 · {context.chunks.length}区間
          </span>
        </span>
        <span className='inline-flex shrink-0 items-center gap-1 text-[10px] font-normal text-[#71807b]'>
          クリックで展開
          <ChevronDown
            size={15}
            strokeWidth={1.8}
            aria-hidden='true'
            className='transition-transform duration-150 group-open:rotate-180'
          />
        </span>
      </summary>
      <div className='border-t border-[#d8e1dc] px-4 py-3 md:px-5'>
        <p className='text-[10px] leading-4 text-[#71807b]'>
          スライドOCRから抽出し、音声に含まれる用語の表記補助として文字起こしへ渡したキーワードです。
        </p>
        <div className='mt-3 space-y-2'>
          {context.chunks.map((chunk, chunkIndex) => (
            <div
              className='rounded-[9px] border border-[#d8e1dc] bg-[#fbfcfa] px-3 py-2.5'
              key={`${chunk.startMs}-${chunk.endMs}-${chunkIndex}`}
            >
              <p className='font-mono text-[10px] text-[#71807b]'>
                区間 {String(chunkIndex + 1).padStart(2, '0')} · {formatTimestamp(chunk.startMs)} —{' '}
                {formatTimestamp(chunk.endMs)}
              </p>
              {chunk.keywords.length > 0 ? (
                <div className='mt-2 flex flex-wrap gap-1.5'>
                  {chunk.keywords.map((keyword) => (
                    <code
                      className='rounded bg-[#e4f0e8] px-1.5 py-1 text-[10px] text-[#315d4c]'
                      key={keyword}
                    >
                      {keyword}
                    </code>
                  ))}
                </div>
              ) : (
                <p className='mt-1 text-[10px] text-[#9aa6a1]'>抽出されたキーワードはありません。</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}
