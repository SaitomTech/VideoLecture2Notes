import { useState } from 'react'
import { getUserErrorMessage, withUserFacingError } from '../../../lib/errors'
import type { MediaProject, TranscriptionResult } from '../../../types/project'
import {
  runTranscription,
  type TranscriptionLanguage,
  type TranscriptionStage,
} from '../transcription'

export type TranscriptionStatus = 'idle' | 'running' | 'completed' | 'error'

export function useTranscription(
  project: MediaProject,
  onCompleted: (result: TranscriptionResult) => void | Promise<void>,
) {
  const [status, setStatus] = useState<TranscriptionStatus>(
    project.transcription ? 'completed' : 'idle',
  )
  const [stage, setStage] = useState<TranscriptionStage>('preparing-model')
  const [stageProgress, setStageProgress] = useState<number | null>(
    project.transcription ? 1 : null,
  )
  const [error, setError] = useState<string | null>(null)

  async function transcribe(language: TranscriptionLanguage) {
    setStatus('running')
    setStage('preparing-model')
    setStageProgress(null)
    setError(null)

    try {
      const result = await runTranscription({
        project,
        language,
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
      setStageProgress(1)
      setStatus('completed')
    } catch (transcriptionError) {
      console.error(transcriptionError)
      setStatus('error')
      setError(
        getUserErrorMessage(
          transcriptionError,
          '文字起こしを完了できませんでした。アプリを再起動して、再試行してください。',
        ),
      )
    }
  }

  return {
    status,
    stage,
    stageProgress,
    error,
    transcribe,
  }
}
