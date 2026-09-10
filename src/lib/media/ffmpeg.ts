import { executeSidecar, executeSidecarRaw } from '../tauri/sidecar'
import type { CropRegion, MediaMetadata, PerspectiveCrop } from '../../types/project'
import { computeAverageLuma, computeDHash } from './dhash'

/** Runs the bundled ffmpeg with an argument array; callers never build a shell command string. */
export function runFfmpeg(args: string[]) {
  return executeSidecar('binaries/ffmpeg', args)
}

export type FrameHash = {
  timestampMs: number
  hash: string
  averageLuma?: number
}

type SampleVideoFramesInput = {
  path: string
  crop: CropRegion
  perspectiveCrop?: PerspectiveCrop
  metadata: Pick<MediaMetadata, 'width' | 'height'>
  sampleIntervalMs: number
}

type RepresentativeFrameInput = {
  path: string
  crop: CropRegion
  perspectiveCrop?: PerspectiveCrop
  metadata: Pick<MediaMetadata, 'width' | 'height'>
  timestampMs: number
  outputPath: string
  signal?: AbortSignal
}

type CropDetectionFrameInput = {
  path: string
  timestampMs: number
  outputPath: string
  signal?: AbortSignal
}

type ExtractAudioInput = {
  path: string
  outputPath: string
  signal?: AbortSignal
}

type ExtractAudioChunkInput = {
  path: string
  outputPath: string
  startMs: number
  durationMs: number
  signal?: AbortSignal
}

type TrimVideoInput = {
  path: string
  outputPath: string
  startMs: number
  endMs: number
  signal?: AbortSignal
}

type BrowserCompatibleVideoInput = {
  path: string
  outputPath: string
  signal?: AbortSignal
}

function outputText(value: string | Uint8Array) {
  return typeof value === 'string' ? value : new TextDecoder().decode(value)
}

function filterNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(4) : '0'
}

function perspectiveOutputSize(perspectiveCrop: PerspectiveCrop, outputWidth = 1280) {
  const aspectRatio = Math.max(0.1, perspectiveCrop.aspectRatio.value)
  const width = Math.max(2, Math.round(outputWidth / 2) * 2)
  const height = Math.max(2, Math.round(width / aspectRatio / 2) * 2)
  return { width, height }
}

/** Builds the one crop transform shared by detection, preview exports, and OCR images. */
export function buildCropVideoFilter({
  crop,
  perspectiveCrop,
  metadata,
  outputWidth,
  outputHeight,
  scaleFlags = 'lanczos',
}: {
  crop: CropRegion
  perspectiveCrop?: PerspectiveCrop
  metadata: Pick<MediaMetadata, 'width' | 'height'>
  outputWidth?: number
  outputHeight?: number
  scaleFlags?: 'area' | 'fast_bilinear' | 'lanczos'
}) {
  if (!perspectiveCrop) {
    const scale = outputWidth
      ? `,scale=${outputWidth}:${outputHeight ?? -2}:flags=${scaleFlags}`
      : ''
    return `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}${scale}`
  }

  const { width, height } = perspectiveOutputSize(perspectiveCrop, outputWidth ?? 1280)
  const outputSize =
    outputWidth && outputHeight
      ? `${outputWidth}:${outputHeight}`
      : `${width}:${outputHeight ?? height}`
  const { topLeft, topRight, bottomRight, bottomLeft } = perspectiveCrop.corners
  // FFmpeg's source order is top-left, top-right, bottom-left, bottom-right.
  const points = [topLeft, topRight, bottomLeft, bottomRight]
    .flatMap((point) => [point.x * metadata.width, point.y * metadata.height])
    .map(filterNumber)
    .join(':')

  return `perspective=${points}:sense=source,scale=${outputSize}:flags=${scaleFlags},setsar=1`
}

/** Samples 9x8 grayscale frames so slide detection does not need to materialize a cropped video. */
export async function sampleVideoFrames({
  path,
  crop,
  perspectiveCrop,
  metadata,
  sampleIntervalMs,
}: SampleVideoFramesInput): Promise<FrameHash[]> {
  const frameWidth = 9
  const frameHeight = 8
  const frameSize = frameWidth * frameHeight
  const fps = 1000 / sampleIntervalMs
  if (!Number.isFinite(fps) || fps <= 0) throw new Error('サンプリング間隔が不正です')

  const output = await executeSidecarRaw('binaries/ffmpeg', [
    '-hide_banner',
    '-v',
    'error',
    '-i',
    path,
    '-an',
    '-sn',
    '-vf',
    `fps=${fps},${buildCropVideoFilter({
      crop,
      perspectiveCrop,
      metadata,
      outputWidth: frameWidth,
      outputHeight: frameHeight,
      scaleFlags: 'area',
    })},format=gray`,
    '-f',
    'rawvideo',
    '-pix_fmt',
    'gray',
    'pipe:1',
  ])

  if (output.code !== 0) {
    const detail = outputText(output.stderr).trim()
    throw new Error(detail || `ffmpegが終了コード${output.code}で終了しました`)
  }

  const rawFrames = output.stdout
  const frameCount = Math.floor(rawFrames.length / frameSize)
  if (frameCount === 0) throw new Error('サンプリングできるフレームがありません')

  const frames = Array.from({ length: frameCount }, (_, index) => {
    const pixels = rawFrames.subarray(index * frameSize, (index + 1) * frameSize)
    return {
      timestampMs: index * sampleIntervalMs,
      hash: computeDHash(pixels, frameWidth, frameHeight),
      averageLuma: computeAverageLuma(pixels),
    }
  })
  return frames
}

export async function extractRepresentativeFrame({
  path,
  crop,
  perspectiveCrop,
  metadata,
  timestampMs,
  outputPath,
  signal,
}: RepresentativeFrameInput) {
  const output = await executeSidecar(
    'binaries/ffmpeg',
    [
      '-hide_banner',
      '-v',
      'error',
      '-ss',
      String(Math.max(0, timestampMs / 1000)),
      '-i',
      path,
      '-an',
      '-sn',
      '-vf',
      buildCropVideoFilter({
        crop,
        perspectiveCrop,
        metadata,
        outputWidth: 1280,
        scaleFlags: 'lanczos',
      }),
      '-frames:v',
      '1',
      '-q:v',
      '3',
      '-y',
      outputPath,
    ],
    { signal },
  )

  if (output.code !== 0) {
    const detail = output.stderr.trim()
    throw new Error(detail || `代表フレームの抽出に失敗しました (code ${output.code})`)
  }

  return outputPath
}

/** Extracts a small still image for local slide-region detection. */
export async function extractCropDetectionFrame({
  path,
  timestampMs,
  outputPath,
  signal,
}: CropDetectionFrameInput) {
  const output = await executeSidecar(
    'binaries/ffmpeg',
    [
      '-hide_banner',
      '-v',
      'error',
      '-ss',
      String(Math.max(0, timestampMs / 1000)),
      '-i',
      path,
      '-an',
      '-sn',
      '-dn',
      '-vf',
      'scale=640:-2:flags=fast_bilinear',
      '-frames:v',
      '1',
      '-q:v',
      '6',
      '-y',
      outputPath,
    ],
    { signal },
  )

  if (output.code !== 0) {
    const detail = output.stderr.trim()
    throw new Error(detail || `crop候補フレームの抽出に失敗しました (code ${output.code})`)
  }

  return outputPath
}

export async function extractAudio({ path, outputPath, signal }: ExtractAudioInput) {
  const output = await executeSidecar(
    'binaries/ffmpeg',
    [
      '-hide_banner',
      '-v',
      'error',
      '-i',
      path,
      '-vn',
      '-sn',
      '-dn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'pcm_s16le',
      '-y',
      outputPath,
    ],
    { signal },
  )

  if (output.code !== 0) {
    const detail = output.stderr.trim()
    throw new Error(detail || `音声の抽出に失敗しました (code ${output.code})`)
  }

  return outputPath
}

/** Converts a downloaded source into a WebView-compatible H.264/AAC MP4. */
export async function transcodeVideoForBrowser({
  path,
  outputPath,
  signal,
}: BrowserCompatibleVideoInput) {
  const output = await executeSidecar(
    'binaries/ffmpeg',
    [
      '-hide_banner',
      '-v',
      'error',
      '-i',
      path,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-sn',
      '-dn',
      '-movflags',
      '+faststart',
      '-y',
      outputPath,
    ],
    { signal },
  )

  if (output.code !== 0) {
    const detail = output.stderr.trim()
    throw new Error(detail || `動画を再生可能な形式へ変換できませんでした (code ${output.code})`)
  }

  return outputPath
}

/** Creates a frame-accurate, browser-friendly MP4 copy for the selected time range. */
export async function trimVideo({ path, outputPath, startMs, endMs, signal }: TrimVideoInput) {
  const startSeconds = Math.max(0, startMs / 1000)
  const durationSeconds = Math.max(0.001, (endMs - startMs) / 1000)
  if (!Number.isFinite(startSeconds) || !Number.isFinite(durationSeconds) || endMs <= startMs) {
    throw new Error('動画のトリミング範囲が不正です')
  }

  const output = await executeSidecar(
    'binaries/ffmpeg',
    [
      '-hide_banner',
      '-v',
      'error',
      '-i',
      path,
      '-ss',
      String(startSeconds),
      '-t',
      String(durationSeconds),
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '18',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-sn',
      '-dn',
      '-avoid_negative_ts',
      'make_zero',
      '-movflags',
      '+faststart',
      '-y',
      outputPath,
    ],
    { signal },
  )

  if (output.code !== 0) {
    const detail = output.stderr.trim()
    throw new Error(detail || `動画のトリミングに失敗しました (code ${output.code})`)
  }

  return outputPath
}

/** Creates a compact upload copy while preserving the local WAV used by whisper.cpp. */
export async function extractAudioChunkForOpenAi({
  path,
  outputPath,
  startMs,
  durationMs,
  signal,
}: ExtractAudioChunkInput) {
  const output = await executeSidecar(
    'binaries/ffmpeg',
    [
      '-hide_banner',
      '-v',
      'error',
      '-ss',
      String(Math.max(0, startMs / 1000)),
      '-i',
      path,
      '-t',
      String(Math.max(0.001, durationMs / 1000)),
      '-vn',
      '-sn',
      '-dn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'aac',
      '-b:a',
      '32k',
      '-y',
      outputPath,
    ],
    { signal },
  )

  if (output.code !== 0) {
    const detail = output.stderr.trim()
    throw new Error(detail || `OpenAI送信用音声の準備に失敗しました (code ${output.code})`)
  }

  return outputPath
}

export async function extractAudioChunkForLocalTranscription({
  path,
  outputPath,
  startMs,
  durationMs,
  signal,
}: ExtractAudioChunkInput) {
  const output = await executeSidecar(
    'binaries/ffmpeg',
    [
      '-hide_banner',
      '-v',
      'error',
      '-ss',
      String(Math.max(0, startMs / 1000)),
      '-i',
      path,
      '-t',
      String(Math.max(0.001, durationMs / 1000)),
      '-vn',
      '-sn',
      '-dn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'pcm_s16le',
      '-y',
      outputPath,
    ],
    { signal },
  )

  if (output.code !== 0) {
    const detail = output.stderr.trim()
    throw new Error(detail || `ローカル文字起こし用音声の準備に失敗しました (code ${output.code})`)
  }

  return outputPath
}
