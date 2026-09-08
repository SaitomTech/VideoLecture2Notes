import { createContext, useContext } from 'react'
import type { Update } from '@tauri-apps/plugin-updater'

export type UpdateState = {
  update: Update | null
  phase: 'idle' | 'checking' | 'downloading' | 'installing' | 'installed'
  progress: number | null
  message: string | null
  autoCheck: boolean
  setAutoCheck: (enabled: boolean) => void
  checkForUpdates: () => Promise<void>
  installUpdate: () => Promise<void>
}
export const UpdateContext = createContext<UpdateState | null>(null)

export function getUpdateMessage({ message, phase, progress, update }: UpdateState) {
  if (message) return message
  switch (phase) {
    case 'downloading':
      return progress === null ? 'ダウンロード中…' : `ダウンロード中（${progress}%）…`
    case 'installing':
      return 'インストール中…'
    case 'installed':
      return '再起動すると更新が適用されます。'
    default:
      return update ? `新しいバージョン v${update.version} があります。` : null
  }
}
export function useUpdates() {
  const context = useContext(UpdateContext)
  if (!context) throw new Error('UpdateProvider is required')
  return context
}
