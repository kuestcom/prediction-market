import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export default function ThemeSelector() {
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
        title="System mode"
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
        title="System mode"
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
        title="Dark mode"
      >
        <MoonIcon className="size-3.5" />
      </Button>
    </div>
  )
}
