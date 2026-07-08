import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { FormState } from './admin-create-event-form-types'
import type { AdminSportsFormState } from '@/lib/admin-sports-create'
import { useCallback } from 'react'
import { formatDateTimeLocalValue, normalizeDateTimeLocalValue } from '@/lib/datetime-local'

function readNormalizedDateTimeInputValue(input: HTMLInputElement | null, fallbackValue: string) {
  const rawInputValue = input?.value?.trim() ?? ''
  const inputValue = normalizeDateTimeLocalValue(rawInputValue)
  if (inputValue) {
    return inputValue
  }

  const inputDate = input?.valueAsDate
  if (inputDate instanceof Date && !Number.isNaN(inputDate.getTime())) {
    return formatDateTimeLocalValue(inputDate)
  }

  const normalizedFallbackValue = normalizeDateTimeLocalValue(fallbackValue)
  if (normalizedFallbackValue) {
    return normalizedFallbackValue
  }

  return rawInputValue || fallbackValue.trim()
}

export function useResolvedDateInputs({
  eventEndDateInputRef,
  form,
  setForm,
  setSportsForm,
  sportsForm,
  sportsStartTimeInputRef,
}: {
  eventEndDateInputRef: RefObject<HTMLInputElement | null>
  form: FormState
  setForm: Dispatch<SetStateAction<FormState>>
  setSportsForm: Dispatch<SetStateAction<AdminSportsFormState>>
  sportsForm: AdminSportsFormState
  sportsStartTimeInputRef: RefObject<HTMLInputElement | null>
}) {
  const getResolvedDateForms = useCallback(() => {
    const resolvedEndDateIso = readNormalizedDateTimeInputValue(eventEndDateInputRef.current, form.endDateIso)
    const resolvedSportsStartTime = readNormalizedDateTimeInputValue(sportsStartTimeInputRef.current, sportsForm.startTime)

    return {
      resolvedForm: {
        ...form,
        endDateIso: resolvedEndDateIso,
      },
      resolvedSportsForm: {
        ...sportsForm,
        startTime: resolvedSportsStartTime,
      },
    }
  }, [eventEndDateInputRef, form, sportsForm, sportsStartTimeInputRef])

  const syncResolvedDateInputs = useCallback(() => {
    const { resolvedForm, resolvedSportsForm } = getResolvedDateForms()

    if (resolvedForm.endDateIso && resolvedForm.endDateIso !== form.endDateIso) {
      setForm(prev => (prev.endDateIso === resolvedForm.endDateIso
        ? prev
        : {
            ...prev,
            endDateIso: resolvedForm.endDateIso,
          }))
    }

    if (resolvedSportsForm.startTime && resolvedSportsForm.startTime !== sportsForm.startTime) {
      setSportsForm(prev => (prev.startTime === resolvedSportsForm.startTime
        ? prev
        : {
            ...prev,
            startTime: resolvedSportsForm.startTime,
          }))
    }

    return { resolvedForm, resolvedSportsForm }
  }, [form.endDateIso, getResolvedDateForms, setForm, setSportsForm, sportsForm.startTime])

  return {
    getResolvedDateForms,
    syncResolvedDateInputs,
  }
}
