import { getVersion } from '@tauri-apps/api/app'
import { open } from '@tauri-apps/plugin-shell'
import { z } from 'zod'

const LATEST_RELEASE_ENDPOINT =
  'https://api.github.com/repos/SaitomTech/VideoLecture2Notes/releases/latest'

const releaseSchema = z.object({
  tag_name: z.string().min(1),
  html_url: z.string().url(),
})

export type UpdateCheckResult = {
  available: boolean
  currentVersion: string
  latestVersion: string
  releaseUrl: string
}

function normalizeVersion(value: string) {
  const match = value
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null

  return [Number(match[1]), Number(match[2]), Number(match[3])] as const
}

function isNewerVersion(currentVersion: string, latestVersion: string) {
  const current = normalizeVersion(currentVersion)
  const latest = normalizeVersion(latestVersion)
  if (!current || !latest) return false

  for (let index = 0; index < current.length; index += 1) {
    if (latest[index] !== current[index]) return latest[index] > current[index]
  }

  return false
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = await getVersion()
  const response = await fetch(LATEST_RELEASE_ENDPOINT, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub Releasesの確認に失敗しました（HTTP ${response.status}）。`)
  }

  const release = releaseSchema.parse(await response.json())
  const latestVersion = release.tag_name.replace(/^v/i, '')
  if (!normalizeVersion(latestVersion)) {
    throw new Error(`GitHub Releaseのバージョン形式が不正です（${release.tag_name}）。`)
  }

  return {
    available: isNewerVersion(currentVersion, latestVersion),
    currentVersion,
    latestVersion,
    releaseUrl: release.html_url,
  }
}

export async function openUpdateRelease(url: string) {
  await open(url)
}
