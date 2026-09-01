import { useRef, useState } from 'react'
import { getUserErrorMessage } from '../../../lib/errors'
import type { MediaProject } from '../../../types/project'
import {
  ocrInputFingerprint,
  runOcr,
  type OcrProgress,
  type OcrSlideCompleted,
  type OcrStage,
} from '../ocr'

export type OcrStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'error'

export function useOcr(project: MediaProject, onSlideCompleted: OcrSlideCompleted) {
  const initialCompleted = project.slides.filter(
    (slide) => slide.ocr?.inputFingerprint === ocrInputFingerprint(slide),
  ).length
  const [status, setStatus] = useState<OcrStatus>(
    initialCompleted === project.slides.length && project.slides.length > 0 ? 'completed' : 'idle',
  )
  const [stage, setStage] = useState<OcrStage>('preparing-model')
  const [progress, setProgress] = useState<OcrProgress>({
    completed: initialCompleted,
    total: project.slides.length,
    stageProgress: initialCompleted === project.slides.length ? 1 : null,
  })
  const [error, setError] = useState<string | null>(null)
  const activeController = useRef<AbortController | null>(null)

  async function recognize(force = false) {
    if (activeController.current) return

    const controller = new AbortController()
    activeController.current = controller
    setStatus('running')
    setError(null)
    try {
      await runOcr({
        project,
        signal: controller.signal,
        onStage: setStage,
        onProgress: setProgress,
        onSlideCompleted,
        force,
      })
      setProgress((current) => ({ ...current, completed: current.total, stageProgress: 1 }))
      setStatus('completed')
    } catch (ocrError) {
      if (controller.signal.aborted) {
        setStatus('cancelled')
        setError(null)
      } else {
        console.error(ocrError)
        setStatus('error')
        setError(
          getUserErrorMessage(
            ocrError,
            'スライドOCRを完了できませんでした。アプリを再起動して、再試行してください。',
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

  return { status, stage, progress, error, recognize, cancel }
}

export type OcrController = ReturnType<typeof useOcr>
