import { useState } from 'react'
import type { MediaProject } from '../../../types/project'
import { ocrInputFingerprint, runOcr, type OcrProgress, type OcrSlideCompleted, type OcrStage } from '../ocr'

export type OcrStatus = 'idle' | 'running' | 'completed' | 'error'

export function useOcr(project: MediaProject, onSlideCompleted: OcrSlideCompleted) {
  const initialCompleted = project.slides.filter(
    (slide) => slide.ocr?.inputFingerprint === ocrInputFingerprint(slide),
  ).length
  const [status, setStatus] = useState<OcrStatus>(
    initialCompleted === project.slides.length && project.slides.length > 0
      ? 'completed'
      : 'idle',
  )
  const [stage, setStage] = useState<OcrStage>('preparing-model')
  const [progress, setProgress] = useState<OcrProgress>({
    completed: initialCompleted,
    total: project.slides.length,
    stageProgress: initialCompleted === project.slides.length ? 1 : null,
  })
  const [error, setError] = useState<string | null>(null)

  async function recognize(force = false) {
    setStatus('running')
    setError(null)
    try {
      await runOcr({
        project,
        onStage: setStage,
        onProgress: setProgress,
        onSlideCompleted,
        force,
      })
      setProgress((current) => ({ ...current, completed: current.total, stageProgress: 1 }))
      setStatus('completed')
    } catch (ocrError) {
      console.error(ocrError)
      setStatus('error')
      setError(ocrError instanceof Error ? ocrError.message : 'OCRに失敗しました。')
    }
  }

  return { status, stage, progress, error, recognize }
}

export type OcrController = ReturnType<typeof useOcr>
