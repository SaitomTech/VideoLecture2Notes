import { ProcessingStatusRow } from '../../../components/ProcessingStatusRow'
import type { TranscriptionStatus as TranscriptionStatusValue } from '../hooks/useTranscription'
import type { TranscriptionChunkProgress, TranscriptionStage } from '../transcription'

type TranscriptionStatusProps = {
  status: TranscriptionStatusValue
  stage: TranscriptionStage
  stageProgress: number | null
  chunkProgress: TranscriptionChunkProgress | null
  error: string | null
  disabled?: boolean
  onRetry: () => void | Promise<void>
}

const stageLabels: Record<TranscriptionStage, string> = {
  'preparing-model': 'モデルを確認・準備中…',
  'extracting-audio': '音声を準備中…',
  'preparing-chunks': '文字起こし用の音声を区間ごとに準備中…',
  transcribing: '音声を文字に変換中…',
  saving: '結果を保存中…',
}

function getProgressLabel({
  status,
  stage,
  stageProgress,
  chunkProgress,
}: Pick<TranscriptionStatusProps, 'status' | 'stage' | 'stageProgress' | 'chunkProgress'>) {
  if (status === 'running' && stage === 'preparing-model' && stageProgress !== null) {
    return `モデル ${Math.round(stageProgress * 100)}%`
  }
  if (chunkProgress && chunkProgress.total > 0) {
    return `${chunkProgress.completed} / ${chunkProgress.total} 区間`
  }
  if (stageProgress !== null) return `${Math.round(stageProgress * 100)}%`
  if (status === 'running') return '処理中'
  if (status === 'completed') return '完了'
  if (status === 'cancelled') return '停止'
  return '未開始'
}

export function TranscriptionStatus({
  status,
  stage,
  stageProgress,
  chunkProgress,
  error,
  disabled = false,
  onRetry,
}: TranscriptionStatusProps) {
  const progressLabel = getProgressLabel({ status, stage, stageProgress, chunkProgress })
  const message =
    status === 'running'
      ? stageLabels[stage]
      : status === 'completed'
        ? '文字起こしが完了しました。'
        : status === 'cancelled'
          ? '文字起こしを停止しました。保存済みの結果は残っています。'
          : status === 'error'
            ? '文字起こしを完了できませんでした。'
            : '文字起こしはまだ開始されていません。'

  return (
    <ProcessingStatusRow
      status={status}
      message={message}
      progress={status === 'completed' ? 1 : stageProgress}
      progressLabel={progressLabel}
      progressAriaLabel={status === 'running' ? stageLabels[stage] : '文字起こしの進捗'}
      error={error}
      onRetry={onRetry}
      retryDisabled={disabled || status === 'running'}
    />
  )
}
