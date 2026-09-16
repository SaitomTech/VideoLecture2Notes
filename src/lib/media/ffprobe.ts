import { isTauriEnvironment } from '../tauri/environment'
import { executeSidecar } from '../tauri/sidecar'
import type { MediaMetadata } from '../../types/project'

type ProbeStream = {
  codec_type?: unknown
  codec_name?: unknown
  width?: unknown
  height?: unknown
  avg_frame_rate?: unknown
  r_frame_rate?: unknown
  pix_fmt?: unknown
}

type ProbeResult = {
  streams?: ProbeStream[]
  format?: {
    duration?: unknown
    format_name?: unknown
  }
}

function parseNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseFrameRate(value: unknown) {
  if (typeof value !== 'string') return undefined

  const [numerator, denominator] = value.split('/').map(Number)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0)
    return undefined

  const fps = numerator / denominator
  return Number.isFinite(fps) && fps > 0 ? fps : undefined
}

export async function probeVideo(path: string): Promise<MediaMetadata> {
  if (!isTauriEnvironment()) {
    throw new Error('動画解析はTauriアプリ内でのみ実行できます')
  }

  const output = await executeSidecar('binaries/ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    path,
  ])

  if (output.code !== 0) {
    const detail = output.stderr.trim()
    throw new Error(detail || `ffprobeが終了コード${output.code}で終了しました`)
  }

  let parsed: ProbeResult
  try {
    parsed = JSON.parse(output.stdout) as ProbeResult
  } catch {
    throw new Error('ffprobeの出力を解析できませんでした')
  }

  const streams = parsed.streams ?? []
  const videoStream = streams.find((stream) => stream.codec_type === 'video')
  const audioStream = streams.find((stream) => stream.codec_type === 'audio')
  const width = parseNumber(videoStream?.width)
  const height = parseNumber(videoStream?.height)

  if (!videoStream || width === undefined || height === undefined || width <= 0 || height <= 0) {
    throw new Error('動画ストリームが見つかりません')
  }

  const durationSeconds = parseNumber(parsed.format?.duration) ?? 0

  return {
    path,
    durationMs: Math.max(0, Math.round(durationSeconds * 1000)),
    width: Math.round(width),
    height: Math.round(height),
    fps: parseFrameRate(videoStream.avg_frame_rate) ?? parseFrameRate(videoStream.r_frame_rate),
    videoCodec: typeof videoStream.codec_name === 'string' ? videoStream.codec_name : undefined,
    videoPixelFormat: typeof videoStream.pix_fmt === 'string' ? videoStream.pix_fmt : undefined,
    audioCodec: typeof audioStream?.codec_name === 'string' ? audioStream.codec_name : undefined,
    formatName:
      typeof parsed.format?.format_name === 'string' ? parsed.format.format_name : undefined,
  }
}
