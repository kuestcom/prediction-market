import type {
  EventCreationMode,
  FormState,
  RecurringOccurrencePreview,
} from './admin-create-event-form-types'
import type { EventCreationDraftRecord } from '@/lib/db/queries/event-creations'
import type { EventCreationRecurrenceUnit } from '@/lib/event-creation'
import { useCallback, useMemo } from 'react'
import { normalizeDateTimeLocalValue } from '@/lib/datetime-local'
import {
  addRecurrenceInterval,
  appendEventCreationSlugSuffix,
  applyEventCreationTemplate,
  buildDefaultDeployAt,
  buildEventCreationTimestampSeed,
  buildImmediateDeployAt,
  buildScheduledRecurringDeployAt,
  hasEventCreationDateTemplateVariable,
  slugifyEventCreationValue as slugify,
  slugifyEventCreationTemplate as slugifyTemplate,
} from '@/lib/event-creation'
import { hasRecurringDeploymentHistory } from './admin-create-event-form-utils'

export function useRecurringEventPreview({
  clientNowMs,
  creationMode,
  creatorSlugTail,
  form,
  hasConfiguredServerSigners,
  initialDraftRecord,
  recurrenceInterval,
  recurrenceUnit,
  slugSeed,
  slugTemplate,
  titleTemplate,
}: {
  clientNowMs: number
  creationMode: EventCreationMode
  creatorSlugTail: string
  form: FormState
  hasConfiguredServerSigners: boolean
  initialDraftRecord: EventCreationDraftRecord | null
  recurrenceInterval: string
  recurrenceUnit: EventCreationRecurrenceUnit | ''
  slugSeed: string
  slugTemplate: string
  titleTemplate: string
}) {
  const scheduleDateValue = useMemo(
    () => normalizeDateTimeLocalValue(form.endDateIso),
    [form.endDateIso],
  )
  const scheduleOccurrenceDate = useMemo(() => {
    if (!scheduleDateValue) {
      return null
    }

    const parsed = new Date(scheduleDateValue)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }, [scheduleDateValue])
  const recurrenceIntervalNumber = useMemo(
    () => Math.max(1, Number.parseInt(recurrenceInterval || '1', 10) || 1),
    [recurrenceInterval],
  )
  const hasRecurringDeployHistory = useMemo(
    () => creationMode === 'recurring' && hasRecurringDeploymentHistory(initialDraftRecord),
    [creationMode, initialDraftRecord],
  )
  const automaticDeployAtIso = useMemo(() => {
    if (!scheduleOccurrenceDate) {
      return null
    }

    if (creationMode !== 'recurring') {
      return buildDefaultDeployAt(scheduleOccurrenceDate)?.toISOString() ?? null
    }

    if (!hasRecurringDeployHistory) {
      return buildImmediateDeployAt(clientNowMs)?.toISOString() ?? null
    }

    return buildScheduledRecurringDeployAt(
      scheduleOccurrenceDate,
      recurrenceUnit || null,
      recurrenceIntervalNumber,
    )?.toISOString() ?? null
  }, [clientNowMs, creationMode, hasRecurringDeployHistory, recurrenceIntervalNumber, recurrenceUnit, scheduleOccurrenceDate])
  const automaticDeployAtDate = useMemo(() => {
    if (!automaticDeployAtIso) {
      return null
    }

    const parsed = new Date(automaticDeployAtIso)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }, [automaticDeployAtIso])
  const nextRecurringResolutionDate = useMemo(() => {
    if (creationMode !== 'recurring' || !scheduleOccurrenceDate || !recurrenceUnit) {
      return null
    }

    return addRecurrenceInterval(scheduleOccurrenceDate, recurrenceUnit, recurrenceIntervalNumber)
  }, [creationMode, recurrenceIntervalNumber, recurrenceUnit, scheduleOccurrenceDate])
  const nextRecurringDeployDate = useMemo(() => {
    if (!nextRecurringResolutionDate || !recurrenceUnit) {
      return null
    }

    return buildScheduledRecurringDeployAt(nextRecurringResolutionDate, recurrenceUnit, recurrenceIntervalNumber)
  }, [nextRecurringResolutionDate, recurrenceIntervalNumber, recurrenceUnit])
  const recurringResolvedTitle = useMemo(() => {
    if (creationMode !== 'recurring') {
      return ''
    }

    const fallbackTitle = form.title.trim()
    const baseTemplate = titleTemplate.trim() || fallbackTitle
    if (!baseTemplate) {
      return ''
    }

    if (!scheduleOccurrenceDate) {
      return baseTemplate
    }

    return applyEventCreationTemplate(baseTemplate, scheduleOccurrenceDate, baseTemplate).trim() || baseTemplate
  }, [creationMode, form.title, scheduleOccurrenceDate, titleTemplate])
  const derivedRecurringSlugTemplate = useMemo(() => {
    if (creationMode !== 'recurring') {
      return ''
    }

    return slugifyTemplate(titleTemplate)
  }, [creationMode, titleTemplate])
  const recurringSlugSuffix = useMemo(() => {
    if (creationMode !== 'recurring') {
      return ''
    }

    const timestampSeed = scheduleOccurrenceDate
      ? buildEventCreationTimestampSeed(scheduleOccurrenceDate)
      : slugSeed

    return `${timestampSeed}${creatorSlugTail}`
  }, [creationMode, creatorSlugTail, scheduleOccurrenceDate, slugSeed])
  const effectiveRecurringSlugTemplate = useMemo(() => {
    if (creationMode !== 'recurring') {
      return ''
    }

    return slugTemplate.trim() || derivedRecurringSlugTemplate
  }, [creationMode, derivedRecurringSlugTemplate, slugTemplate])
  const recurringResolvedSlug = useMemo(() => {
    if (creationMode !== 'recurring') {
      return ''
    }

    const baseTemplate = effectiveRecurringSlugTemplate
      || slugify(recurringResolvedTitle)
    if (!baseTemplate) {
      return ''
    }

    const rawSlug = scheduleOccurrenceDate
      ? applyEventCreationTemplate(baseTemplate, scheduleOccurrenceDate, baseTemplate)
      : baseTemplate

    if (!scheduleOccurrenceDate) {
      return appendEventCreationSlugSuffix(baseTemplate, recurringSlugSuffix)
    }

    return appendEventCreationSlugSuffix(slugify(rawSlug || baseTemplate), recurringSlugSuffix)
  }, [creationMode, effectiveRecurringSlugTemplate, recurringResolvedTitle, recurringSlugSuffix, scheduleOccurrenceDate])
  const recurringResolvedRules = useMemo(() => {
    if (creationMode !== 'recurring') {
      return ''
    }

    const baseTemplate = form.resolutionRules.trim()
    if (!baseTemplate) {
      return ''
    }

    if (!scheduleOccurrenceDate) {
      return baseTemplate
    }

    return applyEventCreationTemplate(baseTemplate, scheduleOccurrenceDate, baseTemplate).trim() || baseTemplate
  }, [creationMode, form.resolutionRules, scheduleOccurrenceDate])
  const effectiveResolutionRules = useMemo(
    () => creationMode === 'recurring'
      ? (recurringResolvedRules || form.resolutionRules.trim())
      : form.resolutionRules.trim(),
    [creationMode, form.resolutionRules, recurringResolvedRules],
  )
  const buildRecurringOccurrencePreview = useCallback((date: Date | null): RecurringOccurrencePreview | null => {
    if (creationMode !== 'recurring' || !date) {
      return null
    }

    const rawTitleTemplate = titleTemplate.trim()
    const resolvedTitle = applyEventCreationTemplate(rawTitleTemplate, date, rawTitleTemplate).trim()
      || rawTitleTemplate
      || form.title.trim()

    const rawSlugTemplate = (effectiveRecurringSlugTemplate || slugify(resolvedTitle)).trim()
    const resolvedBaseSlug = slugify(applyEventCreationTemplate(rawSlugTemplate, date, rawSlugTemplate) || rawSlugTemplate)
    const suffix = `${buildEventCreationTimestampSeed(date)}${creatorSlugTail}`
    const resolvedSlug = appendEventCreationSlugSuffix(resolvedBaseSlug, suffix)
    const rawRulesTemplate = form.resolutionRules.trim()
    const resolvedRules = applyEventCreationTemplate(rawRulesTemplate, date, rawRulesTemplate).trim() || rawRulesTemplate

    return {
      endDateIso: date.toISOString(),
      title: resolvedTitle,
      slug: resolvedSlug,
      resolutionRules: resolvedRules,
    }
  }, [creationMode, creatorSlugTail, effectiveRecurringSlugTemplate, form.resolutionRules, form.title, titleTemplate])
  const recurringOccurrencePreviews = useMemo(
    () => creationMode === 'recurring'
      ? [buildRecurringOccurrencePreview(scheduleOccurrenceDate), buildRecurringOccurrencePreview(nextRecurringResolutionDate)].filter(Boolean) as RecurringOccurrencePreview[]
      : [],
    [buildRecurringOccurrencePreview, creationMode, nextRecurringResolutionDate, scheduleOccurrenceDate],
  )
  const recurringPreviewErrors = useMemo(() => {
    if (creationMode !== 'recurring') {
      return [] as string[]
    }

    const errors: string[] = []
    const [currentPreview, nextPreview] = recurringOccurrencePreviews

    if (scheduleOccurrenceDate && !currentPreview?.slug) {
      errors.push('Recurring slug preview is invalid.')
    }

    if (scheduleOccurrenceDate && !currentPreview?.title) {
      errors.push('Recurring title preview is invalid.')
    }

    if (scheduleOccurrenceDate && !currentPreview?.resolutionRules) {
      errors.push('Recurring resolution rules preview is invalid.')
    }

    if (currentPreview && nextPreview && currentPreview.slug === nextPreview.slug) {
      errors.push('Recurring slug preview must change between occurrences.')
    }

    return errors
  }, [creationMode, recurringOccurrencePreviews, scheduleOccurrenceDate])
  const recurringEditorialWarnings = useMemo(() => {
    if (creationMode !== 'recurring') {
      return [] as string[]
    }

    const warnings = new Set<string>()
    const [currentPreview, nextPreview] = recurringOccurrencePreviews

    if (titleTemplate.trim() && !hasEventCreationDateTemplateVariable(titleTemplate)) {
      warnings.add('Title template has no date variable, so recurring event titles may look identical between occurrences.')
    }

    if (form.resolutionRules.trim() && !hasEventCreationDateTemplateVariable(form.resolutionRules)) {
      warnings.add('Resolution rules have no date variable, so recurring rules may look identical between occurrences.')
    }

    if (currentPreview && nextPreview && currentPreview.title.trim().toLowerCase() === nextPreview.title.trim().toLowerCase()) {
      warnings.add('First and next recurring title previews are identical.')
    }

    if (currentPreview && nextPreview && currentPreview.resolutionRules.trim().toLowerCase() === nextPreview.resolutionRules.trim().toLowerCase()) {
      warnings.add('First and next recurring resolution rules previews are identical.')
    }

    return Array.from(warnings)
  }, [creationMode, form.resolutionRules, recurringOccurrencePreviews, titleTemplate])
  const recurringRequiresServerWalletSetup = creationMode === 'recurring' && !hasConfiguredServerSigners

  return {
    scheduleDateValue,
    scheduleOccurrenceDate,
    recurrenceIntervalNumber,
    hasRecurringDeployHistory,
    automaticDeployAtIso,
    automaticDeployAtDate,
    nextRecurringResolutionDate,
    nextRecurringDeployDate,
    recurringResolvedTitle,
    effectiveRecurringSlugTemplate,
    recurringResolvedSlug,
    recurringResolvedRules,
    effectiveResolutionRules,
    recurringOccurrencePreviews,
    recurringPreviewErrors,
    recurringEditorialWarnings,
    recurringRequiresServerWalletSetup,
  }
}
