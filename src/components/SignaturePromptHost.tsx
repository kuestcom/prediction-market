'use client'

import { lazy, Suspense } from 'react'
import { useSignaturePrompt } from '@/stores/useSignaturePrompt'

const SignaturePrompt = lazy(async () => {
  const mod = await import('@/components/SignaturePrompt')
  return { default: mod.SignaturePrompt }
})

export function SignaturePromptHost() {
  const open = useSignaturePrompt(state => state.open)

  if (!open) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <SignaturePrompt />
    </Suspense>
  )
}
