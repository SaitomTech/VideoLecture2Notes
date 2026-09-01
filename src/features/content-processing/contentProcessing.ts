import { z } from 'zod'
import { withUserFacingError, UserFacingError } from '../../lib/errors'
import { completeChat, parseJsonResponse } from '../../lib/llama/chat'
import { withLlamaServer } from '../../lib/llama/server'
import { ensureTextModel, getTextModel, type TextModelId } from '../../lib/llama/textModel'
import { modelProgressRatio } from '../../lib/models/download'
import { articleInputFingerprint, hasCurrentArticle } from '../article/article'
import { CORRECTION_LEVELS } from '../correction/correction'
import type {
  ArticleFormattingResult,
  ContentProcessingResult,
  CorrectionLevel,
  MediaProject,
  SlideData,
} from '../../types/project'

const COMMON_PROMPT = [
  '/no_think',
  'あなたは動画講義の文字起こしをもとに記事本文を編集する専門家です。',
  'RAW TRANSCRIPTとSLIDE OCRを使い、このSlideの記事本文だけを作成してください。',
  '返答はJSONオブジェクトのみとし、次の形式にしてください。',
  '{"articleBody":"記事本文"}',
  'articleBodyは、このSlideで扱われた内容を読みやすい記事本文に整えたものです。',
  '単語レベルではSLIDE OCRを完全な正として扱ってください。固有名詞、製品名、サービス名、技術用語、略語、英単語、数値、単位などは、RAW TRANSCRIPTが自然に見えても、スライドに明確な表記があれば必ずスライド表記へ積極的に置き換えてください。',
  'スライドに書かれた単語の表記を保持したまま、articleBodyの文章へ反映してください。',
  'articleBodyには見出しや前置きを追加しないでください。',
  '日本語で出力してください。',
].join('\n')

const LEVEL_PROMPT_RULES: Record<CorrectionLevel, string[]> = {
  lv1: [
    'RAW TRANSCRIPTの内容と文の構造は維持してください。ただし、単語レベルでは共通ルールに従い、スライド表記を必ず正として扱ってください。',
    '固有名詞、製品名、技術用語、英単語、数値などは、明らかな誤変換に限らず、スライドに明確な表記がある場合は積極的に置き換えてください。',
    '日本語は句読点、助詞、明らかな文法ミスを軽く整えるだけにしてください。',
    'articleBodyも要約や情報追加をせず、発話を段落に整える程度にしてください。',
  ],
  lv2: [
    'スライドの正式な用語・表記を優先し、RAW TRANSCRIPTの文の意味を維持したまま軽く整えてください。',
    '技術用語、略語、数値、単位、固有名詞は積極的にスライド表記へ合わせてください。',
    'articleBodyは発話を読みやすい段落に整理し、軽微な重複やフィラーを整えてください。',
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
    'articleBodyはスライドの内容を正として、RAW TRANSCRIPTに依存せず、スライド中心に一から書き直して構いません。',
    'ただし、スライドに明記されていない推測、例、理由、結論は追加せず、スライド全体の単純な書き写しや長文の要約にも変換しないでください。',
  ],
}

const ContentResponseSchema = z.object({
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
  if (!result.success) throw new Error('記事本文の形式が不正です。')

  const article: ArticleFormattingResult = {
    body: result.data.articleBody,
    model: modelId,
    level,
    inputFingerprint: articleInputFingerprint(slide, modelId, level),
  }

  return { article }
}

async function processSlide(
  baseUrl: string,
  slide: SlideData,
  modelId: TextModelId,
  level: CorrectionLevel,
  signal?: AbortSignal,
) {
  return withUserFacingError(
    `Slide ${slide.index + 1}の記事本文を生成できませんでした。再試行してください。`,
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
      withLlamaServer(
        model,
        async (baseUrl) => {
          for (const slide of pendingSlides) {
            throwIfAborted(signal)
            const result = await processSlide(baseUrl, slide, modelId, level, signal)
            await withUserFacingError(
              `Slide ${slide.index + 1}の解析結果を保存できませんでした。空き容量を確認して、再試行してください。`,
              () => onSlideCompleted(slide.id, result),
            )
            throwIfAborted(signal)
            completed += 1
            report(null)
          }
        },
        signal,
      ),
  )
}
