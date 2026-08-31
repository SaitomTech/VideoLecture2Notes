import { useState } from 'react'
import { getUserErrorMessage } from '../../../lib/errors'
import type { TextModelId } from '../../../lib/llama/textModel'
import type { MediaProject } from '../../../types/project'
import {
  articleTargetSlides,
  hasCurrentArticle,
  runArticleFormatting,
  type ArticleFormattingProgress,
  type ArticleFormattingStage,
  type ArticleSlideCompleted,
} from '../article'

export type ArticleFormattingStatus = 'idle' | 'running' | 'completed' | 'error'

export function useArticleFormatting(
  project: MediaProject,
  onSlideCompleted: ArticleSlideCompleted,
  modelId: TextModelId,
) {
  const targetSlides = articleTargetSlides(project, modelId)
  const formattedSlides = targetSlides.filter((slide) => hasCurrentArticle(slide, modelId))
  const completedFromProject = formattedSlides.length
  const isUpToDate = completedFromProject === targetSlides.length && targetSlides.length > 0
  const [status, setStatus] = useState<ArticleFormattingStatus>('idle')
  const [stage, setStage] = useState<ArticleFormattingStage>('preparing-model')
  const [progress, setProgress] = useState<ArticleFormattingProgress>({
    completed: 0,
    total: 0,
    stageProgress: null,
  })
  const [error, setError] = useState<string | null>(null)

  async function format(force = false) {
    setStatus('running')
    setError(null)
    try {
      await runArticleFormatting({
        project,
        modelId,
        onStage: setStage,
        onProgress: setProgress,
        onSlideCompleted,
        force,
      })
      setProgress((current) => ({ ...current, completed: current.total, stageProgress: 1 }))
      setStatus('completed')
    } catch (formattingError) {
      console.error(formattingError)
      setStatus('error')
      setError(
        getUserErrorMessage(
          formattingError,
          '記事本文の生成を完了できませんでした。アプリを再起動して、再試行してください。',
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
    formattedSlides,
    format,
  }
}

export type ArticleFormattingController = ReturnType<typeof useArticleFormatting>
