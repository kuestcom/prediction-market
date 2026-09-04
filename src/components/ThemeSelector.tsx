import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'

export default function ThemeSelector() {
  const t = useExtracted()
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        type="button"
        size="icon"
        variant={theme === 'light' ? 'default' : 'outline'}
        onClick={(e) => {
          e.stopPropagation()
          setTheme('light')
        }}
        className="size-7"
        title={t('Light mode')}
      >
        <SunIcon className="size-3.5" />
      </Button>

      <Button
        type="button"
        size="icon"
        variant={theme === 'system' ? 'default' : 'outline'}
        onClick={(e) => {
          e.stopPropagation()
          setTheme('system')
        }}
        className="size-7"
        title={t('System mode')}
      >
        <MonitorIcon className="size-3.5" />
      </Button>

      <Button
        type="button"
        size="icon"
        variant={theme === 'dark' ? 'default' : 'outline'}
        onClick={(e) => {
          e.stopPropagation()
          setTheme('dark')
        }}
        className="size-7"
        title={t('Dark mode')}
      >
        <MoonIcon className="size-3.5" />
      </Button>
    </div>
  )
}
