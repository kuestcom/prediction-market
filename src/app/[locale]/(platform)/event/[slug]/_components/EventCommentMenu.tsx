import type { Comment } from '@/types'
import { Trash2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useState } from 'react'
import { DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import EventCommentDeleteForm from './EventCommentDeleteForm'

interface CommentMenuProps {
  comment: Comment
  onDelete: () => void
  isDeleting?: boolean
}

export default function EventCommentMenu({ comment, onDelete, isDeleting }: CommentMenuProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const t = useExtracted()

  return (
    <>
      <DropdownMenuContent className="w-32" align="end">
        {comment.is_owner && (
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => {
              setTimeout(() => setIsDeleteOpen(true), 0)
            }}
          >
            <Trash2Icon />
            {t('Delete')}
          </DropdownMenuItem>
        )}
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
