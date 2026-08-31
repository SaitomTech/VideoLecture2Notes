import { z } from 'zod'
import { completeChat, parseJsonResponse } from '../../lib/llama/chat'
import { withLlamaServer } from '../../lib/llama/server'
import { DEFAULT_TEXT_MODEL, ensureTextModel } from '../../lib/llama/textModel'
import { modelProgressRatio } from '../../lib/models/download'
import type { MediaProject, SlideData, TranscriptCorrectionResult } from '../../types/project'

const CORRECTION_PROMPT_VERSION = 'transcript-correction-v1'

const SYSTEM_PROMPT = [
  '/no_think',
  'あなたは動画講義の文字起こしを校正する編集者です。',
  '返答はJSONオブジェクトのみとし、次の形式にしてください。',
  '{"corrected":"補正後の発話","corrections":[{"before":"補正前","after":"補正後","reason":"理由"}]}',
  'raw transcriptを発話内容の唯一の根拠とし、要約、発話の削除、情報の追加、意味の変更は禁止です。',
  'スライドOCRは固有名詞、製品名、技術用語、英単語、数値の表記を確認する補助資料として使ってください。',
  'OCRにしか存在しない内容を発話へ追加してはいけません。',
  '補正不要ならcorrectedはraw transcriptと同じにし、correctionsは空配列にしてください。',
  '日本語で出力してください。',
].join('\n')

const CorrectionResponseSchema = z.object({
  corrected: z.string().trim().min(1),
  corrections: z
    .array(
      z.object({
        before: z.string().trim().min(1),
        after: z.string(),
        reason: z.string().trim().optional(),
      }),
    )
    .default([]),
})

export type CorrectionStage = 'preparing-model' | 'correcting'

export type CorrectionProgress = {
  completed: number
  total: number
  stageProgress: number | null
}

export type CorrectionSlideCompleted = (slideId: string, correction: TranscriptCorrectionResult) => void | Promise<void>

type RunCorrectionInput = {
  project: MediaProject
  onStage?: (stage: CorrectionStage) => void
  onProgress?: (progress: CorrectionProgress) => void
  onSlideCompleted: CorrectionSlideCompleted
  signal?: AbortSignal
  force?: boolean
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('補正を中止しました。', 'AbortError')
}

export function correctionInputFingerprint(slide: SlideData) {
  return JSON.stringify([
    slide.id,
    slide.transcript?.raw ?? '',
    slide.ocr?.rawText ?? '',
    slide.ocr?.title ?? null,
    slide.ocr?.terms ?? [],
    DEFAULT_TEXT_MODEL.id,
    CORRECTION_PROMPT_VERSION,
  ])
}

export function hasCurrentCorrection(slide: SlideData) {
  return (
    Boolean(slide.transcript?.corrected?.trim()) &&
    slide.transcript?.correctionInputFingerprint === correctionInputFingerprint(slide)
  )
}

function parseCorrection(text: string, slide: SlideData): TranscriptCorrectionResult {
  const result = CorrectionResponseSchema.safeParse(parseJsonResponse(text))
  if (!result.success) throw new Error('補正結果の形式が不正です。')

  return {
    ...result.data,
    model: DEFAULT_TEXT_MODEL.id,
    inputFingerprint: correctionInputFingerprint(slide),
  }
}

async function correctSlide(baseUrl: string, slide: SlideData, signal?: AbortSignal) {
  const rawTranscript = slide.transcript?.raw.trim() ?? ''
  if (!rawTranscript) throw new Error(`Slide ${slide.index + 1}に発話がありません。`)

  try {
    const response = await completeChat(baseUrl, {
      model: DEFAULT_TEXT_MODEL.id,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `[RAW TRANSCRIPT]\n${rawTranscript}\n\n[SLIDE OCR]\n${slide.ocr?.rawText.trim() || '(OCRなし)'}`,
        },
      ],
      temperature: 0,
      maxTokens: 2048,
      responseFormat: { type: 'json_object' },
      signal,
    })
    return parseCorrection(response, slide)
  } catch (error) {
    const message = error instanceof Error ? error.message : '補正に失敗しました。'
    throw new Error(`Slide ${slide.index + 1}の補正に失敗しました。${message}`)
  }
}

export async function runCorrection({
  project,
  onStage,
  onProgress,
  onSlideCompleted,
  signal,
  force = false,
}: RunCorrectionInput) {
  const targetSlides = project.slides.filter((slide) => slide.transcript?.raw.trim())
  if (targetSlides.length === 0) {
    throw new Error('補正する文字起こしがありません。先に文字起こしを実行してください。')
  }

  const pendingSlides = force
    ? targetSlides
    : targetSlides.filter((slide) => !hasCurrentCorrection(slide))
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
  onStage?.('correcting')
  report(null)
  await withLlamaServer(model, async (baseUrl) => {
    for (const slide of pendingSlides) {
      throwIfAborted(signal)
      const correction = await correctSlide(baseUrl, slide, signal)
      await onSlideCompleted(slide.id, correction)
      completed += 1
      report(null)
    }
  })
}
