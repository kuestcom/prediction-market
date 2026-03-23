import { ArrowLeftIcon } from 'lucide-react'
import { setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'
import { Suspense } from 'react'
import AdminCreateEventForm from '@/app/[locale]/admin/create-event/_components/AdminCreateEventForm'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { buildAdminSportsSlugCatalog, EMPTY_ADMIN_SPORTS_SLUG_CATALOG } from '@/lib/admin-sports-slugs'
import { normalizeDateTimeLocalValue } from '@/lib/datetime-local'
import { EventCreationRepository } from '@/lib/db/queries/event-creations'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { UserRepository } from '@/lib/db/queries/user'
import { loadEventCreationSignersFromEnv } from '@/lib/event-creation-signers'

type CreationMode = 'single' | 'recurring'

interface AdminCreateEventNewPageProps {
  params: Promise<{
    locale: string
  }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function resolveCreationMode(value: string | string[] | undefined): CreationMode {
  const normalized = Array.isArray(value) ? value[0] : value
  return normalized === 'recurring' ? 'recurring' : 'single'
}

function resolveSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function AdminCreateEventNewContent({
  searchParams,
}: Pick<AdminCreateEventNewPageProps, 'searchParams'>) {
  await connection()
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const mode = resolveCreationMode(resolvedSearchParams?.mode)
  const draftId = resolveSearchParam(resolvedSearchParams?.draftId) ?? ''
  const resumeValue = resolveSearchParam(resolvedSearchParams?.resume)
  const shouldLoadSavedDraft = resumeValue === 'local-draft'
  const startAtValue = shouldLoadSavedDraft ? '' : resolveSearchParam(resolvedSearchParams?.startAt) ?? ''

  const sportsMenuResult = await SportsMenuRepository.getMenuEntries()
  const sportsSlugCatalog = sportsMenuResult.data
    ? buildAdminSportsSlugCatalog(sportsMenuResult.data)
    : EMPTY_ADMIN_SPORTS_SLUG_CATALOG

  const currentUser = await UserRepository.getCurrentUser()
  const draftResult = (!shouldLoadSavedDraft && draftId && currentUser?.is_admin)
    ? await EventCreationRepository.getDraftByIdForUser({
        draftId,
        userId: currentUser.id,
      })
    : { data: null, error: null }
  const hasConfiguredServerSigners = loadEventCreationSignersFromEnv().length > 0
  const effectiveMode = draftResult.data?.creationMode ?? mode
  const initialTitle = draftResult.data?.title ?? ''
  const initialSlug = draftResult.data?.slug ?? ''
  const initialEndDateIso = normalizeDateTimeLocalValue(
    draftResult.data?.endDate ?? startAtValue,
  )

  const title = effectiveMode === 'recurring' ? 'Create Recurring Event' : 'Create Event'
  const description = shouldLoadSavedDraft
    ? 'Resuming the current browser draft.'
    : effectiveMode === 'recurring'
      ? 'Build the base market draft that will power a recurring schedule.'
      : 'Create a one-off event with the existing guided form.'

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/create-event">
            <ArrowLeftIcon className="size-4" />
            Back to calendar
          </Link>
        </Button>
      </div>

      <div className="min-w-0">
        <AdminCreateEventForm
          sportsSlugCatalog={sportsSlugCatalog}
          creationMode={effectiveMode}
          hasConfiguredServerSigners={hasConfiguredServerSigners}
          initialDraftRecord={draftResult.data ?? null}
          draftId={draftId || null}
          initialTitle={initialTitle}
          initialSlug={initialSlug ?? ''}
          initialEndDateIso={initialEndDateIso}
          shouldLoadSavedDraft={shouldLoadSavedDraft}
          serverDraftPayload={draftResult.data?.draftPayload ?? null}
          serverAssetPayload={draftResult.data?.assetPayload ?? null}
        />
      </div>
    </>
  )
}

export default async function AdminCreateEventNewPage({
  params,
  searchParams,
}: AdminCreateEventNewPageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <section className="grid gap-4">
      <Suspense
        fallback={(
          <>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="grid gap-2">
                <h1 className="text-2xl font-semibold">Create Event</h1>
                <p className="text-sm text-muted-foreground">Loading event form...</p>
              </div>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/create-event">
                  <ArrowLeftIcon className="size-4" />
                  Back to calendar
                </Link>
              </Button>
            </div>

            <div className="min-h-40 rounded-xl border bg-background" />
          </>
        )}
      >
        <AdminCreateEventNewContent searchParams={searchParams} />
      </Suspense>
    </section>
  )
}
