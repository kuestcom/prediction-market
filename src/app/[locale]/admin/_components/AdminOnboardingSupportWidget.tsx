'use client'

import type { Route } from 'next'
import type { AdminOnboardingTaskId, KuestSupportPosition } from '@/lib/admin-support-settings'
import { CheckIcon, ChevronLeftIcon, HeadphonesIcon, ListChecksIcon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  createAdminSupportContextAction,
  dismissSupportAnnouncementAction,
  updateAdminOnboardingTaskAction,
} from '@/app/[locale]/admin/_actions/update-admin-support'
import AdminSupportInvoicePaymentHandler from '@/app/[locale]/admin/_components/AdminSupportInvoicePaymentHandler'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

const SUPPORT_ORIGIN = 'https://chat.kuest.com'
const ONBOARDING_OPEN_COUNT_KEY = 'kuest.admin.onboarding.open-count.v1'
const AUTO_OPEN_LIMIT = 3

type WidgetView = 'onboarding' | 'support'

interface AdminOnboardingSupportWidgetProps {
  announcementDismissedAt: string | null
  initialCompletedTasks: AdminOnboardingTaskId[]
  position: KuestSupportPosition
}

interface SupportAnnouncement {
  body: string
  id: number
  publishedAt: string
}

interface SupportUnreadMessage {
  body: string
  id: number
}

export default function AdminOnboardingSupportWidget({
  announcementDismissedAt: initialAnnouncementDismissedAt,
  initialCompletedTasks,
  position,
}: AdminOnboardingSupportWidgetProps) {
  const t = useExtracted()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const notificationAudioRef = useRef<AudioContext | null>(null)
  const lastNotificationSoundAtRef = useRef(0)
  const hasInitializedWidgetRef = useRef(false)
  const pendingTaskIdsRef = useRef(new Set<AdminOnboardingTaskId>())
  const [completedTasks, setCompletedTasks] = useState(
    () => new Set<AdminOnboardingTaskId>(initialCompletedTasks),
  )
  const [announcementDismissedAt, setAnnouncementDismissedAt] = useState(initialAnnouncementDismissedAt)
  const [announcement, setAnnouncement] = useState<SupportAnnouncement | null>(null)
  const [hasOpenedSupport, setHasOpenedSupport] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [supportBlocked, setSupportBlocked] = useState(false)
  const [unreadMessage, setUnreadMessage] = useState<SupportUnreadMessage | null>(null)
  const [visitorEoa, setVisitorEoa] = useState<string | null>(null)
  const [view, setView] = useState<WidgetView>('onboarding')
  const [, startSaving] = useTransition()

  const tasks = useMemo(() => [
    {
      id: 'brand' as const,
      href: '/admin/general#theme-site-name' as Route,
      label: t({
        id: 'adminOnboarding.customizeBrand',
        message: 'Set site name & logo',
      }),
      external: false,
    },
    {
      id: 'fee-wallet' as const,
      href: '/admin/affiliate#fee_recipient_wallet' as Route,
      label: t({
        id: 'adminOnboarding.addFeeWallet',
        message: 'Add your wallet to receive fees',
      }),
      external: false,
    },
    {
      id: 'openrouter' as const,
      href: '/admin/integrations#openrouter' as Route,
      label: t({
        id: 'adminOnboarding.configureOpenRouter',
        message: 'Connect OpenRouter for AI',
      }),
      external: false,
    },
    {
      id: 'endpoints' as const,
      href: 'https://docs.kuest.com/configuration/custom-domain',
      label: t({
        id: 'adminOnboarding.customizeEndpoints',
        message: 'Customize endpoints (optional)',
      }),
      external: true,
    },
  ], [t])

  const isComplete = completedTasks.size === tasks.length

  const initializeWidget = useCallback((element: HTMLElement | null) => {
    if (!element || hasInitializedWidgetRef.current) {
      return
    }

    hasInitializedWidgetRef.current = true
    if (isComplete) {
      return
    }

    try {
      const openCount = Number.parseInt(window.localStorage.getItem(ONBOARDING_OPEN_COUNT_KEY) ?? '0', 10)
      if (!Number.isFinite(openCount) || openCount < AUTO_OPEN_LIMIT) {
        setIsOpen(true)
        window.localStorage.setItem(
          ONBOARDING_OPEN_COUNT_KEY,
          String(Number.isFinite(openCount) ? openCount + 1 : 1),
        )
      }
    }
    catch {
      setIsOpen(true)
    }
  }, [isComplete])

  useEffect(function synchronizeSupportAnnouncement() {
    let cancelled = false

    async function loadAnnouncement() {
      try {
        const response = await fetch(`${SUPPORT_ORIGIN}/api/announcement`, {
          cache: 'no-store',
        })
        const payload: unknown = await response.json()
        if (
          !response.ok
          || !payload
          || typeof payload !== 'object'
          || Array.isArray(payload)
        ) {
          return
        }

        const value = (payload as { announcement?: unknown }).announcement
        if (value === null) {
          if (!cancelled) {
            setAnnouncement(null)
          }
          return
        }
        if (
          !value
          || typeof value !== 'object'
          || Array.isArray(value)
        ) {
          return
        }

        const candidate = value as Record<string, unknown>
        if (
          typeof candidate.id !== 'number'
          || typeof candidate.body !== 'string'
          || typeof candidate.publishedAt !== 'string'
          || !Number.isFinite(Date.parse(candidate.publishedAt))
        ) {
          return
        }

        const publishedAt = new Date(candidate.publishedAt).toISOString()
        const dismissedAt = announcementDismissedAt
          ? Date.parse(announcementDismissedAt)
          : Number.NaN
        if (!cancelled) {
          setAnnouncement(
            Number.isFinite(dismissedAt) && Date.parse(publishedAt) <= dismissedAt
              ? null
              : {
                  body: candidate.body,
                  id: candidate.id,
                  publishedAt,
                },
          )
        }
      }
      catch {
        // Announcements must never block onboarding or support.
      }
    }

    void loadAnnouncement()
    const interval = window.setInterval(() => {
      void loadAnnouncement()
    }, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [announcementDismissedAt])

  useEffect(function subscribeToSupportMessages() {
    function receiveSupportMessage(event: MessageEvent<unknown>) {
      if (
        event.origin !== SUPPORT_ORIGIN
        || event.source !== iframeRef.current?.contentWindow
        || !event.data
        || typeof event.data !== 'object'
        || Array.isArray(event.data)
      ) {
        return
      }

      const payload = event.data as Record<string, unknown>
      if (payload.type === 'kuest-support-blocked') {
        setSupportBlocked(true)
        return
      }
      if (
        payload.type !== 'kuest-support-new-message'
        || !payload.message
        || typeof payload.message !== 'object'
        || Array.isArray(payload.message)
      ) {
        return
      }

      const message = payload.message as Record<string, unknown>
      if (
        typeof message.id !== 'number'
        || !Number.isSafeInteger(message.id)
        || message.id <= 0
        || typeof message.body !== 'string'
        || message.body.length > 3000
      ) {
        return
      }

      playNotificationSound()
      if (!isOpen || view !== 'support') {
        setUnreadMessage({
          body: message.body,
          id: message.id,
        })
      }
    }

    window.addEventListener('message', receiveSupportMessage)
    return () => window.removeEventListener('message', receiveSupportMessage)
  }, [isOpen, view])

  useEffect(function closeNotificationAudioOnUnmount() {
    return () => {
      void notificationAudioRef.current?.close()
    }
  }, [])

  function saveTask(
    taskId: AdminOnboardingTaskId,
    completed: boolean,
    previousCompleted: boolean,
  ) {
    pendingTaskIdsRef.current.add(taskId)
    startSaving(async () => {
      try {
        await updateAdminOnboardingTaskAction(taskId, completed)
      }
      catch {
        setCompletedTasks((current) => {
          const restored = new Set(current)
          if (previousCompleted) {
            restored.add(taskId)
          }
          else {
            restored.delete(taskId)
          }
          return restored
        })
        toast.error(t({
          id: 'IULR3V',
          message: 'An unexpected error occurred. Please try again.',
        }))
      }
      finally {
        pendingTaskIdsRef.current.delete(taskId)
      }
    })
  }

  function markTaskCompleted(taskId: AdminOnboardingTaskId) {
    if (completedTasks.has(taskId) || pendingTaskIdsRef.current.has(taskId)) {
      return
    }

    const next = new Set(completedTasks)
    next.add(taskId)
    setCompletedTasks(next)
    saveTask(taskId, true, false)
  }

  function toggleTask(taskId: AdminOnboardingTaskId) {
    if (pendingTaskIdsRef.current.has(taskId)) {
      return
    }

    const next = new Set(completedTasks)
    const previousCompleted = next.has(taskId)
    const completed = !previousCompleted
    if (completed) {
      next.add(taskId)
    }
    else {
      next.delete(taskId)
    }
    setCompletedTasks(next)
    saveTask(taskId, completed, previousCompleted)
  }

  function openWidget() {
    void unlockNotificationSound()
    if (unreadMessage || isComplete) {
      openSupport()
      return
    }

    setView('onboarding')
    setIsOpen(true)
  }

  async function unlockNotificationSound() {
    try {
      notificationAudioRef.current ??= new AudioContext()
      if (notificationAudioRef.current.state === 'suspended') {
        await notificationAudioRef.current.resume()
      }
    }
    catch {
      // Browsers can deny audio before a user gesture; unread UI remains available.
    }
  }

  function playNotificationSound() {
    const audio = notificationAudioRef.current
    const now = Date.now()
    if (!audio || audio.state !== 'running' || now - lastNotificationSoundAtRef.current < 750) {
      return
    }

    lastNotificationSoundAtRef.current = now
    const gain = audio.createGain()
    const firstTone = audio.createOscillator()
    const secondTone = audio.createOscillator()
    const startAt = audio.currentTime

    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.32)
    firstTone.frequency.setValueAtTime(660, startAt)
    secondTone.frequency.setValueAtTime(880, startAt + 0.12)
    firstTone.connect(gain)
    secondTone.connect(gain)
    gain.connect(audio.destination)
    firstTone.start(startAt)
    firstTone.stop(startAt + 0.18)
    secondTone.start(startAt + 0.12)
    secondTone.stop(startAt + 0.32)
  }

  function openSupport() {
    void unlockNotificationSound()
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'kuest-support-interaction' },
      SUPPORT_ORIGIN,
    )
    setHasOpenedSupport(true)
    setUnreadMessage(null)
    setView('support')
    setIsOpen(true)
  }

  function dismissAnnouncement() {
    if (!announcement) {
      return
    }

    const dismissedAnnouncement = announcement
    const previousDismissedAt = announcementDismissedAt
    const publishedAt = announcement.publishedAt
    setAnnouncement(null)
    setAnnouncementDismissedAt(publishedAt)
    startSaving(async () => {
      try {
        await dismissSupportAnnouncementAction(publishedAt)
      }
      catch {
        setAnnouncement(current => current ?? dismissedAnnouncement)
        setAnnouncementDismissedAt(current => current === publishedAt ? previousDismissedAt : current)
        toast.error(t({
          id: 'IULR3V',
          message: 'An unexpected error occurred. Please try again.',
        }))
      }
    })
  }

  async function sendSupportContext() {
    try {
      const result = await createAdminSupportContextAction()
      setVisitorEoa(result.context.visitorEoa)
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'kuest-support-context',
          context: {
            ...result.context,
            supportAssertion: result.assertion,
          },
        },
        SUPPORT_ORIGIN,
      )
    }
    catch (error) {
      console.error('Could not initialize Kuest Support.', error)
    }
  }

  if (supportBlocked) {
    return null
  }

  return (
    <aside
      ref={initializeWidget}
      className={cn(
        'fixed bottom-4 z-60 flex max-w-[calc(100vw-2rem)] flex-col sm:bottom-6',
        position === 'right'
          ? 'right-4 items-end sm:right-6'
          : 'left-4 items-start sm:left-6',
      )}
    >
      {unreadMessage && !isOpen && (
        <>
          <span className="sr-only" role="status" aria-live="polite">
            {t({ id: 'adminOnboarding.newSupportReply', message: 'New support reply' })}
          </span>
          <button
            type="button"
            onClick={openSupport}
            className="
              relative mb-3 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-foreground bg-foreground px-4 py-3
              text-left text-background shadow-xl shadow-foreground/20
            "
          >
            <span className="block text-xs font-semibold">
              {t({ id: 'adminOnboarding.newSupportReply', message: 'New support reply' })}
            </span>
            <span className="mt-1 line-clamp-2 block text-xs/relaxed text-background/75">
              {unreadMessage.body}
            </span>
            <span
              className={cn(
                'absolute -bottom-1.5 size-3 rotate-45 bg-foreground',
                position === 'right' ? 'right-5' : 'left-5',
              )}
              aria-hidden
            />
          </button>
        </>
      )}

      {announcement && !isOpen && !unreadMessage && (
        <div
          className="
            relative mb-3 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-foreground bg-foreground px-4 py-3
            pr-10 text-left text-background shadow-xl shadow-foreground/20
          "
          role="status"
        >
          <button
            type="button"
            onClick={dismissAnnouncement}
            aria-label={t({ id: 'adminOnboarding.dismissAnnouncement', message: 'Dismiss message' })}
            className="
              absolute top-2 right-2 grid size-7 place-items-center rounded-full text-background/65 transition-colors
              hover:bg-background/10 hover:text-background
            "
          >
            <XIcon className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={openSupport}
            className="block w-full text-left"
          >
            <span className="block text-xs font-semibold text-background">
              {t({ id: 'adminOnboarding.announcementTitle', message: 'Kuest Message' })}
            </span>
            <span className="mt-1 block text-xs/relaxed text-background/75">
              {announcement.body}
            </span>
          </button>
          <span
            className={cn(
              'absolute -bottom-1.5 size-3 rotate-45 bg-foreground',
              position === 'right' ? 'right-5' : 'left-5',
            )}
            aria-hidden
          />
        </div>
      )}

      {(isOpen || hasOpenedSupport) && (
        <div
          className={cn(
            `
              mb-3 overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl shadow-foreground/10
              transition-[width,height,opacity] duration-200
            `,
            view === 'support'
              ? 'h-[min(42rem,calc(100vh-7rem))] w-[min(26rem,calc(100vw-2rem))]'
              : 'w-[min(21rem,calc(100vw-2rem))]',
            !isOpen && 'pointer-events-none invisible absolute bottom-12 opacity-0',
          )}
        >
          {view === 'onboarding' && (
            <>
              <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t({ id: 'adminOnboarding.title', message: 'Onboarding' })}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {completedTasks.size}
                    /
                    {tasks.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label={t({ id: 'adminOnboarding.close', message: 'Close' })}
                  className="
                    grid size-8 place-items-center rounded-full text-muted-foreground transition-colors
                    hover:bg-muted hover:text-foreground
                  "
                >
                  <XIcon className="size-4" aria-hidden />
                </button>
              </div>

              <div className="px-2 pb-2">
                {tasks.map(task => (
                  <div key={task.id} className="flex min-h-11 items-center gap-2 rounded-xl px-2 hover:bg-muted/55">
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      aria-label={task.label}
                      aria-pressed={completedTasks.has(task.id)}
                      className={cn(
                        `
                          grid size-5 shrink-0 place-items-center rounded-full border text-white transition-colors
                          focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                          focus-visible:outline-none
                        `,
                        completedTasks.has(task.id)
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-border bg-transparent',
                      )}
                    >
                      {completedTasks.has(task.id) && <CheckIcon className="size-3.5 stroke-3" aria-hidden />}
                    </button>

                    {task.external
                      ? (
                          <a
                            href={task.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => markTaskCompleted(task.id)}
                            className="min-w-0 flex-1 py-2 text-sm text-foreground"
                          >
                            {task.label}
                          </a>
                        )
                      : (
                          <Link
                            href={task.href}
                            onClick={() => markTaskCompleted(task.id)}
                            className="min-w-0 flex-1 py-2 text-sm text-foreground"
                          >
                            {task.label}
                          </Link>
                        )}
                  </div>
                ))}
              </div>

              <div className="border-t px-4 py-3">
                <button
                  type="button"
                  onClick={openSupport}
                  className="
                    flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium
                    text-foreground transition-colors
                    hover:bg-muted
                  "
                >
                  <HeadphonesIcon className="size-4 text-muted-foreground" aria-hidden />
                  {t({ id: 'adminOnboarding.kuestSupport', message: 'Kuest Support' })}
                </button>
              </div>
            </>
          )}
          {hasOpenedSupport && (
            <div
              className={cn(
                'h-full min-h-0 flex-col',
                view === 'support'
                  ? 'flex'
                  : 'pointer-events-none invisible absolute inset-0 flex',
              )}
            >
              <div className="flex h-13 shrink-0 items-center justify-between border-b px-3">
                {!isComplete
                  ? (
                      <button
                        type="button"
                        onClick={() => setView('onboarding')}
                        aria-label={t({ id: 'adminOnboarding.back', message: 'Back' })}
                        className="
                          grid size-8 place-items-center rounded-full text-muted-foreground transition-colors
                          hover:bg-muted hover:text-foreground
                        "
                      >
                        <ChevronLeftIcon className="size-4" aria-hidden />
                      </button>
                    )
                  : <span className="size-8" aria-hidden />}
                <p className="text-sm font-semibold text-foreground">
                  {t({ id: 'adminOnboarding.kuestSupport', message: 'Kuest Support' })}
                </p>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label={t({ id: 'adminOnboarding.close', message: 'Close' })}
                  className="
                    grid size-8 place-items-center rounded-full text-muted-foreground transition-colors
                    hover:bg-muted hover:text-foreground
                  "
                >
                  <XIcon className="size-4" aria-hidden />
                </button>
              </div>
              <iframe
                ref={iframeRef}
                src={`${SUPPORT_ORIGIN}/embed`}
                title={t({ id: 'adminOnboarding.supportChat', message: 'Support chat' })}
                onLoad={() => {
                  void sendSupportContext()
                }}
                className="min-h-0 flex-1 border-0 bg-background"
              />
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={isOpen ? () => setIsOpen(false) : openWidget}
        aria-label={isComplete
          ? t({ id: 'adminOnboarding.kuestSupport', message: 'Kuest Support' })
          : t({ id: 'adminOnboarding.title', message: 'Onboarding' })}
        className={cn(
          `
            grid size-12 place-items-center rounded-full border border-border/60 bg-foreground text-background shadow-lg
            shadow-foreground/15 transition-transform
            hover:scale-105
            focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none
          `,
          unreadMessage && !isOpen && 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-background',
        )}
      >
        {isComplete
          ? <HeadphonesIcon className="size-5" aria-hidden />
          : <ListChecksIcon className="size-5" aria-hidden />}
      </button>
      <AdminSupportInvoicePaymentHandler iframeRef={iframeRef} visitorEoa={visitorEoa} />
    </aside>
  )
}
