'use client'

import type { EventClickArg, EventInput } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { Route } from 'next'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { CalendarPlusIcon, ClipboardListIcon, CopyIcon, ImageIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import EventIconImage from '@/components/EventIconImage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useRouter } from '@/i18n/navigation'
import { formatDateTimeLocalValue, normalizeDateTimeLocalValue } from '@/lib/datetime-local'
import { expandEventCreationOccurrences } from '@/lib/event-creation'

const CREATE_EVENT_DRAFT_STORAGE_KEY = 'admin_create_event_draft_v2'
const COPY_EVENT_FALLBACK_ICON_CLASS_NAME = 'flex size-14 items-center justify-center rounded-lg border text-muted-foreground'

type CreationMode = 'single' | 'recurring'

interface LocalDraftSummary {
  id: string
  title: string
  endDateIso: string
  currentStep: number
}

interface BackendDraftSummary {
  id: string
  title: string
  slug: string | null
  titleTemplate: string | null
  slugTemplate: string | null
  creationMode: CreationMode
  status: 'draft' | 'scheduled' | 'running' | 'deployed' | 'failed' | 'canceled'
  startAt: string | null
  deployAt: string | null
  recurrenceUnit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'semiannual' | 'year' | null
  recurrenceInterval: number | null
  recurrenceUntil: string | null
  walletAddress: string | null
  updatedAt: string
}

interface AdminEventSearchResult {
  id: string
  title: string
  slug: string
  end_date: string | null
  icon_url: string | null
}

function buildDefaultStartAt(baseTimeMs: number) {
  if (!Number.isFinite(baseTimeMs) || baseTimeMs <= 0) {
    return ''
  }

  const next = new Date(baseTimeMs)
  next.setMinutes(0, 0, 0)
  next.setHours(next.getHours() + 1)
  return formatDateTimeLocalValue(next)
}

function readCurrentTimeMs() {
  if (typeof window === 'undefined' || typeof window.performance === 'undefined') {
    return 0
  }

  return window.performance.timeOrigin + window.performance.now()
}

function normalizeCalendarSelection(date: Date, allDay: boolean) {
  const next = new Date(date)
  if (allDay) {
    next.setHours(9, 0, 0, 0)
  }
  return formatDateTimeLocalValue(next)
}

function formatStartAtLabel(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Choose where this draft should start on the calendar.'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function formatDraftDateLabel(value: string) {
  const normalized = normalizeDateTimeLocalValue(value)
  if (!normalized) {
    return 'Today'
  }

  return formatStartAtLabel(normalized)
}

function parseLocalDraft(raw: string | null): LocalDraftSummary | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as {
      form?: {
        title?: unknown
        endDateIso?: unknown
      }
      currentStep?: unknown
    }

    const title = typeof parsed.form?.title === 'string' && parsed.form.title.trim()
      ? parsed.form.title.trim()
      : 'Untitled draft'

    const endDateIso = typeof parsed.form?.endDateIso === 'string'
      ? normalizeDateTimeLocalValue(parsed.form.endDateIso)
      : ''

    const currentStepValue = Number(parsed.currentStep ?? 1)
    return {
      id: 'local-browser-draft',
      title,
      endDateIso,
      currentStep: Number.isFinite(currentStepValue) ? Math.max(1, Math.floor(currentStepValue)) : 1,
    }
  }
  catch {
    return null
  }
}

export default function AdminCreateEventCalendar() {
  const router = useRouter()
  const [localDraft, setLocalDraft] = useState<LocalDraftSummary | null>(null)
  const [backendDrafts, setBackendDrafts] = useState<BackendDraftSummary[]>([])
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(true)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const [draftsDialogOpen, setDraftsDialogOpen] = useState(false)
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copySearch, setCopySearch] = useState('')
  const [copyResults, setCopyResults] = useState<AdminEventSearchResult[]>([])
  const [isSearchingCopy, setIsSearchingCopy] = useState(false)
  const latestCopySearchRequestIdRef = useRef(0)
  const [newEventDialogOpen, setNewEventDialogOpen] = useState(false)
  const [recurringWalletSetupDialogOpen, setRecurringWalletSetupDialogOpen] = useState(false)
  const [selectedStartAt, setSelectedStartAt] = useState('')
  const [serverSignerAvailability, setServerSignerAvailability] = useState<'loading' | 'available' | 'missing' | 'error'>('loading')

  useEffect(() => {
    setSelectedStartAt(buildDefaultStartAt(readCurrentTimeMs()))
  }, [])

  useEffect(() => {
    function syncDraft() {
      if (typeof window === 'undefined') {
        return
      }

      setLocalDraft(parseLocalDraft(window.localStorage.getItem(CREATE_EVENT_DRAFT_STORAGE_KEY)))
    }

    syncDraft()
    window.addEventListener('storage', syncDraft)

    return () => window.removeEventListener('storage', syncDraft)
  }, [])

  useEffect(() => {
    async function loadDrafts() {
      try {
        setIsLoadingDrafts(true)
        const response = await fetch('/admin/api/event-creations', {
          method: 'GET',
          cache: 'no-store',
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(typeof payload?.error === 'string' ? payload.error : 'Could not load drafts.')
        }

        const payload = await response.json().catch(() => null) as { data?: BackendDraftSummary[] } | null
        setBackendDrafts(Array.isArray(payload?.data) ? payload.data : [])
      }
      catch (error) {
        console.error('Failed to load event creation drafts', error)
        toast.error(error instanceof Error ? error.message : 'Could not load drafts.')
      }
      finally {
        setIsLoadingDrafts(false)
      }
    }

    void loadDrafts()
  }, [])

  useEffect(() => {
    let isActive = true

    void (async () => {
      try {
        setServerSignerAvailability('loading')
        const response = await fetch('/admin/api/event-creations/signers', {
          method: 'GET',
          cache: 'no-store',
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(typeof payload?.error === 'string' ? payload.error : 'Could not load server wallets.')
        }

        const payload = await response.json().catch(() => null) as { data?: Array<{ address: string }> } | null
        if (!isActive) {
          return
        }

        setServerSignerAvailability(Array.isArray(payload?.data) && payload.data.length > 0 ? 'available' : 'missing')
      }
      catch (error) {
        if (!isActive) {
          return
        }

        console.error('Failed to load event creation signers', error)
        setServerSignerAvailability('error')
        toast.error(error instanceof Error ? error.message : 'Could not load server wallets.')
      }
    })()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    latestCopySearchRequestIdRef.current += 1
    const requestId = latestCopySearchRequestIdRef.current
    const controller = new AbortController()

    if (!copyDialogOpen) {
      setIsSearchingCopy(false)
      return
    }

    const trimmedSearch = copySearch.trim()
    if (!trimmedSearch) {
      setCopyResults([])
      setIsSearchingCopy(false)
      return
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          setIsSearchingCopy(true)
          const query = new URLSearchParams({
            search: trimmedSearch,
            limit: '12',
            sortBy: 'updated_at',
            sortOrder: 'desc',
          })
          const response = await fetch(`/admin/api/events?${query.toString()}`, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
          })
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}))
            throw new Error(typeof payload?.error === 'string' ? payload.error : 'Could not search events.')
          }

          const payload = await response.json().catch(() => null) as {
            data?: AdminEventSearchResult[]
          } | null
          if (controller.signal.aborted || requestId !== latestCopySearchRequestIdRef.current) {
            return
          }
          setCopyResults(Array.isArray(payload?.data) ? payload.data : [])
        }
        catch (error) {
          if (controller.signal.aborted || requestId !== latestCopySearchRequestIdRef.current) {
            return
          }
          console.error('Failed to search events for copy', error)
          toast.error(error instanceof Error ? error.message : 'Could not search events.')
        }
        finally {
          if (requestId === latestCopySearchRequestIdRef.current) {
            setIsSearchingCopy(false)
          }
        }
      })()
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [copyDialogOpen, copySearch])

  const events: EventInput[] = [
    ...backendDrafts.flatMap((draft) => {
      const occurrences = expandEventCreationOccurrences({
        id: draft.id,
        title: draft.title,
        slug: draft.slug,
        titleTemplate: draft.titleTemplate,
        slugTemplate: draft.slugTemplate,
        startAt: draft.startAt || draft.updatedAt,
        status: draft.status,
        creationMode: draft.creationMode,
        recurrenceUnit: draft.recurrenceUnit,
        recurrenceInterval: draft.recurrenceInterval,
        recurrenceUntil: draft.recurrenceUntil,
        maxOccurrences: draft.creationMode === 'recurring' ? 10 : 1,
      })

      return occurrences.map((occurrence) => {
        const palette = occurrence.status === 'scheduled'
          ? {
              backgroundColor: 'hsl(var(--primary))',
              borderColor: 'hsl(var(--primary))',
              textColor: 'hsl(var(--primary-foreground))',
            }
          : occurrence.status === 'failed'
            ? {
                backgroundColor: 'hsl(var(--destructive))',
                borderColor: 'hsl(var(--destructive))',
                textColor: 'hsl(var(--destructive-foreground))',
              }
            : {
                backgroundColor: 'hsl(var(--secondary))',
                borderColor: 'hsl(var(--border))',
                textColor: 'hsl(var(--secondary-foreground))',
              }

        return {
          id: occurrence.id,
          title: occurrence.isRecurringInstance ? `${occurrence.title} · recurrence` : occurrence.title,
          start: occurrence.startAt,
          allDay: false,
          ...palette,
          extendedProps: {
            kind: 'backend-draft',
            draftId: draft.id,
          },
        } satisfies EventInput
      })
    }),
    ...(localDraft
      ? [
          {
            id: localDraft.id,
            title: localDraft.title,
            start: localDraft.endDateIso || selectedStartAt || undefined,
            allDay: !localDraft.endDateIso && !selectedStartAt,
            backgroundColor: 'hsl(var(--muted-foreground))',
            borderColor: 'hsl(var(--muted-foreground))',
            extendedProps: {
              kind: 'local-draft',
            },
          } satisfies EventInput,
        ]
      : []),
  ]

  function openNewEventDialog(startAt?: string) {
    setSelectedStartAt(startAt || buildDefaultStartAt(readCurrentTimeMs()))
    setNewEventDialogOpen(true)
  }

  function handleBlockedRecurringAccess() {
    if (serverSignerAvailability === 'loading') {
      toast.message('Checking server wallets...')
      return
    }

    if (serverSignerAvailability === 'error') {
      toast.error('Could not verify EVENT_CREATION_SIGNER_PRIVATE_KEYS right now.')
      return
    }

    setRecurringWalletSetupDialogOpen(true)
  }

  function openServerDraft(draftId: string, mode: CreationMode, startAt?: string | null) {
    if (mode === 'recurring' && serverSignerAvailability !== 'available') {
      handleBlockedRecurringAccess()
      return
    }

    const params = new URLSearchParams({
      draftId,
      mode,
    })
    if (startAt) {
      params.set('startAt', normalizeDateTimeLocalValue(startAt))
    }
    router.push(`/admin/create-event/new?${params.toString()}` as Route)
  }

  async function createDraftAndOpen(mode: CreationMode, startAt?: string, sourceEventId?: string) {
    if (mode === 'recurring' && serverSignerAvailability !== 'available') {
      handleBlockedRecurringAccess()
      return
    }

    try {
      setIsCreatingDraft(true)
      const normalizedStartAt = normalizeDateTimeLocalValue(startAt || selectedStartAt)
      const parsedStartAt = normalizedStartAt ? new Date(normalizedStartAt) : null
      const startAtIso = parsedStartAt && !Number.isNaN(parsedStartAt.getTime())
        ? parsedStartAt.toISOString()
        : null

      const response = await fetch('/admin/api/event-creations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          startAt: startAtIso,
          sourceEventId: sourceEventId ?? null,
        }),
      })

      const payload = await response.json().catch(() => null) as { data?: BackendDraftSummary, error?: string } | null
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || `Could not create draft (${response.status})`)
      }

      setBackendDrafts(previous => [payload.data!, ...previous.filter(item => item.id !== payload.data!.id)])
      setNewEventDialogOpen(false)
      setCopyDialogOpen(false)
      openServerDraft(payload.data.id, mode, normalizedStartAt)
    }
    catch (error) {
      console.error('Failed to create draft', error)
      toast.error(error instanceof Error ? error.message : 'Could not create draft.')
    }
    finally {
      setIsCreatingDraft(false)
    }
  }

  function handleResumeLocalDraft() {
    router.push('/admin/create-event/new?resume=local-draft' as Route)
  }

  function handleDateClick(info: DateClickArg) {
    openNewEventDialog(normalizeCalendarSelection(info.date, info.allDay))
  }

  function handleEventClick(info: EventClickArg) {
    const eventKind = info.event.extendedProps.kind

    if (eventKind === 'local-draft') {
      handleResumeLocalDraft()
      return
    }

    if (eventKind === 'backend-draft') {
      const draftId = typeof info.event.extendedProps.draftId === 'string'
        ? info.event.extendedProps.draftId
        : info.event.id
      const draft = backendDrafts.find(item => item.id === draftId)
      if (draft) {
        openServerDraft(draft.id, draft.creationMode, draft.startAt)
      }
    }
  }

  return (
    <>
      <section className="grid gap-4">
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold">Event Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Manage creation drafts from the calendar, then jump into the existing form for unique or recurring flows.
          </p>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 rounded-sm border bg-transparent p-4 shadow-none">
            <div data-create-event-calendar className="overflow-hidden">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                height="auto"
                selectable
                weekends
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,listMonth',
                }}
                buttonText={{
                  today: 'Today',
                  month: 'Month',
                  week: 'Week',
                  list: 'Agenda',
                }}
                events={events}
                dateClick={handleDateClick}
                select={selection => openNewEventDialog(normalizeCalendarSelection(selection.start, selection.allDay))}
                eventClick={handleEventClick}
                dayMaxEventRows={3}
                eventTimeFormat={{
                  hour: 'numeric',
                  minute: '2-digit',
                  meridiem: 'short',
                }}
              />
            </div>
          </div>

          <div className="grid content-start gap-4">
            <Card className="border bg-transparent shadow-none">
              <CardHeader className="pt-8 text-center">
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-center gap-3 pb-8">
                <Button type="button" className="w-full justify-center" onClick={() => openNewEventDialog()}>
                  <CalendarPlusIcon className="size-4" />
                  Create from scratch
                </Button>
                <Button type="button" variant="outline" className="w-full justify-center" onClick={() => setDraftsDialogOpen(true)}>
                  <ClipboardListIcon className="size-4" />
                  Open drafts
                </Button>
                <Button type="button" variant="outline" className="w-full justify-center" onClick={() => setCopyDialogOpen(true)}>
                  <CopyIcon className="size-4" />
                  Copy existing event
                </Button>
              </CardContent>
            </Card>

            <Card className="border bg-transparent shadow-none">
              <CardHeader className="pt-8 text-center">
                <CardTitle>Current Draft</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-center gap-3 pb-8 text-center">
                {localDraft
                  ? (
                      <>
                        <div className="grid gap-1">
                          <p className="font-medium text-foreground">{localDraft.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDraftDateLabel(localDraft.endDateIso)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Resumes at step
                            {' '}
                            {localDraft.currentStep}
                            .
                          </p>
                        </div>
                        <Button type="button" variant="outline" className="mx-auto" onClick={handleResumeLocalDraft}>
                          Resume Draft
                        </Button>
                      </>
                    )
                  : (
                      <p className="text-sm text-muted-foreground">
                        No browser draft found yet. Create a new event to start one.
                      </p>
                    )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Dialog open={newEventDialogOpen} onOpenChange={setNewEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>
              Selected slot:
              {' '}
              {formatStartAtLabel(selectedStartAt)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button
              type="button"
              className="h-auto justify-start py-3"
              disabled={isCreatingDraft}
              onClick={() => void createDraftAndOpen('single')}
            >
              <span className="text-left">
                <span className="block font-medium">Unique event</span>
                <span className="block text-xs text-primary-foreground/80">
                  Start with the current form for a one-off event.
                </span>
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto justify-start py-3"
              disabled={isCreatingDraft || serverSignerAvailability === 'loading'}
              onClick={() => {
                if (serverSignerAvailability === 'missing') {
                  handleBlockedRecurringAccess()
                  return
                }

                void createDraftAndOpen('recurring')
              }}
            >
              <span className="text-left">
                <span className="block font-medium">Recurring event</span>
                <span className="block text-xs text-muted-foreground">
                  Open the form as the base draft for a recurring schedule.
                </span>
              </span>
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setNewEventDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recurringWalletSetupDialogOpen} onOpenChange={setRecurringWalletSetupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Server Wallet Required</DialogTitle>
            <DialogDescription>
              Recurring events require adding the creator wallet private key to
              {' '}
              <code>EVENT_CREATION_SIGNER_PRIVATE_KEYS</code>
              {' '}
              in Vercel Environment Variables or your project&apos;s
              {' '}
              <code>.env</code>
              {' '}
              before you can create or edit recurring drafts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRecurringWalletSetupDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={draftsDialogOpen} onOpenChange={setDraftsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Drafts</DialogTitle>
            <DialogDescription>
              Resume a server draft or keep using the browser draft while autosave evolves.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {isLoadingDrafts && (
              <p className="text-sm text-muted-foreground">
                Loading drafts...
              </p>
            )}

            {!isLoadingDrafts && backendDrafts.map(draft => (
              <Card key={draft.id}>
                <CardHeader className="px-4">
                  <CardTitle className="text-base">{draft.title}</CardTitle>
                  <CardDescription>
                    {draft.startAt ? formatDraftDateLabel(draft.startAt) : 'No calendar slot yet'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openServerDraft(draft.id, draft.creationMode, draft.startAt)}
                  >
                    Resume Draft
                  </Button>
                </CardContent>
              </Card>
            ))}

            {localDraft && (
              <Card>
                <CardHeader className="px-4">
                  <CardTitle className="text-base">{localDraft.title}</CardTitle>
                  <CardDescription>{formatDraftDateLabel(localDraft.endDateIso)}</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <Button type="button" variant="outline" onClick={handleResumeLocalDraft}>
                    Resume Browser Draft
                  </Button>
                </CardContent>
              </Card>
            )}

            {!isLoadingDrafts && backendDrafts.length === 0 && !localDraft && (
              <p className="text-sm text-muted-foreground">
                No drafts available yet.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Existing Event</DialogTitle>
            <DialogDescription>
              Search an existing event and generate a new draft from it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              value={copySearch}
              onChange={event => setCopySearch(event.target.value)}
              placeholder="Search by title or slug"
            />

            {isSearchingCopy && (
              <p className="text-sm text-muted-foreground">
                Searching...
              </p>
            )}

            {!isSearchingCopy && copySearch.trim() && copyResults.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No events found.
              </p>
            )}

            {!isSearchingCopy && copyResults.length > 0 && (
              <div className="grid max-h-[320px] gap-3 overflow-y-auto pr-1">
                {copyResults.map((result) => {
                  const eventIconUrl = result.icon_url?.trim() || ''

                  return (
                    <Card key={result.id}>
                      <CardHeader className="px-4">
                        <div className="flex items-center gap-3">
                          {eventIconUrl
                            ? (
                                <EventIconImage
                                  src={eventIconUrl}
                                  alt={result.title}
                                  sizes="56px"
                                  containerClassName="size-14 rounded-lg border"
                                />
                              )
                            : (
                                <div className={COPY_EVENT_FALLBACK_ICON_CLASS_NAME}>
                                  <ImageIcon className="size-5" />
                                </div>
                              )}
                          <div className="min-w-0">
                            <CardTitle className="truncate text-base">{result.title}</CardTitle>
                            <CardDescription>
                              {result.end_date ? formatDraftDateLabel(result.end_date) : result.slug}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-4">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isCreatingDraft}
                          onClick={() => void createDraftAndOpen('single', result.end_date ?? undefined, result.id)}
                        >
                          Copy to Draft
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <style jsx global>
        {`
        [data-create-event-calendar] .fc {
          --fc-border-color: color-mix(in srgb, currentColor 12%, transparent);
          --fc-button-bg-color: hsl(var(--secondary));
          --fc-button-border-color: hsl(var(--border));
          --fc-button-text-color: hsl(var(--secondary-foreground));
          --fc-button-hover-bg-color: hsl(var(--accent));
          --fc-button-hover-border-color: hsl(var(--border));
          --fc-button-active-bg-color: hsl(var(--primary));
          --fc-button-active-border-color: hsl(var(--primary));
          --fc-event-bg-color: hsl(var(--primary));
          --fc-event-border-color: hsl(var(--primary));
          --fc-event-text-color: hsl(var(--primary-foreground));
          --fc-page-bg-color: transparent;
          --fc-neutral-bg-color: transparent;
          --fc-list-event-hover-bg-color: hsl(var(--accent));
        }

        [data-create-event-calendar] .fc .fc-toolbar {
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        [data-create-event-calendar] .fc .fc-toolbar.fc-header-toolbar {
          flex-wrap: wrap;
        }

        [data-create-event-calendar] .fc .fc-toolbar-title {
          font-size: 1.1rem;
          font-weight: 600;
        }

        [data-create-event-calendar] .fc .fc-button {
          border-radius: 0.35rem;
          box-shadow: none;
          font-weight: 500;
          min-height: 2.25rem;
          text-transform: none;
        }
        [data-create-event-calendar] .fc .fc-daygrid-day-frame,
        [data-create-event-calendar] .fc .fc-timegrid-slot {
          cursor: pointer;
        }

        [data-create-event-calendar] .fc .fc-event {
          border-radius: 0.35rem;
          padding: 0.1rem 0.2rem;
        }

        [data-create-event-calendar] .fc .fc-col-header-cell-cushion,
        [data-create-event-calendar] .fc .fc-daygrid-day-number {
          padding: 0.5rem;
        }

        [data-create-event-calendar] .fc .fc-list-empty {
          background: transparent;
        }
      `}
      </style>
    </>
  )
}
