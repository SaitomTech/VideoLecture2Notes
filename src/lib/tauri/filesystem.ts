import {
  BaseDirectory,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  stat,
  writeFile,
  writeTextFile as tauriWriteTextFile,
} from '@tauri-apps/plugin-fs'

export type AppLocalDirectoryEntry = {
  name: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
}

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
  await tauriWriteTextFile(path, contents, {
    baseDir: BaseDirectory.AppLocalData,
  })
}

export async function readAppLocalTextFile(path: string) {
  return readTextFile(path, {
    baseDir: BaseDirectory.AppLocalData,
  })
}

export async function readAppLocalDirectory(path: string): Promise<AppLocalDirectoryEntry[]> {
  return readDir(path, { baseDir: BaseDirectory.AppLocalData })
}

export async function appLocalFileExists(path: string) {
  try {
    const fileInfo = await stat(path, { baseDir: BaseDirectory.AppLocalData })
    return fileInfo.isFile
  } catch {
    return false
  }
}

export async function renameAppLocalPath(oldPath: string, newPath: string) {
  await rename(oldPath, newPath, {
    oldPathBaseDir: BaseDirectory.AppLocalData,
    newPathBaseDir: BaseDirectory.AppLocalData,
  })
}

export async function renameAbsolutePath(oldPath: string, newPath: string) {
  await rename(oldPath, newPath)
}

export async function removeAppLocalPath(path: string) {
  await remove(path, { baseDir: BaseDirectory.AppLocalData, recursive: true })
}

export async function removeAbsolutePath(path: string) {
  await remove(path, { recursive: true })
}

export async function fileExists(path: string) {
  try {
    const fileInfo = await stat(path)
    return fileInfo.isFile
  } catch {
    return false
  }
}

export async function ensureDirectory(path: string) {
  await mkdir(path, { recursive: true })
}

export async function copyFile(sourcePath: string, destinationPath: string) {
  await writeFile(destinationPath, await readFile(sourcePath))
}

export async function writeTextFile(path: string, contents: string) {
  await tauriWriteTextFile(path, contents)
}
