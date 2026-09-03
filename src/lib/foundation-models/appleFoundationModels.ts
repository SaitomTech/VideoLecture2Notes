import { z } from 'zod'
import { UserFacingError } from '../errors'
import { openJsonLineSidecar } from '../tauri/sidecar'

const AppleFoundationModelsResponseSchema = z.object({
  id: z.string().min(1),
  ok: z.boolean(),
  body: z.string().nullable().optional(),
  engineVersion: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
})

export type AppleFoundationModelsResponse = z.infer<typeof AppleFoundationModelsResponseSchema>

export type AppleFoundationModelsClient = Awaited<ReturnType<typeof openJsonLineSidecar>>

export async function openAppleFoundationModels(
  signal?: AbortSignal,
): Promise<AppleFoundationModelsClient> {
  return openJsonLineSidecar('binaries/apple-foundation-models', signal)
}

export async function generateAppleArticle({
  client,
  instructions,
  input,
  signal,
}: {
  client: AppleFoundationModelsClient
  instructions: string
  input: string
  signal?: AbortSignal
}) {
  const response = await client.request(
    {
      locale: 'ja-JP',
      instructions,
      prompt: input,
    },
    signal,
  )
  const parsed = AppleFoundationModelsResponseSchema.safeParse(response)
  if (!parsed.success) {
    throw new UserFacingError('Apple Foundation Modelsの応答形式が不正です。', parsed.error)
  }
  if (!parsed.data.ok || !parsed.data.body?.trim()) {
    throw new Error(parsed.data.error || 'Apple Foundation Modelsの本文が空でした。')
  }

  return {
    body: parsed.data.body.trim(),
    engineVersion: parsed.data.engineVersion ?? 'FoundationModels',
  }
}
