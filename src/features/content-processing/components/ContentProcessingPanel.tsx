import { AlertTriangle, Check, FileText, RefreshCw } from 'lucide-react'
import type { TextModel } from '../../../lib/llama/textModel'
import type { CorrectionLevel } from '../../../types/project'
import { CORRECTION_LEVELS } from '../../correction/correction'
import type { ContentProcessingController } from '../hooks/useContentProcessing'

type ContentProcessingPanelProps = {
  processing: ContentProcessingController
  model: TextModel
  level: CorrectionLevel
  onLevelChange: (level: CorrectionLevel) => void
  disabled?: boolean
}

const stageLabels = {
  'preparing-model': '文章処理モデルを確認・準備中…',
  processing: 'Slideごとに発話と本文を生成中…',
} as const

function formatModelSize(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(2)}GB`
}

function progressRatio(processing: ContentProcessingController) {
  if (processing.status === 'completed') return 1
  if (processing.status !== 'running') return null
  if (processing.stage === 'preparing-model') return processing.progress.stageProgress
  return processing.progress.total > 0
    ? processing.progress.completed / processing.progress.total
    : 0
}

export function ContentProcessingPanel({
  processing,
  model,
  level,
  onLevelChange,
  disabled = false,
}: ContentProcessingPanelProps) {
  const isRunning = processing.status === 'running'
  const isCompleted = processing.status === 'completed'
  const total = processing.progress.total
  const progress = progressRatio(processing)
  const selectedLevel = CORRECTION_LEVELS.find((item) => item.id === level)
  const statusLabel = isCompleted
    ? 'READY'
    : processing.status === 'error'
      ? 'ERROR'
      : isRunning
        ? 'PROCESSING'
        : 'WAITING'

  return (
    <section className="mt-8 border-t border-[#e0e8e3] pt-6" aria-labelledby="content-processing-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="content-processing-heading" className="text-[21px] font-bold tracking-[-0.05em]">
              発話と本文を生成
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] ${isCompleted ? 'text-[#1d6b50]' : processing.status === 'error' ? 'text-[#b6533a]' : 'text-[#9a7a35]'}`}
            >
              {isCompleted ? <Check size={13} /> : processing.status === 'error' ? <AlertTriangle size={13} /> : <FileText size={13} />}
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#71807b]">
            スライドと音声の文字起こしをもとに、補正済みの発話と記事本文をまとめて生成します。
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-[9px] bg-[#1d6b50] px-4 py-3 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => void processing.process(isCompleted)}
          disabled={disabled || isRunning || total === 0}
        >
          <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
          {isRunning ? '生成中…' : isCompleted ? '再生成' : '生成を開始'}
        </button>
      </div>

      <div className="mt-5 grid gap-4 rounded-[12px] border border-[#d8e1dc] bg-[#f7faf7] p-4 md:grid-cols-3 md:p-5">
        <label className="block text-xs text-[#71807b]" htmlFor="correction-level">
          <span className="block font-semibold text-[#18211f]">補正レベル</span>
          <select
            id="correction-level"
            className="mt-2 w-full rounded-[8px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2 text-[11px] text-[#18211f] outline-none focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/20 disabled:cursor-not-allowed disabled:opacity-50"
            value={level}
            onChange={(event) => onLevelChange(event.target.value as CorrectionLevel)}
            disabled={disabled || isRunning}
          >
            {CORRECTION_LEVELS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[10px] text-[#9aa6a1]">{selectedLevel?.description}</span>
        </label>
        <div className="text-xs text-[#71807b]">
          <span className="block font-semibold text-[#18211f]">使用モデル</span>
          <p className="mt-2 font-mono text-[11px] text-[#1d6b50]">{model.label}</p>
          <p className="mt-1 text-[10px] text-[#9aa6a1]">
            初回のみモデルをダウンロードします（約{formatModelSize(model.totalSizeBytes)}）。
          </p>
        </div>
        <div className="text-xs text-[#71807b]">
          <span className="block font-semibold text-[#18211f]">進捗</span>
          <p className="mt-2 font-mono text-[11px] text-[#1d6b50]">
            {processing.progress.completed} / {total} slides
          </p>
          <p className="mt-1 text-[10px] text-[#9aa6a1]">
            {isRunning
              ? stageLabels[processing.stage]
              : isCompleted
                ? '発話と記事本文をすべて生成しました。'
                : processing.status === 'error'
                  ? '発話と記事本文の生成を完了できませんでした。'
                  : total === 0
                    ? '先に文字起こしを実行してください。'
                    : 'まだ開始されていません。'}
          </p>
        </div>
      </div>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#e2eee8]" aria-label="発話と記事本文生成の進捗">
        {isRunning && progress === null ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#1d6b50]" />
        ) : (
          <div
            className="h-full rounded-full bg-[#1d6b50] transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, (progress ?? 0) * 100))}%` }}
          />
        )}
      </div>

      {processing.error && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e4b4a7] bg-[#fff5f1] px-4 py-3 text-xs text-[#9d422d]" role="alert">
          <p className="min-w-0">{processing.error}</p>
          <button
            className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#9d422d] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/30"
            type="button"
            onClick={() => void processing.process()}
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
