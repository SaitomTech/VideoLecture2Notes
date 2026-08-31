import { readFile } from '@tauri-apps/plugin-fs'
import { withLlamaServer } from '../../lib/llama/server'
import {
  DEFAULT_OCR_MODEL,
  ensureOcrModel,
} from '../../lib/ocr/modelManager'
import type { ModelDownloadProgress } from '../../lib/models/download'
import type { MediaProject, SlideData, SlideOcrResult } from '../../types/project'

const OCR_PROMPT_VERSION = 'text-recognition-v1'
const OCR_PROMPT = 'Text Recognition:'

export type OcrStage = 'preparing-model' | 'recognizing'

export type OcrProgress = {
  completed: number
  total: number
  stageProgress: number | null
}

export type OcrSlideCompleted = (
  slideId: string,
  ocr: SlideOcrResult,
) => void | Promise<void>

type RunOcrInput = {
  project: MediaProject
  onStage?: (stage: OcrStage) => void
  onProgress?: (progress: OcrProgress) => void
  onSlideCompleted?: OcrSlideCompleted
  signal?: AbortSignal
  force?: boolean
}

type LlamaChatResponse = {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function contentToText(content: unknown) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map((part) => {
      if (!part || typeof part !== 'object' || !('text' in part)) return ''
      return typeof part.text === 'string' ? part.text : ''
    })
    .join('')
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
  if (!imagePath) throw new Error(`Slide ${slide.index + 1}の代表画像がありません。`)

  const image = toBase64(await readFile(imagePath))
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
      max_tokens: 2048,
      stream: false,
    }),
    signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Slide ${slide.index + 1}のOCRに失敗しました (HTTP ${response.status})${detail ? `: ${detail}` : ''}`)
  }

  const result = (await response.json()) as LlamaChatResponse
  const text = contentToText(result.choices?.[0]?.message?.content).trim()
  if (!text) throw new Error(`Slide ${slide.index + 1}のOCR結果が空でした。`)
  return text
}

function modelProgress(progress: ModelDownloadProgress) {
  const fileProgress = progress.totalBytes > 0 ? progress.receivedBytes / progress.totalBytes : 0
  return Math.min(1, (progress.fileIndex - 1 + fileProgress) / progress.fileCount)
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
  if (slides.length === 0) throw new Error('OCRするSlideがありません。先にスライド検出を実行してください。')
  if (slides.some((slide) => !slide.image.representativeFramePath)) {
    throw new Error('代表画像のないSlideがあります。スライド検出をもう一度実行してください。')
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
  const model = await ensureOcrModel({
    signal,
    onProgress: (progress) => report(modelProgress(progress)),
  })

  throwIfAborted(signal)
  onStage?.('recognizing')
  report(null)
  await withLlamaServer(model, async (baseUrl) => {
    for (const slide of pendingSlides) {
      const fingerprint = ocrInputFingerprint(slide)
      throwIfAborted(signal)
      const rawText = await recognizeSlide(baseUrl, slide, signal)
      await onSlideCompleted?.(slide.id, {
        rawText,
        model: DEFAULT_OCR_MODEL.id,
        inputFingerprint: fingerprint,
      })
      completed += 1
      report(null)
    }
  })
}
