import { invoke } from '@tauri-apps/api/core'
import { appLocalDataDir, join } from '@tauri-apps/api/path'
import {
  BaseDirectory,
  exists,
  remove,
  rename,
  writeFile,
} from '@tauri-apps/plugin-fs'
import { ensureAppLocalDirectory } from '../tauri/filesystem'

export type ModelFile = {
  filename: string
  url: string
  sizeBytes: number
  sha256: string
}

export type ModelDownloadProgress = {
  fileIndex: number
  fileCount: number
  receivedBytes: number
  totalBytes: number
}

export function modelProgressRatio(progress: ModelDownloadProgress) {
  const fileProgress = progress.totalBytes > 0 ? progress.receivedBytes / progress.totalBytes : 0
  return Math.min(1, (progress.fileIndex - 1 + fileProgress) / progress.fileCount)
}

type EnsureModelFilesInput = {
  directory: string
  files: readonly ModelFile[]
  onProgress?: (progress: ModelDownloadProgress) => void
  signal?: AbortSignal
}

async function sha256(path: string) {
  return invoke<string>('sha256_app_local_file', { relativePath: path })
}

async function downloadFile(
  directory: string,
  file: ModelFile,
  fileIndex: number,
  fileCount: number,
  onProgress?: (progress: ModelDownloadProgress) => void,
  signal?: AbortSignal,
) {
  const path = `${directory}/${file.filename}`
  const partPath = `${path}.part`

  if (await exists(partPath, { baseDir: BaseDirectory.AppLocalData })) {
    const partialFileHash = await sha256(partPath)
    if (partialFileHash === file.sha256) {
      await rename(partPath, path, {
        oldPathBaseDir: BaseDirectory.AppLocalData,
        newPathBaseDir: BaseDirectory.AppLocalData,
      })
      return
    }

    await remove(partPath, { baseDir: BaseDirectory.AppLocalData })
  }

  const response = await fetch(file.url, { signal })
  if (!response.ok || !response.body) {
    throw new Error(`${file.filename}のダウンロードに失敗しました (HTTP ${response.status})`)
  }

  const totalBytes = Number(response.headers.get('content-length')) || file.sizeBytes
  const reader = response.body.getReader()
  let receivedBytes = 0
  let isFirstChunk = true

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      await writeFile(partPath, value, {
        baseDir: BaseDirectory.AppLocalData,
        append: !isFirstChunk,
      })
      isFirstChunk = false
      receivedBytes += value.byteLength
      onProgress?.({ fileIndex, fileCount, receivedBytes, totalBytes })
    }

    const actualHash = await sha256(partPath)
    if (actualHash !== file.sha256) {
      throw new Error(`${file.filename}のSHA-256が一致しません。ダウンロードをやり直してください。`)
    }

    await rename(partPath, path, {
      oldPathBaseDir: BaseDirectory.AppLocalData,
      newPathBaseDir: BaseDirectory.AppLocalData,
    })
  } catch (error) {
    if (await exists(partPath, { baseDir: BaseDirectory.AppLocalData })) {
      await remove(partPath, { baseDir: BaseDirectory.AppLocalData })
    }
    throw error
  } finally {
    reader.releaseLock()
  }
}

export async function ensureModelFiles({
  directory,
  files,
  onProgress,
  signal,
}: EnsureModelFilesInput) {
  await ensureAppLocalDirectory(directory)

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const path = `${directory}/${file.filename}`
    if (await exists(path, { baseDir: BaseDirectory.AppLocalData })) continue

    await downloadFile(directory, file, index + 1, files.length, onProgress, signal)
  }

  const appDataPath = await appLocalDataDir()
  return Promise.all(files.map((file) => join(appDataPath, directory, file.filename)))
}
