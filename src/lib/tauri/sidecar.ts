import { Command } from '@tauri-apps/plugin-shell'

export type SidecarName =
  | 'binaries/ffmpeg'
  | 'binaries/ffprobe'
  | 'binaries/whisper-cli'
  | 'binaries/llama-server'

export function executeSidecar(name: SidecarName, args: string[]) {
  return Command.sidecar(name, args).execute()
}

export async function executeSidecarRaw(name: SidecarName, args: string[]) {
  const output = await Command.sidecar(name, args, { encoding: 'raw' }).execute()

  // Tauri IPC may deserialize Rust's Vec<u8> as number[] despite the plugin type being Uint8Array.
  return {
    ...output,
    stdout: output.stdout instanceof Uint8Array ? output.stdout : Uint8Array.from(output.stdout),
    stderr: output.stderr instanceof Uint8Array ? output.stderr : Uint8Array.from(output.stderr),
  }
}
