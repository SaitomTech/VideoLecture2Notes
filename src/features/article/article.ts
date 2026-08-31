import { z } from 'zod'
import { UserFacingError, withUserFacingError } from '../../lib/errors'
import { parseJsonResponse, completeChat } from '../../lib/llama/chat'
import { withLlamaServer } from '../../lib/llama/server'
import {
  DEFAULT_TEXT_MODEL,
  ensureTextModel,
  getTextModel,
  type TextModelId,
} from '../../lib/llama/textModel'
import { modelProgressRatio } from '../../lib/models/download'
import { hasCurrentCorrection } from '../correction/correction'
import type {
  ArticleFormattingResult,
  CorrectionMode,
  MediaProject,
  SlideData,
} from '../../types/project'

const ARTICLE_PROMPT_VERSION = 'article-formatting-v1'

const SYSTEM_PROMPT = [
  '/no_think',
  'あなたは動画講義の編集者です。',
  '補正済み文字起こしを、内容を変えずに読みやすい記事本文へ整形してください。',
  '返答はJSONオブジェクトのみとし、次の形式にしてください。',
  '{"body":"整形後の記事本文"}',
  '許可される変更は、フィラー除去、句読点の追加、段落分け、明らかな言い直しや軽微な重複の整理だけです。',
  '要約、発話していない事実の追加、スライドだけを根拠にした文章の追加、主張や意味の変更は禁止です。',
  '見出しや前置きは追加せず、本文だけを日本語で返してください。',
].join('\n')

const ArticleResponseSchema = z.object({
  body: z.string().trim().min(1),
})

export type ArticleFormattingStage = 'preparing-model' | 'formatting'

export type ArticleFormattingProgress = {
  completed: number
  total: number
  stageProgress: number | null
}

export type ArticleSlideCompleted = (
  slideId: string,
  article: ArticleFormattingResult,
) => void | Promise<void>

type RunArticleFormattingInput = {
  project: MediaProject
  modelId: TextModelId
  correctionMode?: CorrectionMode
  onStage?: (stage: ArticleFormattingStage) => void
  onProgress?: (progress: ArticleFormattingProgress) => void
  onSlideCompleted: ArticleSlideCompleted
  signal?: AbortSignal
  force?: boolean
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('記事整形を中止しました。', 'AbortError')
}

export function articleInputFingerprint(
  slide: SlideData,
  modelId = slide.transcript?.articleModel ?? DEFAULT_TEXT_MODEL.id,
) {
  return JSON.stringify([
    slide.id,
    slide.transcript?.corrected ?? '',
    slide.transcript?.correctionInputFingerprint ?? '',
    modelId,
    ARTICLE_PROMPT_VERSION,
  ])
}

export function hasCurrentArticle(
  slide: SlideData,
  modelId = slide.transcript?.articleModel ?? DEFAULT_TEXT_MODEL.id,
) {
  return (
    Boolean(slide.transcript?.articleBody?.trim()) &&
    slide.transcript?.articleInputFingerprint === articleInputFingerprint(slide, modelId)
  )
}

export function articleTargetSlides(
  project: MediaProject,
  modelId?: TextModelId,
  correctionMode?: CorrectionMode,
) {
  return project.slides.filter((slide) => hasCurrentCorrection(slide, modelId, correctionMode))
}

function parseArticle(text: string, slide: SlideData, modelId: TextModelId): ArticleFormattingResult {
  const looksLikeJson = /^\s*(?:\{|\[|```json\b)/i.test(text)
  const plainText = text
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  let body = plainText

  if (looksLikeJson) {
    const result = ArticleResponseSchema.safeParse(parseJsonResponse(text))
    if (!result.success) throw new Error('記事本文の形式が不正です。')
    body = result.data.body
  } else {
    try {
      const result = ArticleResponseSchema.safeParse(parseJsonResponse(text))
      if (result.success) body = result.data.body
    } catch {
      // llama-server may return the requested article body without the JSON wrapper.
    }
  }

  if (!body) throw new Error('記事本文の形式が不正です。')

  return {
    body,
    model: modelId,
    inputFingerprint: articleInputFingerprint(slide, modelId),
  }
}

async function formatSlide(
  baseUrl: string,
  slide: SlideData,
  modelId: TextModelId,
  signal?: AbortSignal,
) {
  const correctedTranscript = slide.transcript?.corrected?.trim() ?? ''
  if (!correctedTranscript) throw new Error(`Slide ${slide.index + 1}に補正済み発話がありません。`)

  return withUserFacingError(
    `Slide ${slide.index + 1}の記事本文を生成できませんでした。再試行してください。`,
    async () => {
      const response = await completeChat(baseUrl, {
        model: modelId,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `[CORRECTED TRANSCRIPT]\n${correctedTranscript}` },
        ],
        temperature: 0,
        maxTokens: 2048,
        responseFormat: { type: 'json_object' },
        signal,
      })
      return parseArticle(response, slide, modelId)
    },
  )
}

export async function runArticleFormatting({
  project,
  modelId,
  correctionMode,
  onStage,
  onProgress,
  onSlideCompleted,
  signal,
  force = false,
}: RunArticleFormattingInput) {
  const textModel = getTextModel(modelId)
  const targetSlides = articleTargetSlides(project, modelId, correctionMode)
  if (targetSlides.length === 0) {
    throw new UserFacingError(
      '記事に整形する補正済み文字起こしがありません。先に文字起こしの補正を実行してください。',
    )
  }

  const pendingSlides = force
    ? targetSlides
    : targetSlides.filter((slide) => !hasCurrentArticle(slide, modelId))
  let completed = targetSlides.length - pendingSlides.length
  const report = (stageProgress: number | null) => {
    onProgress?.({ completed, total: targetSlides.length, stageProgress })
  }

  report(pendingSlides.length === 0 ? 1 : null)
  if (pendingSlides.length === 0) return

  throwIfAborted(signal)
  onStage?.('preparing-model')
  const model = await withUserFacingError(
    '記事生成モデルを準備できませんでした。通信状況と空き容量を確認して、再試行してください。',
    () =>
      ensureTextModel({
        model: textModel,
        signal,
        onProgress: (progress) => report(modelProgressRatio(progress)),
      }),
  )

  throwIfAborted(signal)
  onStage?.('formatting')
  report(null)
  await withUserFacingError(
    '記事生成エンジンを起動または実行できませんでした。アプリを再起動して、再試行してください。',
    () =>
      withLlamaServer(model, async (baseUrl) => {
        for (const slide of pendingSlides) {
          throwIfAborted(signal)
          const article = await formatSlide(baseUrl, slide, modelId, signal)
          await withUserFacingError(
            `Slide ${slide.index + 1}の記事本文を保存できませんでした。空き容量を確認して、再試行してください。`,
            () => onSlideCompleted(slide.id, article),
          )
          completed += 1
          report(null)
        }
      }),
  )
}
