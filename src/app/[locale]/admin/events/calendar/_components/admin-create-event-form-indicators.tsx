'use client'

import type { SignatureTxStatus } from './admin-create-event-form-types'
import { CheckIcon, CircleMinusIcon, Loader2Icon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type CheckIndicatorState = 'idle' | 'checking' | 'ok' | 'error'

function OutcomeStateDot({ value }: { value: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex size-5 items-center justify-center rounded-full',
        value ? 'bg-emerald-600 text-background' : 'bg-red-600 text-background',
      )}
    >
      {value ? <CheckIcon className="size-3" /> : <XIcon className="size-3" />}
    </span>
  )
}

function CheckIndicator({
  state,
}: {
  state: CheckIndicatorState
}) {
  return (
    <span
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-full border',
        state === 'idle' && 'border-muted-foreground/30 bg-muted/20 text-foreground/80',
        state === 'checking' && 'border-yellow-500/60 bg-yellow-500/15 text-yellow-500',
        state === 'ok' && 'border-emerald-500/60 bg-emerald-500/15 text-emerald-500',
        state === 'error' && 'border-red-500/60 bg-red-500/15 text-red-500',
      )}
    >
      {state === 'idle' && <CircleMinusIcon className="size-3.5" />}
      {state === 'checking' && <Loader2Icon className="size-3.5 animate-spin" />}
      {state === 'ok' && <CheckIcon className="size-3.5" />}
      {state === 'error' && <XIcon className="size-3.5" />}
    </span>
  )
}

function SignatureTxIndicator({ status }: { status: SignatureTxStatus }) {
  if (status === 'success') {
    return (
      <span className={cn(`
        inline-flex size-6 items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/15
        text-emerald-500
      `)}
      >
        <CheckIcon className="size-3.5" />
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className={cn(`
        inline-flex size-6 items-center justify-center rounded-full border border-red-500/60 bg-red-500/15 text-red-500
      `)}
      >
        <XIcon className="size-3.5" />
      </span>
    )
  }

  if (status === 'awaiting_wallet' || status === 'confirming') {
    return (
      <span className={cn(`
        inline-flex size-6 items-center justify-center rounded-full border border-yellow-500/60 bg-yellow-500/15
        text-yellow-500
      `)}
      >
        <Loader2Icon className="size-3.5 animate-spin" />
      </span>
    )
  }

  return (
    <span className={cn(`
      inline-flex size-6 items-center justify-center rounded-full border border-muted-foreground/30 bg-muted/20
      text-muted-foreground
    `)}
    >
      <span className="size-2 rounded-full bg-current" />
    </span>
  )
}

export { CheckIndicator, OutcomeStateDot, SignatureTxIndicator }
