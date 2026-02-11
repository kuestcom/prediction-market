import { getExtracted } from 'next-intl/server'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { getAvatarPlaceholderStyle, shouldUseAvatarPlaceholder } from '@/lib/avatar'
import { tableHeaderClass } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface AffiliateRow {
  id: string
  username: string
  address: string
  proxy_wallet_address?: string | null
  image: string
  affiliate_code?: string | null
  total_referrals: number
  volume: number
  total_affiliate_fees: number
}

interface AdminAffiliateOverviewProps {
  rows: AffiliateRow[]
}

export default async function AdminAffiliateOverview({ rows }: AdminAffiliateOverviewProps) {
  const t = await getExtracted()

  if (!rows.length) {
    return (
      <div className="rounded-lg border p-6">
        <h2 className="text-xl font-semibold">{t('Affiliate performance')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('No affiliate activity recorded yet.')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b p-4 md:px-6">
        <div>
          <h2 className="text-xl font-semibold">{t('Affiliate performance')}</h2>
          <p className="text-sm text-muted-foreground">{t('Top referring partners and their earnings.')}</p>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y">
          <thead>
            <tr>
              <th className={cn(tableHeaderClass, 'px-6 text-left')}>{t('Affiliate')}</th>
              <th className={cn(tableHeaderClass, 'px-6 text-right')}>{t('Referrals')}</th>
              <th className={cn(tableHeaderClass, 'px-6 text-right')}>{t('Volume')}</th>
              <th className={cn(tableHeaderClass, 'px-6 text-right')}>{t('Affiliate fees')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const avatarUrl = row.image?.trim() ?? ''
              const avatarSeed = row.proxy_wallet_address || row.address || row.username || row.id
              const showPlaceholder = shouldUseAvatarPlaceholder(avatarUrl)
              const placeholderStyle = showPlaceholder
                ? getAvatarPlaceholderStyle(avatarSeed)
                : undefined
              return (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {showPlaceholder
                        ? (
                            <div
                              aria-hidden="true"
                              className="size-8 rounded-full"
                              style={placeholderStyle}
                            />
                          )
                        : (
                            <Image
                              src={avatarUrl}
                              alt={t('Affiliate avatar')}
                              width={32}
                              height={32}
                              className="rounded-full"
                            />
                          )}
                      <div className="space-y-0.5">
                        <Link
                          href={`/@${row.username}`}
                          className="text-sm font-medium hover:text-primary"
                        >
                          {row.username}
                        </Link>
                        {row.affiliate_code && (
                          <p className="text-xs text-muted-foreground">
                            {t('Code:')}
                            {' '}
                            {row.affiliate_code}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    {row.total_referrals}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    {formatCurrency(row.volume, { includeSymbol: false })}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    {formatCurrency(row.total_affiliate_fees, { includeSymbol: false })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y md:hidden">
        {rows.map((row) => {
          const avatarUrl = row.image?.trim() ?? ''
          const avatarSeed = row.proxy_wallet_address || row.address || row.username || row.id
          const showPlaceholder = shouldUseAvatarPlaceholder(avatarUrl)
          const placeholderStyle = showPlaceholder
            ? getAvatarPlaceholderStyle(avatarSeed)
            : undefined
          return (
            <div key={row.id} className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                {showPlaceholder
                  ? (
                      <div
                        aria-hidden="true"
                        className="size-8 rounded-full"
                        style={placeholderStyle}
                      />
                    )
                  : (
                      <Image
                        src={avatarUrl}
                        alt={t('Affiliate avatar')}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    )}
                <div className="flex-1 space-y-0.5">
                  <Link
                    href={`/@${row.username}`}
                    className="block text-sm font-medium hover:text-primary"
                  >
                    {row.username}
                  </Link>
                  {row.affiliate_code && (
                    <p className="text-xs text-muted-foreground">
                      {t('Code:')}
                      {' '}
                      {row.affiliate_code}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase">{t('Referrals')}</p>
                  <p className="font-medium">{row.total_referrals}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase">{t('Volume')}</p>
                  <p className="font-medium">{formatCurrency(row.volume, { includeSymbol: false })}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-muted-foreground uppercase">{t('Fees')}</p>
                  <p className="font-medium">{formatCurrency(row.total_affiliate_fees, { includeSymbol: false })}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
