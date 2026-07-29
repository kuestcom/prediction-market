'use client'

import { cn } from '@/lib/utils'

function SportsEventLiveStatusIcon({ className, muted = false }: { className?: string; muted?: boolean }) {
  if (muted) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        className={cn(className, 'text-muted-foreground')}
        fill="none"
      >
        <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
          <path d="M5.641,12.359c-1.855-1.855-1.855-4.863,0-6.718" />
          <path d="M3.52,14.48C.493,11.454,.493,6.546,3.52,3.52" />
          <circle cx="9" cy="9" r="1.75" fill="none" stroke="currentColor" />
          <path d="M12.359,12.359c1.855-1.855,1.855-4.863,0-6.718" />
          <path d="M14.48,14.48c3.027-3.027,3.027-7.934,0-10.96" />
        </g>
      </svg>
    )
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      className={cn(className, 'text-red-500')}
      fill="none"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        <path d="M5.641,12.359c-1.855-1.855-1.855-4.863,0-6.718" opacity="0.24">
          <animate
            attributeName="opacity"
            values="0.24;1;1;0.24;0.24"
            keyTimes="0;0.28;0.56;0.84;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
        <path d="M3.52,14.48C.493,11.454,.493,6.546,3.52,3.52" opacity="0.14">
          <animate
            attributeName="opacity"
            values="0.14;0.14;0.92;0.92;0.14;0.14"
            keyTimes="0;0.4;0.58;0.78;0.92;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
        <circle cx="9" cy="9" r="1.75" fill="none" stroke="currentColor" />
        <path d="M12.359,12.359c1.855-1.855,1.855-4.863,0-6.718" opacity="0.24">
          <animate
            attributeName="opacity"
            values="0.24;1;1;0.24;0.24"
            keyTimes="0;0.28;0.56;0.84;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
        <path d="M14.48,14.48c3.027-3.027,3.027-7.934,0-10.96" opacity="0.14">
          <animate
            attributeName="opacity"
            values="0.14;0.14;0.92;0.92;0.14;0.14"
            keyTimes="0;0.4;0.58;0.78;0.92;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </svg>
  )
}

export default SportsEventLiveStatusIcon
