import type { EventCreationMode, FormState } from './admin-create-event-form-types'
import { useMemo } from 'react'
import { normalizeDateTimeLocalValue } from '@/lib/datetime-local'

export function useEventPreview({
  creationMode,
  effectiveRecurringSlugTemplate,
  eventImagePreviewUrl,
  form,
  optionImagePreviewUrls,
  previewSiteOrigin,
  recurringResolvedSlug,
  recurringResolvedTitle,
  titleTemplate,
}: {
  creationMode: EventCreationMode
  effectiveRecurringSlugTemplate: string
  eventImagePreviewUrl: string | null
  form: FormState
  optionImagePreviewUrls: Record<string, string>
  previewSiteOrigin: string
  recurringResolvedSlug: string
  recurringResolvedTitle: string
  titleTemplate: string
}) {
  const previewEndDate = useMemo(() => {
    const normalizedEndDate = normalizeDateTimeLocalValue(form.endDateIso)
    if (!normalizedEndDate) {
      return 'Resolution date not set'
    }
    const parsed = new Date(normalizedEndDate)
    if (Number.isNaN(parsed.getTime())) {
      return normalizedEndDate
    }
    return parsed.toLocaleString()
  }, [form.endDateIso])
  const previewTitle = useMemo(
    () => creationMode === 'recurring'
      ? (recurringResolvedTitle || titleTemplate.trim() || 'Untitled event')
      : (form.title || 'Untitled event'),
    [creationMode, form.title, recurringResolvedTitle, titleTemplate],
  )
  const previewSlug = useMemo(
    () => creationMode === 'recurring'
      ? (recurringResolvedSlug || effectiveRecurringSlugTemplate || 'event-slug')
      : (form.slug || 'event-slug'),
    [creationMode, effectiveRecurringSlugTemplate, form.slug, recurringResolvedSlug],
  )
  const previewMarkets = useMemo(() => {
    if (form.marketMode === 'binary') {
      return [
        {
          key: 'binary',
          title: previewTitle.trim(),
          question: form.binaryQuestion.trim() || previewTitle.trim(),
          shortName: '',
          outcomeYes: form.binaryOutcomeYes.trim() || 'Yes',
          outcomeNo: form.binaryOutcomeNo.trim() || 'No',
          imageUrl: eventImagePreviewUrl,
        },
      ]
    }

    if (form.marketMode === 'multi_multiple' || form.marketMode === 'multi_unique') {
      return form.options.map((option, index) => ({
        key: option.id || `option-${index + 1}`,
        title: option.title.trim(),
        question: option.question.trim(),
        shortName: option.shortName.trim(),
        outcomeYes: option.outcomeYes.trim() || 'Yes',
        outcomeNo: option.outcomeNo.trim() || 'No',
        imageUrl: optionImagePreviewUrls[option.id] ?? null,
      }))
    }

    return []
  }, [
    eventImagePreviewUrl,
    form.binaryOutcomeNo,
    form.binaryOutcomeYes,
    form.binaryQuestion,
    form.marketMode,
    form.options,
    optionImagePreviewUrls,
    previewTitle,
  ])
  const tradePreviewMarket = useMemo(
    () => previewMarkets[0] ?? null,
    [previewMarkets],
  )
  const previewEventUrl = useMemo(
    () => `${previewSiteOrigin}/event/${previewSlug}`,
    [previewSiteOrigin, previewSlug],
  )
  const isMultiMarketPreview = form.marketMode === 'multi_multiple' || form.marketMode === 'multi_unique'

  return {
    previewEndDate,
    previewTitle,
    previewSlug,
    previewMarkets,
    tradePreviewMarket,
    previewEventUrl,
    isMultiMarketPreview,
  }
}
