import { useCallback, useState } from 'react'
import { assignTranscriptToSlides } from '../../../lib/pipeline/assignTranscriptToSlides'
import type { MediaProject } from '../../../types/project'
import { runTranscription, type TranscriptionLanguage } from '../transcription'
import type { TranscriptionOutput, TranscriptionStage } from '../types'

export type TranscriptionStatus = 'idle' | 'running' | 'completed' | 'error'

function persistedOutput(project: MediaProject): TranscriptionOutput | null {
  if (!project.transcription) return null
  return {
    result: project.transcription,
    slides: assignTranscriptToSlides(
      project.slides,
      project.transcription.segments,
      project.transcription.model,
    ),
  }
}

type UseTranscriptionOptions = {
  onCompleted?: (output: TranscriptionOutput) => void | Promise<void>
}

export function useTranscription(
  project: MediaProject,
  { onCompleted }: UseTranscriptionOptions = {},
) {
  const [output, setOutput] = useState<TranscriptionOutput | null>(() => persistedOutput(project))
  const hasPersistedResult = output !== null
  const [status, setStatus] = useState<TranscriptionStatus>(
    hasPersistedResult ? 'completed' : 'idle',
  )
  const [stage, setStage] = useState<TranscriptionStage>(
    hasPersistedResult ? 'completed' : 'preparing-model',
  )
  const [stageProgress, setStageProgress] = useState<number | null>(hasPersistedResult ? 1 : null)
  const [error, setError] = useState<string | null>(null)

  const transcribe = useCallback(
    async (language: TranscriptionLanguage) => {
      setStatus('running')
      setStage('preparing-model')
      setStageProgress(null)
      setOutput(null)
      setError(null)

      try {
        const nextOutput = await runTranscription({
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
        await onCompleted?.(nextOutput)
        setOutput(nextOutput)
        setStage('completed')
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
    },
    [onCompleted, project],
  )

  return {
    status,
    stage,
    stageProgress,
    output,
    error,
    transcribe,
  }
}
