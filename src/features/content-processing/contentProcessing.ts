import { z } from 'zod'
import { withUserFacingError, UserFacingError } from '../../lib/errors'
import { completeChat, parseJsonResponse } from '../../lib/llama/chat'
import { withLlamaServer } from '../../lib/llama/server'
import { ensureTextModel, getTextModel, type TextModelId } from '../../lib/llama/textModel'
import { modelProgressRatio } from '../../lib/models/download'
import { articleInputFingerprint, hasCurrentArticle } from '../article/article'
import { CORRECTION_LEVELS, correctionInputFingerprint } from '../correction/correction'
import type {
  ArticleFormattingResult,
  ContentProcessingResult,
  CorrectionLevel,
  MediaProject,
  SlideData,
  TranscriptCorrectionResult,
} from '../../types/project'

const COMMON_PROMPT = [
  '/no_think',
  'あなたは動画講義の文字起こしと記事本文を編集する専門家です。',
  'RAW TRANSCRIPTとSLIDE OCRを使い、補正済み発話と記事本文を同時に作成してください。',
  '返答はJSONオブジェクトのみとし、次の形式にしてください。',
  '{"correctedTranscript":"補正済みの発話","corrections":[{"before":"補正前","after":"補正後","reason":"理由"}],"articleBody":"記事本文"}',
  'correctedTranscriptは、補正後の発話記録です。',
  'articleBodyは、correctedTranscriptをもとにしたこのSlideの記事本文です。',
  'articleBodyには見出しや前置きを追加しないでください。',
  '日本語で出力してください。',
].join('\n')

const LEVEL_PROMPT_RULES: Record<CorrectionLevel, string[]> = {
  lv1: [
    'スライドは用語確認の参考資料にとどめ、RAW TRANSCRIPTの内容と文の構造を維持してください。',
    '固有名詞、製品名、技術用語、英単語、数値の明らかな誤変換だけを、スライド表記へ置き換えてください。',
    '日本語は句読点、助詞、明らかな文法ミスを軽く整えるだけにしてください。',
    'articleBodyも要約や情報追加をせず、補正済み発話を段落に整える程度にしてください。',
  ],
  lv2: [
    'スライドの正式な用語・表記を優先し、RAW TRANSCRIPTの文の意味を維持したまま軽く整えてください。',
    '技術用語、略語、数値、単位、固有名詞は積極的にスライド表記へ合わせてください。',
    'articleBodyは補正済み発話を読みやすい段落に整理し、軽微な重複やフィラーを整えてください。',
  ],
  lv3: [
    'スライドを用語と短い事実関係の判断における優先資料として扱ってください。',
    'RAW TRANSCRIPTに明らかな誤変換や欠落した短い用語があり、スライドから特定できる場合は補完してください。',
    'articleBodyはスライドの流れに沿って段落を整理して構いませんが、発話とスライドにない情報は追加しないでください。',
  ],
  lv4: [
    'スライドを内容の基準として扱い、RAW TRANSCRIPTは発話の流れを確認する参考資料として使ってください。',
    '用語や数値だけでなく、スライドと矛盾する短い説明や文の一部も、スライドに合わせて再構成してください。',
    'スライドに直接書かれた短い語句は、発話の文脈を成立させるために補完して構いません。',
    'articleBodyはスライドと発話の対応関係が分かる、読みやすい説明文へ整えてください。',
  ],
  lv5: [
    'スライドのテキストを、その区間で扱われた内容の正規化された基準として扱ってください。',
    'RAW TRANSCRIPTは参考程度に使い、用語、数値、主張がスライドと異なる場合はスライドを優先してください。',
    'correctedTranscriptはスライドに忠実な発話記録として、欠落した短い語句や文をスライドの直接的な根拠に基づいて再構成して構いません。',
    'articleBodyはスライドの内容を正として、RAW TRANSCRIPTに依存せず、スライド中心に一から書き直して構いません。',
    'ただし、スライドに明記されていない推測、例、理由、結論は追加せず、スライド全体の単純な書き写しや長文の要約にも変換しないでください。',
  ],
}

const ContentResponseSchema = z.object({
  correctedTranscript: z.string().trim().min(1),
  corrections: z
    .array(
      z.object({
        before: z.string().trim().min(1),
        after: z.string(),
        reason: z.string().trim().optional(),
      }),
    )
    .default([]),
  articleBody: z.string().trim().min(1),
})

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
  modelId: TextModelId
  level: CorrectionLevel
  onStage?: (stage: ContentProcessingStage) => void
  onProgress?: (progress: ContentProcessingProgress) => void
  onSlideCompleted: ContentProcessingSlideCompleted
  signal?: AbortSignal
  force?: boolean
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('処理を中止しました。', 'AbortError')
}

function systemPromptFor(level: CorrectionLevel) {
  return [
    COMMON_PROMPT,
    ...LEVEL_PROMPT_RULES[level],
    '補正不要ならcorrectedTranscriptはRAW TRANSCRIPTと同じにし、correctionsは空配列にしてください。',
    'スライドやRAW TRANSCRIPTに根拠のない情報を追加しないでください。',
    `この処理は${CORRECTION_LEVELS.find((item) => item.id === level)?.label ?? level}として実行しています。`,
  ].join('\n')
}

function userPromptFor(slide: SlideData) {
  return [
    `[RAW TRANSCRIPT]\n${slide.transcript?.raw.trim() || '(発話なし)'}`,
    `[SLIDE OCR TITLE]\n${slide.ocr?.title?.trim() || '(タイトルなし)'}`,
    `[SLIDE OCR TERMS]\n${slide.ocr?.terms?.join(', ') || '(用語なし)'}`,
    `[SLIDE OCR RAW]\n${slide.ocr?.rawText.trim() || '(OCRなし)'}`,
  ].join('\n\n')
}

function parseContentResponse(
  text: string,
  slide: SlideData,
  modelId: TextModelId,
  level: CorrectionLevel,
): ContentProcessingResult {
  if (!slide.transcript) throw new Error(`Slide ${slide.index + 1}に発話データがありません。`)

  const result = ContentResponseSchema.safeParse(parseJsonResponse(text))
  if (!result.success) throw new Error('発話と記事本文の形式が不正です。')

  const correction: TranscriptCorrectionResult = {
    corrected: result.data.correctedTranscript,
    corrections: result.data.corrections,
    model: modelId,
    level,
    inputFingerprint: correctionInputFingerprint(slide, modelId, level),
  }
  const correctedSlide: SlideData = {
    ...slide,
    transcript: {
      ...slide.transcript,
      corrected: correction.corrected,
      correctionModel: correction.model,
      correctionLevel: correction.level,
      correctionInputFingerprint: correction.inputFingerprint,
    },
  }
  const article: ArticleFormattingResult = {
    body: result.data.articleBody,
    model: modelId,
    inputFingerprint: articleInputFingerprint(correctedSlide, modelId),
  }

  return { correction, article }
}

async function processSlide(
  baseUrl: string,
  slide: SlideData,
  modelId: TextModelId,
  level: CorrectionLevel,
  signal?: AbortSignal,
) {
  return withUserFacingError(
    `Slide ${slide.index + 1}の発話と記事本文を生成できませんでした。再試行してください。`,
    async () => {
      const response = await completeChat(baseUrl, {
        model: modelId,
        messages: [
          { role: 'system', content: systemPromptFor(level) },
          { role: 'user', content: userPromptFor(slide) },
        ],
        temperature: 0,
        maxTokens: 4096,
        responseFormat: { type: 'json_object' },
        signal,
      })
      return parseContentResponse(response, slide, modelId, level)
    },
  )
}

export function hasCurrentContent(slide: SlideData, modelId: TextModelId, level: CorrectionLevel) {
  return hasCurrentArticle(slide, modelId, level)
}

export async function runContentProcessing({
  project,
  modelId,
  level,
  onStage,
  onProgress,
  onSlideCompleted,
  signal,
  force = false,
}: RunContentProcessingInput) {
  const textModel = getTextModel(modelId)
  const targetSlides = project.slides.filter((slide) => slide.transcript?.raw.trim())
  if (targetSlides.length === 0) {
    throw new UserFacingError('処理する文字起こしがありません。先に文字起こしを実行してください。')
  }

  const pendingSlides = force
    ? targetSlides
    : targetSlides.filter((slide) => !hasCurrentContent(slide, modelId, level))
  let completed = targetSlides.length - pendingSlides.length
  const report = (stageProgress: number | null) => {
    onProgress?.({ completed, total: targetSlides.length, stageProgress })
  }

  report(pendingSlides.length === 0 ? 1 : null)
  if (pendingSlides.length === 0) return

  throwIfAborted(signal)
  onStage?.('preparing-model')
  const model = await withUserFacingError(
    '文章処理モデルを準備できませんでした。通信状況と空き容量を確認して、再試行してください。',
    () =>
      ensureTextModel({
        model: textModel,
        signal,
        onProgress: (progress) => report(modelProgressRatio(progress)),
      }),
  )

  throwIfAborted(signal)
  onStage?.('processing')
  report(null)
  await withUserFacingError(
    '文章処理エンジンを起動または実行できませんでした。アプリを再起動して、再試行してください。',
    () =>
      withLlamaServer(model, async (baseUrl) => {
        for (const slide of pendingSlides) {
          throwIfAborted(signal)
          const result = await processSlide(baseUrl, slide, modelId, level, signal)
          await withUserFacingError(
            `Slide ${slide.index + 1}の解析結果を保存できませんでした。空き容量を確認して、再試行してください。`,
            () => onSlideCompleted(slide.id, result),
          )
          completed += 1
          report(null)
        }
      }),
  )
}
