import { invoke } from '@tauri-apps/api/core'

export type OpenAiCredentialStatus = {
  configured: boolean
  lastFour?: string
}

export type OpenAiArticleResponse = {
  body: string
  requestId?: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export function getOpenAiApiKeyStatus() {
  return invoke<OpenAiCredentialStatus>('get_openai_api_key_status')
}

export function validateAndSaveOpenAiApiKey(apiKey: string) {
  return invoke<OpenAiCredentialStatus>('validate_and_save_openai_api_key', { apiKey })
}

export function testOpenAiConnection() {
  return invoke<void>('test_openai_connection')
}

export function deleteOpenAiApiKey() {
  return invoke<void>('delete_openai_api_key')
}

export async function generateOpenAiArticle({
  instructions,
  input,
  maxOutputTokens = 8192,
  signal,
}: {
  instructions: string
  input: string
  maxOutputTokens?: number
  signal?: AbortSignal
}) {
  if (signal?.aborted) throw new DOMException('処理を中止しました。', 'AbortError')

  const clientRequestId = crypto.randomUUID()
  const handleAbort = () => {
    void invoke('cancel_openai_request', { clientRequestId }).catch(() => undefined)
  }
  signal?.addEventListener('abort', handleAbort, { once: true })

  try {
    return await invoke<OpenAiArticleResponse>('generate_openai_article', {
      request: { instructions, input, maxOutputTokens, clientRequestId },
    })
  } catch (error) {
    if (signal?.aborted) throw new DOMException('処理を中止しました。', 'AbortError')
    throw error
  } finally {
    signal?.removeEventListener('abort', handleAbort)
  }
}
