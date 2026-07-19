'use client'

import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  createIdentityDataExportAction,
  createIdentityProviderSessionAction,
  createIdentitySubmissionAction,
  requestIdentityCorrectionAction,
  requestIdentityErasureAction,
  saveIdentityAnswersAction,
} from '@/app/[locale]/(platform)/settings/_actions/identity'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface VerificationField {
  id?: string
  key: string
  type: string
  storageMode: string
  sensitivity: string
  section: string
  displayOrder: number
  required: boolean
  config: Record<string, unknown>
  conditions: Array<{ fieldKey: string, operator: 'equals' | 'not_equals' | 'in' | 'exists', value?: unknown }>
  label: string
  description: string
  helpText: string
  placeholder: string
  options: Array<{ value: string, label: string }>
}

interface VerificationProgram {
  id: string
  key: string
  name: string
  description: string
  versionId: string
  mode: 'self_hosted' | 'provider' | 'hybrid'
  countries: string[]
  providerConfigId: string | null
  consent: { key: string, documentVersion: string, content: string } | null
  fields: VerificationField[]
  submission: {
    id: string
    status: string
    revision: number
    countryCode: string | null
    reasonCode: string | null
    submittedAt: string | null
    decidedAt: string | null
    expiresAt: string | null
    answers: Record<string, unknown>
    documents: Array<{ id: string, fieldId: string | null, contentType: string, sizeBytes: number, scanStatus: string }>
  } | null
}

interface VerificationPayload {
  programs: VerificationProgram[]
  privacy: {
    exports: Array<{ id: string, status: string, expiresAt: string | null, createdAt: string }>
    requests: Array<{ id: string, status: string, scope: string, reasonCode: string | null, progress: Record<string, unknown>, requestedAt: string }>
    legalHoldActive: boolean
  }
}

const fieldClassName = 'grid gap-1.5 text-sm font-medium'
const selectClassName = 'h-10 w-full rounded-md border bg-background px-3 text-sm'

function conditionMatches(
  condition: VerificationField['conditions'][number],
  answers: Record<string, unknown>,
) {
  const actual = answers[condition.fieldKey]
  if (condition.operator === 'exists') {
    return actual !== null && actual !== undefined && actual !== ''
  }
  if (condition.operator === 'in') {
    return Array.isArray(condition.value) && condition.value.some(value => JSON.stringify(value) === JSON.stringify(actual))
  }
  const equal = JSON.stringify(actual) === JSON.stringify(condition.value)
  return condition.operator === 'equals' ? equal : !equal
}

function FieldInput({
  field,
  locale,
  value,
  disabled,
  error,
  onChange,
  onUpload,
  documents,
}: {
  field: VerificationField
  locale: string
  value: unknown
  disabled: boolean
  error?: string
  onChange: (value: unknown) => void
  onUpload: (file: File) => void
  documents: Array<{ id: string, fieldId: string | null, contentType: string, sizeBytes: number, scanStatus: string }>
}) {
  const t = useExtracted()
  const common = {
    id: `identity-${field.key}`,
    disabled,
    required: field.required,
    placeholder: field.placeholder,
    autoComplete: typeof field.config.autocomplete === 'string' ? field.config.autocomplete : 'off',
    inputMode: typeof field.config.inputMode === 'string' ? field.config.inputMode as 'text' : undefined,
  }
  const label = (
    <span>
      {field.label}
      {field.required ? ' *' : ''}
    </span>
  )

  if (field.type === 'heading') {
    return <h3 className="text-lg font-semibold">{field.label}</h3>
  }
  if (field.type === 'paragraph' || field.type === 'notice') {
    return (
      <div className={field.type === 'notice'
        ? 'rounded-md border bg-muted p-3 text-sm'
        : `text-sm text-muted-foreground`}
      >
        {field.description || field.label}
      </div>
    )
  }
  if (field.type === 'separator') {
    return <hr />
  }
  if (field.storageMode === 'provider_only') {
    return null
  }
  if (field.type === 'long_text') {
    return (
      <label className={fieldClassName}>
        {label}
        <Textarea {...common} value={typeof value === 'string' ? value : ''} onChange={event => onChange(event.target.value)} />
        {field.helpText && <small className="text-muted-foreground">{field.helpText}</small>}
        {error && (
          <small className="text-destructive">
            {error}
          </small>
        )}
      </label>
    )
  }
  if (field.type === 'boolean') {
    return (
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={value === true} onChange={event => onChange(event.target.checked)} disabled={disabled} />
        <span>
          {field.label}
          {field.description && (
            <small className="block text-muted-foreground">
              {field.description}
            </small>
          )}
          {error && <small className="block text-destructive">{error}</small>}
        </span>
      </label>
    )
  }
  if (['single_select', 'radio'].includes(field.type)) {
    return (
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{label}</legend>
        {field.type === 'single_select'
          ? (
              <select className={selectClassName} value={typeof value === 'string' ? value : ''} onChange={event => onChange(event.target.value)} disabled={disabled} required={field.required}>
                <option value="">{t('Select an option')}</option>
                {field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            )
          : field.options.map(option => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <input type="radio" name={`identity-${field.key}`} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} disabled={disabled} />
                {option.label}
              </label>
            ))}
        {error && <small className="text-destructive">{error}</small>}
      </fieldset>
    )
  }
  if (field.type === 'multi_select') {
    const selected = Array.isArray(value) ? value as string[] : []
    return (
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{label}</legend>
        {field.options.map(option => (
          <label
            key={option.value}
            className="flex items-center gap-2 text-sm"
          >
            <input type="checkbox" checked={selected.includes(option.value)} onChange={event => onChange(event.target.checked ? [...selected, option.value] : selected.filter(item => item !== option.value))} disabled={disabled} />
            {option.label}
          </label>
        ))}
        {error && <small className="text-destructive">{error}</small>}
      </fieldset>
    )
  }
  if (field.type === 'address') {
    const address = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, string> : {}
    const configuredParts = Array.isArray(field.config.addressParts) ? field.config.addressParts : []
    const addressParts = configuredParts.length > 0
      ? configuredParts.flatMap((part) => {
          if (!part || typeof part !== 'object' || Array.isArray(part) || typeof (part as { key?: unknown }).key !== 'string') {
            return []
          }
          const item = part as { key: string, required?: boolean, labels?: Record<string, unknown> }
          const localizedLabel = typeof item.labels?.[locale] === 'string' ? item.labels[locale] as string : item.key
          return [{ key: item.key, required: item.required === true, label: localizedLabel }]
        })
      : ['line1', 'line2', 'city', 'region', 'postalCode', 'countryCode'].map(key => ({ key, required: key !== 'line2', label: key }))
    return (
      <fieldset className="grid gap-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">{label}</legend>
        {addressParts.map(part => <Input key={part.key} value={address[part.key] ?? ''} placeholder={part.label} aria-label={part.label} onChange={event => onChange({ ...address, [part.key]: event.target.value })} disabled={disabled} required={field.required && part.required} />)}
        {error && <small className="text-destructive">{error}</small>}
      </fieldset>
    )
  }
  if (field.type === 'file' || field.type === 'document') {
    const fieldDocuments = documents.filter(document => document.fieldId === field.id)
    return (
      <label className={fieldClassName}>
        {label}
        <Input type="file" accept="image/jpeg,image/png,application/pdf" onChange={event => event.target.files?.[0] && onUpload(event.target.files[0])} disabled={disabled} />
        {fieldDocuments.map(document => (
          <span key={document.id} className="text-xs text-muted-foreground">
            {document.contentType}
            {' '}
            ·
            {' '}
            {Math.ceil(document.sizeBytes / 1024)}
            {' '}
            KB ·
            {' '}
            {document.scanStatus}
          </span>
        ))}
        <small className="text-muted-foreground">{t('Documents are encrypted, stored privately, and unavailable until malware scanning succeeds.')}</small>
        {error && <small className="text-destructive">{error}</small>}
      </label>
    )
  }
  if (field.type === 'country') {
    return (
      <label className={fieldClassName}>
        {label}
        <Input {...common} value={typeof value === 'string' ? value : ''} maxLength={2} onChange={event => onChange(event.target.value.toUpperCase())} placeholder={field.placeholder || 'BR'} />
        {error && <small className="text-destructive">{error}</small>}
      </label>
    )
  }
  const inputType = field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'
  return (
    <label className={fieldClassName}>
      {label}
      <Input {...common} type={inputType} value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} minLength={typeof field.config.minLength === 'number' ? field.config.minLength : undefined} maxLength={typeof field.config.maxLength === 'number' ? field.config.maxLength : undefined} onChange={event => onChange(event.target.value)} />
      {field.helpText && <small className="text-muted-foreground">{field.helpText}</small>}
      {error && (
        <small className="text-destructive">
          {error}
        </small>
      )}
    </label>
  )
}

export default function SettingsIdentityVerificationContent({ locale }: { locale: string }) {
  const t = useExtracted()
  const [payload, setPayload] = useState<VerificationPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [answersByProgram, setAnswersByProgram] = useState<Record<string, Record<string, unknown>>>({})
  const [countryByProgram, setCountryByProgram] = useState<Record<string, string>>({})
  const [consents, setConsents] = useState<Record<string, boolean>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/identity/submissions?locale=${encodeURIComponent(locale)}`, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error('IDENTITY_OVERVIEW_LOAD_FAILED')
    }
    const nextPayload = await response.json() as VerificationPayload
    setPayload(nextPayload)
    setAnswersByProgram(Object.fromEntries(nextPayload.programs.map(program => [program.id, program.submission?.answers ?? {}])))
    setCountryByProgram(Object.fromEntries(nextPayload.programs.map(program => [program.id, program.submission?.countryCode ?? ''])))
  }, [locale])

  useEffect(() => {
    let active = true
    void refresh().catch((error) => {
      if (active) {
        setLoadError(error instanceof Error ? error.message : 'IDENTITY_OVERVIEW_LOAD_FAILED')
      }
    })
    return () => {
      active = false
    }
  }, [refresh])

  const programs = useMemo(() => payload?.programs ?? [], [payload])

  function startSubmission(program: VerificationProgram) {
    startTransition(async () => {
      const result = await createIdentitySubmissionAction({
        programId: program.id,
        countryCode: countryByProgram[program.id] || null,
      })
      if (result.error) {
        toast.error(result.error)
      }
      else {
        await refresh()
        toast.success(t('Verification started.'))
      }
    })
  }

  function save(program: VerificationProgram, finalize: boolean) {
    if (!program.submission) {
      startSubmission(program)
      return
    }
    startTransition(async () => {
      const result = await saveIdentityAnswersAction({
        submissionId: program.submission!.id,
        expectedRevision: program.submission!.revision,
        answers: answersByProgram[program.id] ?? {},
        finalize,
        consentAccepted: consents[program.id] === true,
        locale,
      })
      if (result.error) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.error)
      }
      else {
        setFieldErrors({})
        await refresh()
        toast.success(finalize ? t('Verification submitted.') : t('Draft saved.'))
      }
    })
  }

  function openProvider(program: VerificationProgram) {
    if (!program.submission || !program.providerConfigId) {
      startSubmission(program)
      return
    }
    startTransition(async () => {
      const result = await createIdentityProviderSessionAction({
        providerConfigId: program.providerConfigId,
        submissionId: program.submission!.id,
        locale,
        consentAccepted: consents[program.id] === true,
      })
      if (result.error || !result.session) {
        toast.error(result.error ?? 'IDENTITY_PROVIDER_NOT_AVAILABLE')
      }
      else {
        window.location.assign(result.session.sessionUrl)
      }
    })
  }

  function uploadDocument(program: VerificationProgram, field: VerificationField, file: File) {
    if (!program.submission || !field.id) {
      toast.error(t('Start verification before uploading a document.'))
      return
    }
    startTransition(async () => {
      const body = new FormData()
      body.set('submissionId', program.submission!.id)
      body.set('fieldId', field.id!)
      body.set('file', file)
      const response = await fetch('/api/identity/documents', { method: 'POST', body })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) {
        toast.error(result.error ?? 'IDENTITY_DOCUMENT_UPLOAD_FAILED')
      }
      else {
        await refresh()
        toast.success(t('Document uploaded and scanned.'))
      }
    })
  }

  if (loadError) {
    return <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{loadError}</div>
  }
  if (!payload) {
    return <div className="min-h-48 animate-pulse rounded-lg border bg-muted/30" />
  }

  return (
    <div className="grid gap-6" data-private="true" data-dd-privacy="mask" data-sentry-mask>
      {programs.length === 0 && <div className="rounded-lg border p-4 text-sm text-muted-foreground">{t('No identity program applies to your account.')}</div>}
      {programs.map((program) => {
        const submission = program.submission
        const editable = !submission || ['draft', 'needs_resubmission'].includes(submission.status)
        const answers = answersByProgram[program.id] ?? {}
        const visibleFields = program.fields
          .filter((field) => {
            const results = field.conditions.map(condition => conditionMatches(condition, answers))
            return field.config.conditionLogic === 'or' ? results.some(Boolean) : results.every(Boolean)
          })
          .sort((left, right) => left.displayOrder - right.displayOrder)
        return (
          <section key={program.id} className="grid gap-5 rounded-xl border bg-background p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <h2 className="text-lg font-semibold">{program.name}</h2>
                {program.description && <p className="text-sm text-muted-foreground">{program.description}</p>}
              </div>
              <span className="rounded-full border px-2.5 py-1 text-xs font-medium">{submission?.status ?? 'not_started'}</span>
            </div>
            {submission?.reasonCode && (
              <p className="rounded-md border bg-muted p-3 text-sm">
                {t('Status reason')}
                :
                {' '}
                {submission.reasonCode}
              </p>
            )}
            {submission?.expiresAt && (
              <p className="text-xs text-muted-foreground">
                {t('Approval expires')}
                :
                {' '}
                {new Date(submission.expiresAt).toLocaleDateString(locale)}
              </p>
            )}

            {editable && !submission && (
              <label className={fieldClassName}>
                {t('Relevant country (ISO alpha-2)')}
                <Input value={countryByProgram[program.id] ?? ''} maxLength={2} onChange={event => setCountryByProgram(previous => ({ ...previous, [program.id]: event.target.value.toUpperCase() }))} placeholder="BR" disabled={pending} />
                {program.countries.length > 0 && (
                  <small className="text-muted-foreground">
                    {t('Supported countries')}
                    :
                    {' '}
                    {program.countries.join(', ')}
                  </small>
                )}
              </label>
            )}

            {editable && submission && program.mode !== 'provider' && (
              <div className="grid gap-4">
                {visibleFields.map(field => (
                  <div key={field.key} className="grid gap-2">
                    {!['heading', 'paragraph', 'notice', 'separator'].includes(field.type) && (
                      <p className="text-xs text-muted-foreground">
                        {t('Purpose')}
                        :
                        {' '}
                        {typeof field.config.purpose === 'string' ? field.config.purpose : '—'}
                        {' · '}
                        {t('Operator policy')}
                        :
                        {' '}
                        {typeof field.config.legalBasis === 'string' ? field.config.legalBasis : '—'}
                        {' · '}
                        {t('Retention')}
                        :
                        {' '}
                        {typeof field.config.retentionDays === 'number' ? `${field.config.retentionDays} ${t('days')}` : '—'}
                        {' · '}
                        {t('Processor')}
                        :
                        {' '}
                        {field.storageMode === 'provider_only' || field.storageMode === 'transient_forward_only' ? t('Verification provider') : t('This platform')}
                      </p>
                    )}
                    <FieldInput
                      field={field}
                      locale={locale}
                      value={answers[field.key]}
                      disabled={pending}
                      error={fieldErrors[field.key]}
                      documents={submission.documents}
                      onChange={value => setAnswersByProgram(previous => ({ ...previous, [program.id]: { ...previous[program.id], [field.key]: value } }))}
                      onUpload={file => uploadDocument(program, field, file)}
                    />
                    {typeof field.config.consentTextByLocale === 'object' && field.config.consentTextByLocale !== null && !Array.isArray(field.config.consentTextByLocale) && typeof (field.config.consentTextByLocale as Record<string, unknown>)[locale] === 'string' && (
                      <p className="rounded-md border bg-muted/40 p-2 text-xs">{String((field.config.consentTextByLocale as Record<string, unknown>)[locale])}</p>
                    )}
                  </div>
                ))}
                {program.consent && (
                  <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                    <input type="checkbox" checked={consents[program.id] === true} onChange={event => setConsents(previous => ({ ...previous, [program.id]: event.target.checked }))} disabled={pending} />
                    <span>
                      {program.consent.content}
                      <small className="block text-muted-foreground">
                        {t('Document version')}
                        :
                        {' '}
                        {program.consent.documentVersion}
                      </small>
                    </span>
                  </label>
                )}
              </div>
            )}

            {editable && submission && program.mode === 'provider' && program.consent && (
              <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                <input type="checkbox" checked={consents[program.id] === true} onChange={event => setConsents(previous => ({ ...previous, [program.id]: event.target.checked }))} disabled={pending} />
                <span>
                  {program.consent.content}
                  <small className="block text-muted-foreground">
                    {t('Document version')}
                    :
                    {' '}
                    {program.consent.documentVersion}
                  </small>
                </span>
              </label>
            )}

            {editable && (
              <div className="flex flex-wrap gap-2">
                {!submission && <Button type="button" disabled={pending} onClick={() => startSubmission(program)}>{t('Start verification')}</Button>}
                {submission && program.mode !== 'provider' && <Button type="button" variant="outline" disabled={pending} onClick={() => save(program, false)}>{t('Save draft')}</Button>}
                {submission && program.mode === 'self_hosted' && <Button type="button" disabled={pending} onClick={() => save(program, true)}>{t('Submit verification')}</Button>}
                {submission && program.mode === 'hybrid' && <Button type="button" disabled={pending} onClick={() => save(program, true)}>{t('Submit data')}</Button>}
                {submission && program.providerConfigId && <Button type="button" disabled={pending} onClick={() => openProvider(program)}>{t('Continue with verification provider')}</Button>}
              </div>
            )}
            {submission && ['pending', 'under_review'].includes(submission.status) && (
              <p className="text-sm text-muted-foreground">
                {t('Your verification is being processed. You can continue browsing while you wait.')}
              </p>
            )}
            {submission?.status === 'approved' && <p className="text-sm text-emerald-600">{t('Your verification is approved.')}</p>}
            {submission && ['approved', 'rejected', 'expired', 'suspended'].includes(submission.status) && (
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  const result = await requestIdentityCorrectionAction({ submissionId: submission.id, expectedRevision: submission.revision })
                  if (result.error) {
                    toast.error(result.error)
                  }
                  else {
                    await refresh()
                    toast.success(t('Correction request opened. Previous access grants were reevaluated.'))
                  }
                })}
              >
                {t('Request correction or resubmission')}
              </Button>
            )}
          </section>
        )
      })}

      <section className="grid gap-4 rounded-xl border bg-background p-5">
        <div>
          <h2 className="text-lg font-semibold">{t('Your identity data')}</h2>
          <p className="text-sm text-muted-foreground">{t('Download a portable copy or request deletion of identity data. Account deletion uses the same tracked erasure process.')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => startTransition(async () => {
              const result = await createIdentityDataExportAction()
              if (result.error) {
                toast.error(result.error)
              }
              else {
                await refresh()
                toast.success(t('Identity data export created.'))
              }
            })}
          >
            {t('Create data export')}
          </Button>
        </div>
        {payload.privacy.exports.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>
              {item.status}
              {' '}
              ·
              {' '}
              {new Date(item.createdAt).toLocaleString(locale)}
            </span>
            {item.status === 'ready' && <a className="text-primary underline" href={`/api/identity/exports/${item.id}`}>{t('Download')}</a>}
          </div>
        ))}
        <div className="grid gap-2 rounded-md border border-destructive/40 p-3">
          <p className="text-sm">{t('Type DELETE to request erasure. Active legal holds or provider failures may delay completion and will be shown transparently.')}</p>
          <p className="text-xs text-muted-foreground">{t('Deletion revokes identity-based access grants immediately. Features that require verification will remain unavailable until a new submission is approved.')}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} placeholder="DELETE" />
            <Button
              type="button"
              variant="destructive"
              disabled={pending || deleteConfirmation !== 'DELETE'}
              onClick={() => startTransition(async () => {
                const result = await requestIdentityErasureAction()
                if (result.error) {
                  toast.error(result.error)
                }
                else {
                  setDeleteConfirmation('')
                  await refresh()
                  toast.success(t('Erasure request processed.'))
                }
              })}
            >
              {t('Delete identity data')}
            </Button>
          </div>
          {payload.privacy.legalHoldActive && <p className="text-sm text-amber-600">{t('A legal hold is delaying deletion. Contact support for details.')}</p>}
          {payload.privacy.requests.map(item => (
            <p key={item.id} className="text-xs text-muted-foreground">
              {item.status}
              {' '}
              ·
              {' '}
              {item.reasonCode ?? '—'}
              {' '}
              ·
              {' '}
              {new Date(item.requestedAt).toLocaleString(locale)}
              {' · '}
              {Object.entries(item.progress).filter(([, value]) => typeof value === 'string').map(([system, value]) => `${system}: ${value}`).join(', ')}
            </p>
          ))}
        </div>
      </section>
    </div>
  )
}
