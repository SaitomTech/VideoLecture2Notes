import { FilePenLine, Save, X } from 'lucide-react'
import { SlideThumbnail } from '../../../components/SlideThumbnail'
import { formatTimestamp } from '../../../lib/time'
import type { SlideData } from '../../../types/project'

type ArticleSectionEditorProps = {
  slide: SlideData
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

export function ArticleSectionEditor({
  slide,
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
      </div>
    </article>
  )
}
