import { appLocalDataDir, join } from '@tauri-apps/api/path'
import {
  BaseDirectory,
  exists,
  readFile,
  remove,
  rename,
  writeFile,
} from '@tauri-apps/plugin-fs'
import { ensureAppLocalDirectory } from '../tauri/filesystem'

export const DEFAULT_WHISPER_MODEL = {
  id: 'large-v3-turbo-q5_0',
  label: 'Whisper large-v3-turbo Q5_0',
  filename: 'ggml-large-v3-turbo-q5_0.bin',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin?download=true',
  sizeBytes: 574_041_195,
  sha256: '394221709cd5ad1f40c46e6031ca85bce88931e6e088c188294c6d5a55ffa7e2',
} as const

const MODEL_DIRECTORY = 'models/whisper'
const MODEL_PATH = `${MODEL_DIRECTORY}/${DEFAULT_WHISPER_MODEL.filename}`
const PART_PATH = `${MODEL_PATH}.part`

export type ModelDownloadProgress = {
  receivedBytes: number
  totalBytes: number
}

export async function getWhisperModelPath() {
  await ensureAppLocalDirectory(MODEL_DIRECTORY)
  return join(await appLocalDataDir(), MODEL_PATH)
}

export async function isWhisperModelInstalled() {
  return exists(MODEL_PATH, { baseDir: BaseDirectory.AppLocalData })
}

async function sha256(path: string) {
  const contents = await readFile(path, { baseDir: BaseDirectory.AppLocalData })
  const digest = await crypto.subtle.digest('SHA-256', contents)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function ensureWhisperModel(
  { onProgress, signal }: { onProgress?: (progress: ModelDownloadProgress) => void; signal?: AbortSignal } = {},
) {
  if (await isWhisperModelInstalled()) return getWhisperModelPath()

  await ensureAppLocalDirectory(MODEL_DIRECTORY)
  if (await exists(PART_PATH, { baseDir: BaseDirectory.AppLocalData })) {
    await remove(PART_PATH, { baseDir: BaseDirectory.AppLocalData })
  }

  const response = await fetch(DEFAULT_WHISPER_MODEL.url, { signal })
  if (!response.ok || !response.body) {
    throw new Error(`Whisperモデルのダウンロードに失敗しました (HTTP ${response.status})`)
  }

  const totalBytes = Number(response.headers.get('content-length')) || DEFAULT_WHISPER_MODEL.sizeBytes
  const reader = response.body.getReader()
  let receivedBytes = 0
  let isFirstChunk = true

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      await writeFile(PART_PATH, value, {
        baseDir: BaseDirectory.AppLocalData,
        append: !isFirstChunk,
      })
      isFirstChunk = false
      receivedBytes += value.byteLength
      onProgress?.({ receivedBytes, totalBytes })
    }

    const actualHash = await sha256(PART_PATH)
    if (actualHash !== DEFAULT_WHISPER_MODEL.sha256) {
      throw new Error('WhisperモデルのSHA-256が一致しません。ダウンロードをやり直してください。')
    }

    await rename(PART_PATH, MODEL_PATH, {
      oldPathBaseDir: BaseDirectory.AppLocalData,
      newPathBaseDir: BaseDirectory.AppLocalData,
    })
  } catch (error) {
    if (await exists(PART_PATH, { baseDir: BaseDirectory.AppLocalData })) {
      await remove(PART_PATH, { baseDir: BaseDirectory.AppLocalData })
    }
    throw error
  } finally {
    reader.releaseLock()
  }

  return getWhisperModelPath()
}
