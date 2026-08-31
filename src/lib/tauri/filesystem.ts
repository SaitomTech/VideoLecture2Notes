import { BaseDirectory, mkdir, readTextFile, stat, writeTextFile } from '@tauri-apps/plugin-fs'

export async function getFileSize(path: string) {
  const fileInfo = await stat(path)

  if (!fileInfo.isFile) {
    throw new Error('選択したパスはファイルではありません')
  }

  return fileInfo.size
}

export async function ensureAppLocalDirectory(path: string) {
  await mkdir(path, {
    baseDir: BaseDirectory.AppLocalData,
    recursive: true,
  })
}

export async function writeAppLocalTextFile(path: string, contents: string) {
  await writeTextFile(path, contents, {
    baseDir: BaseDirectory.AppLocalData,
  })
}

export async function readAppLocalTextFile(path: string) {
  return readTextFile(path, {
    baseDir: BaseDirectory.AppLocalData,
  })
}

export async function fileExists(path: string) {
  try {
    const fileInfo = await stat(path)
    return fileInfo.isFile
  } catch {
    return false
  }
}
