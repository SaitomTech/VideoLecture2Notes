import { useState } from 'react'
import { getUserErrorMessage } from '../../../lib/errors'
import type { TextModelId } from '../../../lib/llama/textModel'
import type { CorrectionLevel, MediaProject } from '../../../types/project'
import {
  hasCurrentContent,
  runContentProcessing,
  type ContentProcessingProgress,
  type ContentProcessingSlideCompleted,
  type ContentProcessingStage,
} from '../contentProcessing'

export type ContentProcessingStatus = 'idle' | 'running' | 'completed' | 'error'

export function useContentProcessing(
  project: MediaProject,
  onSlideCompleted: ContentProcessingSlideCompleted,
  modelId: TextModelId,
  level: CorrectionLevel,
) {
  const targetSlides = project.slides.filter((slide) => slide.transcript?.raw.trim())
  const completedFromProject = targetSlides.filter(
    (slide) => hasCurrentContent(slide, modelId, level),
  ).length
  const isUpToDate = completedFromProject === targetSlides.length && targetSlides.length > 0
  const [status, setStatus] = useState<ContentProcessingStatus>('idle')
  const [stage, setStage] = useState<ContentProcessingStage>('preparing-model')
  const [progress, setProgress] = useState<ContentProcessingProgress>({
    completed: 0,
    total: 0,
    stageProgress: null,
  })
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setStatus('idle')
    setError(null)
    setProgress({ completed: 0, total: 0, stageProgress: null })
    setStage('preparing-model')
  }

  async function process(force = false) {
    setStatus('running')
    setError(null)
    try {
      await runContentProcessing({
        project,
        modelId,
        level,
        onStage: setStage,
        onProgress: setProgress,
        onSlideCompleted,
        force,
      })
      setProgress((current) => ({ ...current, completed: current.total, stageProgress: 1 }))
      setStatus('completed')
    } catch (processingError) {
      console.error(processingError)
      setStatus('error')
      setError(
        getUserErrorMessage(
          processingError,
          '発話と記事本文の生成を完了できませんでした。アプリを再起動して、再試行してください。',
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

  return {
    status: visibleStatus,
    stage,
    progress: visibleProgress,
    error,
    process,
    reset,
  }
}

export type ContentProcessingController = ReturnType<typeof useContentProcessing>
