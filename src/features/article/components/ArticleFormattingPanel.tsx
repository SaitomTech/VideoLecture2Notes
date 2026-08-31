import { AlertTriangle, Check, FileText, RefreshCw } from 'lucide-react'
import { DEFAULT_TEXT_MODEL } from '../../../lib/llama/textModel'
import type { ArticleFormattingController } from '../hooks/useArticleFormatting'

type ArticleFormattingPanelProps = {
  formatting: ArticleFormattingController
  disabled?: boolean
}

const stageLabels = {
  'preparing-model': '記事整形モデルを確認・準備中…',
  formatting: 'Slideごとに記事本文を整形中…',
} as const

function progressRatio(formatting: ArticleFormattingController) {
  if (formatting.status === 'completed') return 1
  if (formatting.status !== 'running') return null
  if (formatting.stage === 'preparing-model') return formatting.progress.stageProgress
  return formatting.progress.total > 0
    ? formatting.progress.completed / formatting.progress.total
    : 0
}

export function ArticleFormattingPanel({ formatting, disabled = false }: ArticleFormattingPanelProps) {
  const isRunning = formatting.status === 'running'
  const isCompleted = formatting.status === 'completed'
  const total = formatting.progress.total
  const progress = progressRatio(formatting)
  const statusLabel = isCompleted
    ? 'READY'
    : formatting.status === 'error'
      ? 'ERROR'
      : isRunning
        ? 'PROCESSING'
        : 'WAITING'

  return (
    <section className="mt-8 border-t border-[#e0e8e3] pt-6" aria-labelledby="article-formatting-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="article-formatting-heading" className="text-[21px] font-bold tracking-[-0.05em]">
              記事本文を生成
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] ${isCompleted ? 'text-[#1d6b50]' : formatting.status === 'error' ? 'text-[#b6533a]' : 'text-[#9a7a35]'}`}
            >
              {isCompleted ? <Check size={13} /> : formatting.status === 'error' ? <AlertTriangle size={13} /> : <FileText size={13} />}
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#71807b]">
            補正済みの発話を、内容を変えずに読みやすい本文へ整えます。
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-[9px] border border-[#b7cbc0] bg-[#fbfcfa] px-4 py-3 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => void formatting.format(isCompleted)}
          disabled={disabled || isRunning || total === 0}
        >
          <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
          {isRunning ? '記事本文を生成中…' : isCompleted ? '再生成' : '生成を開始'}
        </button>
      </div>

      <div className="mt-5 grid gap-4 rounded-[12px] border border-[#d8e1dc] bg-[#f7faf7] p-4 md:grid-cols-2 md:p-5">
        <div className="text-xs text-[#71807b]">
          <span className="block font-semibold text-[#18211f]">使用モデル</span>
          <p className="mt-2 font-mono text-[11px] text-[#1d6b50]">{DEFAULT_TEXT_MODEL.label}</p>
          <p className="mt-1 text-[10px] text-[#9aa6a1]">文字起こし補正と共通のモデルを使用します。</p>
        </div>
        <div className="text-xs text-[#71807b]">
          <span className="block font-semibold text-[#18211f]">進捗</span>
          <p className="mt-2 font-mono text-[11px] text-[#1d6b50]">
            {formatting.progress.completed} / {total} slides
          </p>
          <p className="mt-1 text-[10px] text-[#9aa6a1]">
            {isRunning
              ? stageLabels[formatting.stage]
              : isCompleted
                ? '記事本文をすべて生成しました。'
                : formatting.status === 'error'
                  ? '記事本文の生成を完了できませんでした。'
                  : total === 0
                    ? '先に文字起こしの補正を実行してください。'
                    : 'まだ開始されていません。'}
          </p>
        </div>
      </div>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#e2eee8]" aria-label="記事本文生成の進捗">
        {isRunning && progress === null ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#1d6b50]" />
        ) : (
          <div
            className="h-full rounded-full bg-[#1d6b50] transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, (progress ?? 0) * 100))}%` }}
          />
        )}
      </div>

      {formatting.error && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e4b4a7] bg-[#fff5f1] px-4 py-3 text-xs text-[#9d422d]" role="alert">
          <p className="min-w-0">{formatting.error}</p>
          <button
            className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#9d422d] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/30"
            type="button"
            onClick={() => void formatting.format()}
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
