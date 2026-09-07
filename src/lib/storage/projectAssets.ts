import { appLocalDataDir, join } from '@tauri-apps/api/path'
import {
  ensureAppLocalDirectory,
  readAppLocalDirectory,
  removeAppLocalPath,
} from '../tauri/filesystem'

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

export async function prepareProjectSourceAssetDirectory(projectId: string) {
  return prepareProjectAssetDirectory(projectId, 'source')
}

export async function prepareProjectDerivedAssetDirectory(projectId: string) {
  return prepareProjectAssetDirectory(projectId, 'derived')
}

export async function getTrimmedVideoAssetPath(projectId: string) {
  const directory = await prepareProjectDerivedAssetDirectory(projectId)
  return join(directory, 'trimmed.mp4')
}

export async function removeTrimmedVideoAsset(projectId: string) {
  await removeAppLocalPath(`${projectAssetDirectory(projectId, 'derived')}/trimmed.mp4`)
}

/** Removes cached media artifacts whose timestamps depend on the selected video range. */
export async function removeProjectAnalysisAssets(projectId: string) {
  await Promise.all(
    ['audio', 'slides', 'transcript'].map((directory) =>
      removeAppLocalPath(projectAssetDirectory(projectId, directory)).catch(() => undefined),
    ),
  )
}

export async function prepareCropDetectionDirectory(projectId: string) {
  return prepareProjectAssetDirectory(projectId, 'crop-detection')
}

export async function removeCropDetectionDirectory(projectId: string) {
  await removeAppLocalPath(projectAssetDirectory(projectId, 'crop-detection'))
}

export async function removeProjectSourceAssetDirectory(projectId: string) {
  await removeAppLocalPath(projectAssetDirectory(projectId, 'source'))
}

export async function removeProjectSourceAsset(projectId: string, fileName: string) {
  if (fileName !== fileName.split(/[\\/]/).pop()) throw new Error('不正なsource asset名です。')
  await removeAppLocalPath(`${projectAssetDirectory(projectId, 'source')}/${fileName}`)
}

export async function listProjectSourceAssets(projectId: string) {
  const relativeDirectory = projectAssetDirectory(projectId, 'source')
  await ensureAppLocalDirectory(relativeDirectory)
  const appDataDirectory = await appLocalDataDir()
  const [directory, entries] = await Promise.all([
    join(appDataDirectory, relativeDirectory),
    readAppLocalDirectory(relativeDirectory),
  ])
  const paths: Array<ReturnType<typeof join>> = []

  for (const entry of entries) {
    if (entry.isFile) paths.push(join(directory, entry.name))
  }

  return Promise.all(paths)
}

export async function getSlideAssetPath(projectId: string, slideIndex: number) {
  const directory = await prepareSlideAssetDirectory(projectId)
  return join(directory, `slide-${String(slideIndex + 1).padStart(3, '0')}.jpg`)
}

export async function getAudioAssetPath(projectId: string) {
  const directory = await prepareProjectAssetDirectory(projectId, 'audio')
  return join(directory, 'source-16k.wav')
}

export async function getTranscriptionAudioChunkPath(
  projectId: string,
  provider: 'local' | 'openai',
  chunkIndex: number,
) {
  const directory = await prepareProjectAssetDirectory(projectId, `audio/${provider}`)
  const extension = provider === 'local' ? 'wav' : 'm4a'
  return join(directory, `chunk-${String(chunkIndex + 1).padStart(3, '0')}.${extension}`)
}

export async function getRawTranscriptAssetPath(projectId: string) {
  const directory = await prepareProjectAssetDirectory(projectId, 'transcript')
  return join(directory, 'raw.json')
}
