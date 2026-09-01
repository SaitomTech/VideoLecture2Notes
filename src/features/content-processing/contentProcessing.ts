import { getArticleModel, type ArticleModelId } from '../../lib/article/articleModel'
import { withUserFacingError, UserFacingError } from '../../lib/errors'
import type { ContentProcessingResult, MediaProject } from '../../types/project'
import { hasCurrentArticle } from '../article/article'
import { createArticleGenerator } from './articleGenerator'

export type ContentProcessingStage = 'preparing-model' | 'processing'

export type ContentProcessingProgress = {
  completed: number
  total: number
  stageProgress: number | null
}

export type ContentProcessingSlideCompleted = (
  slideId: string,
  result: ContentProcessingResult,
) => void | Promise<void>

type RunContentProcessingInput = {
  project: MediaProject
  modelId: ArticleModelId
  onStage?: (stage: ContentProcessingStage) => void
  onProgress?: (progress: ContentProcessingProgress) => void
  onSlideCompleted: ContentProcessingSlideCompleted
  signal?: AbortSignal
  force?: boolean
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('処理を中止しました。', 'AbortError')
}

export function hasCurrentContent(slide: MediaProject['slides'][number], modelId: ArticleModelId) {
  return hasCurrentArticle(slide, modelId)
}

export async function runContentProcessing({
  project,
  modelId,
  onStage,
  onProgress,
  onSlideCompleted,
  signal,
  force = false,
}: RunContentProcessingInput) {
  const generator = createArticleGenerator(getArticleModel(modelId))
  const targetSlides = project.slides.filter((slide) => slide.transcript?.raw.trim())
  if (targetSlides.length === 0) {
    throw new UserFacingError('処理する文字起こしがありません。先に文字起こしを実行してください。')
  }

  const pendingSlides = force
    ? targetSlides
    : targetSlides.filter((slide) => !hasCurrentContent(slide, modelId))
  let completed = targetSlides.length - pendingSlides.length
  const report = (stageProgress: number | null) => {
    onProgress?.({ completed, total: targetSlides.length, stageProgress })
  }

  report(pendingSlides.length === 0 ? 1 : null)
  if (pendingSlides.length === 0) return

  throwIfAborted(signal)
  onStage?.('preparing-model')
  await withUserFacingError(generator.failureMessage, () =>
    generator.run({
      signal,
      onPreparationProgress: report,
      onReady: () => {
        onStage?.('processing')
        report(null)
      },
      work: async (generate) => {
        for (const slide of pendingSlides) {
          throwIfAborted(signal)
          const result = await generate(slide, signal)
          await withUserFacingError(
            `Slide ${slide.index + 1}の解析結果を保存できませんでした。空き容量を確認して、再試行してください。`,
            () => onSlideCompleted(slide.id, result),
          )
          throwIfAborted(signal)
          completed += 1
          report(null)
        }
      },
    }),
  )
}
