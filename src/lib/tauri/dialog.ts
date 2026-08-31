import { open } from '@tauri-apps/plugin-dialog'
import { VIDEO_EXTENSIONS } from '../../types/media'

export async function pickVideoPath(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    title: '動画を選択',
    filters: [{ name: '動画', extensions: [...VIDEO_EXTENSIONS] }],
  })

  return typeof selected === 'string' ? selected : null
}

export async function pickExportDirectory(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: true,
    title: 'Export先を選択',
  })

  return typeof selected === 'string' ? selected : null
}
