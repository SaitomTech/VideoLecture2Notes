import { RefreshCw, Square } from 'lucide-react'
import { ModelSelect } from '../../../components/ModelSelect'
import { ProcessingStatusRow } from '../../../components/ProcessingStatusRow'
import { SlideThumbnail } from '../../../components/SlideThumbnail'
import {
  APPLE_FOUNDATION_MODELS,
  OPENAI_LUNA_MODEL,
  type ArticleModel,
  type ArticleModelId,
} from '../../../lib/article/articleModel'
import { formatTimestamp } from '../../../lib/time'
import { TEXT_MODELS } from '../../../lib/llama/textModel'
import type {
  MediaProject,
  TranscriptAlignmentSuggestion,
  TranscriptUnit,
} from '../../../types/project'
import { ArticleModelDetails } from '../../content-processing/components/ContentProcessingPanel'
import { alignmentNeedsRun } from '../alignment'
import type { TranscriptAlignmentController } from '../hooks/useTranscriptAlignment'

type TranscriptAlignmentPanelProps = {
  project: MediaProject
  alignment: TranscriptAlignmentController
  model: ArticleModel
  modelId: ArticleModelId
  onModelChange: (modelId: ArticleModelId) => void
  disabled?: boolean
  onApplySuggestion: (unitId: string, slideId: string) => void | Promise<void>
}

function SuggestionRow({
  suggestion,
  unit,
  fromSlide,
  toSlide,
  slideNumberById,
  actionLabel,
  actionSlideId,
  className,
  buttonClassName,
  disabled,
  onChange,
}: {
  suggestion: TranscriptAlignmentSuggestion
  unit: TranscriptUnit
  fromSlide: MediaProject['slides'][number]
  toSlide: MediaProject['slides'][number]
  slideNumberById: Map<string, number>
  actionLabel: string
  actionSlideId: string
  className: string
  buttonClassName: string
  disabled: boolean
  onChange: (unitId: string, slideId: string) => void | Promise<void>
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-[9px] border px-3 py-2.5 ${className}`}
      key={suggestion.unitId}
    >
      <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2.5'>
        <div className='w-[240px] shrink-0'>
          <p className='mb-1 text-[9px] font-semibold text-[#71807b]'>元 Slide {fromSlide.index + 1}</p>
          <SlideThumbnail slide={fromSlide} />
        </div>
        <span className='px-0.5 text-sm font-semibold text-[#9aa6a1]' aria-hidden='true'>
          →
        </span>
        <div className='w-[240px] shrink-0'>
          <p className='mb-1 text-[9px] font-semibold text-[#71807b]'>移動先 Slide {toSlide.index + 1}</p>
          <SlideThumbnail slide={toSlide} />
        </div>
        <div className='min-w-[180px] flex-1'>
          <p className='text-xs leading-6 text-[#33413c]'>{unit.text}</p>
          <p className='font-mono text-[9px] text-[#71807b]'>
            {formatTimestamp(unit.startMs)} · Slide {slideNumberById.get(suggestion.fromSlideId) ?? '?'}{' '}
            → Slide {slideNumberById.get(suggestion.toSlideId) ?? '?'} · 信頼度{' '}
            {Math.round(suggestion.confidence * 100)}%
          </p>
          {suggestion.reason && (
            <p className='mt-1 text-[10px] leading-5 text-[#71807b]'>理由: {suggestion.reason}</p>
          )}
        </div>
      </div>
      <button
        className={`shrink-0 rounded-[8px] border px-2.5 py-2 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
        type='button'
        onClick={() => void onChange(suggestion.unitId, actionSlideId)}
        disabled={disabled}
      >
        {actionLabel}
      </button>
    </div>
  )
}

function progressRatio(alignment: TranscriptAlignmentController) {
  if (alignment.status === 'completed') return 1
  if (alignment.status === 'running' && alignment.progress.total > 0) {
    return alignment.progress.completed / alignment.progress.total
  }
  return alignment.progress.stageProgress
}

export function TranscriptAlignmentPanel({
  project,
  alignment,
  model,
  modelId,
  onModelChange,
  disabled = false,
  onApplySuggestion,
}: TranscriptAlignmentPanelProps) {
  const isRunning = alignment.status === 'running'
  const hasCurrentAlignment =
    Boolean(project.transcriptAlignment) &&
    project.transcriptAlignment?.model === modelId &&
    !alignmentNeedsRun(project, modelId)
  const suggestions = hasCurrentAlignment ? (project.transcriptAlignment?.suggestions ?? []) : []
  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === 'pending')
  const autoAppliedSuggestions = suggestions.filter(
    (suggestion) => suggestion.status === 'auto-applied',
  )
  const acceptedSuggestions = suggestions.filter((suggestion) => suggestion.status === 'accepted')
  const revertedSuggestions = suggestions.filter((suggestion) => suggestion.status === 'reverted')
  const unitById = new Map(
    (hasCurrentAlignment ? (project.transcriptAlignment?.units ?? []) : []).map((unit) => [
      unit.id,
      unit,
    ]),
  )
  const slideById = new Map(project.slides.map((slide) => [slide.id, slide]))
  const slideNumberById = new Map(project.slides.map((slide) => [slide.id, slide.index + 1]))
  const total = alignment.progress.total
  const progress = progressRatio(alignment)
  const message =
    alignment.status === 'running'
      ? '境界付近の発話を前後のSlideと照合中…'
      : alignment.status === 'completed'
        ? `確認が必要: ${pendingSuggestions.length}件 / 自動で調整: ${autoAppliedSuggestions.length}件`
        : alignment.status === 'cancelled'
          ? '所属補正を停止しました。保存済みの結果は残っています。'
          : alignment.status === 'error'
            ? 'Slide所属の自動補正を完了できませんでした。'
            : '文字起こしと前後のSlideを比較し、境界付近の発話所属を補正できます。'
  const progressLabel =
    alignment.status === 'running' && alignment.stage === 'preparing-model' && total === 0
      ? alignment.progress.stageProgress === null
        ? '準備中'
        : `モデル ${Math.round(alignment.progress.stageProgress * 100)}%`
      : `${alignment.progress.completed} / ${total || '—'} 境界`

  return (
    <section aria-labelledby='transcript-alignment-heading'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h3
            id='transcript-alignment-heading'
            className='text-[15px] font-semibold text-[#18211f]'
          >
            文字起こしとSlideの対応を調整
          </h3>
          <p className='mt-1 text-xs text-[#71807b]'>
            境界前後の発話を、時刻と前後SlideのOCRから判定します。文章そのものは書き換えません。
          </p>
        </div>
        <button
          className={`inline-flex items-center justify-center gap-2 rounded-[9px] px-4 py-3 text-xs font-semibold shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${isRunning ? 'border border-[#d28d7a] bg-[#fff5f1] text-[#9d422d] shadow-none hover:bg-[#fbe8e2]' : 'bg-[#1d6b50] text-[#f3faf6] hover:bg-[#174d3c]'}`}
          type='button'
          onClick={() => (isRunning ? alignment.cancel() : void alignment.align())}
          disabled={disabled || !project.transcription || project.slides.length < 2}
          aria-label={isRunning ? 'Slide所属補正を停止' : undefined}
        >
          {isRunning ? <Square size={13} fill='currentColor' /> : <RefreshCw size={14} />}
          {isRunning ? '停止' : alignment.status === 'completed' ? '再補正' : '自動補正を開始'}
        </button>
      </div>

      <div className='mt-4 rounded-[12px] border border-[#d8e1dc] bg-[#f7faf7] p-4 md:p-5'>
        <label className='block text-xs text-[#71807b]' htmlFor='transcript-alignment-model'>
          <span className='block font-semibold text-[#18211f]'>使用モデル</span>
          <ModelSelect
            id='transcript-alignment-model'
            value={modelId}
            systemModels={[APPLE_FOUNDATION_MODELS]}
            localModels={TEXT_MODELS}
            apiModels={[OPENAI_LUNA_MODEL]}
            onChange={(nextModelId) => onModelChange(nextModelId as ArticleModelId)}
            disabled={disabled || isRunning}
            aria-label='Slide所属補正モデル'
          />
        </label>
        <ArticleModelDetails model={model} disabled={disabled || isRunning} />
      </div>

      <div className='mt-4'>
        <ProcessingStatusRow
          status={alignment.status}
          message={message}
          progress={progress}
          progressLabel={progressLabel}
          progressAriaLabel='Slide所属補正の進捗'
          error={alignment.error}
          onRetry={() => void alignment.align()}
          retryDisabled={disabled || isRunning || !project.transcription}
        />

        {pendingSuggestions.length > 0 && (
          <div className='py-4'>
            <p className='text-xs font-semibold text-[#18211f]'>確認が必要な候補</p>
            <div className='mt-3 space-y-2'>
              {pendingSuggestions.map((suggestion) => {
                const unit = unitById.get(suggestion.unitId)
                const fromSlide = slideById.get(suggestion.fromSlideId)
                const toSlide = slideById.get(suggestion.toSlideId)
                if (!unit || !fromSlide || !toSlide) return null
                return (
                  <SuggestionRow
                    key={suggestion.unitId}
                    suggestion={suggestion}
                    unit={unit}
                    fromSlide={fromSlide}
                    toSlide={toSlide}
                    slideNumberById={slideNumberById}
                    actionLabel={`Slide ${slideNumberById.get(suggestion.toSlideId) ?? '?'}へ移す`}
                    actionSlideId={suggestion.toSlideId}
                    className='border-[#e2d6b7] bg-[#fffaf0]'
                    buttonClassName='border-[#d8c48f] text-[#7d6327] hover:bg-[#f8edcf] focus-visible:ring-[#9a7a35]/30'
                    disabled={disabled}
                    onChange={onApplySuggestion}
                  />
                )
              })}
            </div>
          </div>
        )}

        {autoAppliedSuggestions.length > 0 && (
          <div className='py-4'>
            <p className='text-xs font-semibold text-[#18211f]'>自動適用された変更</p>
            <div className='mt-3 space-y-2'>
              {autoAppliedSuggestions.map((suggestion) => {
                const unit = unitById.get(suggestion.unitId)
                const fromSlide = slideById.get(suggestion.fromSlideId)
                const toSlide = slideById.get(suggestion.toSlideId)
                if (!unit || !fromSlide || !toSlide) return null
                return (
                  <SuggestionRow
                    key={suggestion.unitId}
                    suggestion={suggestion}
                    unit={unit}
                    fromSlide={fromSlide}
                    toSlide={toSlide}
                    slideNumberById={slideNumberById}
                    actionLabel={`元のSlide ${slideNumberById.get(suggestion.fromSlideId) ?? '?'}に戻す`}
                    actionSlideId={suggestion.fromSlideId}
                    className='border-[#c5ddd0] bg-[#f2faf5]'
                    buttonClassName='border-[#9fc5af] text-[#1d6b50] hover:bg-[#e0f1e7] focus-visible:ring-[#1d6b50]/30'
                    disabled={disabled}
                    onChange={onApplySuggestion}
                  />
                )
              })}
            </div>
          </div>
        )}

        {acceptedSuggestions.length > 0 && (
          <div className='py-4'>
            <p className='text-xs font-semibold text-[#18211f]'>手動で採用した変更</p>
            <div className='mt-3 space-y-2'>
              {acceptedSuggestions.map((suggestion) => {
                const unit = unitById.get(suggestion.unitId)
                const fromSlide = slideById.get(suggestion.fromSlideId)
                const toSlide = slideById.get(suggestion.toSlideId)
                if (!unit || !fromSlide || !toSlide) return null
                return (
                  <SuggestionRow
                    key={suggestion.unitId}
                    suggestion={suggestion}
                    unit={unit}
                    fromSlide={fromSlide}
                    toSlide={toSlide}
                    slideNumberById={slideNumberById}
                    actionLabel={`元のSlide ${slideNumberById.get(suggestion.fromSlideId) ?? '?'}に戻す`}
                    actionSlideId={suggestion.fromSlideId}
                    className='border-[#c5ddd0] bg-[#f7faf7]'
                    buttonClassName='border-[#b7cbc0] text-[#527065] hover:bg-[#e8f1eb] focus-visible:ring-[#527065]/30'
                    disabled={disabled}
                    onChange={onApplySuggestion}
                  />
                )
              })}
            </div>
          </div>
        )}

        {revertedSuggestions.length > 0 && (
          <div className='py-4'>
            <p className='text-xs font-semibold text-[#18211f]'>元のSlideへ戻した変更</p>
            <div className='mt-3 space-y-2'>
              {revertedSuggestions.map((suggestion) => {
                const unit = unitById.get(suggestion.unitId)
                const fromSlide = slideById.get(suggestion.fromSlideId)
                const toSlide = slideById.get(suggestion.toSlideId)
                if (!unit || !fromSlide || !toSlide) return null
                return (
                  <SuggestionRow
                    key={suggestion.unitId}
                    suggestion={suggestion}
                    unit={unit}
                    fromSlide={fromSlide}
                    toSlide={toSlide}
                    slideNumberById={slideNumberById}
                    actionLabel={`Slide ${slideNumberById.get(suggestion.toSlideId) ?? '?'}へ戻す`}
                    actionSlideId={suggestion.toSlideId}
                    className='border-[#e1d8c8] bg-[#fbfaf7]'
                    buttonClassName='border-[#d1c3a8] text-[#7d6945] hover:bg-[#f3eee3] focus-visible:ring-[#9a7a35]/30'
                    disabled={disabled}
                    onChange={onApplySuggestion}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
