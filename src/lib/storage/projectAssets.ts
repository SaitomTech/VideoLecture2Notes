import { appLocalDataDir, join } from '@tauri-apps/api/path'
import { ensureAppLocalDirectory } from '../tauri/filesystem'

function projectAssetDirectory(projectId: string, assetDirectory: string) {
  return `projects/${projectId}/${assetDirectory}`
}

async function prepareProjectAssetDirectory(projectId: string, assetDirectory: string) {
  const relativeDirectory = projectAssetDirectory(projectId, assetDirectory)
  await ensureAppLocalDirectory(relativeDirectory)
  return join(await appLocalDataDir(), relativeDirectory)
}

export async function prepareSlideAssetDirectory(projectId: string) {
  return prepareProjectAssetDirectory(projectId, 'slides')
}

export async function getSlideAssetPath(projectId: string, slideIndex: number) {
  const directory = await prepareSlideAssetDirectory(projectId)
  return join(directory, `slide-${String(slideIndex + 1).padStart(3, '0')}.jpg`)
}

export async function getAudioAssetPath(projectId: string) {
  const directory = await prepareProjectAssetDirectory(projectId, 'audio')
  return join(directory, 'source-16k.wav')
}

export async function getRawTranscriptAssetPath(projectId: string) {
  const directory = await prepareProjectAssetDirectory(projectId, 'transcript')
  return join(directory, 'raw.json')
}
