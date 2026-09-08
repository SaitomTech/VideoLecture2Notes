import type { Update } from '@tauri-apps/plugin-updater'

export async function downloadAndInstallUpdate(
  update: Update,
  onProgress: (percent: number | null) => void,
  onInstalling: () => void,
) {
  let downloadedBytes = 0
  let contentLength: number | undefined

  await update.downloadAndInstall((event) => {
    if (event.event === 'Finished') {
      onInstalling()
      return
    }
    if (event.event === 'Started') contentLength = event.data.contentLength
    else downloadedBytes += event.data.chunkLength
    onProgress(
      contentLength ? Math.min(100, Math.round((downloadedBytes / contentLength) * 100)) : null,
    )
  })
}
