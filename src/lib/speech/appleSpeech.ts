import { z } from 'zod'
import { UserFacingError } from '../errors'
import { executeSidecarStreaming } from '../tauri/sidecar'
import type { TranscriptSegment } from '../../types/project'

const AppleSpeechResponseSchema = z.object({
  language: z.string().min(1),
  segments: z.array(
    z.object({
      startMs: z.number().finite().nonnegative(),
      endMs: z.number().finite().nonnegative(),
      text: z.string(),
    }),
  ),
  engineVersion: z.string().min(1),
})

export type AppleSpeechRecognition = {
  language: string
  segments: TranscriptSegment[]
  engineVersion: string
}

function outputText(output: { stdout: string | Uint8Array }) {
  return typeof output.stdout === 'string' ? output.stdout : new TextDecoder().decode(output.stdout)
}

function progressParser(onProgress?: (progress: number) => void) {
  let buffer = ''
  return (chunk: string) => {
    buffer = `${buffer}${chunk}`.slice(-128)
    const matches = [...buffer.matchAll(/progress\s*=\s*(\d{1,3})\s*%/gi)]
    const latest = matches.at(-1)
    if (!latest) return
    const percentage = Number(latest[1])
    if (Number.isFinite(percentage)) onProgress?.(Math.min(100, percentage) / 100)
  }
}

export async function runAppleSpeech({
  audioPath,
  language = 'auto',
  onProgress,
  signal,
}: {
  audioPath: string
  language?: 'auto' | 'ja' | 'en'
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}): Promise<AppleSpeechRecognition> {
  const parseProgress = progressParser(onProgress)
  const output = await executeSidecarStreaming(
    'binaries/apple-speech-transcriber',
    [audioPath, language],
    { onStderr: parseProgress, signal },
  )

  if (output.code !== 0) {
    throw new Error(
      output.stderr.trim() || `Apple SpeechTranscriberが終了コード${output.code}で終了しました`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(outputText(output))
  } catch (error) {
    throw new UserFacingError('Apple SpeechTranscriberの応答を読み取れませんでした。', error)
  }

  const result = AppleSpeechResponseSchema.safeParse(parsed)
  if (!result.success) {
    throw new UserFacingError('Apple SpeechTranscriberの応答形式が不正です。', result.error)
  }

  return {
    ...result.data,
    segments: result.data.segments.map((segment, index) => ({
      ...segment,
      id: `segment-${index}-${segment.startMs}-${segment.endMs}`,
    })),
  }
}
