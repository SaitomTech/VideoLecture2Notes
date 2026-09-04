import { RefreshCw, Square } from 'lucide-react'
import { ApiCostEstimate } from '../../../components/ApiCostEstimate'
import { OpenAiApiKeySettings } from '../../../components/OpenAiApiKeySettings'
import { ModelDescription } from '../../../components/ModelDescription'
import { ModelSelect } from '../../../components/ModelSelect'
import { ProcessingStatusRow } from '../../../components/ProcessingStatusRow'
import { estimateOpenAiArticleCost } from '../../../lib/openai/cost'
import type { MediaProject } from '../../../types/project'
import {
  APPLE_FOUNDATION_MODELS,
  OPENAI_LUNA_MODEL,
  type ArticleModel,
  type ArticleModelId,
} from '../../../lib/article/articleModel'
import { TEXT_MODELS } from '../../../lib/llama/textModel'
import type { ContentProcessingController } from '../hooks/useContentProcessing'
import { hasCurrentContent } from '../contentProcessing'

type ContentProcessingPanelProps = {
  project: MediaProject
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

export function ArticleModelDetails({
  model,
  disabled,
}: {
  model: ArticleModel
  disabled: boolean
}) {
  switch (model.provider) {
    case 'apple':
      return (
        <ModelDescription
          description={model.description}
          annotation='文字起こしとOCRテキストはMac内で処理します。macOS 26以降、対応するApple Silicon MacでApple Intelligenceを有効にしてください。'
        />
      )
    case 'local':
      return (
        <ModelDescription
          description={model.model.description}
          annotation={`初回のみモデルをダウンロードします（約${formatModelSize(model.model.totalSizeBytes)}）。`}
        />
      )
    case 'openai':
      return (
        <ModelDescription
          description={model.description}
          annotation='文字起こしとOCRテキストを外部送信します。動画・音声・画像は送信しません。'
        >
          <OpenAiApiKeySettings
            verificationModel={OPENAI_LUNA_MODEL.apiModel}
            verificationLabel={OPENAI_LUNA_MODEL.label}
            billingNote='API利用料は、入力したAPIキーに紐づくOpenAI APIの請求先に発生します。'
            disabled={disabled}
          />
        </ModelDescription>
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
  project,
  processing,
  model,
  modelId,
  onModelChange,
  disabled = false,
}: ContentProcessingPanelProps) {
  const isRunning = processing.status === 'running'
  const isCompleted = processing.status === 'completed'
  const total = processing.progress.total
  const targetSlides = project.slides.filter((slide) => slide.transcript?.raw.trim())
  const slidesToProcess = isCompleted
    ? targetSlides
    : targetSlides.filter((slide) => !hasCurrentContent(slide, modelId))
  const costEstimate =
    model.provider === 'openai'
      ? estimateOpenAiArticleCost({
          slides: slidesToProcess.map((slide) => ({
            transcriptCharacters: slide.transcript?.raw.length ?? 0,
            ocrCharacters: slide.ocr?.rawText.length ?? 0,
          })),
        })
      : undefined
  return (
    <section aria-labelledby='content-processing-heading'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h3 id='content-processing-heading' className='text-[15px] font-semibold text-[#18211f]'>
            本文を生成
          </h3>
          <p className='mt-1 text-xs text-[#71807b]'>
            スライドと音声の文字起こしをもとに、記事本文を生成します。
          </p>
        </div>
        <button
          className={`inline-flex items-center justify-center gap-2 rounded-[9px] px-4 py-3 text-xs font-semibold shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${isRunning ? 'border border-[#d28d7a] bg-[#fff5f1] text-[#9d422d] shadow-none hover:bg-[#fbe8e2]' : 'bg-[#1d6b50] text-[#f3faf6] hover:bg-[#174d3c]'}`}
          type='button'
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
          {isRunning ? <Square size={13} fill='currentColor' /> : <RefreshCw size={14} />}
          {isRunning ? '停止' : isCompleted ? '再生成' : '生成を開始'}
        </button>
      </div>

      <div className='mt-4 rounded-[12px] border border-[#d8e1dc] bg-[#f7faf7] p-4 md:p-5'>
        <label className='block text-xs text-[#71807b]' htmlFor='article-generation-model'>
          <span className='block font-semibold text-[#18211f]'>使用モデル</span>
          <ModelSelect
            id='article-generation-model'
            value={modelId}
            systemModels={[APPLE_FOUNDATION_MODELS]}
            localModels={TEXT_MODELS}
            apiModels={[OPENAI_LUNA_MODEL]}
            onChange={(nextModelId) => onModelChange(nextModelId as ArticleModelId)}
            disabled={disabled || isRunning}
            aria-label='使用モデル'
          />
        </label>
        <ArticleModelDetails model={model} disabled={disabled || isRunning} />
        <ApiCostEstimate isOpenAi={model.provider === 'openai'} estimate={costEstimate} />
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
  const skippedSlideLabel = processing.skippedSlides
    .map((slide) => `Slide ${slide.slideIndex + 1}`)
    .join('、')
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
      ? processing.skippedSlides.length > 0
        ? `記事本文の生成が完了しました。${skippedSlideLabel}はスキップしました。`
        : '記事本文をすべて生成しました。'
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
