import { z } from 'zod'
import { UserFacingError, withUserFacingError } from '../../lib/errors'
import { completeChat, parseJsonResponse } from '../../lib/llama/chat'
import { withLlamaServer } from '../../lib/llama/server'
import {
  DEFAULT_TEXT_MODEL,
  ensureTextModel,
  getTextModel,
  type TextModelId,
} from '../../lib/llama/textModel'
import { modelProgressRatio } from '../../lib/models/download'
import type {
  CorrectionMode,
  MediaProject,
  SlideData,
  TranscriptCorrectionResult,
} from '../../types/project'

const CORRECTION_PROMPT_VERSION = 'transcript-correction-v2'

export const CORRECTION_MODES = [
  {
    id: 'transcript-first',
    label: '発話に忠実',
    description: '発話内容を優先し、スライドは用語確認に使います。',
  },
  {
    id: 'slide-aligned',
    label: 'スライド表記を優先',
    description: 'スライドの正式な用語・表記に合わせます。',
  },
  {
    id: 'slide-faithful',
    label: 'スライド準拠（強）',
    description: 'スライドを基準に、欠落した短い用語や表記も補います。',
  },
  {
    id: 'slide-authoritative',
    label: 'スライド中心（最強）',
    description: 'スライドを内容の基準にして、文の再構成まで許可します。',
  },
] as const satisfies ReadonlyArray<{ id: CorrectionMode; label: string; description: string }>

export const DEFAULT_CORRECTION_MODE: CorrectionMode = 'transcript-first'

const COMMON_PROMPT = [
  '/no_think',
  'あなたは動画講義の文字起こしを校正する編集者です。',
  '返答はJSONオブジェクトのみとし、次の形式にしてください。',
  '{"corrected":"補正後の発話","corrections":[{"before":"補正前","after":"補正後","reason":"理由"}]}',
].join('\n')

const MODE_PROMPT_RULES: Record<CorrectionMode, string[]> = {
  'transcript-first': [
    'raw transcriptを発話内容の唯一の根拠とし、要約、発話の削除、情報の追加、意味の変更は禁止です。',
    'スライドOCRは固有名詞、製品名、技術用語、英単語、数値の表記を確認する補助資料として使ってください。',
    'OCRにしか存在しない内容を発話へ追加してはいけません。',
  ],
  'slide-aligned': [
    '発話内容を変えずに、スライドに表示された正式な表記へ文字起こしを合わせてください。',
    '固有名詞、製品名、技術用語、英単語、略語、数値、単位は、スライドの表記を優先して補正してください。',
    'スライドにしか存在しない内容を発話へ追加してはいけません。',
  ],
  'slide-faithful': [
    'スライドを、用語・表記・短い事実関係を判断する最優先の資料として扱ってください。',
    'RAW TRANSCRIPTに明らかな誤変換、聞き間違い、欠落した短い用語があり、スライドから正しい表記を特定できる場合は、積極的に補正してください。',
    '発話とスライドが異なる場合、技術用語、数値、短い事実関係はスライドに合わせてください。',
    'スライドに直接書かれた短い語句は、発話の文脈を成立させるために補完して構いません。',
    'スライドの文章を大量にコピーしたり、発話にない説明や結論を追加したりしてはいけません。',
  ],
  'slide-authoritative': [
    'スライドを、その区間で扱われた内容の正規化された基準として扱ってください。',
    'RAW TRANSCRIPTは不完全な下書きとして扱い、用語、数値、短い事実関係がスライドと矛盾する場合はスライドを優先してください。',
    '明らかな聞き間違いだけでなく、欠落した短い語句や文の一部も、スライドの直接的な根拠に基づいて補完・再構成して構いません。',
    'RAW TRANSCRIPTが崩れている場合は、スライドの内容と発話の流れから、対応する一文を再構成して構いません。',
    'スライドに明記されていない推測、例、理由、結論を追加してはいけません。',
    'スライド全体を読み上げたような長文を新しく作ったり、記事や要約に変換したりしてはいけません。',
  ],
}

function systemPromptFor(mode: CorrectionMode) {
  return [
    COMMON_PROMPT,
    ...MODE_PROMPT_RULES[mode],
    '補正不要ならcorrectedはraw transcriptと同じにし、correctionsは空配列にしてください。',
    '日本語で出力してください。',
  ].join('\n')
}

function userPromptFor(slide: SlideData, mode: CorrectionMode) {
  const rawTranscript = slide.transcript?.raw.trim() ?? ''
  if (mode === 'transcript-first') {
    return `[RAW TRANSCRIPT]\n${rawTranscript}\n\n[SLIDE OCR]\n${slide.ocr?.rawText.trim() || '(OCRなし)'}`
  }

  return [
    `[RAW TRANSCRIPT]\n${rawTranscript}`,
    `[SLIDE OCR TITLE]\n${slide.ocr?.title?.trim() || '(タイトルなし)'}`,
    `[SLIDE OCR TERMS]\n${slide.ocr?.terms?.join(', ') || '(用語なし)'}`,
    `[SLIDE OCR RAW]\n${slide.ocr?.rawText.trim() || '(OCRなし)'}`,
  ].join('\n\n')
}

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

export type CorrectionSlideCompleted = (
  slideId: string,
  correction: TranscriptCorrectionResult,
) => void | Promise<void>

type RunCorrectionInput = {
  project: MediaProject
  modelId: TextModelId
  correctionMode?: CorrectionMode
  onStage?: (stage: CorrectionStage) => void
  onProgress?: (progress: CorrectionProgress) => void
  onSlideCompleted: CorrectionSlideCompleted
  signal?: AbortSignal
  force?: boolean
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('補正を中止しました。', 'AbortError')
}

export function correctionInputFingerprint(
  slide: SlideData,
  modelId = slide.transcript?.correctionModel ?? DEFAULT_TEXT_MODEL.id,
  correctionMode = slide.transcript?.correctionMode ?? DEFAULT_CORRECTION_MODE,
) {
  return JSON.stringify([
    slide.id,
    slide.transcript?.raw ?? '',
    slide.ocr?.rawText ?? '',
    slide.ocr?.title ?? null,
    slide.ocr?.terms ?? [],
    modelId,
    correctionMode,
    CORRECTION_PROMPT_VERSION,
  ])
}

export function hasCurrentCorrection(
  slide: SlideData,
  modelId = slide.transcript?.correctionModel ?? DEFAULT_TEXT_MODEL.id,
  correctionMode = slide.transcript?.correctionMode ?? DEFAULT_CORRECTION_MODE,
) {
  return (
    Boolean(slide.transcript?.corrected?.trim()) &&
    slide.transcript?.correctionInputFingerprint ===
      correctionInputFingerprint(slide, modelId, correctionMode)
  )
}

function parseCorrection(
  text: string,
  slide: SlideData,
  modelId: TextModelId,
  correctionMode: CorrectionMode,
): TranscriptCorrectionResult {
  const result = CorrectionResponseSchema.safeParse(parseJsonResponse(text))
  if (!result.success) throw new Error('補正結果の形式が不正です。')

  return {
    ...result.data,
    model: modelId,
    mode: correctionMode,
    inputFingerprint: correctionInputFingerprint(slide, modelId, correctionMode),
  }
}

async function correctSlide(
  baseUrl: string,
  slide: SlideData,
  modelId: TextModelId,
  correctionMode: CorrectionMode,
  signal?: AbortSignal,
) {
  const rawTranscript = slide.transcript?.raw.trim() ?? ''
  if (!rawTranscript) throw new Error(`Slide ${slide.index + 1}に発話がありません。`)

  return withUserFacingError(
    `Slide ${slide.index + 1}の文字起こしを補正できませんでした。再試行してください。`,
    async () => {
      const response = await completeChat(baseUrl, {
        model: modelId,
        messages: [
          { role: 'system', content: systemPromptFor(correctionMode) },
          { role: 'user', content: userPromptFor(slide, correctionMode) },
        ],
        temperature: 0,
        maxTokens: 2048,
        responseFormat: { type: 'json_object' },
        signal,
      })
      return parseCorrection(response, slide, modelId, correctionMode)
    },
  )
}

export async function runCorrection({
  project,
  modelId,
  correctionMode = DEFAULT_CORRECTION_MODE,
  onStage,
  onProgress,
  onSlideCompleted,
  signal,
  force = false,
}: RunCorrectionInput) {
  const textModel = getTextModel(modelId)
  const targetSlides = project.slides.filter((slide) => slide.transcript?.raw.trim())
  if (targetSlides.length === 0) {
    throw new UserFacingError('補正する文字起こしがありません。先に文字起こしを実行してください。')
  }

  const pendingSlides = force
    ? targetSlides
    : targetSlides.filter((slide) => !hasCurrentCorrection(slide, modelId, correctionMode))
  let completed = targetSlides.length - pendingSlides.length
  const report = (stageProgress: number | null) => {
    onProgress?.({ completed, total: targetSlides.length, stageProgress })
  }

  report(pendingSlides.length === 0 ? 1 : null)
  if (pendingSlides.length === 0) return

  throwIfAborted(signal)
  onStage?.('preparing-model')
  const model = await withUserFacingError(
    '文字起こし補正モデルを準備できませんでした。通信状況と空き容量を確認して、再試行してください。',
    () =>
      ensureTextModel({
        model: textModel,
        signal,
        onProgress: (progress) => report(modelProgressRatio(progress)),
      }),
  )

  throwIfAborted(signal)
  onStage?.('correcting')
  report(null)
  await withUserFacingError(
    '文字起こし補正エンジンを起動または実行できませんでした。アプリを再起動して、再試行してください。',
    () =>
      withLlamaServer(model, async (baseUrl) => {
        for (const slide of pendingSlides) {
          throwIfAborted(signal)
          const correction = await correctSlide(baseUrl, slide, modelId, correctionMode, signal)
          await withUserFacingError(
            `Slide ${slide.index + 1}の補正結果を保存できませんでした。空き容量を確認して、再試行してください。`,
            () => onSlideCompleted(slide.id, correction),
          )
          completed += 1
          report(null)
        }
      }),
  )
}
