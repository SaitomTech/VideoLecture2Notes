import { AlertTriangle, Check, RefreshCw, ScanLine } from 'lucide-react'
import type { SlideDetectionStatus } from '../hooks/useSlideDetection'
import type { SlideDetectionStage } from '../types'

type SlideDetectionSettingsStatusProps = {
  threshold: number
  sampleIntervalMs: number
  status: SlideDetectionStatus
  stage: SlideDetectionStage
  stageProgress: number | null
  error: string | null
  isSaving: boolean
  onThresholdChange: (value: number) => void
  onSampleIntervalChange: (value: number) => void
  onDetect: () => void | Promise<void>
}

const stageLabels: Record<SlideDetectionStage, string> = {
  preparing: '解析の準備中…',
  sampling: 'フレームを読み込み中…',
  comparing: 'フレームの変化を比較中…',
  extracting: '代表画像を作成中…',
  saving: '検出結果を保存中…',
  completed: '検出結果を確認してください。',
}

export function SlideDetectionSettingsStatus({
  threshold,
  sampleIntervalMs,
  status,
  stage,
  stageProgress,
  error,
  isSaving,
  onThresholdChange,
  onSampleIntervalChange,
  onDetect,
}: SlideDetectionSettingsStatusProps) {
  const isRunning = status === 'running'
  const isCompleted = status === 'completed'
  const progressLabel =
    stageProgress === null
      ? isRunning
        ? '処理中'
        : isCompleted
          ? '完了'
          : '未開始'
      : `${Math.round(stageProgress * 100)}%`
  const statusLabel = isCompleted
    ? 'DETECTED'
    : status === 'error'
      ? 'ERROR'
      : isRunning
        ? 'ANALYZING'
        : 'READY'

  return (
    <section aria-labelledby="analysis-status-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="analysis-status-heading" className="text-[21px] font-bold tracking-[-0.05em]">
          解析を実行
        </h2>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-[9px] border border-[#b7cbc0] bg-[#fbfcfa] px-4 py-3 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => void onDetect()}
          disabled={isRunning || isSaving}
        >
          <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
          {isRunning ? '解析中…' : isCompleted ? '再検出' : '解析開始'}
        </button>
      </div>

      <div className="mt-6">
        <p className="text-[13px] font-semibold text-[#18211f]">設定</p>
      </div>

      <div className="mt-3 rounded-[12px] border border-[#d8e1dc] bg-[#f7faf7] p-4 md:p-5">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block text-xs text-[#71807b]">
            <span className="flex items-center justify-between gap-3">
              <span>しきい値</span>
              <span className="font-mono text-[#1d6b50]">{threshold}</span>
            </span>
            <input
              className="mt-3 w-full accent-[#1d6b50]"
              type="range"
              min="4"
              max="32"
              step="1"
              value={threshold}
              onChange={(event) => onThresholdChange(Number(event.target.value))}
              disabled={isRunning}
              aria-label="スライド変化のしきい値"
            />
            <span className="mt-1 block text-[10px] text-[#9aa6a1]">
              小さい変化も拾う ← → 大きな変化だけ
            </span>
          </label>

          <label className="block text-xs text-[#71807b]">
            <span className="flex items-center justify-between gap-3">
              <span>インターバル</span>
              <span className="font-mono text-[#1d6b50]">
                {sampleIntervalMs >= 1000
                  ? `${(sampleIntervalMs / 1000).toFixed(1)}秒`
                  : `${sampleIntervalMs}ms`}
              </span>
            </span>
            <input
              className="mt-3 w-full accent-[#1d6b50]"
              type="range"
              min="100"
              max="2000"
              step="100"
              value={sampleIntervalMs}
              onChange={(event) => onSampleIntervalChange(Number(event.target.value))}
              disabled={isRunning}
              aria-label="フレームを確認する間隔"
            />
            <span className="mt-1 block text-[10px] text-[#9aa6a1]">
              短いほど細かく検出、長いほど速く解析
            </span>
          </label>
        </div>
      </div>

      <div className="mt-8 border-t border-[#e0e8e3] pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-[#18211f]">解析状況</p>
              <div
                className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] ${isCompleted ? 'text-[#1d6b50]' : status === 'error' ? 'text-[#b6533a]' : 'text-[#9a7a35]'}`}
              >
                {isCompleted ? (
                  <Check size={13} />
                ) : status === 'error' ? (
                  <AlertTriangle size={13} />
                ) : (
                  <ScanLine size={13} />
                )}
                {statusLabel}
              </div>
            </div>
            <p className="mt-1 text-xs text-[#71807b]">
              {isRunning
                ? stageLabels[stage]
                : isCompleted
                  ? stageLabels.completed
                  : '解析はまだ開始されていません。'}
            </p>
          </div>
          <span className="font-mono text-[11px] tabular-nums text-[#1d6b50]">{progressLabel}</span>
        </div>

        <div
          className="mt-4 h-1 overflow-hidden rounded-full bg-[#e2eee8]"
          aria-label={isRunning ? stageLabels[stage] : '検出の進捗'}
        >
          {isRunning && stageProgress === null ? (
            <div className="h-full w-1/3 rounded-full bg-[#1d6b50] animate-pulse" />
          ) : (
            <div
              className="h-full rounded-full bg-[#1d6b50] transition-[width] duration-300"
              style={{
                width: `${isCompleted ? 100 : Math.max(0, Math.min(100, (stageProgress ?? 0) * 100))}%`,
              }}
            />
          )}
        </div>

        {error && (
          <div className="mt-5 flex items-start justify-between gap-4 rounded-[10px] border border-[#e4b4a7] bg-[#fff5f1] px-4 py-3 text-xs text-[#9d422d]">
            <p>{error}</p>
            <button
              className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#9d422d] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/30"
              type="button"
              onClick={() => void onDetect()}
            >
              <RefreshCw size={13} />
              再試行
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
