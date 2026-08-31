type LlamaChatContent = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

type LlamaChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | LlamaChatContent[]
}

type CompleteChatInput = {
  model: string
  messages: LlamaChatMessage[]
  temperature?: number
  maxTokens?: number
  responseFormat?: { type: 'json_object' }
  signal?: AbortSignal
}

type LlamaChatResponse = {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
}

function contentToText(content: unknown) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map((part) => {
      if (!part || typeof part !== 'object' || !('text' in part)) return ''
      return typeof part.text === 'string' ? part.text : ''
    })
    .join('')
}

export function parseJsonResponse(text: string) {
  const fencedJson = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text
  const start = fencedJson.indexOf('{')
  const end = fencedJson.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('JSON形式の応答を読み取れませんでした。')

  try {
    return JSON.parse(fencedJson.slice(start, end + 1)) as unknown
  } catch {
    throw new Error('JSON形式の応答を読み取れませんでした。')
  }
}

export async function completeChat(
  baseUrl: string,
  { model, messages, temperature = 0, maxTokens = 2048, responseFormat, signal }: CompleteChatInput,
) {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(responseFormat ? { response_format: responseFormat } : {}),
      stream: false,
    }),
    signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`llama-serverの応答に失敗しました (HTTP ${response.status})${detail ? `: ${detail}` : ''}`)
  }

  const result = (await response.json()) as LlamaChatResponse
  const text = contentToText(result.choices?.[0]?.message?.content).trim()
  if (!text) throw new Error('llama-serverの応答が空でした。')
  return text
}
