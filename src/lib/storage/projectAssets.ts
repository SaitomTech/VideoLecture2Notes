import { appLocalDataDir, join } from '@tauri-apps/api/path'
import { ensureAppLocalDirectory } from '../tauri/filesystem'

function slideDirectory(projectId: string) {
  return `projects/${projectId}/slides`
}

export async function prepareSlideAssetDirectory(projectId: string) {
  const relativeDirectory = slideDirectory(projectId)
  await ensureAppLocalDirectory(relativeDirectory)
  return join(await appLocalDataDir(), relativeDirectory)
}

export async function getSlideAssetPath(projectId: string, slideIndex: number) {
  const directory = await prepareSlideAssetDirectory(projectId)
  return join(directory, `slide-${String(slideIndex + 1).padStart(3, '0')}.jpg`)
}
