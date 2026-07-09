import { AlertCircleIcon } from 'lucide-react'
import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface AlertBannerProps {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode | null
  className?: string
  titleClassName?: string
  descriptionClassName?: string
  variant?: 'default' | 'destructive'
}

export default function AlertBanner({
  title,
  description,
  icon,
  className,
  titleClassName,
  descriptionClassName,
  variant = 'destructive',
}: AlertBannerProps) {
  const resolvedIcon = icon === undefined ? <AlertCircleIcon /> : icon

  return (
    <Alert variant={variant} className={className}>
      {resolvedIcon}
      <AlertTitle className={titleClassName}>{title}</AlertTitle>
      {description
        ? (
            <AlertDescription className={descriptionClassName}>
              {description}
            </AlertDescription>
          )
        : null}
    </Alert>
  )
}
