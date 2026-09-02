import { Command, type Child } from '@tauri-apps/plugin-shell'

export type SidecarName =
  | 'binaries/ffmpeg'
  | 'binaries/ffprobe'
  | 'binaries/whisper-cli'
  | 'binaries/llama-server'
  | 'binaries/apple-vision-ocr'

type SidecarStreamHandlers = {
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
  signal?: AbortSignal
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
  { onStdout, onStderr, signal }: SidecarStreamHandlers = {},
) {
  const command = Command.sidecar(name, args)
  let stdout = ''
  let stderr = ''
  let child: Child | null = null
  let settled = false
  let onAbort: (() => void) | null = null
  let rejectCompletion: (reason?: unknown) => void = () => undefined

  const cleanup = () => {
    if (onAbort) signal?.removeEventListener('abort', onAbort)
    onAbort = null
  }

  const settleWithError = (error: unknown) => {
    if (settled) return
    settled = true
    cleanup()
    rejectCompletion(error)
  }

  const completion = new Promise<SidecarStreamResult>((resolve, reject) => {
    rejectCompletion = reject
    const abort = () => {
      const abortError = new DOMException('処理を中止しました。', 'AbortError')
      if (!child) {
        settleWithError(abortError)
        return
      }
      void child.kill().catch(() => undefined).finally(() => settleWithError(abortError))
    }
    onAbort = abort

    if (signal?.aborted) {
      abort()
      return
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    command.stdout.on('data', (chunk) => {
      stdout += chunk
      onStdout?.(chunk)
    })
    command.stderr.on('data', (chunk) => {
      stderr += chunk
      onStderr?.(chunk)
    })
    command.once('close', ({ code, signal: terminationSignal }) => {
      if (settled) return
      if (signal?.aborted) {
        settleWithError(new DOMException('処理を中止しました。', 'AbortError'))
        return
      }
      settled = true
      cleanup()
      resolve({ code, signal: terminationSignal, stdout, stderr })
    })
    command.once('error', settleWithError)
  })

  void command
    .spawn()
    .then((spawnedChild) => {
      child = spawnedChild
      if (signal?.aborted) void spawnedChild.kill().catch(() => undefined)
    })
    .catch((error) => {
      // A spawn failure does not always emit the shell plugin's error event.
      settleWithError(error)
    })

  return completion
}

export function executeSidecar(
  name: SidecarName,
  args: string[],
  { signal }: { signal?: AbortSignal } = {},
) {
  return signal
    ? executeSidecarStreaming(name, args, { signal })
    : Command.sidecar(name, args).execute()
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
