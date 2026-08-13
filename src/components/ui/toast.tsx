'use client'

import type { ReactNode } from 'react'

import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type ToastType = 'default' | 'success' | 'info' | 'warning' | 'error' | 'loading'
type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

interface ToastData {
  actionControl?: 'button' | 'switch'
  actionOnClick?: () => void
  content?: ReactNode
  icon?: ReactNode
  image?: ReactNode
  onClick?: () => void
}

interface ToastActionOptions {
  control?: 'button' | 'switch'
  label: ReactNode
  onClick: () => void
}

interface ToastOptions {
  action?: ToastActionOptions
  content?: ReactNode
  description?: ReactNode
  duration?: number
  icon?: ReactNode
  id?: number | string
  image?: ReactNode
  onClick?: () => void
}

interface ToastFunction {
  (title: ReactNode, options?: ToastOptions): string
  close(id?: number | string): void
  dismiss(id?: number | string): void
  error(title: ReactNode, options?: ToastOptions): string
  info(title: ReactNode, options?: ToastOptions): string
  loading(title: ReactNode, options?: ToastOptions): string
  message(title: ReactNode, options?: ToastOptions): string
  success(title: ReactNode, options?: ToastOptions): string
  warning(title: ReactNode, options?: ToastOptions): string
}

const toastManager = ToastPrimitive.createToastManager<ToastData>()

function showToast(type: ToastType, title: ReactNode, options: ToastOptions = {}) {
  const { action, content, description, duration, icon, id, image, onClick } = options

  return toastManager.add({
    actionProps: action
      ? {
          children: action.label,
          onClick: action.onClick,
        }
      : undefined,
    data: { actionControl: action?.control, actionOnClick: action?.onClick, content, icon, image, onClick },
    description,
    id: id === undefined ? undefined : String(id),
    priority: type === 'error' || type === 'warning' ? 'high' : 'low',
    timeout: duration,
    title,
    type,
  })
}

const toast = Object.assign((title: ReactNode, options?: ToastOptions) => showToast('default', title, options), {
  close: (id?: number | string) => toastManager.close(id === undefined ? undefined : String(id)),
  dismiss: (id?: number | string) => toastManager.close(id === undefined ? undefined : String(id)),
  error: (title: ReactNode, options?: ToastOptions) => showToast('error', title, options),
  info: (title: ReactNode, options?: ToastOptions) => showToast('info', title, options),
  loading: (title: ReactNode, options?: ToastOptions) => showToast('loading', title, options),
  message: (title: ReactNode, options?: ToastOptions) => showToast('default', title, options),
  success: (title: ReactNode, options?: ToastOptions) => showToast('success', title, options),
  warning: (title: ReactNode, options?: ToastOptions) => showToast('warning', title, options),
}) as ToastFunction

function ToastProvider(props: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider {...props} />
}

function ToastPortal(props: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn('pointer-events-none fixed z-[100] w-[calc(100%-2rem)] max-w-[22rem] outline-none', className)}
      {...props}
    />
  )
}

function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        'group/toast pointer-events-auto absolute inset-x-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom rounded-[var(--radius)] border bg-popover text-popover-foreground shadow-lg will-change-transform outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        '[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]',
        'h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms]',
        "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        'data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]',
        'data-limited:opacity-0 data-starting-style:[transform:translateY(150%)]',
        '[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]',
        'data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]',
        'data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]',
        'data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]',
        'data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]',
        className,
      )}
      {...props}
    />
  )
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn(
        'relative h-full overflow-hidden px-4 py-3.5 pr-12 transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-behind:opacity-0 data-expanded:opacity-100 [&[data-expanded][data-behind]]:opacity-100',
        className,
      )}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn('line-clamp-2 min-w-0 text-base font-medium break-words', className)}
      {...props}
    />
  )
}

function ToastDescription({ className, ...props }: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      render={<div />}
      className={cn('line-clamp-3 min-w-0 text-sm leading-relaxed break-words text-muted-foreground', className)}
      {...props}
    />
  )
}

function ToastAction({ className, ...props }: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      render={<Button variant="outline" size="sm" />}
      className={cn('shrink-0', className)}
      {...props}
    />
  )
}

function ToastSwitchAction({ label, onActivate }: { label?: string; onActivate?: () => void }) {
  const [activating, setActivating] = useState(false)

  return (
    <Switch
      aria-busy={activating}
      aria-label={label}
      checked={activating}
      disabled={activating}
      onClick={() => {
        if (activating) {
          return
        }
        setActivating(true)
        onActivate?.()
      }}
    />
  )
}

function ToastClose({ className, children, ...props }: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Close toast"
      render={<Button variant="ghost" size="icon" />}
      className={cn(
        "absolute top-3 right-3 z-10 size-6 text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children ?? <XIcon aria-hidden="true" className="size-4" />}
    </ToastPrimitive.Close>
  )
}

function defaultToastIcon(type: string | undefined) {
  if (type === 'success') {
    return <CircleCheckIcon className="size-5 text-yes" />
  }
  if (type === 'info') {
    return <InfoIcon className="size-5 text-primary" />
  }
  if (type === 'warning') {
    return <TriangleAlertIcon className="size-5 text-orange-400" />
  }
  if (type === 'error') {
    return <OctagonXIcon className="size-5 text-no" />
  }
  if (type === 'loading') {
    return <Spinner className="size-5" />
  }
  return null
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager<ToastData>()

  return toasts.map((toastItem) => {
    const customContent = toastItem.data?.content
    const icon = toastItem.data?.icon ?? defaultToastIcon(toastItem.type)
    const image = toastItem.data?.image
    const hasMedia = Boolean(image || icon)
    const hasAction = Boolean(toastItem.actionProps)
    const hasDescription = customContent == null && toastItem.description != null
    const onClick = toastItem.data?.onClick

    return (
      <Toast
        key={toastItem.id}
        toast={toastItem}
        className={cn(onClick && 'cursor-pointer transition-colors hover:bg-accent/50')}
        role={onClick ? 'link' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={
          onClick
            ? (event) => {
                const interactiveTarget =
                  event.target instanceof Element
                    ? event.target.closest('a,button,[role="button"],[role="link"]')
                    : null
                if (event.defaultPrevented || (interactiveTarget && interactiveTarget !== event.currentTarget)) {
                  return
                }
                onClick()
              }
            : undefined
        }
        onKeyDown={
          onClick
            ? (event) => {
                if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) {
                  return
                }
                event.preventDefault()
                onClick()
              }
            : undefined
        }
      >
        <ToastContent
          className={cn(
            hasAction
              ? 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5'
              : 'flex items-center gap-2.5',
          )}
        >
          {hasMedia && (
            <span
              data-slot="toast-media"
              className={cn(
                'flex shrink-0 items-center gap-2 [&_svg]:pointer-events-none',
                hasAction && 'col-start-1 mt-0.5',
                hasDescription && 'row-span-2',
              )}
            >
              {image}
              {icon && <span data-slot="toast-icon">{icon}</span>}
            </span>
          )}
          {customContent != null ? (
            <div
              data-slot="toast-body"
              className={cn('min-w-0', hasAction && (hasMedia ? 'col-start-2 col-end-3' : 'col-start-1 col-end-3'))}
            >
              {customContent}
            </div>
          ) : hasAction ? (
            <>
              <div
                data-slot="toast-body"
                className={cn(
                  'min-w-0',
                  hasMedia ? 'col-start-2' : 'col-start-1',
                  hasDescription ? 'col-end-4' : 'col-end-3',
                )}
              >
                <ToastTitle />
              </div>
              {hasDescription && (
                <div
                  data-slot="toast-description-row"
                  className={cn('min-w-0 self-center', hasMedia ? 'col-start-2' : 'col-start-1', 'col-end-3')}
                >
                  <ToastDescription />
                </div>
              )}
            </>
          ) : (
            <div data-slot="toast-body" className="flex min-w-0 flex-col gap-1">
              <ToastTitle />
              {toastItem.description != null && <ToastDescription />}
            </div>
          )}
          {toastItem.actionProps && (
            <div
              data-slot="toast-actions"
              className={cn('col-start-3 self-center justify-self-end', hasDescription ? 'row-start-2' : 'row-start-1')}
            >
              {toastItem.data?.actionControl === 'switch' ? (
                <ToastSwitchAction
                  label={
                    typeof toastItem.actionProps.children === 'string' ? toastItem.actionProps.children : undefined
                  }
                  onActivate={toastItem.data?.actionOnClick}
                />
              ) : (
                <ToastAction />
              )}
            </div>
          )}
          <ToastClose />
        </ToastContent>
      </Toast>
    )
  })
}

interface ToasterProps extends Omit<ToastPrimitive.Provider.Props, 'toastManager'> {
  position?: ToastPosition
  toastManager?: typeof toastManager
}

const positionClasses: Record<ToastPosition, string> = {
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'right-4 bottom-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
}

function Toaster({
  children,
  position = 'bottom-right',
  toastManager: manager = toastManager,
  ...props
}: ToasterProps) {
  return (
    <ToastProvider limit={5} timeout={6000} toastManager={manager} {...props}>
      {children}
      <ToastPortal>
        <ToastViewport className={positionClasses[position]}>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  )
}

const createToastManager = ToastPrimitive.createToastManager
const useToastManager = ToastPrimitive.useToastManager

export type { ToastActionOptions, ToastData, ToastOptions, ToasterProps }
export {
  Toaster,
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  createToastManager,
  toast,
  toastManager,
  useToastManager,
}
