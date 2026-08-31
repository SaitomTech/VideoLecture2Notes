import { Command } from '@tauri-apps/plugin-shell'

export type SidecarName = 'binaries/ffmpeg' | 'binaries/ffprobe'

export function executeSidecar(name: SidecarName, args: string[]) {
  return Command.sidecar(name, args).execute()
}
