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
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}
