import { RefreshCw, Square } from 'lucide-react'
import { ProcessingStatusRow } from '../../../components/ProcessingStatusRow'
import {
  OPENAI_LUNA_MODEL,
  type ArticleModel,
  type ArticleModelId,
} from '../../../lib/article/articleModel'
import { TEXT_MODELS } from '../../../lib/llama/textModel'
import type { ContentProcessingController } from '../hooks/useContentProcessing'
import { OpenAiApiKeySettings } from './OpenAiApiKeySettings'

type ContentProcessingPanelProps = {
  processing: ContentProcessingController
  model: ArticleModel
  modelId: ArticleModelId
  onModelChange: (modelId: ArticleModelId) => void
  disabled?: boolean
}

const stageLabels = {
  'preparing-model': '文章処理モデルを確認・準備中…',
  processing: 'Slideごとに本文を生成中…',
} as const

function formatModelSize(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(2)}GB`
}

function assertNever(value: never): never {
  throw new Error(`未対応の本文生成プロバイダーです: ${JSON.stringify(value)}`)
}

function ArticleModelDetails({ model, disabled }: { model: ArticleModel; disabled: boolean }) {
  switch (model.provider) {
    case 'local':
      return (
        <>
          <span className="mt-1 block text-[10px] text-[#9aa6a1]">
            初回のみモデルをダウンロードします（約
            {formatModelSize(model.model.totalSizeBytes)}）。
          </span>
          <span className="mt-2 block rounded-[8px] border border-[#d8e1dc] bg-[#fbfcfa] px-3 py-2 text-xs leading-5 text-[#52635c]">
            {model.model.description}
          </span>
        </>
      )
    case 'openai':
      return (
        <>
          <span className="mt-1 block text-[10px] leading-4 text-[#9a7a35]">
            API利用料は設定したOpenAIアカウントに発生します。動画・音声・画像は送信しません。
          </span>
          <span className="mt-2 block rounded-[8px] border border-[#d8e1dc] bg-[#fbfcfa] px-3 py-2 text-xs leading-5 text-[#52635c]">
            {model.description}
          </span>
          <OpenAiApiKeySettings disabled={disabled} />
        </>
      )
    default:
      return assertNever(model)
  }
}

function progressRatio(processing: ContentProcessingController) {
  if (processing.status === 'completed') return 1
  if (processing.status === 'cancelled') {
    return processing.progress.total > 0
      ? processing.progress.completed / processing.progress.total
      : 0
  }
  if (processing.status !== 'running') return null
  if (processing.stage === 'preparing-model') return processing.progress.stageProgress
  return processing.progress.total > 0
    ? processing.progress.completed / processing.progress.total
    : 0
}

export function ContentProcessingPanel({
  processing,
  model,
  modelId,
  onModelChange,
  disabled = false,
}: ContentProcessingPanelProps) {
  const isRunning = processing.status === 'running'
  const isCompleted = processing.status === 'completed'
  const total = processing.progress.total
  return (
    <section aria-labelledby="content-processing-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id="content-processing-heading" className="text-[15px] font-semibold text-[#18211f]">
            本文を生成
          </h3>
          <p className="mt-1 text-xs text-[#71807b]">
            スライドと音声の文字起こしをもとに、記事本文を生成します。
          </p>
        </div>
        <button
          className={`inline-flex items-center justify-center gap-2 rounded-[9px] px-4 py-3 text-xs font-semibold shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${isRunning ? 'border border-[#d28d7a] bg-[#fff5f1] text-[#9d422d] shadow-none hover:bg-[#fbe8e2]' : 'bg-[#1d6b50] text-[#f3faf6] hover:bg-[#174d3c]'}`}
          type="button"
          onClick={() => {
            if (isRunning) {
              processing.cancel()
              return
            }
            void processing.process(isCompleted)
          }}
          disabled={disabled || (!isRunning && total === 0)}
          aria-label={isRunning ? '本文の生成を停止' : undefined}
        >
          {isRunning ? <Square size={13} fill="currentColor" /> : <RefreshCw size={14} />}
          {isRunning ? '停止' : isCompleted ? '再生成' : '生成を開始'}
        </button>
      </div>

      <div className="mt-4 rounded-[12px] border border-[#d8e1dc] bg-[#f7faf7] p-4 md:p-5">
        <label className="block text-xs text-[#71807b]" htmlFor="article-generation-model">
          <span className="block font-semibold text-[#18211f]">使用モデル</span>
          <select
            id="article-generation-model"
            className="mt-2 w-full rounded-[8px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2.5 text-sm text-[#18211f] outline-none focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/20 disabled:cursor-not-allowed disabled:opacity-50"
            value={modelId}
            onChange={(event) => onModelChange(event.target.value as ArticleModelId)}
            disabled={disabled || isRunning}
          >
            <optgroup label="ローカルモデル">
              {TEXT_MODELS.map((textModel) => (
                <option key={textModel.id} value={textModel.id}>
                  {textModel.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="OpenAI API">
              <option value={OPENAI_LUNA_MODEL.id}>{OPENAI_LUNA_MODEL.label}</option>
            </optgroup>
          </select>
        </label>
        <ArticleModelDetails model={model} disabled={disabled || isRunning} />
      </div>
    </section>
  )
}

export function ContentProcessingStatus({
  processing,
  disabled = false,
}: {
  processing: ContentProcessingController
  disabled?: boolean
}) {
  const isRunning = processing.status === 'running'
  const isCompleted = processing.status === 'completed'
  const isCancelled = processing.status === 'cancelled'
  const progress = progressRatio(processing)
  const progressLabel =
    isRunning &&
    processing.stage === 'preparing-model' &&
    processing.progress.stageProgress !== null
      ? `モデル ${Math.round(processing.progress.stageProgress * 100)}%`
      : `${processing.progress.completed} / ${processing.progress.total} slides`
  const message = isRunning
    ? stageLabels[processing.stage]
    : isCompleted
      ? '記事本文をすべて生成しました。'
      : isCancelled
        ? '生成を停止しました。処理済みのSlideは保存されています。'
        : processing.status === 'error'
          ? '記事本文の生成を完了できませんでした。'
          : processing.progress.total === 0
            ? '先に文字起こしを実行してください。'
            : 'まだ開始されていません。'

  return (
    <ProcessingStatusRow
      status={processing.status}
      message={message}
      progress={progress}
      progressLabel={progressLabel}
      progressAriaLabel={isRunning ? stageLabels[processing.stage] : '記事本文生成の進捗'}
      error={processing.error}
      onRetry={() => processing.process()}
      retryDisabled={disabled || isRunning || processing.progress.total === 0}
    />
  )
}
