import { readFile } from '@tauri-apps/plugin-fs'
import { UserFacingError, withUserFacingError } from '../../lib/errors'
import { completeChat } from '../../lib/llama/chat'
import { withLlamaServer } from '../../lib/llama/server'
import { DEFAULT_OCR_MODEL, ensureOcrModel } from '../../lib/ocr/modelManager'
import { modelProgressRatio } from '../../lib/models/download'
import type { MediaProject, SlideData, SlideOcrResult } from '../../types/project'

const OCR_PROMPT_VERSION = 'text-recognition-v1'
const OCR_PROMPT = 'Text Recognition:'

export type OcrStage = 'preparing-model' | 'recognizing'

export type OcrProgress = {
  completed: number
  total: number
  stageProgress: number | null
}

export type OcrSlideCompleted = (slideId: string, ocr: SlideOcrResult) => void | Promise<void>

type RunOcrInput = {
  project: MediaProject
  onStage?: (stage: OcrStage) => void
  onProgress?: (progress: OcrProgress) => void
  onSlideCompleted?: OcrSlideCompleted
  signal?: AbortSignal
  force?: boolean
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('OCRを中止しました。', 'AbortError')
}

export function ocrInputFingerprint(slide: SlideData) {
  return JSON.stringify([
    slide.id,
    slide.image.representativeFramePath ?? '',
    slide.startMs,
    slide.endMs,
    slide.detection.hash ?? '',
    DEFAULT_OCR_MODEL.id,
    OCR_PROMPT_VERSION,
  ])
}

async function recognizeSlide(baseUrl: string, slide: SlideData, signal?: AbortSignal) {
  const imagePath = slide.image.representativeFramePath
  if (!imagePath) throw new UserFacingError(`Slide ${slide.index + 1}の代表画像がありません。`)

  const image = toBase64(await readFile(imagePath))
  return completeChat(baseUrl, {
    model: DEFAULT_OCR_MODEL.id,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } },
          { type: 'text', text: OCR_PROMPT },
        ],
      },
    ],
    temperature: 0.02,
    maxTokens: 2048,
    signal,
  })
}

export async function runOcr({
  project,
  onStage,
  onProgress,
  onSlideCompleted,
  signal,
  force = false,
}: RunOcrInput) {
  const slides = project.slides
  if (slides.length === 0) {
    throw new UserFacingError('OCRするSlideがありません。先にスライド検出を実行してください。')
  }
  if (slides.some((slide) => !slide.image.representativeFramePath)) {
    throw new UserFacingError(
      '代表画像のないSlideがあります。スライド検出をもう一度実行してください。',
    )
  }

  const pendingSlides = force
    ? slides
    : slides.filter((slide) => slide.ocr?.inputFingerprint !== ocrInputFingerprint(slide))
  let completed = slides.length - pendingSlides.length
  const report = (stageProgress: number | null) => {
    onProgress?.({
      completed,
      total: slides.length,
      stageProgress,
    })
  }

  report(pendingSlides.length === 0 ? 1 : null)
  if (pendingSlides.length === 0) return

  throwIfAborted(signal)
  onStage?.('preparing-model')
  const model = await withUserFacingError(
    'OCRモデルを準備できませんでした。通信状況と空き容量を確認して、再試行してください。',
    () =>
      ensureOcrModel({
        signal,
        onProgress: (progress) => report(modelProgressRatio(progress)),
      }),
  )

  throwIfAborted(signal)
  onStage?.('recognizing')
  report(null)
  await withUserFacingError(
    'OCRエンジンを起動または実行できませんでした。アプリを再起動して、再試行してください。',
    () =>
      withLlamaServer(
        model,
        async (baseUrl) => {
          for (const slide of pendingSlides) {
            const fingerprint = ocrInputFingerprint(slide)
            throwIfAborted(signal)
            const rawText = await withUserFacingError(
              `Slide ${slide.index + 1}の文字を読み取れませんでした。再試行してください。`,
              () => recognizeSlide(baseUrl, slide, signal),
            )
            await withUserFacingError(
              `Slide ${slide.index + 1}のOCR結果を保存できませんでした。空き容量を確認して、再試行してください。`,
              async () => {
                await onSlideCompleted?.(slide.id, {
                  rawText,
                  model: DEFAULT_OCR_MODEL.id,
                  inputFingerprint: fingerprint,
                })
              },
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
