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
  textRegions: z.array(VisionRegionSchema),
  faceRegions: z.array(VisionRegionSchema),
  engineVersion: z.string().min(1),
})

const VisionRectangleBatchResponseSchema = z.array(VisionRectangleResponseSchema)

export type VisionPoint = z.infer<typeof VisionPointSchema>
export type VisionRegion = z.infer<typeof VisionRegionSchema>
export type VisionRectangleDetection = z.infer<typeof VisionRectangleResponseSchema>

function outputText(output: { stdout: string | Uint8Array }) {
  return typeof output.stdout === 'string' ? output.stdout : new TextDecoder().decode(output.stdout)
}

/** Uses the existing Apple Vision sidecar for one offline rectangle-detection batch. */
export async function detectVisionRectangles(
  imagePaths: string[],
  signal?: AbortSignal,
): Promise<VisionRectangleDetection[]> {
  if (imagePaths.length === 0) return []

  const output = await executeSidecar(
    'binaries/apple-vision-ocr',
    ['--detect-rectangles', ...imagePaths],
    { signal },
  )

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

  const result = VisionRectangleBatchResponseSchema.safeParse(parsed)
  if (!result.success) {
    throw new UserFacingError('Apple Visionの矩形検出結果の形式が不正です。', result.error)
  }

  return result.data
}
