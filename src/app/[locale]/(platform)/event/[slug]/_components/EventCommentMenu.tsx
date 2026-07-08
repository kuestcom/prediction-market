import { Trash2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useState } from 'react'
import { DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import EventCommentDeleteForm from './EventCommentDeleteForm'

interface CommentMenuProps {
  onDelete: () => void
  isDeleting?: boolean
}

function useDeleteDialog() {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  return { isDeleteOpen, setIsDeleteOpen }
}

export default function EventCommentMenu({ onDelete, isDeleting }: CommentMenuProps) {
  const { isDeleteOpen, setIsDeleteOpen } = useDeleteDialog()
  const t = useExtracted()

  return (
    <>
      <DropdownMenuContent className="w-32" align="end">
        <DropdownMenuItem
          className="text-destructive"
          onSelect={() => {
            setTimeout(setIsDeleteOpen, 0, true)
          }}
        >
          <Trash2Icon />
          {t('Delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <EventCommentDeleteForm
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onDelete={onDelete}
        isDeleting={isDeleting}
      />
    </>
  )
}
