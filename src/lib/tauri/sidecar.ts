import { Command } from '@tauri-apps/plugin-shell'

export type SidecarName =
  | 'binaries/ffmpeg'
  | 'binaries/ffprobe'
  | 'binaries/whisper-cli'
  | 'binaries/llama-server'

export function executeSidecar(name: SidecarName, args: string[]) {
  return Command.sidecar(name, args).execute()
}

type SidecarStreamHandlers = {
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
}

type SidecarStreamResult = {
  code: number | null
  signal: number | null
  stdout: string
  stderr: string
}

/** Runs a sidecar while forwarding stdout/stderr chunks to the caller. */
export function executeSidecarStreaming(
  name: SidecarName,
  args: string[],
  { onStdout, onStderr }: SidecarStreamHandlers = {},
) {
  const command = Command.sidecar(name, args)
  let stdout = ''
  let stderr = ''
  let rejectCompletion: (reason?: unknown) => void = () => undefined

  const completion = new Promise<SidecarStreamResult>((resolve, reject) => {
    rejectCompletion = reject
    command.stdout.on('data', (chunk) => {
      stdout += chunk
      onStdout?.(chunk)
    })
    command.stderr.on('data', (chunk) => {
      stderr += chunk
      onStderr?.(chunk)
    })
    command.once('close', ({ code, signal }) => resolve({ code, signal, stdout, stderr }))
    command.once('error', reject)
  })

  void command.spawn().catch((error) => {
    // A spawn failure does not always emit the shell plugin's error event.
    rejectCompletion(error)
  })

  return completion
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
