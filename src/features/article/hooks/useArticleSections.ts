import { useRef, useState } from 'react'
import { getUserErrorMessage } from '../../../lib/errors'
import type { ArticleModelId } from '../../../lib/article/articleModel'
import type { ArticleSections, MediaProject } from '../../../types/project'
import { hasCurrentArticleSections } from '../article'
import { runArticleSectionGeneration } from '../sectionGenerator'

export type ArticleSectionsStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'error'
export type ArticleSectionsStage = 'preparing-model' | 'generating'

export function useArticleSections(
  project: MediaProject,
  modelId: ArticleModelId,
  onCompleted: (sections: ArticleSections) => void | Promise<void>,
) {
  const articleSlides = project.slides.filter((slide) => slide.transcript)
  const hasAllArticleBodies =
    articleSlides.length > 0 &&
    articleSlides.every((slide) => slide.transcript?.articleBody?.trim())
  const isUpToDate = hasCurrentArticleSections(project, modelId)
  const [status, setStatus] = useState<ArticleSectionsStatus>('idle')
  const [stage, setStage] = useState<ArticleSectionsStage>('preparing-model')
  const [stageProgress, setStageProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const activeController = useRef<AbortController | null>(null)

  async function generate(force = false) {
    if (activeController.current) return
    if (!hasAllArticleBodies) {
      setStatus('error')
      setError('Slide本文をすべて生成してから、セクション構成を作成してください。')
      return
    }
    if (isUpToDate && !force) {
      setStatus('completed')
      return
    }

    const controller = new AbortController()
    activeController.current = controller
    setStatus('running')
    setStage('preparing-model')
    setStageProgress(null)
    setError(null)

    try {
      const sections = await runArticleSectionGeneration({
        project,
        modelId,
        signal: controller.signal,
        onPreparationProgress: setStageProgress,
        onReady: () => {
          setStage('generating')
          setStageProgress(null)
        },
      })
      await onCompleted(sections)
      setStageProgress(1)
      setStatus('completed')
    } catch (generationError) {
      if (controller.signal.aborted) {
        setStatus('cancelled')
        setError(null)
      } else {
        console.error(generationError)
        setStatus('error')
        setError(
          getUserErrorMessage(
            generationError,
            'セクションを生成できませんでした。設定と入力内容を確認して、再試行してください。',
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

  const visibleStatus: ArticleSectionsStatus =
    status === 'running' || status === 'cancelled' || status === 'completed' || status === 'error'
      ? status
      : isUpToDate
        ? 'completed'
        : 'idle'

  return {
    status: visibleStatus,
    stage,
    stageProgress,
    error,
    isUpToDate,
    hasAllArticleBodies,
    generate,
    cancel,
  }
}

export type ArticleSectionsController = ReturnType<typeof useArticleSections>
