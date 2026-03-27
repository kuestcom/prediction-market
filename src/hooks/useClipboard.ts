'use client'

import { useState } from 'react'

interface UseClipboardReturn {
  copied: boolean
  copy: (text: string) => Promise<void>
}

export function useClipboard(): UseClipboardReturn {
  const [copied, setCopied] = useState(false)

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(setCopied, 2000, false)
    }
    catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  return { copied, copy }
}
