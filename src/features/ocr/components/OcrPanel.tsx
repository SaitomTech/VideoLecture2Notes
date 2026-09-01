import { RefreshCw, Square } from 'lucide-react'
import { ProcessingStatusRow } from '../../../components/ProcessingStatusRow'
import {
  getOcrModel,
  OCR_MODELS,
  type OcrModelId,
} from '../../../lib/ocr/modelManager'
import type { OcrController } from '../hooks/useOcr'

type OcrPanelProps = {
  ocr: OcrController
  modelId: OcrModelId
  onModelChange: (modelId: OcrModelId) => void
  disabled?: boolean
}

const stageLabels = {
  'preparing-model': 'OCRモデルを確認・準備中…',
  recognizing: 'スライド画像を読み取り中…',
} as const

function formatModelSize(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(2)}GB`
}

function progressRatio(ocr: OcrController) {
  if (ocr.status === 'completed') return 1
  if (ocr.status === 'cancelled') {
    return ocr.progress.total > 0 ? ocr.progress.completed / ocr.progress.total : 0
  }
  if (ocr.status !== 'running') return null
  if (ocr.stage === 'preparing-model') return ocr.progress.stageProgress
  return ocr.progress.total > 0 ? ocr.progress.completed / ocr.progress.total : 0
}

export function OcrPanel({ ocr, modelId, onModelChange, disabled = false }: OcrPanelProps) {
  const isRunning = ocr.status === 'running'
  const isCompleted = ocr.status === 'completed'
  const total = ocr.progress.total
  const model = getOcrModel(modelId)

  return (
    <section aria-labelledby="ocr-settings-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id="ocr-settings-heading" className="text-[15px] font-semibold text-[#18211f]">
            画像データから文字を抽出
          </h3>
          <p className="mt-1 text-xs text-[#71807b]">
            代表画像からスライドに表示された文字を抽出します。
          </p>
        </div>
        <button
          className={`inline-flex items-center justify-center gap-2 rounded-[9px] px-4 py-3 text-xs font-semibold shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${isRunning ? 'border border-[#d28d7a] bg-[#fff5f1] text-[#9d422d] shadow-none hover:bg-[#fbe8e2]' : 'bg-[#1d6b50] text-[#f3faf6] hover:bg-[#174d3c]'}`}
          type="button"
          onClick={() => {
            if (isRunning) {
              ocr.cancel()
              return
            }
            void ocr.recognize(isCompleted)
          }}
          disabled={disabled || (!isRunning && total === 0)}
          aria-label={isRunning ? 'OCRを停止' : undefined}
        >
          {isRunning ? <Square size={13} fill="currentColor" /> : <RefreshCw size={14} />}
          {isRunning ? '停止' : isCompleted ? '再OCR' : 'OCRを開始'}
        </button>
      </div>

      <div className="mt-4 rounded-[12px] border border-[#d8e1dc] bg-[#f7faf7] p-4 md:p-5">
        <label className="block text-xs text-[#71807b]" htmlFor="ocr-model">
          <span className="block font-semibold text-[#18211f]">使用モデル</span>
          <select
            id="ocr-model"
            className="mt-2 w-full rounded-[8px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2.5 text-sm text-[#18211f] outline-none focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/20 disabled:cursor-not-allowed disabled:opacity-50"
            value={modelId}
            onChange={(event) => onModelChange(event.target.value as OcrModelId)}
            disabled={disabled || isRunning}
          >
            {OCR_MODELS.map((ocrModel) => (
              <option key={ocrModel.id} value={ocrModel.id}>
                {ocrModel.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[10px] text-[#9aa6a1]">
            初回のみモデルをダウンロードします（約{formatModelSize(model.totalSizeBytes)}）。
          </span>
        </label>
      </div>
    </section>
  )
}

export function OcrStatus({ ocr, disabled = false }: Pick<OcrPanelProps, 'ocr' | 'disabled'>) {
  const isRunning = ocr.status === 'running'
  const isCompleted = ocr.status === 'completed'
  const isCancelled = ocr.status === 'cancelled'
  const progress = progressRatio(ocr)
  const progressLabel =
    isRunning && ocr.stage === 'preparing-model' && ocr.progress.stageProgress !== null
      ? `モデル ${Math.round(ocr.progress.stageProgress * 100)}%`
      : `${ocr.progress.completed} / ${ocr.progress.total} slides`
  const message = isRunning
    ? stageLabels[ocr.stage]
    : isCompleted
      ? 'すべてのSlideを処理しました。'
      : isCancelled
        ? 'OCRを停止しました。処理済みのSlideは保存されています。'
        : ocr.status === 'error'
          ? 'スライドOCRを完了できませんでした。'
          : 'まだ開始されていません。'

  return (
    <ProcessingStatusRow
      status={ocr.status}
      message={message}
      progress={progress}
      progressLabel={progressLabel}
      progressAriaLabel={isRunning ? stageLabels[ocr.stage] : 'OCRの進捗'}
      error={ocr.error}
      errorDetail={ocr.errorDetail}
      onRetry={() => ocr.recognize()}
      retryDisabled={disabled || isRunning}
    />
  )
}
