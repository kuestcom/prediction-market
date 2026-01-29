import { useExtracted } from 'next-intl'
import { Link } from '@/i18n/navigation'

export default function EventOrderPanelTermsDisclaimer() {
  const t = useExtracted()

  return (
    <p className="mt-3 text-center text-2xs text-muted-foreground">
      {t('By trading, you agree to our')}
      {' '}
      <Link className="font-medium text-primary underline-offset-2 hover:underline" href="/terms-of-use">
        {t('Terms of Use')}
      </Link>
      .
    </p>
  )
}
