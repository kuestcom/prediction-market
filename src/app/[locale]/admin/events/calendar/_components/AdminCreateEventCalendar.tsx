'use client'

import type { EventClickArg, EventInput } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { Route } from 'next'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { CalendarPlusIcon, ClipboardListIcon, CopyIcon, ImageIcon, SquarePenIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'
import EventIconImage from '@/components/EventIconImage'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'

const COPY_EVENT_FALLBACK_ICON_CLASS_NAME = 'flex size-14 items-center justify-center rounded-lg border text-muted-foreground'

type CreationMode = 'single' | 'recurring'

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
  imageUrl: string | null
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

function isPastCreationResolutionDate(value: string | null | undefined) {
  const normalized = normalizeDateTimeLocalValue(value ?? '')
  if (!normalized) {
    return false
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    return false
  }

  const now = readCurrentTimeMs() || Date.now()
  return parsed.getTime() <= now
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

function getDraftDisplayTitle(draft: Pick<BackendDraftSummary, 'title' | 'titleTemplate'>) {
  return draft.title.trim() || draft.titleTemplate?.trim() || 'Draft without title'
}

function getDraftModeLabel(mode: CreationMode) {
  return mode === 'recurring' ? 'Recurring' : 'Single'
}

function useCreateEventCalendarState() {
  const router = useRouter()
  const [backendDrafts, setBackendDrafts] = useState<BackendDraftSummary[]>([])
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(true)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const [draftsDialogOpen, setDraftsDialogOpen] = useState(false)
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copySearch, setCopySearch] = useState('')
  const [copyResults, setCopyResults] = useReducer(
    (_current: AdminEventSearchResult[], next: AdminEventSearchResult[]) => next,
    [],
  )
  const [isSearchingCopy, setIsSearchingCopy] = useReducer(
    (_current: boolean, next: boolean) => next,
    false,
  )
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null)
  const latestCopySearchRequestIdRef = useRef(0)
  const [newEventDialogOpen, setNewEventDialogOpen] = useState(false)
  const [recurringWalletSetupDialogOpen, setRecurringWalletSetupDialogOpen] = useState(false)
  const [selectedStartAt, setSelectedStartAt] = useState(() => buildDefaultStartAt(readCurrentTimeMs()))
  const [serverSignerAvailability, setServerSignerAvailability] = useState<'loading' | 'available' | 'missing' | 'error'>('loading')

  useEffect(function loadDraftsOnMount() {
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

  useEffect(function loadServerSignersOnMount() {
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

    return function cancelSignersFetch() {
      isActive = false
    }
  }, [])

  useEffect(function searchCopyEventsOnChange() {
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

    return function cancelCopySearch() {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [copyDialogOpen, copySearch])

  return {
    router,
    backendDrafts,
    setBackendDrafts,
    isLoadingDrafts,
    isCreatingDraft,
    setIsCreatingDraft,
    draftsDialogOpen,
    setDraftsDialogOpen,
    copyDialogOpen,
    setCopyDialogOpen,
    copySearch,
    setCopySearch,
    copyResults,
    isSearchingCopy,
    deletingDraftId,
    setDeletingDraftId,
    newEventDialogOpen,
    setNewEventDialogOpen,
    recurringWalletSetupDialogOpen,
    setRecurringWalletSetupDialogOpen,
    selectedStartAt,
    setSelectedStartAt,
    serverSignerAvailability,
  }
}

export default function AdminCreateEventCalendar() {
  const {
    router,
    backendDrafts,
    setBackendDrafts,
    isLoadingDrafts,
    isCreatingDraft,
    setIsCreatingDraft,
    draftsDialogOpen,
    setDraftsDialogOpen,
    copyDialogOpen,
    setCopyDialogOpen,
    copySearch,
    setCopySearch,
    copyResults,
    isSearchingCopy,
    deletingDraftId,
    setDeletingDraftId,
    newEventDialogOpen,
    setNewEventDialogOpen,
    recurringWalletSetupDialogOpen,
    setRecurringWalletSetupDialogOpen,
    selectedStartAt,
    setSelectedStartAt,
    serverSignerAvailability,
  } = useCreateEventCalendarState()

  const events: EventInput[] = backendDrafts.flatMap((draft) => {
    const displayTitle = getDraftDisplayTitle(draft)
    const occurrences = expandEventCreationOccurrences({
      id: draft.id,
      title: draft.title || displayTitle,
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
        title: occurrence.isRecurringInstance
          ? `${occurrence.title || displayTitle} · recurrence`
          : (occurrence.title || displayTitle),
        start: occurrence.startAt,
        allDay: false,
        ...palette,
        extendedProps: {
          kind: 'backend-draft',
          draftId: draft.id,
        },
      } satisfies EventInput
    })
  })

  function openNewEventDialog(startAt?: string) {
    const nextStartAt = startAt || buildDefaultStartAt(readCurrentTimeMs())
    if (startAt && isPastCreationResolutionDate(nextStartAt)) {
      toast.error('Select a future resolution date to create a new event.')
      return
    }

    setSelectedStartAt(nextStartAt)
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
      edit: '1',
    })
    if (startAt) {
      params.set('startAt', normalizeDateTimeLocalValue(startAt))
    }
    router.push(`/admin/events/calendar/new?${params.toString()}` as Route)
  }

  async function createDraftAndOpen(mode: CreationMode, startAt?: string, sourceEventId?: string) {
    if (mode === 'recurring' && serverSignerAvailability !== 'available') {
      handleBlockedRecurringAccess()
      return
    }

    const normalizedStartAt = normalizeDateTimeLocalValue(startAt || selectedStartAt)
    if (!sourceEventId && isPastCreationResolutionDate(normalizedStartAt)) {
      toast.error('Select a future resolution date to create a new event.')
      return
    }

    try {
      setIsCreatingDraft(true)
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

  async function handleDeleteBackendDraft(draftId: string) {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && !window.confirm('Delete this draft?')) {
      return
    }

    try {
      setDeletingDraftId(draftId)
      const response = await fetch(`/admin/api/event-creations/${draftId}`, {
        method: 'DELETE',
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error || `Could not delete draft (${response.status})`)
      }

      setBackendDrafts(previous => previous.filter(item => item.id !== draftId))
      toast.success('Draft deleted.')
    }
    catch (error) {
      console.error('Failed to delete event creation draft', error)
      toast.error(error instanceof Error ? error.message : 'Could not delete draft.')
    }
    finally {
      setDeletingDraftId(null)
    }
  }

  function handleDateClick(info: DateClickArg) {
    openNewEventDialog(normalizeCalendarSelection(info.date, info.allDay))
  }

  function handleEventClick(info: EventClickArg) {
    const eventKind = info.event.extendedProps.kind

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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid gap-2">
            <h1 className="text-2xl font-semibold">Event Calendar</h1>
            <p className="text-sm text-muted-foreground">
              Manage, schedule, and create your own events.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button type="button" className="justify-center" onClick={() => openNewEventDialog()}>
              <CalendarPlusIcon className="size-4" />
              New
            </Button>
            <Button type="button" variant="outline" className="justify-center" onClick={() => setDraftsDialogOpen(true)}>
              <ClipboardListIcon className="size-4" />
              Drafts
            </Button>
            <Button type="button" variant="outline" className="justify-center" onClick={() => setCopyDialogOpen(true)}>
              <CopyIcon className="size-4" />
              Clone
            </Button>
          </div>
        </div>

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
              eventDidMount={(info) => {
                const fullLabel = info.timeText
                  ? `${info.timeText} ${info.event.title}`
                  : info.event.title
                info.el.setAttribute('title', fullLabel)
              }}
              dayMaxEventRows={3}
              eventTimeFormat={{
                hour: 'numeric',
                minute: '2-digit',
                meridiem: 'short',
              }}
            />
          </div>
        </div>
      </section>

      <Dialog open={newEventDialogOpen} onOpenChange={setNewEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>
              Selected resolution date:
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
                  Use this date as the resolution date for a one-off event.
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
                  Use this date as the first resolution date for the recurring schedule.
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Drafts</DialogTitle>
            <DialogDescription>
              Resume or delete saved drafts.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {isLoadingDrafts && (
              <p className="text-sm text-muted-foreground">
                Loading drafts...
              </p>
            )}

            {!isLoadingDrafts && (
              <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1">
                {backendDrafts.map((draft) => {
                  const displayTitle = getDraftDisplayTitle(draft)

                  return (
                    <Card key={draft.id} className="border bg-transparent shadow-none">
                      <CardContent className="flex items-center gap-3 p-3">
                        {draft.imageUrl
                          ? (
                              <EventIconImage
                                src={draft.imageUrl}
                                alt={displayTitle}
                                sizes="56px"
                                containerClassName="size-14 shrink-0 rounded-lg border"
                              />
                            )
                          : (
                              <div className={COPY_EVENT_FALLBACK_ICON_CLASS_NAME}>
                                <ImageIcon className="size-5" />
                              </div>
                            )}

                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="truncate font-medium text-foreground">{displayTitle}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{draft.startAt ? formatDraftDateLabel(draft.startAt) : 'No calendar slot yet'}</span>
                            <span className="rounded-sm border border-border/70 px-1.5 py-0.5">
                              {getDraftModeLabel(draft.creationMode)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="rounded-md"
                            aria-label="Edit draft"
                            onClick={() => openServerDraft(draft.id, draft.creationMode, draft.startAt)}
                          >
                            <SquarePenIcon className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="rounded-md text-destructive hover:text-destructive"
                            aria-label="Delete draft"
                            disabled={deletingDraftId === draft.id}
                            onClick={() => void handleDeleteBackendDraft(draft.id)}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {!isLoadingDrafts && backendDrafts.length === 0 && (
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
            <DialogTitle>Clone Existing Event</DialogTitle>
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
              <div className="grid max-h-[280px] gap-2 overflow-y-auto pr-1">
                {copyResults.map((result) => {
                  const eventIconUrl = result.icon_url?.trim() || ''

                  return (
                    <Card key={result.id} className="border bg-transparent shadow-none">
                      <CardContent className="flex items-center gap-3 p-3">
                        <div className="shrink-0">
                          {eventIconUrl
                            ? (
                                <EventIconImage
                                  src={eventIconUrl}
                                  alt={result.title}
                                  sizes="48px"
                                  containerClassName="size-12 rounded-lg border"
                                />
                              )
                            : (
                                <div className={cn(`
                                  flex size-12 items-center justify-center rounded-lg border text-muted-foreground
                                `)}
                                >
                                  <ImageIcon className="size-5" />
                                </div>
                              )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="truncate text-sm font-medium text-foreground" title={result.title}>
                            {result.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {result.end_date ? formatDraftDateLabel(result.end_date) : result.slug}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="rounded-md"
                          aria-label="Clone event into draft"
                          disabled={isCreatingDraft}
                          onClick={() => void createDraftAndOpen('single', result.end_date ?? undefined, result.id)}
                        >
                          <CopyIcon className="size-4" />
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

        [data-create-event-calendar] .fc .fc-daygrid-event {
          font-size: 0.625rem;
        }

        [data-create-event-calendar] .fc .fc-daygrid-event .fc-event-time {
          display: none;
        }

        [data-create-event-calendar] .fc .fc-daygrid-event .fc-event-title {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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
