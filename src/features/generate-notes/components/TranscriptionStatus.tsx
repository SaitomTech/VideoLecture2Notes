import { ProcessingStatusRow } from '../../../components/ProcessingStatusRow'
import type { TranscriptionStatus as TranscriptionStatusValue } from '../hooks/useTranscription'
import type { TranscriptionStage } from '../transcription'

type TranscriptionStatusProps = {
  status: TranscriptionStatusValue
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
  const progressLabel =
    stageProgress === null
      ? status === 'running'
        ? '処理中'
        : status === 'completed'
          ? '完了'
          : status === 'cancelled'
            ? '停止'
            : '未開始'
      : `${Math.round(stageProgress * 100)}%`
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
