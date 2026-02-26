import type { ReactNode } from 'react'
import { openSauceOne } from '@/lib/fonts'
import { loadRuntimeThemeState } from '@/lib/theme-settings'
import './globals.css'

interface Props {
  children: ReactNode
}

export default async function RootLayout({ children }: Props) {
  const runtimeTheme = await loadRuntimeThemeState()

  return (
    <html
      lang="en"
      className={openSauceOne.variable}
      data-theme-preset={runtimeTheme.theme.presetId}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans">
        {children}
      </body>
    </html>
  )
}
