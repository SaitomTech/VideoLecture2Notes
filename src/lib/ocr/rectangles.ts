import { z } from 'zod'
import { UserFacingError } from '../errors'
import { executeSidecar } from '../tauri/sidecar'

const VisionPointSchema = z.object({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
})

const VisionRegionSchema = z.object({
  confidence: z.number().finite().min(0).max(1),
  polygon: z.array(VisionPointSchema).min(4).max(4),
})

const VisionRectangleResponseSchema = z.object({
  imagePath: z.string().min(1),
  rectangles: z.array(VisionRegionSchema),
  engineVersion: z.string().min(1),
})

const RECTANGLE_DETECTION_TIMEOUT_MS = 60_000

export type VisionPoint = z.infer<typeof VisionPointSchema>
export type VisionRegion = z.infer<typeof VisionRegionSchema>
export type VisionRectangleDetection = z.infer<typeof VisionRectangleResponseSchema>

function outputText(output: { stdout: string | Uint8Array }) {
  return typeof output.stdout === 'string' ? output.stdout : new TextDecoder().decode(output.stdout)
}

/** Uses a fresh Apple Vision sidecar process for each offline rectangle detection. */
export async function detectVisionRectangles(
  imagePaths: string[],
  signal?: AbortSignal,
): Promise<VisionRectangleDetection[]> {
  if (imagePaths.length === 0) return []

  const detections: VisionRectangleDetection[] = []
  for (let index = 0; index < imagePaths.length; index += 1) {
    const controller = new AbortController()
    const abortFromParent = () => controller.abort()
    if (signal?.aborted) controller.abort()
    signal?.addEventListener('abort', abortFromParent, { once: true })
    const timeout = window.setTimeout(() => controller.abort(), RECTANGLE_DETECTION_TIMEOUT_MS)

    let output
    try {
      output = await executeSidecar(
        'binaries/apple-vision-ocr',
        ['--detect-rectangles', imagePaths[index]],
        { signal: controller.signal },
      )
    } catch (error) {
      if (controller.signal.aborted && !signal?.aborted) {
        throw new Error(
          `Apple Visionの矩形検出がタイムアウトしました（${index + 1}/${imagePaths.length}枚目、60秒以内に完了しませんでした）。`,
        )
      }
      throw error
    } finally {
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', abortFromParent)
    }

    if (output.code !== 0) {
      throw new Error(
        output.stderr.trim() || `Apple Visionの矩形検出が終了コード${output.code}で終了しました`,
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(outputText(output))
    } catch (error) {
      throw new UserFacingError('Apple Visionの矩形検出結果を読み取れませんでした。', error)
    }

    const result = VisionRectangleResponseSchema.safeParse(parsed)
    if (!result.success) {
      throw new UserFacingError('Apple Visionの矩形検出結果の形式が不正です。', result.error)
    }

    detections.push(result.data)
  }

  return detections
}
