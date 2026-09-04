import { useRef, useState } from 'react'
import { getUserErrorMessage } from '../../../lib/errors'
import type { ArticleModelId } from '../../../lib/article/articleModel'
import type { MediaProject, TranscriptAlignment } from '../../../types/project'
import {
  alignmentNeedsRun,
  runTranscriptAlignment,
  type AlignmentProgress,
  type AlignmentStage,
} from '../alignment'

export type TranscriptAlignmentStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'error'

export function useTranscriptAlignment(
  project: MediaProject,
  modelId: ArticleModelId,
  onCompleted: (alignment: TranscriptAlignment) => void | Promise<void>,
) {
  const currentAlignment = project.transcriptAlignment
  const hasCurrentAlignment = Boolean(currentAlignment) && !alignmentNeedsRun(project, modelId)
  const [status, setStatus] = useState<TranscriptAlignmentStatus>(
    hasCurrentAlignment ? 'completed' : 'idle',
  )
  const [stage, setStage] = useState<AlignmentStage>('preparing-model')
  const [progress, setProgress] = useState<AlignmentProgress>({
    completed: 0,
    total: 0,
    stageProgress: null,
  })
  const [error, setError] = useState<string | null>(null)
  const activeController = useRef<AbortController | null>(null)

  async function align() {
    if (activeController.current) return

    const controller = new AbortController()
    activeController.current = controller
    setStatus('running')
    setError(null)
    try {
      const result = await runTranscriptAlignment({
        project,
        modelId,
        signal: controller.signal,
        onStage: setStage,
        onProgress: setProgress,
      })
      await onCompleted(result)
      if (controller.signal.aborted) throw new DOMException('補正を中止しました。', 'AbortError')
      setProgress((current) => ({ ...current, completed: current.total, stageProgress: 1 }))
      setStatus('completed')
    } catch (alignmentError) {
      if (controller.signal.aborted) {
        setStatus('cancelled')
        setError(null)
      } else {
        console.error(alignmentError)
        setStatus('error')
        setError(
          getUserErrorMessage(
            alignmentError,
            'スライド所属の自動補正を完了できませんでした。アプリを再起動して、再試行してください。',
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

  const visibleStatus: TranscriptAlignmentStatus =
    status === 'running' || status === 'cancelled' || status === 'error'
      ? status
      : hasCurrentAlignment
        ? 'completed'
        : status === 'completed'
          ? 'idle'
          : status
  const visibleProgress =
    status === 'running' ||
    status === 'cancelled' ||
    (status === 'completed' && progress.total > 0 && hasCurrentAlignment)
      ? progress
      : {
          completed: hasCurrentAlignment ? progress.completed : 0,
          total: hasCurrentAlignment ? progress.total : 0,
          stageProgress: hasCurrentAlignment ? 1 : null,
        }

  return {
    status: visibleStatus,
    stage,
    progress: visibleProgress,
    error,
    align,
    cancel,
  }
}

export type TranscriptAlignmentController = ReturnType<typeof useTranscriptAlignment>
