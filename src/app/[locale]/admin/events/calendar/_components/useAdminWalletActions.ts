import { useCallback, useEffect, useRef, useState } from 'react'

export function useAdminWalletActions(eoaAddress: string | null) {
  const [isAddressCopied, setIsAddressCopied] = useState(false)
  const copyTimeoutRef = useRef<number | null>(null)

  useEffect(function cleanupCopyTimeoutOnUnmount() {
    return function clearCopyTimeout() {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const copyWalletAddress = useCallback(async () => {
    if (!eoaAddress) {
      return
    }

    try {
      await navigator.clipboard.writeText(eoaAddress)
      setIsAddressCopied(true)
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setIsAddressCopied(false)
      }, 1400)
    }
    catch (error) {
      console.error('Error copying wallet address:', error)
    }
  }, [eoaAddress])

  const openAdminSettings = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const segments = window.location.pathname.split('/').filter(Boolean)
    const href = segments.length >= 2 && segments[1] === 'admin'
      ? `/${segments[0]}/admin`
      : '/admin'
    window.open(href, '_blank', 'noopener,noreferrer')
  }, [])

  const resetAddressCopied = useCallback(() => {
    setIsAddressCopied(false)
  }, [])

  return {
    isAddressCopied,
    copyWalletAddress,
    openAdminSettings,
    resetAddressCopied,
  }
}
