import { readTextFile } from '@tauri-apps/plugin-fs'
import { executeSidecar } from '../tauri/sidecar'
import { getRawTranscriptAssetPath } from '../storage/projectAssets'
import type { TranscriptSegment } from '../../types/project'

type WhisperJsonSegment = {
  timestamps?: {
    from?: unknown
    to?: unknown
  }
  offsets?: {
    from?: unknown
    to?: unknown
  }
  text?: unknown
}

type WhisperJson = {
  result?: {
    language?: unknown
  }
  transcription?: WhisperJsonSegment[]
}

type RunWhisperInput = {
  projectId: string
  audioPath: string
  modelPath: string
  language: string
}

function parseTimestamp(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null

  const parts = value.trim().split(':')
  if (parts.length < 2 || parts.length > 3) return null
  const seconds = Number(parts.at(-1))
  const minutes = Number(parts.at(-2))
  const hours = parts.length === 3 ? Number(parts[0]) : 0
  if (![hours, minutes, seconds].every(Number.isFinite)) return null
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000)
}

function parseSegment(segment: WhisperJsonSegment): TranscriptSegment | null {
  const startMs =
    parseTimestamp(segment.offsets?.from) ?? parseTimestamp(segment.timestamps?.from)
  const endMs = parseTimestamp(segment.offsets?.to) ?? parseTimestamp(segment.timestamps?.to)
  const text = typeof segment.text === 'string' ? segment.text.trim() : ''
  if (startMs === null || endMs === null || !text || endMs < startMs) return null

  return { startMs, endMs, text }
}

function outputBasePath(path: string) {
  return path.endsWith('.json') ? path.slice(0, -'.json'.length) : path
}

export async function runWhisper({ projectId, audioPath, modelPath, language }: RunWhisperInput) {
  const outputPath = await getRawTranscriptAssetPath(projectId)
  const output = await executeSidecar('binaries/whisper-cli', [
    '--model',
    modelPath,
    '--file',
    audioPath,
    '--language',
    language,
    '--output-json-full',
    '--output-file',
    outputBasePath(outputPath),
    '--no-prints',
  ])

  if (output.code !== 0) {
    const detail = output.stderr.trim()
    throw new Error(detail || `Whisperが終了コード${output.code}で終了しました`)
  }

  const contents = await readTextFile(outputPath)
  const parsed = JSON.parse(contents) as WhisperJson
  const segments = (parsed.transcription ?? [])
    .map(parseSegment)
    .filter((segment): segment is TranscriptSegment => segment !== null)
    .sort((first, second) => first.startMs - second.startMs)

  return {
    language: typeof parsed.result?.language === 'string' ? parsed.result.language : undefined,
    segments,
  }
}
