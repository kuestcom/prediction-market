import { useEffect, useMemo, useState } from 'react'
import { SIGNATURE_COUNTDOWN_INTERVAL_MS } from './admin-create-event-form-constants'
import { formatSignatureCountdown } from './admin-create-event-form-utils'

export function useSignatureCountdown() {
  const [authChallengeExpiresAtMs, setAuthChallengeExpiresAtMs] = useState<number | null>(null)
  const [signatureNowMs, setSignatureNowMs] = useState(0)
  const authChallengeRemainingSeconds = useMemo(() => {
    if (!authChallengeExpiresAtMs || signatureNowMs <= 0) {
      return null
    }
    return Math.max(0, Math.floor((authChallengeExpiresAtMs - signatureNowMs) / 1000))
  }, [authChallengeExpiresAtMs, signatureNowMs])
  const authChallengeCountdownLabel = useMemo(() => {
    if (authChallengeRemainingSeconds === null) {
      return ''
    }
    return formatSignatureCountdown(authChallengeRemainingSeconds)
  }, [authChallengeRemainingSeconds])

  useEffect(function runAuthChallengeCountdown() {
    if (!authChallengeExpiresAtMs) {
      return
    }

    const timer = window.setInterval(function tickSignatureCountdownNow() {
      setSignatureNowMs(Date.now())
    }, SIGNATURE_COUNTDOWN_INTERVAL_MS)

    return function clearAuthChallengeCountdownTimer() {
      window.clearInterval(timer)
    }
  }, [authChallengeExpiresAtMs])

  return {
    authChallengeExpiresAtMs,
    setAuthChallengeExpiresAtMs,
    setSignatureNowMs,
    authChallengeRemainingSeconds,
    authChallengeCountdownLabel,
  }
}
