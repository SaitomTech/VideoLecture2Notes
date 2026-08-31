import { AlertTriangle, Check, Mic2, RefreshCw } from 'lucide-react'
import type { TranscriptionStatus } from '../hooks/useTranscription'
import type { TranscriptionStage } from '../transcription'

type TranscriptionStatusProps = {
  status: TranscriptionStatus
  stage: TranscriptionStage
  stageProgress: number | null
  error: string | null
  disabled?: boolean
  onRetry: () => void | Promise<void>
}

const stageLabels: Record<TranscriptionStage, string> = {
  'preparing-model': 'モデルを確認・準備中…',
  'extracting-audio': '音声を準備中…',
  transcribing: '音声を文字に変換中…',
  saving: '結果を保存中…',
}

export function TranscriptionStatus({
  status,
  stage,
  stageProgress,
  error,
  disabled = false,
  onRetry,
}: TranscriptionStatusProps) {
  const isRunning = status === 'running'
  const isCompleted = status === 'completed'
  const statusLabel = isCompleted
    ? 'READY'
    : status === 'error'
      ? 'ERROR'
      : isRunning
        ? 'PROCESSING'
        : 'WAITING'
  const progressLabel =
    stageProgress === null
      ? isRunning
        ? '処理中'
        : isCompleted
          ? '完了'
          : '未開始'
      : `${Math.round(stageProgress * 100)}%`

  return (
    <section className="mt-8 border-t border-[#e0e8e3] pt-6" aria-labelledby="transcription-status-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="transcription-status-heading" className="text-[13px] font-semibold text-[#18211f]">
              処理状況
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] ${isCompleted ? 'text-[#1d6b50]' : status === 'error' ? 'text-[#b6533a]' : 'text-[#9a7a35]'}`}
            >
              {isCompleted ? <Check size={13} /> : status === 'error' ? <AlertTriangle size={13} /> : <Mic2 size={13} />}
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#71807b]">
            {isRunning
              ? stageLabels[stage]
              : isCompleted
                ? '文字起こしが完了しました。'
                : status === 'error'
                  ? '文字起こしを完了できませんでした。'
                  : '文字起こしはまだ開始されていません。'}
          </p>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-[#1d6b50]">{progressLabel}</span>
      </div>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#e2eee8]" aria-label={isRunning ? stageLabels[stage] : '文字起こしの進捗'}>
        {isRunning && stageProgress === null ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#1d6b50]" />
        ) : (
          <div
            className="h-full rounded-full bg-[#1d6b50] transition-[width] duration-300"
            style={{ width: `${isCompleted ? 100 : Math.max(0, Math.min(100, (stageProgress ?? 0) * 100))}%` }}
          />
        )}
      </div>

      {error && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e4b4a7] bg-[#fff5f1] px-4 py-3 text-xs text-[#9d422d]" role="alert">
          <p className="min-w-0">{error}</p>
          <button
            className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#9d422d] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/30"
            type="button"
            onClick={() => void onRetry()}
            disabled={isRunning || disabled}
          >
            <RefreshCw size={13} />
            再試行
          </button>
        </div>
      )}
    </section>
  )
}
