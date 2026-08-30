import { stat } from '@tauri-apps/plugin-fs'

export async function getFileSize(path: string) {
  const fileInfo = await stat(path)

  if (!fileInfo.isFile) {
    throw new Error('選択したパスはファイルではありません')
  }

  return fileInfo.size
}
