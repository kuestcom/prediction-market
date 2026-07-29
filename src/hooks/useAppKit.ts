'use client'

import type { OpenOptions, Views } from '@reown/appkit/react'

import { createContext, use } from 'react'

export interface AppKitValue {
  open: (options?: OpenOptions<Views>) => Promise<void>
  close: () => Promise<void>
  isReady: boolean
}

export const defaultAppKitValue: AppKitValue = {
  open: async () => {},
  close: async () => {},
  isReady: false,
}

export const AppKitContext = createContext<AppKitValue>(defaultAppKitValue)

export function useAppKit() {
  return use(AppKitContext)
}
