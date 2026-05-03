'use client'

import { useExtracted } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteAccountAction } from '@/app/[locale]/(platform)/settings/_actions/delete-account'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { useIsMobile } from '@/hooks/useIsMobile'
import { signOutAndRedirect } from '@/lib/logout'

function useDeleteAccountState() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isPending, startTransition] = useTransition()
  return {
    isDialogOpen,
    setIsDialogOpen,
    error,
    setError,
    deleteConfirmation,
    setDeleteConfirmation,
    isPending,
    startTransition,
  }
}

export default function SettingsDeleteAccountContent() {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const {
    isDialogOpen,
    setIsDialogOpen,
    error,
    setError,
    deleteConfirmation,
    setDeleteConfirmation,
    isPending,
    startTransition,
  } = useDeleteAccountState()
  const isDeleteConfirmed = deleteConfirmation === 'DELETE'

  function handleDialogOpenChange(nextOpen: boolean) {
    if (isPending) {
      return
    }
    setIsDialogOpen(nextOpen)
    if (!nextOpen) {
      setDeleteConfirmation('')
    }
  }

  function handleDeleteAccount() {
    setError(null)

    startTransition(async () => {
      try {
        const result = await deleteAccountAction()

        if (result.error) {
          setError(result.error)
          toast.error(result.error)
          return
        }

        await signOutAndRedirect({
          currentPathname: window.location.pathname,
        })
      }
      catch {
        const errorMessage = t('Failed to delete account. Please try again.')
        setError(errorMessage)
        toast.error(errorMessage)
      }
    })
  }

  return (
    <>
      <section className="grid gap-4 rounded-lg border border-destructive/30 p-6">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{t('Delete account')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('Permanently delete your account. This action cannot be undone.')}
          </p>
        </div>

        {error && <InputError message={error} />}

        <div className="ms-auto">
          <Button
            type="button"
            variant="destructive"
            className="bg-destructive hover:bg-destructive"
            onClick={() => {
              setDeleteConfirmation('')
              setIsDialogOpen(true)
            }}
            disabled={isPending}
          >
            {t('Delete account')}
          </Button>
        </div>
      </section>

      {isMobile
        ? (
            <Drawer open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
                <div className="space-y-6">
                  <DrawerHeader className="space-y-3 text-center">
                    <DrawerTitle className="text-2xl font-bold">
                      {t('Are you sure?')}
                    </DrawerTitle>
                    <DrawerDescription className="text-sm text-muted-foreground">
                      {t('This will permanently delete your account. All your data will be removed and you will be logged out of all devices. This action cannot be undone.')}
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="space-y-2 px-4">
                    <p className="text-sm text-muted-foreground">{t('Type DELETE to confirm')}</p>
                    <Input
                      value={deleteConfirmation}
                      onChange={event => setDeleteConfirmation(event.target.value)}
                      placeholder="DELETE"
                      autoComplete="off"
                    />
                  </div>
                  <DrawerFooter className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-background"
                      onClick={() => handleDialogOpenChange(false)}
                      disabled={isPending}
                    >
                      {t('Never mind')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="bg-destructive hover:bg-destructive"
                      onClick={handleDeleteAccount}
                      disabled={isPending || !isDeleteConfirmed}
                    >
                      {isPending ? t('Deleting...') : t('Confirm')}
                    </Button>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
          )
        : (
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogContent className="bg-background sm:max-w-sm sm:p-8">
                <div className="space-y-6">
                  <DialogHeader className="space-y-3">
                    <DialogTitle className="text-center text-2xl font-bold">
                      {t('Are you sure?')}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      {t('This will permanently delete your account. All your data will be removed and you will be logged out of all devices. This action cannot be undone.')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{t('Type DELETE to confirm')}</p>
                    <Input
                      value={deleteConfirmation}
                      onChange={event => setDeleteConfirmation(event.target.value)}
                      placeholder="DELETE"
                      autoComplete="off"
                    />
                  </div>
                  <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-background sm:w-36"
                      onClick={() => handleDialogOpenChange(false)}
                      disabled={isPending}
                    >
                      {t('Never mind')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="bg-destructive hover:bg-destructive sm:w-36"
                      onClick={handleDeleteAccount}
                      disabled={isPending || !isDeleteConfirmed}
                    >
                      {isPending ? t('Deleting...') : t('Confirm')}
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          )}
    </>
  )
}
