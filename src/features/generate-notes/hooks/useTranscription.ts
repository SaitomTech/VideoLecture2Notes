import { useState } from 'react'
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
      await onCompleted(result)
      setStageProgress(1)
      setStatus('completed')
    } catch (transcriptionError) {
      console.error(transcriptionError)
      setStatus('error')
      setError(
        transcriptionError instanceof Error
          ? transcriptionError.message
          : '文字起こしに失敗しました。',
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
