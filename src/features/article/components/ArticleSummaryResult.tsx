import { Check, FilePenLine, Lightbulb, Save, Sparkles, Tag, X } from 'lucide-react'
import { useState } from 'react'
import type { ArticleSummary } from '../../../types/project'

type SummaryDraft = Pick<ArticleSummary, 'overview' | 'mainMessage' | 'keyPoints' | 'keywords'>

type ArticleSummaryResultProps = {
  summary?: ArticleSummary
  isUpToDate: boolean
  disabled?: boolean
  onSave: (summary: ArticleSummary) => void | Promise<void>
}

function draftFromSummary(summary: ArticleSummary): SummaryDraft {
  return {
    overview: summary.overview,
    mainMessage: summary.mainMessage,
    keyPoints: summary.keyPoints,
    keywords: summary.keywords,
  }
}

function listText(values: string[]) {
  return values.join('\n')
}

function nonEmptyLines(value: string | string[]) {
  const values = typeof value === 'string' ? value.split('\n') : value
  return values.flatMap((line) => {
    const trimmed = line.trim()
    return trimmed ? [trimmed] : []
  })
}

function SummaryList({ values }: { values: string[] }) {
  return (
    <ul className="mt-3 space-y-2.5">
      {values.map((value) => (
        <li className="flex gap-2.5 text-sm leading-7 text-[#33413c]" key={value}>
          <Check className="mt-1 shrink-0 text-[#1d6b50]" size={15} strokeWidth={2.2} />
          <span>{value}</span>
        </li>
      ))}
    </ul>
  )
}

function SummaryField({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  rows: number
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-[#18211f]">{label}</span>
      <textarea
        className="mt-2 w-full resize-y rounded-[9px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2.5 text-sm leading-7 text-[#33413c] outline-none transition placeholder:text-[#9aa6a1] focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/15"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </label>
  )
}

export function ArticleSummaryResult({
  summary,
  isUpToDate,
  disabled = false,
  onSave,
}: ArticleSummaryResultProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<SummaryDraft | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const canEdit = Boolean(summary) && !disabled && !isSaving

  const startEditing = () => {
    if (!summary || !canEdit) return
    setDraft(draftFromSummary(summary))
    setSaveError(null)
    setEditing(true)
  }

  const cancelEditing = () => {
    setDraft(null)
    setSaveError(null)
    setEditing(false)
  }

  const saveEditing = async () => {
    if (!summary || !draft) return

    const overview = draft.overview.trim()
    const keyPoints = nonEmptyLines(draft.keyPoints)
    const keywords = nonEmptyLines(draft.keywords)
    if (!overview || !draft.mainMessage.trim() || keyPoints.length === 0 || keywords.length === 0) {
      setSaveError('概要、中心メッセージ、主なポイント、キーワードを入力してください。')
      return
    }

    setIsSaving(true)
    setSaveError(null)
    try {
      await onSave({
        ...summary,
        overview,
        mainMessage: draft.mainMessage.trim(),
        keyPoints,
        keywords,
      })
      setEditing(false)
      setDraft(null)
    } catch (error) {
      console.error(error)
      setSaveError(error instanceof Error ? error.message : '要約の保存に失敗しました。')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section
      className="mt-6 overflow-hidden rounded-[15px] border border-[#b7cbc0] bg-[#fbfcfa]"
      aria-labelledby="article-summary-result-heading"
    >
      <header className="border-b border-[#d8e1dc] bg-[#eef6f0] px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#1d6b50]">
              <Sparkles size={12} />
              AI SUMMARY
            </p>
            <h3
              id="article-summary-result-heading"
              className="mt-1 text-[20px] font-bold tracking-[-0.05em]"
            >
              文書全体の要約
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#71807b]">
              生成された要約を確認・編集できます。
            </p>
          </div>
          {summary && (
            <div className="flex flex-wrap items-center gap-2">
              {editing ? (
                <>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#d8e1dc] bg-[#fbfcfa] px-3 py-2 text-[11px] font-semibold text-[#71807b] transition hover:bg-[#f1f3f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    onClick={cancelEditing}
                    disabled={isSaving}
                  >
                    <X size={13} />
                    キャンセル
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#1d6b50] px-3 py-2 text-[11px] font-semibold text-[#f3faf6] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    onClick={() => void saveEditing()}
                    disabled={isSaving}
                  >
                    <Save size={13} />
                    {isSaving ? '保存中…' : '保存'}
                  </button>
                </>
              ) : (
                <button
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2 text-[11px] font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  onClick={startEditing}
                  disabled={!canEdit}
                >
                  <FilePenLine size={13} />
                  編集
                </button>
              )}
            </div>
          )}
        </div>
        {saveError && (
          <p className="mt-4 rounded-[8px] border border-[#e6b6a8] bg-[#fff5f1] px-3 py-2 text-xs leading-5 text-[#9d422d]">
            {saveError}
          </p>
        )}
      </header>

      {editing && draft ? (
        <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
          <div className="md:col-span-2">
            <SummaryField
              label="概要"
              value={draft.overview}
              onChange={(overview) =>
                setDraft((current) => (current ? { ...current, overview } : current))
              }
              placeholder="文書全体の概要"
              rows={4}
            />
          </div>
          <div className="md:col-span-2">
            <SummaryField
              label="中心メッセージ"
              value={draft.mainMessage}
              onChange={(mainMessage) =>
                setDraft((current) => (current ? { ...current, mainMessage } : current))
              }
              placeholder="講演者・講師が最も伝えたかった主張や結論"
              rows={3}
            />
          </div>
          <SummaryField
            label="主なポイント（1行に1つ）"
            value={listText(draft.keyPoints)}
            onChange={(value) =>
              setDraft((current) =>
                current ? { ...current, keyPoints: nonEmptyLines(value) } : current,
              )
            }
            placeholder="重要なポイントを1行ずつ"
            rows={6}
          />
          <SummaryField
            label="キーワード（1行に1つ）"
            value={listText(draft.keywords)}
            onChange={(value) =>
              setDraft((current) =>
                current ? { ...current, keywords: nonEmptyLines(value) } : current,
              )
            }
            placeholder="重要な概念や専門用語を1行ずつ"
            rows={6}
          />
        </div>
      ) : summary ? (
        <div className="p-5 md:p-6">
          {!isUpToDate && (
            <p className="mb-5 rounded-[8px] border border-[#ead8a8] bg-[#fffaf0] px-3 py-2 text-xs leading-5 text-[#8b6a2b]">
              本文が変更されています。最新の内容を反映するには、Step 1で要約を更新してください。
            </p>
          )}
          <div>
            <h4 className="text-xs font-semibold tracking-[0.03em] text-[#71807b]">概要</h4>
            <p className="mt-2 text-[15px] leading-8 text-[#33413c]">{summary.overview}</p>
          </div>

          <div className="mt-6 border-t border-[#d8e1dc] pt-5">
            <h4 className="text-xs font-semibold tracking-[0.03em] text-[#71807b]">
              中心メッセージ
            </h4>
            <p className="mt-3 rounded-[9px] bg-[#f4f8f4] px-4 py-3 text-[15px] leading-8 text-[#33413c]">
              {summary.mainMessage}
            </p>
          </div>

          <div className="mt-6 grid gap-6 border-t border-[#d8e1dc] pt-5 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-2">
                <Lightbulb className="text-[#1d6b50]" size={15} />
                <h4 className="text-xs font-semibold tracking-[0.03em] text-[#71807b]">
                  主なポイント
                </h4>
              </div>
              <SummaryList values={summary.keyPoints} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Tag className="text-[#1d6b50]" size={15} />
                <h4 className="text-xs font-semibold tracking-[0.03em] text-[#71807b]">
                  キーワード
                </h4>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {summary.keywords.length > 0 ? (
                  summary.keywords.map((keyword) => (
                    <span
                      className="rounded-full border border-[#b7cbc0] bg-[#f4f8f4] px-2.5 py-1 text-xs text-[#53615b]"
                      key={keyword}
                    >
                      {keyword}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-[#9aa6a1]">キーワードはありません。</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="px-5 py-8 text-center text-xs leading-5 text-[#71807b] md:px-6">
          Step 1で要約を生成すると、ここに結果が表示されます。
        </p>
      )}
    </section>
  )
}
