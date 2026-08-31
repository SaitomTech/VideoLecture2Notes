import { AlertTriangle, Check, FilePenLine, RefreshCw } from 'lucide-react'
import type { TextModel } from '../../../lib/llama/textModel'
import type { CorrectionMode } from '../../../types/project'
import { CORRECTION_MODES } from '../correction'
import type { CorrectionController } from '../hooks/useCorrection'

type CorrectionPanelProps = {
  correction: CorrectionController
  model: TextModel
  correctionMode: CorrectionMode
  onCorrectionModeChange: (mode: CorrectionMode) => void
  disabled?: boolean
}

const stageLabels = {
  'preparing-model': '補正モデルを確認・準備中…',
  correcting: 'Slideごとに文字起こしを補正中…',
} as const

function formatModelSize(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(2)}GB`
}

function progressRatio(correction: CorrectionController) {
  if (correction.status === 'completed') return 1
  if (correction.status !== 'running') return null
  if (correction.stage === 'preparing-model') return correction.progress.stageProgress
  return correction.progress.total > 0 ? correction.progress.completed / correction.progress.total : 0
}

export function CorrectionPanel({
  correction,
  model,
  correctionMode,
  onCorrectionModeChange,
  disabled = false,
}: CorrectionPanelProps) {
  const isRunning = correction.status === 'running'
  const isCompleted = correction.status === 'completed'
  const total = correction.progress.total
  const progress = progressRatio(correction)
  const statusLabel = isCompleted
    ? 'READY'
    : correction.status === 'error'
      ? 'ERROR'
      : isRunning
        ? 'PROCESSING'
        : 'WAITING'

  return (
    <section className="mt-8 border-t border-[#e0e8e3] pt-6" aria-labelledby="correction-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="correction-heading" className="text-[21px] font-bold tracking-[-0.05em]">
              文字起こしの補正
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] ${isCompleted ? 'text-[#1d6b50]' : correction.status === 'error' ? 'text-[#b6533a]' : 'text-[#9a7a35]'}`}
            >
              {isCompleted ? (
                <Check size={13} />
              ) : correction.status === 'error' ? (
                <AlertTriangle size={13} />
              ) : (
                <FilePenLine size={13} />
              )}
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#71807b]">
            {correctionMode === 'slide-aligned'
              ? 'スライドの正式な用語・表記を優先して、発話の誤変換を整えます。'
              : 'スライドの文字を補助資料にして、発話の誤変換や表記を整えます。'}
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-[9px] border border-[#b7cbc0] bg-[#fbfcfa] px-4 py-3 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => void correction.correct(isCompleted)}
          disabled={disabled || isRunning || total === 0}
        >
          <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
          {isRunning ? '補正中…' : isCompleted ? '再補正' : '補正を開始'}
        </button>
      </div>

      <div className="mt-5 grid gap-4 rounded-[12px] border border-[#d8e1dc] bg-[#f7faf7] p-4 md:grid-cols-3 md:p-5">
        <label className="block text-xs text-[#71807b]" htmlFor="correction-mode">
          <span className="block font-semibold text-[#18211f]">補正方針</span>
          <select
            id="correction-mode"
            className="mt-2 w-full rounded-[8px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2 text-[11px] text-[#18211f] outline-none focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/20 disabled:cursor-not-allowed disabled:opacity-50"
            value={correctionMode}
            onChange={(event) => onCorrectionModeChange(event.target.value as CorrectionMode)}
            disabled={disabled || isRunning}
          >
            {CORRECTION_MODES.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[10px] text-[#9aa6a1]">
            {CORRECTION_MODES.find((mode) => mode.id === correctionMode)?.description}
          </span>
        </label>
        <div className="text-xs text-[#71807b]">
          <span className="block font-semibold text-[#18211f]">使用モデル</span>
          <p className="mt-2 font-mono text-[11px] text-[#1d6b50]">{model.label}</p>
          <p className="mt-1 text-[10px] text-[#9aa6a1]">
            初回のみモデルをダウンロードします（約
            {formatModelSize(model.totalSizeBytes)}）。
          </p>
        </div>
        <div className="text-xs text-[#71807b]">
          <span className="block font-semibold text-[#18211f]">進捗</span>
          <p className="mt-2 font-mono text-[11px] text-[#1d6b50]">
            {correction.progress.completed} / {total} slides
          </p>
          <p className="mt-1 text-[10px] text-[#9aa6a1]">
            {isRunning
              ? stageLabels[correction.stage]
              : isCompleted
                ? '発話のあるSlideをすべて処理しました。'
                : correction.status === 'error'
                  ? '文字起こしの補正を完了できませんでした。'
                  : total === 0
                    ? '先に文字起こしを実行してください。'
                    : 'まだ開始されていません。'}
          </p>
        </div>
      </div>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#e2eee8]" aria-label="補正の進捗">
        {isRunning && progress === null ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#1d6b50]" />
        ) : (
          <div
            className="h-full rounded-full bg-[#1d6b50] transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, (progress ?? 0) * 100))}%` }}
          />
        )}
      </div>

      {correction.error && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e4b4a7] bg-[#fff5f1] px-4 py-3 text-xs text-[#9d422d]" role="alert">
          <p className="min-w-0">{correction.error}</p>
          <button
            className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#9d422d] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/30"
            type="button"
            onClick={() => void correction.correct()}
            disabled={disabled || isRunning || total === 0}
          >
            <RefreshCw size={13} />
            再試行
          </button>
        </div>
      )}
    </section>
  )
}
