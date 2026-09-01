import { useRef, useState } from 'react'
import { getUserErrorMessage, withUserFacingError } from '../../../lib/errors'
import type { WhisperModelId } from '../../../lib/whisper/modelManager'
import type { MediaProject, TranscriptionResult } from '../../../types/project'
import {
  runTranscription,
  type TranscriptionLanguage,
  type TranscriptionStage,
} from '../transcription'

export type TranscriptionStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'error'

export function useTranscription(
  project: MediaProject,
  modelId: WhisperModelId,
  onCompleted: (result: TranscriptionResult) => void | Promise<void>,
) {
  const hasCurrentTranscription = project.transcription?.model === modelId
  const [status, setStatus] = useState<TranscriptionStatus>(
    hasCurrentTranscription ? 'completed' : 'idle',
  )
  const [stage, setStage] = useState<TranscriptionStage>('preparing-model')
  const [stageProgress, setStageProgress] = useState<number | null>(
    hasCurrentTranscription ? 1 : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [operationModelId, setOperationModelId] = useState<WhisperModelId>(modelId)
  const activeController = useRef<AbortController | null>(null)

  async function transcribe(language: TranscriptionLanguage) {
    if (activeController.current) return

    const controller = new AbortController()
    activeController.current = controller
    setOperationModelId(modelId)
    setStatus('running')
    setStage('preparing-model')
    setStageProgress(null)
    setError(null)

    try {
      const result = await runTranscription({
        project,
        language,
        modelId,
        signal: controller.signal,
        onStage: (nextStage) => {
          setStage(nextStage)
          setStageProgress(null)
        },
        onProgress: setStageProgress,
      })
      setStage('saving')
      setStageProgress(null)
      await withUserFacingError(
        '文字起こし結果を保存できませんでした。空き容量を確認して、再試行してください。',
        () => onCompleted(result),
      )
      if (controller.signal.aborted) {
        throw new DOMException('処理を中止しました。', 'AbortError')
      }
      setStageProgress(1)
      setStatus('completed')
    } catch (transcriptionError) {
      if (controller.signal.aborted) {
        setStatus('cancelled')
        setError(null)
      } else {
        console.error(transcriptionError)
        setStatus('error')
        setError(
          getUserErrorMessage(
            transcriptionError,
            '文字起こしを完了できませんでした。アプリを再起動して、再試行してください。',
          ),
        )
      }
    } finally {
      if (activeController.current === controller) activeController.current = null
    }
  }

  function cancel() {
    activeController.current?.abort()
  }

  const isOperationForSelectedModel = operationModelId === modelId
  const visibleStatus = isOperationForSelectedModel
    ? status
    : hasCurrentTranscription
      ? 'completed'
      : 'idle'
  const visibleStageProgress = isOperationForSelectedModel
    ? stageProgress
    : hasCurrentTranscription
      ? 1
      : null
  const visibleError = isOperationForSelectedModel ? error : null

  return {
    status: visibleStatus,
    stage,
    stageProgress: visibleStageProgress,
    error: visibleError,
    transcribe,
    cancel,
  }
}
