export function isSkippedTransitionAbortError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const { message, name } = error as { message?: unknown; name?: unknown }
  return name === 'AbortError' && message === 'Transition was skipped'
}
