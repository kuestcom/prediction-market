import type { MouseEvent } from 'react'
import { useExtracted } from 'next-intl'
import { Button } from '@/components/ui/button'

interface EventOrderPanelSubmitButtonProps {
  isLoading: boolean
  isDisabled: boolean
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  label?: string
  type?: 'button' | 'submit'
}

export default function EventOrderPanelSubmitButton({
  isLoading,
  isDisabled,
  onClick,
  label,
  type = 'submit',
}: EventOrderPanelSubmitButtonProps) {
  const t = useExtracted()

  return (
    <div className="relative w-full pb-1.25">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 rounded-b-md bg-[oklch(0.50_0.11_237.323)]" />
      <Button
        type={type}
        size="outcomeLg"
        disabled={isDisabled}
        aria-disabled={isDisabled}
        onClick={onClick}
        className={`
          relative w-full translate-y-0 rounded-md text-base font-bold transition-transform duration-150 ease-out
          hover:translate-y-px hover:bg-primary
          active:translate-y-0.5
          disabled:opacity-100
        `}

      >
        {isLoading
          ? (
              <div className="flex items-center justify-center gap-2">
                <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                <span>{t('Processing...')}</span>
              </div>
            )
          : (
              <span>{label ?? t('Trade')}</span>
            )}
      </Button>
    </div>
  )
}
