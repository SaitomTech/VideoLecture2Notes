import { useState } from 'react'
import { getUserErrorMessage } from '../../../lib/errors'
import type { MediaProject } from '../../../types/project'
import {
  hasCurrentCorrection,
  runCorrection,
  type CorrectionProgress,
  type CorrectionSlideCompleted,
  type CorrectionStage,
} from '../correction'

export type CorrectionStatus = 'idle' | 'running' | 'completed' | 'error'

export function useCorrection(project: MediaProject, onSlideCompleted: CorrectionSlideCompleted) {
  const targetSlides = project.slides.filter((slide) => slide.transcript?.raw.trim())
  const completedFromProject = targetSlides.filter(hasCurrentCorrection).length
  const isUpToDate = completedFromProject === targetSlides.length && targetSlides.length > 0
  const [status, setStatus] = useState<CorrectionStatus>('idle')
  const [stage, setStage] = useState<CorrectionStage>('preparing-model')
  const [progress, setProgress] = useState<CorrectionProgress>({
    completed: 0,
    total: 0,
    stageProgress: null,
  })
  const [error, setError] = useState<string | null>(null)

  async function correct(force = false) {
    setStatus('running')
    setError(null)
    try {
      await runCorrection({
        project,
        onStage: setStage,
        onProgress: setProgress,
        onSlideCompleted,
        force,
      })
      setProgress((current) => ({ ...current, completed: current.total, stageProgress: 1 }))
      setStatus('completed')
    } catch (correctionError) {
      console.error(correctionError)
      setStatus('error')
      setError(
        getUserErrorMessage(
          correctionError,
          '文字起こしの補正を完了できませんでした。アプリを再起動して、再試行してください。',
        ),
      )
    }
  }

  const visibleProgress =
    status === 'running'
      ? progress
      : {
          completed: completedFromProject,
          total: targetSlides.length,
          stageProgress: isUpToDate ? 1 : null,
        }
  const visibleStatus =
    status === 'running' || status === 'error' ? status : isUpToDate ? 'completed' : 'idle'

  return { status: visibleStatus, stage, progress: visibleProgress, error, correct }
}

export type CorrectionController = ReturnType<typeof useCorrection>
