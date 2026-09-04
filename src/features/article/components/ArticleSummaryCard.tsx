import {
  Check,
  FilePenLine,
  Lightbulb,
  RefreshCw,
  Save,
  Sparkles,
  Tag,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { ModelSelect } from '../../../components/ModelSelect'
import {
  APPLE_FOUNDATION_MODELS,
  OPENAI_LUNA_MODEL,
  getArticleModel,
  type ArticleModel,
  type ArticleModelId,
} from '../../../lib/article/articleModel'
import { TEXT_MODELS } from '../../../lib/llama/textModel'
import type { ArticleSummary } from '../../../types/project'
import type { ArticleSummaryController } from '../hooks/useArticleSummary'

type SummaryDraft = Pick<ArticleSummary, 'overview' | 'mainMessage' | 'keyPoints' | 'keywords'>

type ArticleSummaryCardProps = {
  summary?: ArticleSummary
  generation: ArticleSummaryController
  modelId: ArticleModelId
  onModelChange: (modelId: ArticleModelId) => void
  disabled?: boolean
  onGenerate: (force: boolean) => void
  onCancel: () => void
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

function modelDescription(model: ArticleModel) {
  return model.provider === 'local' ? model.model.description : model.description
}

function SummaryList({ values }: { values: string[] }) {
  return (
    <ul className='mt-3 space-y-2.5'>
      {values.map((value) => (
        <li className='flex gap-2.5 text-sm leading-7 text-[#33413c]' key={value}>
          <Check className='mt-1 shrink-0 text-[#1d6b50]' size={15} strokeWidth={2.2} />
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
    <label className='block'>
      <span className='block text-xs font-semibold text-[#18211f]'>{label}</span>
      <textarea
        className='mt-2 w-full resize-y rounded-[9px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2.5 text-sm leading-7 text-[#33413c] outline-none transition placeholder:text-[#9aa6a1] focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/15'
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </label>
  )
}

export function ArticleSummaryCard({
  summary,
  generation,
  modelId,
  onModelChange,
  disabled = false,
  onGenerate,
  onCancel,
  onSave,
}: ArticleSummaryCardProps) {
  const isRunning = generation.status === 'running'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<SummaryDraft | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const hasSummary = Boolean(summary)
  const canEdit = Boolean(summary) && !disabled && !isRunning && !isSaving
  const buttonLabel = generation.isUpToDate
    ? '要約を再生成'
    : hasSummary
      ? '要約を更新'
      : '要約を生成'

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
    if (
      !overview ||
      !draft.mainMessage.trim() ||
      keyPoints.length === 0 ||
      keywords.length === 0
    ) {
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
      className='mt-5 overflow-hidden rounded-[15px] border border-[#b7cbc0] bg-[#fbfcfa]'
      aria-labelledby='article-summary-heading'
    >
      <header className='border-b border-[#d8e1dc] bg-[#eef6f0] px-5 py-5 md:px-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <p className='flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#1d6b50]'>
              <Sparkles size={12} />
              AI SUMMARY
            </p>
            <h2 id='article-summary-heading' className='mt-1 text-[20px] font-bold tracking-[-0.05em]'>
              文書全体の要約
            </h2>
            <p className='mt-1 text-xs leading-5 text-[#71807b]'>
              生成済みのSlide本文全体から、伝えたいことと重要ポイントを整理します。
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            {summary && !editing && (
              <button
                className='inline-flex items-center gap-1.5 rounded-[8px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2 text-[11px] font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50'
                type='button'
                onClick={startEditing}
                disabled={!canEdit}
              >
                <FilePenLine size={13} />
                編集
              </button>
            )}
            {editing ? (
              <>
                <button
                  className='inline-flex items-center gap-1.5 rounded-[8px] border border-[#d8e1dc] bg-[#fbfcfa] px-3 py-2 text-[11px] font-semibold text-[#71807b] transition hover:bg-[#f1f3f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50'
                  type='button'
                  onClick={cancelEditing}
                  disabled={isSaving}
                >
                  <X size={13} />
                  キャンセル
                </button>
                <button
                  className='inline-flex items-center gap-1.5 rounded-[8px] bg-[#1d6b50] px-3 py-2 text-[11px] font-semibold text-[#f3faf6] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50'
                  type='button'
                  onClick={() => void saveEditing()}
                  disabled={isSaving}
                >
                  <Save size={13} />
                  {isSaving ? '保存中…' : '保存'}
                </button>
              </>
            ) : (
              <button
                className='inline-flex items-center gap-1.5 rounded-[8px] bg-[#1d6b50] px-3 py-2 text-[11px] font-semibold text-[#f3faf6] shadow-[0_5px_12px_rgba(29,107,80,0.15)] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'
                type='button'
                onClick={() => (isRunning ? onCancel() : onGenerate(generation.isUpToDate))}
                disabled={isRunning ? false : disabled || !generation.hasAllArticleBodies}
              >
                <RefreshCw className={isRunning ? 'animate-spin' : undefined} size={13} />
                {isRunning ? '停止' : buttonLabel}
              </button>
            )}
          </div>
        </div>
        {generation.stage === 'preparing-model' &&
          isRunning &&
          generation.stageProgress !== null && (
            <div className='mt-4'>
              <div className='flex items-center justify-between font-mono text-[10px] text-[#71807b]'>
                <span>モデルを準備中</span>
                <span>{Math.round(generation.stageProgress * 100)}%</span>
              </div>
              <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-[#d8e9dd]'>
                <div
                  className='h-full rounded-full bg-[#1d6b50] transition-[width]'
                  style={{ width: `${generation.stageProgress * 100}%` }}
                />
              </div>
            </div>
          )}
        {!generation.hasAllArticleBodies && (
          <p className='mt-4 rounded-[8px] border border-[#ead8a8] bg-[#fffaf0] px-3 py-2 text-xs leading-5 text-[#8b6a2b]'>
            Slide本文をすべて生成すると、文書全体の要約を作成できます。
          </p>
        )}
        <div className='mt-4 max-w-[440px]'>
          <label className='block text-xs text-[#71807b]' htmlFor='article-summary-model'>
            <span className='block font-semibold text-[#18211f]'>要約に使うモデル</span>
            <ModelSelect
              id='article-summary-model'
              value={modelId}
              systemModels={[APPLE_FOUNDATION_MODELS]}
              localModels={TEXT_MODELS}
              apiModels={[OPENAI_LUNA_MODEL]}
              onChange={(nextModelId) => onModelChange(nextModelId as ArticleModelId)}
              disabled={disabled || isRunning || editing || isSaving}
              aria-label='要約に使うモデル'
            />
          </label>
          <p className='mt-1.5 text-[10px] leading-5 text-[#9aa6a1]'>
            {modelDescription(getArticleModel(modelId))}
          </p>
        </div>
        {generation.error && (
          <p className='mt-4 rounded-[8px] border border-[#e6b6a8] bg-[#fff5f1] px-3 py-2 text-xs leading-5 text-[#9d422d]'>
            {generation.error}
          </p>
        )}
        {saveError && (
          <p className='mt-4 rounded-[8px] border border-[#e6b6a8] bg-[#fff5f1] px-3 py-2 text-xs leading-5 text-[#9d422d]'>
            {saveError}
          </p>
        )}
      </header>

      {editing && draft ? (
        <div className='grid gap-5 p-5 md:grid-cols-2 md:p-6'>
          <div className='md:col-span-2'>
            <SummaryField
              label='概要'
              value={draft.overview}
              onChange={(overview) =>
                setDraft((current) => (current ? { ...current, overview } : current))
              }
              placeholder='文書全体の概要'
              rows={4}
            />
          </div>
          <div className='md:col-span-2'>
            <SummaryField
              label='中心メッセージ'
              value={draft.mainMessage}
              onChange={(mainMessage) =>
                setDraft((current) => (current ? { ...current, mainMessage } : current))
              }
              placeholder='講演者・講師が最も伝えたかった主張や結論'
              rows={3}
            />
          </div>
          <SummaryField
            label='主なポイント（1行に1つ）'
            value={listText(draft.keyPoints)}
            onChange={(value) =>
              setDraft((current) =>
                current ? { ...current, keyPoints: nonEmptyLines(value) } : current,
              )
            }
            placeholder='重要なポイントを1行ずつ'
            rows={6}
          />
          <SummaryField
            label='キーワード（1行に1つ）'
            value={listText(draft.keywords)}
            onChange={(value) =>
              setDraft((current) =>
                current ? { ...current, keywords: nonEmptyLines(value) } : current,
              )
            }
            placeholder='重要な概念や専門用語を1行ずつ'
            rows={6}
          />
        </div>
      ) : summary ? (
        <div className='p-5 md:p-6'>
          {!generation.isUpToDate && (
            <p className='mb-5 rounded-[8px] border border-[#ead8a8] bg-[#fffaf0] px-3 py-2 text-xs leading-5 text-[#8b6a2b]'>
              本文が変更されています。最新の内容を反映するには要約を更新してください。
            </p>
          )}
          <div>
            <h3 className='text-xs font-semibold tracking-[0.03em] text-[#71807b]'>概要</h3>
            <p className='mt-2 text-[15px] leading-8 text-[#33413c]'>{summary.overview}</p>
          </div>

          <div className='mt-6 border-t border-[#d8e1dc] pt-5'>
            <h3 className='text-xs font-semibold tracking-[0.03em] text-[#71807b]'>中心メッセージ</h3>
            <p className='mt-3 rounded-[9px] bg-[#f4f8f4] px-4 py-3 text-[15px] leading-8 text-[#33413c]'>
              {summary.mainMessage}
            </p>
          </div>

          <div className='mt-6 grid gap-6 border-t border-[#d8e1dc] pt-5 md:grid-cols-2'>
            <div>
              <div className='flex items-center gap-2'>
                <Lightbulb className='text-[#1d6b50]' size={15} />
                <h3 className='text-xs font-semibold tracking-[0.03em] text-[#71807b]'>主なポイント</h3>
              </div>
              <SummaryList values={summary.keyPoints} />
            </div>
            <div>
              <div className='flex items-center gap-2'>
                <Tag className='text-[#1d6b50]' size={15} />
                <h3 className='text-xs font-semibold tracking-[0.03em] text-[#71807b]'>キーワード</h3>
              </div>
              <div className='mt-3 flex flex-wrap gap-2'>
                {summary.keywords.length > 0 ? (
                  summary.keywords.map((keyword) => (
                    <span
                      className='rounded-full border border-[#b7cbc0] bg-[#f4f8f4] px-2.5 py-1 text-xs text-[#53615b]'
                      key={keyword}
                    >
                      {keyword}
                    </span>
                  ))
                ) : (
                  <p className='text-sm text-[#9aa6a1]'>キーワードはありません。</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className='px-5 py-8 text-center md:px-6'>
          <Sparkles className='mx-auto text-[#9dbbad]' size={22} />
          <p className='mt-3 text-sm font-semibold text-[#53615b]'>まだ要約がありません</p>
          <p className='mt-1 text-xs leading-5 text-[#9aa6a1]'>
            本文全体を読み、概要・中心メッセージ・主なポイント・キーワードを自動で整理します。
          </p>
        </div>
      )}
    </section>
  )
}
