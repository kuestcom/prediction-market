'use client'

import type { User } from '@/types'
import SettingsProfileContent from '@/app/[locale]/(platform)/settings/_components/SettingsProfileContent'
import PwaInstallCard from '@/components/PwaInstallCard'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { cn } from '@/lib/utils'

export default function SettingsProfilePanel({ user }: { user: User }) {
  const { canShowInstallUi } = usePwaInstall()

  return (
    <div className={cn('mx-auto w-full lg:mx-0', canShowInstallUi ? 'max-w-5xl' : 'max-w-2xl')}>
      <div
        className={cn(
          canShowInstallUi && `
            grid gap-6
            lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start
            xl:grid-cols-[minmax(0,1fr)_320px]
          `,
        )}
      >
        <div className="min-w-0">
          <SettingsProfileContent user={user} />
        </div>

        {canShowInstallUi && (
          <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <PwaInstallCard />
          </aside>
        )}
      </div>
    </div>
  )
}
