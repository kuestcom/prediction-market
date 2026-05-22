'use client'

import { CheckIcon, CopyIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const COMMIT_SHA = process.env.COMMIT_SHA!
const SITE_URL = process.env.SITE_URL!
const IS_VERCEL = process.env.IS_VERCEL!

export default function CopyVersion() {
  const [copied, setCopied] = useState(false)
  const t = useExtracted()

  async function copyVersionPayload() {
    const payload = `{${[
      COMMIT_SHA,
      SITE_URL,
      IS_VERCEL,
      new Date().toISOString(),
    ].join(';')}}`

    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      window.setTimeout(setCopied, 2000, false)
    }
    catch {
      toast.error(t('Failed to copy version'))
    }
  }

  return (
    <div className="bottom-2 mt-4 text-muted-foreground lg:fixed">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        title={copied ? 'Copied' : 'Copy version payload'}
        onClick={() => void copyVersionPayload()}
      >
        v.
        {COMMIT_SHA}
        {copied
          ? <CheckIcon className="text-yes" />
          : <CopyIcon />}
      </Button>
    </div>
  )
}
