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

function getErrorCode(error: unknown) {
  const body = getErrorBody(error)
  return typeof body?.code === 'string' ? body.code : null
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

export function isPasswordAlreadySetError(error: unknown) {
  return getErrorCode(error) === 'PASSWORD_ALREADY_SET'
    || extractTwoFactorErrorMessage(error) === 'User already has a password set'
}
