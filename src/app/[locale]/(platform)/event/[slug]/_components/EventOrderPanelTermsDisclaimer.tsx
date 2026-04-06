import { useExtracted } from 'next-intl'
import AppLink from '@/components/AppLink'

export default function EventOrderPanelTermsDisclaimer() {
  const t = useExtracted()

  return (
    <p className="pb-2 text-center text-xs font-medium text-muted-foreground lg:-mt-2 lg:pb-0">
      {t('By trading, you agree to our')}
      {' '}
      <AppLink className="underline" href="/tos">
        {t('Terms of Use')}
      </AppLink>
      .
    </p>
  )
}
