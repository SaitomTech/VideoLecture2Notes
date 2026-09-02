import { ProcessingStatusRow } from '../../../components/ProcessingStatusRow'
import type { TranscriptionModel } from '../../../lib/transcription/transcriptionModel'
import type { TranscriptionStatus as TranscriptionStatusValue } from '../hooks/useTranscription'
import type { TranscriptionChunkProgress, TranscriptionStage } from '../transcription'

type TranscriptionStatusProps = {
  status: TranscriptionStatusValue
  provider: TranscriptionModel['provider']
  stage: TranscriptionStage
  stageProgress: number | null
  chunkProgress: TranscriptionChunkProgress | null
  error: string | null
  disabled?: boolean
  onRetry: () => void | Promise<void>
}

function getStageLabel(stage: TranscriptionStage, provider: TranscriptionModel['provider']) {
  if (stage === 'preparing-chunks') {
    return provider === 'openai'
      ? '文字起こし用の音声をスライド単位で準備中…'
      : '文字起こし用の音声を30分単位で準備中…'
  }

  const labels: Record<Exclude<TranscriptionStage, 'preparing-chunks'>, string> = {
    'preparing-model': 'モデルを確認・準備中…',
    'extracting-audio': '音声を準備中…',
    transcribing: '音声を文字に変換中…',
    saving: '結果を保存中…',
  }
  return labels[stage]
}

function getProgressLabel({
  status,
  provider,
  stage,
  stageProgress,
  chunkProgress,
}: Pick<TranscriptionStatusProps, 'status' | 'provider' | 'stage' | 'stageProgress' | 'chunkProgress'>) {
  if (status === 'running' && stage === 'preparing-model' && stageProgress !== null) {
    return `モデル ${Math.round(stageProgress * 100)}%`
  }
  if (chunkProgress && chunkProgress.total > 0) {
    if (provider === 'openai') {
      return `${chunkProgress.completed} / ${chunkProgress.total} スライド`
    }
    if (stageProgress !== null) return `${Math.round(stageProgress * 100)}%`
    return `${chunkProgress.completed} / ${chunkProgress.total} 30分単位`
  }
  if (stageProgress !== null) return `${Math.round(stageProgress * 100)}%`
  if (status === 'running') return '処理中'
  if (status === 'completed') return '完了'
  if (status === 'cancelled') return '停止'
  return '未開始'
}

export function TranscriptionStatus({
  status,
  provider,
  stage,
  stageProgress,
  chunkProgress,
  error,
  disabled = false,
  onRetry,
}: TranscriptionStatusProps) {
  const stageLabel = getStageLabel(stage, provider)
  const progressLabel = getProgressLabel({ status, provider, stage, stageProgress, chunkProgress })
  const message =
    status === 'running'
      ? stageLabel
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
      progressAriaLabel={status === 'running' ? stageLabel : '文字起こしの進捗'}
      error={error}
      onRetry={onRetry}
      retryDisabled={disabled || status === 'running'}
    />
  )
}
