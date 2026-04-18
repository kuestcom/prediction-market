'use client'

import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'

import { cn } from '@/lib/utils'

function Drawer({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return (
    <DrawerPrimitive.Root
      shouldScaleBackground={shouldScaleBackground}
      {...props}
    />
  )
}

Drawer.displayName = 'Drawer'

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

function DrawerOverlay({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay> & { ref?: React.RefObject<React.ElementRef<typeof DrawerPrimitive.Overlay> | null> }) {
  return (
    <DrawerPrimitive.Overlay
      ref={ref}
      data-slot="drawer-overlay"
      className={cn('fixed inset-0 z-50 bg-black/80', className)}
      {...props}
    />
  )
}
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

function DrawerContent({ ref, className, children, ...props }: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & { ref?: React.RefObject<React.ElementRef<typeof DrawerPrimitive.Content> | null> }) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={ref}
        data-slot="drawer-content"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background',
          className,
        )}
        {...props}
      >
        <div className="mx-auto mt-4 h-2 w-25 rounded-full bg-muted" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}
DrawerContent.displayName = 'DrawerContent'

function DrawerHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-4 grid gap-1.5 p-4 text-center sm:text-left', className)}
      {...props}
    />
  )
}
DrawerHeader.displayName = 'DrawerHeader'

function DrawerFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  )
}
DrawerFooter.displayName = 'DrawerFooter'

function DrawerTitle({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title> & { ref?: React.RefObject<React.ElementRef<typeof DrawerPrimitive.Title> | null> }) {
  return (
    <DrawerPrimitive.Title
      ref={ref}
      className={cn(
        'text-lg leading-none font-semibold tracking-tight',
        className,
      )}
      {...props}
    />
  )
}
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

function DrawerDescription({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description> & { ref?: React.RefObject<React.ElementRef<typeof DrawerPrimitive.Description> | null> }) {
  return (
    <DrawerPrimitive.Description
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
}
