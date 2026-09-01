import { executeSidecar, executeSidecarRaw } from '../tauri/sidecar'
import type { CropRegion } from '../../types/project'
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
  sampleIntervalMs: number
}

type RepresentativeFrameInput = {
  path: string
  crop: CropRegion
  timestampMs: number
  outputPath: string
}

type ExtractAudioInput = {
  path: string
  outputPath: string
  signal?: AbortSignal
}

function outputText(value: string | Uint8Array) {
  return typeof value === 'string' ? value : new TextDecoder().decode(value)
}

/** Samples 9x8 grayscale frames so slide detection does not need to materialize a cropped video. */
export async function sampleVideoFrames({
  path,
  crop,
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
    `fps=${fps},crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=${frameWidth}:${frameHeight}:flags=area,format=gray`,
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
  timestampMs,
  outputPath,
}: RepresentativeFrameInput) {
  const output = await executeSidecar('binaries/ffmpeg', [
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
    `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=480:-2:flags=lanczos`,
    '-frames:v',
    '1',
    '-q:v',
    '3',
    '-y',
    outputPath,
  ])

  if (output.code !== 0) {
    const detail = output.stderr.trim()
    throw new Error(detail || `代表フレームの抽出に失敗しました (code ${output.code})`)
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
