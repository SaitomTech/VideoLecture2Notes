export class UserFacingError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'UserFacingError'
  }
}

export function asUserFacingError(error: unknown, message: string) {
  return error instanceof UserFacingError ? error : new UserFacingError(message, error)
}

export async function withUserFacingError<T>(message: string, operation: () => T | Promise<T>) {
  try {
    return await operation()
  } catch (error) {
    throw asUserFacingError(error, message)
  }
}

export function getUserErrorMessage(error: unknown, fallback: string) {
  return error instanceof UserFacingError ? error.message : fallback
}

export function getErrorDetail(error: unknown, fallback = '不明なエラー') {
  const messages: string[] = []
  const visited = new Set<unknown>()
  let current: unknown = error

  while (current && !visited.has(current)) {
    visited.add(current)

    if (current instanceof Error) {
      if (current.message.trim()) messages.push(current.message.trim())
      current = current.cause
      continue
    }

    if (typeof current === 'string') {
      if (current.trim()) messages.push(current.trim())
      break
    }

    break
  }

  return [...new Set(messages)].join(' → ') || fallback
}
