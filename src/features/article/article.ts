import { z } from 'zod'
import { parseJsonResponse, completeChat } from '../../lib/llama/chat'
import { withLlamaServer } from '../../lib/llama/server'
import { DEFAULT_TEXT_MODEL, ensureTextModel } from '../../lib/llama/textModel'
import { modelProgressRatio } from '../../lib/models/download'
import { hasCurrentCorrection } from '../correction/correction'
import type { ArticleFormattingResult, MediaProject, SlideData } from '../../types/project'

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
  onStage?: (stage: ArticleFormattingStage) => void
  onProgress?: (progress: ArticleFormattingProgress) => void
  onSlideCompleted: ArticleSlideCompleted
  signal?: AbortSignal
  force?: boolean
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('記事整形を中止しました。', 'AbortError')
}

export function articleInputFingerprint(slide: SlideData) {
  return JSON.stringify([
    slide.id,
    slide.transcript?.corrected ?? '',
    slide.transcript?.correctionInputFingerprint ?? '',
    DEFAULT_TEXT_MODEL.id,
    ARTICLE_PROMPT_VERSION,
  ])
}

export function hasCurrentArticle(slide: SlideData) {
  return (
    Boolean(slide.transcript?.articleBody?.trim()) &&
    slide.transcript?.articleInputFingerprint === articleInputFingerprint(slide)
  )
}

export function articleTargetSlides(project: MediaProject) {
  return project.slides.filter(hasCurrentCorrection)
}

function parseArticle(text: string, slide: SlideData): ArticleFormattingResult {
  const result = ArticleResponseSchema.safeParse(parseJsonResponse(text))
  if (!result.success) throw new Error('記事本文の形式が不正です。')

  return {
    body: result.data.body,
    model: DEFAULT_TEXT_MODEL.id,
    inputFingerprint: articleInputFingerprint(slide),
  }
}

async function formatSlide(baseUrl: string, slide: SlideData, signal?: AbortSignal) {
  const correctedTranscript = slide.transcript?.corrected?.trim() ?? ''
  if (!correctedTranscript) throw new Error(`Slide ${slide.index + 1}に補正済み発話がありません。`)

  try {
    const response = await completeChat(baseUrl, {
      model: DEFAULT_TEXT_MODEL.id,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `[CORRECTED TRANSCRIPT]\n${correctedTranscript}` },
      ],
      temperature: 0,
      maxTokens: 2048,
      responseFormat: { type: 'json_object' },
      signal,
    })
    return parseArticle(response, slide)
  } catch (error) {
    const message = error instanceof Error ? error.message : '記事本文の生成に失敗しました。'
    throw new Error(`Slide ${slide.index + 1}の記事整形に失敗しました。${message}`)
  }
}

export async function runArticleFormatting({
  project,
  onStage,
  onProgress,
  onSlideCompleted,
  signal,
  force = false,
}: RunArticleFormattingInput) {
  const targetSlides = articleTargetSlides(project)
  if (targetSlides.length === 0) {
    throw new Error('記事に整形する補正済み文字起こしがありません。先に文字起こしの補正を実行してください。')
  }

  const pendingSlides = force
    ? targetSlides
    : targetSlides.filter((slide) => !hasCurrentArticle(slide))
  let completed = targetSlides.length - pendingSlides.length
  const report = (stageProgress: number | null) => {
    onProgress?.({ completed, total: targetSlides.length, stageProgress })
  }

  report(pendingSlides.length === 0 ? 1 : null)
  if (pendingSlides.length === 0) return

  throwIfAborted(signal)
  onStage?.('preparing-model')
  const model = await ensureTextModel({
    signal,
    onProgress: (progress) => report(modelProgressRatio(progress)),
  })

  throwIfAborted(signal)
  onStage?.('formatting')
  report(null)
  await withLlamaServer(model, async (baseUrl) => {
    for (const slide of pendingSlides) {
      throwIfAborted(signal)
      const article = await formatSlide(baseUrl, slide, signal)
      await onSlideCompleted(slide.id, article)
      completed += 1
      report(null)
    }
  })
}
