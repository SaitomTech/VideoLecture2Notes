import { useCallback, useState } from 'react'
import { runSlideDetection } from '../detection'
import type { MediaProject } from '../../../types/project'
import type { SlideDetectionOutput, SlideDetectionStage } from '../types'

export type SlideDetectionStatus = 'idle' | 'running' | 'completed' | 'error'

function hasRepresentativeFrames(project: MediaProject) {
  return (
    project.slides.length > 0 &&
    project.slides.every((slide) => Boolean(slide.image.representativeFramePath))
  )
}

function persistedOutput(project: MediaProject): SlideDetectionOutput | null {
  if (!project.slideDetection || !hasRepresentativeFrames(project)) return null
  return {
    result: project.slideDetection,
    slides: project.slides,
  }
}

type UseSlideDetectionOptions = {
  onCompleted?: (output: SlideDetectionOutput) => void | Promise<void>
}

export type SlideDetectionParameters = {
  threshold?: number
  sampleIntervalMs?: number
}

export function useSlideDetection(
  project: MediaProject,
  { onCompleted }: UseSlideDetectionOptions = {},
) {
  const [output, setOutput] = useState<SlideDetectionOutput | null>(() => persistedOutput(project))
  const hasPersistedResult = output !== null
  const [status, setStatus] = useState<SlideDetectionStatus>(
    hasPersistedResult ? 'completed' : 'idle',
  )
  const [stage, setStage] = useState<SlideDetectionStage>(
    hasPersistedResult ? 'completed' : 'preparing',
  )
  const [stageProgress, setStageProgress] = useState<number | null>(hasPersistedResult ? 1 : null)
  const [error, setError] = useState<string | null>(null)

  const detect = useCallback(
    async ({ threshold, sampleIntervalMs }: SlideDetectionParameters = {}) => {
      setStatus('running')
      setStage('preparing')
      setStageProgress(null)
      setOutput(null)
      setError(null)

      try {
        const nextOutput = await runSlideDetection({
          project,
          threshold,
          sampleIntervalMs,
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
      } catch (detectionError) {
        console.error(detectionError)
        setStatus('error')
        setError('スライドを検出できませんでした。動画とsidecarの状態を確認してください。')
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
    detect,
  }
}
