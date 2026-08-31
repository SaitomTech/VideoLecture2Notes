import { AlertTriangle, Check, RefreshCw, ScanText } from 'lucide-react'
import { DEFAULT_OCR_MODEL } from '../../../lib/ocr/modelManager'
import type { OcrController } from '../hooks/useOcr'

type OcrPanelProps = {
  ocr: OcrController
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
  if (ocr.status !== 'running') return null
  if (ocr.stage === 'preparing-model') return ocr.progress.stageProgress
  return ocr.progress.total > 0 ? ocr.progress.completed / ocr.progress.total : 0
}

export function OcrPanel({ ocr, disabled = false }: OcrPanelProps) {
  const isRunning = ocr.status === 'running'
  const isCompleted = ocr.status === 'completed'
  const total = ocr.progress.total
  const progress = progressRatio(ocr)
  const statusLabel = isCompleted
    ? 'READY'
    : ocr.status === 'error'
      ? 'ERROR'
      : isRunning
        ? 'PROCESSING'
        : 'WAITING'

  return (
    <section className="mt-8 border-t border-[#e0e8e3] pt-6" aria-labelledby="ocr-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="ocr-heading" className="text-[21px] font-bold tracking-[-0.05em]">
              スライドOCR
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] ${isCompleted ? 'text-[#1d6b50]' : ocr.status === 'error' ? 'text-[#b6533a]' : 'text-[#9a7a35]'}`}
            >
              {isCompleted ? <Check size={13} /> : ocr.status === 'error' ? <AlertTriangle size={13} /> : <ScanText size={13} />}
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#71807b]">
            代表画像からスライドに表示された文字を抽出します。
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-[9px] border border-[#b7cbc0] bg-[#fbfcfa] px-4 py-3 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => void ocr.recognize(isCompleted)}
          disabled={disabled || isRunning || total === 0}
        >
          <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
          {isRunning ? 'OCR実行中…' : isCompleted ? '再OCR' : 'OCRを開始'}
        </button>
      </div>

      <div className="mt-5 grid gap-4 rounded-[12px] border border-[#d8e1dc] bg-[#f7faf7] p-4 md:grid-cols-2 md:p-5">
        <div className="text-xs text-[#71807b]">
          <span className="block font-semibold text-[#18211f]">使用モデル</span>
          <p className="mt-2 font-mono text-[11px] text-[#1d6b50]">{DEFAULT_OCR_MODEL.label}</p>
          <p className="mt-1 text-[10px] text-[#9aa6a1]">
            初回のみモデルをダウンロードします（約{formatModelSize(DEFAULT_OCR_MODEL.totalSizeBytes)}）。
          </p>
        </div>
        <div className="text-xs text-[#71807b]">
          <span className="block font-semibold text-[#18211f]">進捗</span>
          <p className="mt-2 font-mono text-[11px] text-[#1d6b50]">
            {ocr.progress.completed} / {total} slides
          </p>
          <p className="mt-1 text-[10px] text-[#9aa6a1]">
            {isRunning
              ? stageLabels[ocr.stage]
              : isCompleted
                ? 'すべてのSlideを処理しました。'
                : ocr.status === 'error'
                  ? 'スライドOCRを完了できませんでした。'
                  : 'まだ開始されていません。'}
          </p>
        </div>
      </div>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#e2eee8]" aria-label="OCRの進捗">
        {isRunning && progress === null ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#1d6b50]" />
        ) : (
          <div
            className="h-full rounded-full bg-[#1d6b50] transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, (progress ?? 0) * 100))}%` }}
          />
        )}
      </div>

      {ocr.error && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e4b4a7] bg-[#fff5f1] px-4 py-3 text-xs text-[#9d422d]" role="alert">
          <p className="min-w-0">{ocr.error}</p>
          <button
            className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#9d422d] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/30"
            type="button"
            onClick={() => void ocr.recognize()}
            disabled={disabled || isRunning}
          >
            <RefreshCw size={13} />
            再試行
          </button>
        </div>
      )}
    </section>
  )
}
