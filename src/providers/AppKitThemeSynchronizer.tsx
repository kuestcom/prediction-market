'use client'

import { useAppKitTheme } from '@reown/appkit/react'
import { useEffect } from 'react'

export default function AppKitThemeSynchronizer({ themeMode }: { themeMode: 'light' | 'dark' }) {
  const { setThemeMode } = useAppKitTheme()

  useEffect(() => {
    setThemeMode(themeMode)
  }, [setThemeMode, themeMode])

  return null
}
