const SIWE_VERIFICATION_ERROR_MESSAGE = 'Failed to verify message'

export function isSiweVerificationError(error: unknown) {
  if (typeof error === 'string') {
    return error === SIWE_VERIFICATION_ERROR_MESSAGE
  }

  if (!error || typeof error !== 'object') {
    return false
  }

  const message = (error as { message?: unknown }).message
  return message === SIWE_VERIFICATION_ERROR_MESSAGE
}
