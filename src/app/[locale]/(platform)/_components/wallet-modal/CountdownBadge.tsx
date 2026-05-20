'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface CountdownBadgeContentProps {
  seconds: number
  onReset?: () => void
}

function CountdownBadgeContent({
  seconds,
  onReset,
}: CountdownBadgeContentProps) {
  const [remaining, setRemaining] = useState(seconds)
  const endTimeRef = useRef(0)
  const hasTriggeredResetRef = useRef(false)
  const onResetRef = useRef(onReset)

  useEffect(function syncOnResetRef() {
    onResetRef.current = onReset
  }, [onReset])

  useEffect(function startCountdownTimer() {
    endTimeRef.current = Date.now() + seconds * 1000
    hasTriggeredResetRef.current = false
    const interval = setInterval(() => {
      const now = Date.now()
      let diff = endTimeRef.current - now
      if (diff <= 0) {
        if (!hasTriggeredResetRef.current) {
          hasTriggeredResetRef.current = true
          onResetRef.current?.()
        }
        const restartNow = Date.now()
        endTimeRef.current = restartNow + seconds * 1000
        diff = endTimeRef.current - restartNow
        hasTriggeredResetRef.current = false
      }
      const next = Math.max(0, Math.ceil(diff / 1000))
      setRemaining(next)
    }, 250)

    return function cleanupCountdownTimer() {
      clearInterval(interval)
    }
  }, [seconds])

  const size = 36
  const strokeWidth = 3
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progressRatio = seconds > 0 ? remaining / seconds : 0
  const dashOffset = circumference * (1 - progressRatio)

  return (
    <div className="absolute top-4 right-4">
      <div className="relative size-9">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-muted-foreground/40"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="text-primary"
          />
        </svg>
        <div className={cn(`
          absolute inset-0.75 flex items-center justify-center rounded-full bg-background text-[9px] font-semibold
          text-foreground ring-1 ring-border/60
        `)}
        >
          {remaining}
        </div>
      </div>
    </div>
  )
}

function CountdownBadge({
  seconds = 30,
  onReset,
}: {
  seconds?: number
  onReset?: () => void
}) {
  return (
    <CountdownBadgeContent
      key={seconds}
      seconds={seconds}
      onReset={onReset}
    />
  )
}

export default CountdownBadge
