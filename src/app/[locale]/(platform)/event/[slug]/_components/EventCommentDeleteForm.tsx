'use client'

import { useExtracted } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/useIsMobile'

interface EventCommentDeleteFormProps {
  onDelete: () => void
  isDeleting?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function EventCommentDeleteForm({
  onDelete,
  isDeleting,
  open,
  onOpenChange,
}: EventCommentDeleteFormProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  function handleConfirm() {
    if (isDeleting) {
      return
    }
    onDelete()
  }

  const content = (
    <div className="space-y-6">
      <DialogHeader className="space-y-3">
        <DialogTitle className="text-center text-2xl font-bold">
          {t('Are you sure?')}
        </DialogTitle>
        <DialogDescription className="text-center text-sm text-muted-foreground">
          {t('Are you sure you want to delete this comment?')}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="outline"
          className="bg-background sm:w-36"
          onClick={() => onOpenChange(false)}
        >
          {t('Never mind')}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="bg-destructive hover:bg-destructive sm:w-36"
          onClick={handleConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? t('Deleting...') : t('Confirm')}
        </Button>
      </DialogFooter>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
          <div className="space-y-6">
            <DrawerHeader className="space-y-3 text-center">
              <DrawerTitle className="text-2xl font-bold">
                {t('Are you sure?')}
              </DrawerTitle>
              <DrawerDescription className="text-sm text-muted-foreground">
                {t('Are you sure you want to delete this comment?')}
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="bg-background"
                onClick={() => onOpenChange(false)}
              >
                {t('Never mind')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="bg-destructive hover:bg-destructive"
                onClick={handleConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? t('Deleting...') : t('Confirm')}
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-background sm:p-8">
        {content}
      </DialogContent>
    </Dialog>
  )
}
