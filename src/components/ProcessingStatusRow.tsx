import { RefreshCw } from 'lucide-react'

type ProcessingStatusRowProps = {
  status: 'idle' | 'running' | 'completed' | 'cancelled' | 'error'
  message: string
  progress: number | null
  progressLabel: string
  progressAriaLabel: string
  error?: string | null
  onRetry?: () => void | Promise<void>
  retryDisabled?: boolean
}

export function ProcessingStatusRow({
  status,
  message,
  progress,
  progressLabel,
  progressAriaLabel,
  error,
  onRetry,
  retryDisabled = false,
}: ProcessingStatusRowProps) {
  return (
    <article className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 text-xs text-[#71807b]">{message}</p>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#1d6b50]">
          {progressLabel}
        </span>
      </div>

      <div
        className="mt-4 h-1 overflow-hidden rounded-full bg-[#e2eee8]"
        aria-label={progressAriaLabel}
      >
        {status === 'running' && progress === null ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#1d6b50]" />
        ) : (
          <div
            className="h-full rounded-full bg-[#1d6b50] transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, (progress ?? 0) * 100))}%` }}
          />
        )}
      </div>

      {error && (
        <div
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e4b4a7] bg-[#fff5f1] px-4 py-3 text-xs text-[#9d422d]"
          role="alert"
        >
          <p className="min-w-0">{error}</p>
          {onRetry && (
            <button
              className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#9d422d] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/30 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={() => void onRetry()}
              disabled={retryDisabled}
            >
              <RefreshCw size={13} />
              再試行
            </button>
          )}
        </div>
      )}
    </article>
  )
}
