import { Command } from '@tauri-apps/plugin-shell'
import type { OcrModelPaths } from '../ocr/modelManager'

const STARTUP_TIMEOUT_MS = 120_000
const HEALTH_POLL_INTERVAL_MS = 250

type LlamaServerSession = {
  baseUrl: string
  stop: () => Promise<void>
}

function choosePort() {
  const bytes = new Uint8Array(2)
  crypto.getRandomValues(bytes)
  return 40_000 + (((bytes[0] << 8) | bytes[1]) % 10_000)
}

async function waitForHealth(
  baseUrl: string,
  getStderr: () => string,
) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`, { cache: 'no-store' })
      if (response.ok) return
    } catch {
      // llama-server is still loading or the port is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_INTERVAL_MS))
  }

  throw new Error(`llama-serverの準備に時間がかかりすぎています。${getStderr().trim()}`)
}

async function startLlamaServer(model: OcrModelPaths): Promise<LlamaServerSession> {
  const port = choosePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const command = Command.sidecar('binaries/llama-server', [
    '--model',
    model.modelPath,
    '--mmproj',
    model.mmprojPath,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--ctx-size',
    '8192',
    '--n-gpu-layers',
    'all',
    '--flash-attn',
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

  const child = await command.spawn()
  try {
    await Promise.race([waitForHealth(baseUrl, () => stderr), startupFailure])
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
  model: OcrModelPaths,
  work: (baseUrl: string) => Promise<T>,
) {
  const server = await startLlamaServer(model)
  try {
    return await work(server.baseUrl)
  } finally {
    await server.stop()
  }
}
