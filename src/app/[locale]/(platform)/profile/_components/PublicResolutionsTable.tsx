'use client'

import { useExtracted } from 'next-intl'

import type { DataApiRewardProposal } from '@/lib/data-api/resolution-rewards'

import { tableHeaderClass } from '@/lib/constants'
import { cn } from '@/lib/utils'

import PublicResolutionRow from './PublicResolutionRow'

export default function PublicResolutionsTable({ proposals }: { proposals: DataApiRewardProposal[] }) {
  const t = useExtracted()

  return (
    <div className="relative w-full overflow-x-auto">
      <table className="w-full min-w-[860px] table-fixed border-collapse">
        <thead>
          <tr className="border-b bg-background">
            <th className={cn(tableHeaderClass, 'w-48 text-left')}>{t('Proposed')}</th>
            <th className={cn(tableHeaderClass, 'w-[46%] text-left')}>{t('Market')}</th>
            <th className={cn(tableHeaderClass, 'w-32 text-right')}>{t('Value')}</th>
            <th className={cn(tableHeaderClass, 'w-32 text-right')}>
              <span className="sr-only">{t('Time')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {proposals.length > 0 ? (
            proposals.map((proposal) => <PublicResolutionRow key={proposal.id} proposal={proposal} />)
          ) : (
            <tr>
              <td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                {t('No resolution proposals found.')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
