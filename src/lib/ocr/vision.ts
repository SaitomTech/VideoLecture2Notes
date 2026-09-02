import { z } from 'zod'
import { UserFacingError } from '../errors'
import { executeSidecar } from '../tauri/sidecar'
import type { OcrTextBlock } from '../../types/project'

const VisionOcrResponseSchema = z.object({
  rawText: z.string(),
  blocks: z.array(
    z.object({
      text: z.string(),
      confidence: z.number().finite().min(0).max(1),
      polygon: z.array(
        z.object({
          x: z.number().finite().min(0).max(1),
          y: z.number().finite().min(0).max(1),
        }),
      ),
    }),
  ),
  engineVersion: z.string().min(1),
})

export type VisionOcrRecognition = {
  rawText: string
  blocks: OcrTextBlock[]
  engineVersion: string
}

function outputText(output: { stdout: string | Uint8Array }) {
  return typeof output.stdout === 'string' ? output.stdout : new TextDecoder().decode(output.stdout)
}

export async function recognizeVisionImage({
  imagePath,
  language = 'ja+en',
  signal,
}: {
  imagePath: string
  language?: string
  signal?: AbortSignal
}): Promise<VisionOcrRecognition> {
  const output = await executeSidecar('binaries/apple-vision-ocr', [imagePath, language], {
    signal,
  })

  if (output.code !== 0) {
    throw new Error(
      output.stderr.trim() || `Apple Vision OCRが終了コード${output.code}で終了しました`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(outputText(output))
  } catch (error) {
    throw new UserFacingError('Apple Vision OCRの応答を読み取れませんでした。', error)
  }

  const result = VisionOcrResponseSchema.safeParse(parsed)
  if (!result.success) {
    throw new UserFacingError('Apple Vision OCRの応答形式が不正です。', result.error)
  }

  return result.data
}
