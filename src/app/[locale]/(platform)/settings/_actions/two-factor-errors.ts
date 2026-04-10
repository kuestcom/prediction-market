interface BetterAuthErrorBody {
  code?: unknown
  message?: unknown
}

interface BetterAuthLikeError {
  body?: BetterAuthErrorBody
  message?: unknown
}

function getErrorBody(error: unknown): BetterAuthErrorBody | null {
  if (!error || typeof error !== 'object' || !('body' in error)) {
    return null
  }

  const { body } = error as BetterAuthLikeError
  return body && typeof body === 'object' ? body : null
}

export function extractTwoFactorErrorMessage(error: unknown) {
  const body = getErrorBody(error)

  if (typeof body?.message === 'string' && body.message) {
    return body.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return null
}
