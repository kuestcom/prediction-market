import { useExtracted } from 'next-intl'
import { Link } from '@/i18n/navigation'

export default function EventOrderPanelTermsDisclaimer() {
  const t = useExtracted()

  return (
    <p className="-mt-2 text-center text-xs font-medium text-muted-foreground">
      {t('By trading, you agree to our')}
      {' '}
      <Link className="underline" href="/terms-of-use">
        {t('Terms of Use')}
      </Link>
      .
    </p>
  )
}
