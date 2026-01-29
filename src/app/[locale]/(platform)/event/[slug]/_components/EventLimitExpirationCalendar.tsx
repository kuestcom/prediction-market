'use client'

import { Clock2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface EventLimitExpirationCalendarProps {
  value?: Date
  onChange?: (value: Date) => void
  title?: string
  onCancel?: () => void
  onApply?: () => void
  cancelLabel?: string
  applyLabel?: string
}

function formatTimeInput(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${hours}:${minutes}`
}

function mergeDateAndTime(date: Date, time: string) {
  const [hours, minutes] = time.split(':').map(segment => Number.parseInt(segment, 10))
  const nextDate = new Date(date)

  const normalizedHours = Number.isFinite(hours) ? hours : 0
  const normalizedMinutes = Number.isFinite(minutes) ? minutes : 0
  nextDate.setHours(normalizedHours, normalizedMinutes, 0, 0)

  return nextDate
}

export default function EventLimitExpirationCalendar({
  value,
  onChange,
  title,
  onCancel,
  onApply,
  cancelLabel,
  applyLabel,
}: EventLimitExpirationCalendarProps) {
  const t = useExtracted()
  const initialDate = useMemo(() => value ?? new Date(), [value])
  const minDate = useMemo(() => new Date(), [])
  const [selectedDate, setSelectedDate] = useState<Date>(() => initialDate)
  const [timeValue, setTimeValue] = useState<string>(() => formatTimeInput(initialDate))
  const showActions = Boolean(onCancel || onApply)
  const resolvedCancelLabel = cancelLabel ?? t('Cancel')
  const resolvedApplyLabel = applyLabel ?? t('Apply')

  useEffect(() => {
    const nextDate = value ?? new Date()
    setSelectedDate(nextDate)
    setTimeValue(formatTimeInput(nextDate))
  }, [value])

  function handleChange(nextDate: Date, nextTime = timeValue) {
    const mergedDate = mergeDateAndTime(nextDate, nextTime)
    const clampedDate = mergedDate < minDate ? minDate : mergedDate

    if (clampedDate !== mergedDate) {
      setTimeValue(formatTimeInput(clampedDate))
    }

    setSelectedDate(clampedDate)
    onChange?.(clampedDate)
  }

  return (
    <Card className="w-full max-w-md min-w-[320px] gap-0">
      {title && (
        <CardHeader className="pt-6 pb-4">
          <DialogTitle>{title}</DialogTitle>
        </CardHeader>
      )}
      <CardContent className="py-4">
        <Calendar
          mode="single"
          selected={selectedDate}
          fromDate={minDate}
          disabled={{ before: minDate }}
          onSelect={(nextDate) => {
            if (!nextDate) {
              return
            }
            handleChange(nextDate)
          }}
          className="bg-transparent p-0"
          classNames={{ root: 'w-full' }}
        />
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-4 border-t py-4">
        <div className="flex w-full flex-col gap-3">
          <Label htmlFor="expiration-time">{t('Expiration Time')}</Label>
          <div className="relative flex w-full items-center gap-2">
            <Clock2Icon className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground select-none" />
            <Input
              id="expiration-time"
              type="time"
              step="60"
              value={timeValue}
              onChange={(event) => {
                const nextTime = event.target.value || '00:00'
                setTimeValue(nextTime)
                handleChange(selectedDate ?? initialDate, nextTime)
              }}
              className={`
                appearance-none pl-8
                [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none
              `}
            />
          </div>
        </div>
        {showActions && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {onCancel && (
              <Button variant="outline" type="button" onClick={onCancel}>
                {resolvedCancelLabel}
              </Button>
            )}
            {onApply && (
              <Button type="button" onClick={onApply}>
                {resolvedApplyLabel}
              </Button>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
