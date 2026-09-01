import { Command } from '@tauri-apps/plugin-shell'
import { getErrorDetail } from '../errors'

const STARTUP_TIMEOUT_MS = 120_000
const HEALTH_POLL_INTERVAL_MS = 250

type LlamaServerSession = {
  baseUrl: string
  stop: () => Promise<void>
}

export type LlamaModelPaths = {
  modelPath: string
  mmprojPath?: string
  contextSize?: number
}

function choosePort() {
  const bytes = new Uint8Array(2)
  crypto.getRandomValues(bytes)
  return 40_000 + (((bytes[0] << 8) | bytes[1]) % 10_000)
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('処理を中止しました。', 'AbortError')
}

async function waitForHealth(baseUrl: string, getStderr: () => string, signal?: AbortSignal) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      throwIfAborted(signal)
      const response = await fetch(`${baseUrl}/health`, { cache: 'no-store', signal })
      if (response.ok) return
    } catch (error) {
      if (signal?.aborted) throw error
      // llama-server is still loading or the port is not ready yet.
    }
    throwIfAborted(signal)
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_INTERVAL_MS))
  }

  throw new Error(`llama-serverの準備に時間がかかりすぎています。${getStderr().trim()}`)
}

async function startLlamaServer(
  model: LlamaModelPaths,
  signal?: AbortSignal,
): Promise<LlamaServerSession> {
  throwIfAborted(signal)
  const port = choosePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const command = Command.sidecar('binaries/llama-server', [
    '--model',
    model.modelPath,
    ...(model.mmprojPath ? ['--mmproj', model.mmprojPath] : []),
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--ctx-size',
    String(model.contextSize ?? 8192),
    '--n-gpu-layers',
    'all',
    '--flash-attn',
    'off',
    '--reasoning',
    'off',
    '--fit',
    'off',
    '--no-webui',
    '--log-verbosity',
    '1',
  ])
  let stderr = ''
  command.stderr.on('data', (chunk) => {
    stderr += chunk
  })

  let rejectStartup: (error: Error) => void = () => undefined
  const startupFailure = new Promise<never>((_, reject) => {
    rejectStartup = reject
  })
  const onError = (error: string) =>
    rejectStartup(new Error(`llama-serverを起動できませんでした: ${error}`))
  const onClose = ({ code, signal }: { code: number | null; signal: number | null }) =>
    rejectStartup(
      new Error(
        stderr.trim() ||
          `llama-serverが起動前に終了しました (code ${code ?? 'null'}, signal ${signal ?? 'null'})`,
      ),
    )
  command.once('error', onError)
  command.once('close', onClose)

  let child
  try {
    child = await command.spawn()
  } catch (error) {
    throw new Error(`llama-serverを起動できませんでした: ${getErrorDetail(error)}`, {
      cause: error,
    })
  }
  try {
    await Promise.race([waitForHealth(baseUrl, () => stderr, signal), startupFailure])
  } catch (error) {
    await child.kill().catch(() => undefined)
    throw error
  } finally {
    command.off('error', onError)
    command.off('close', onClose)
  }

  let stopped = false
  return {
    baseUrl,
    stop: async () => {
      if (stopped) return
      stopped = true
      await child.kill()
    },
  }
}

export async function withLlamaServer<T>(
  model: LlamaModelPaths,
  work: (baseUrl: string) => Promise<T>,
  signal?: AbortSignal,
) {
  const server = await startLlamaServer(model, signal)
  try {
    throwIfAborted(signal)
    return await work(server.baseUrl)
  } finally {
    await server.stop()
  }
}
