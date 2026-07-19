'use client'

import type { SUPPORTED_LOCALES } from '@/i18n/locales'
import type { IdentityAdminInitialState, IdentityAdminProgramDraft } from '@/lib/identity/admin-ui-types'
import type { IdentityFieldInput } from '@/lib/identity/types'
import { FileCheckIcon, PlusIcon, ScanFaceIcon, Trash2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  archiveIdentityProgramAction,
  cloneIdentityProgramAction,
  createIdentityDocumentDownloadAction,
  createIdentityLegalHoldAction,
  decideIdentityReviewAction,
  exportIdentityProgramAction,
  importIdentityProgramAction,
  loadIdentityReviewDetailAction,
  publishIdentityProgramAction,
  releaseIdentityLegalHoldAction,
  retryIdentityErasureAction,
  saveIdentityProgramAction,
  saveIdentityProviderAction,
  saveIdentitySettingsAction,
  setIdentityPermissionAction,
  testIdentityProviderAction,
} from '@/app/[locale]/admin/(general)/_actions/identity'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { IDENTITY_CAPABILITIES, IDENTITY_DEFAULT_CONSENT_PLACEHOLDER, IDENTITY_FIELD_TYPES, IDENTITY_SUBMISSION_STATUSES } from '@/lib/identity/constants'
import { DEFAULT_IDENTITY_ACCESS_POLICY, DEFAULT_IDENTITY_RETENTION_POLICY } from '@/lib/identity/schemas'
import SettingsAccordionSection from './SettingsAccordionSection'

const inputClassName = 'h-9 w-full rounded-md border bg-background px-3 text-sm'
const selectClassName = inputClassName
const panelClassName = 'grid gap-4 rounded-lg border bg-muted/20 p-4'
const labelClassName = 'grid gap-1.5 text-sm font-medium'

function buildTranslations(locales: string[], label: string) {
  const locale = locales[0] ?? 'en'
  return [{ locale, label, description: '', helpText: '', placeholder: '' }] as IdentityFieldInput['translations']
}

function createField(locales: string[], index: number): IdentityFieldInput {
  return {
    key: `field_${index + 1}`,
    type: 'short_text',
    storageMode: 'local_encrypted',
    sensitivity: 'personal',
    section: 'identity',
    displayOrder: index,
    required: true,
    config: { normalization: 'trim', maxLength: 255, purpose: 'Identity verification', retentionDays: 365 },
    conditions: [],
    translations: buildTranslations(locales, `Field ${index + 1}`),
    options: [],
  }
}

function createProgram(locales: string[]): IdentityAdminProgramDraft {
  return {
    key: 'identity_program',
    name: 'Identity program',
    description: '',
    version: {
      mode: 'self_hosted',
      decisionPolicy: 'manual_review',
      requiredEvidence: 'self_declared',
      assignmentRules: {
        countries: [],
        minimumAge: null,
        maximumAge: null,
        providerConfigId: null,
        fallbackProviderConfigIds: [],
        consent: {
          key: 'identity_consent',
          documentVersion: '1',
          contentByLocale: Object.fromEntries(locales.map(locale => [locale, IDENTITY_DEFAULT_CONSENT_PLACEHOLDER])) as Partial<Record<(typeof SUPPORTED_LOCALES)[number], string>>,
        },
      },
      accessPolicy: { ...DEFAULT_IDENTITY_ACCESS_POLICY },
      retentionPolicy: { ...DEFAULT_IDENTITY_RETENTION_POLICY },
      fields: [],
    },
  }
}

function normalizeProgram(program: IdentityAdminInitialState['programs'][number]): IdentityAdminProgramDraft {
  return {
    id: program.id,
    key: program.key,
    name: program.name,
    description: program.description,
    version: structuredClone(program.version),
  }
}

function providerMetadata(config: Record<string, unknown>) {
  const keys = [
    'supportedCountries',
    'processingRegion',
    'storageRegion',
    'retentionDays',
    'subprocessors',
    'serviceLevel',
    'contractDocumentationUrl',
  ]
  return Object.fromEntries(Object.entries(config).filter(([key]) => keys.includes(key)))
}

function parseOptions(
  value: string,
  currentLocale: string,
  currentOptions: IdentityFieldInput['options'],
) {
  return value.split('\n').map(line => line.trim()).filter(Boolean).map((line, index) => {
    const [rawKey, ...labelParts] = line.split('=')
    const valueKey = (rawKey ?? '').trim()
    const label = labelParts.join('=').trim() || valueKey
    const existing = currentOptions.find(option => option.valueKey === valueKey)
    const translations = existing?.translations.filter(translation => translation.locale !== currentLocale) ?? []
    return {
      ...(existing?.id ? { id: existing.id } : {}),
      valueKey,
      displayOrder: index,
      config: existing?.config ?? {},
      translations: [...translations, { locale: currentLocale, label }],
    }
  }) as IdentityFieldInput['options']
}

interface ReviewDetail {
  id: string
  status: string
  revision: number
  programName: string
  countryCode: string | null
  fields: Array<{ id: string, label: string, key: string, sensitivity: string, value: unknown }>
  documents: Array<{ id: string, contentType: string, sizeBytes: number, scanStatus: string }>
}

interface IdentityComplianceSectionProps {
  isPending: boolean
  openSections: string[]
  onToggleSection: (value: string) => void
  initialState: IdentityAdminInitialState
}

export default function IdentityComplianceSection({
  isPending,
  openSections,
  onToggleSection,
  initialState,
}: IdentityComplianceSectionProps) {
  const t = useExtracted()
  const [pending, startTransition] = useTransition()
  const disabled = isPending || pending
  const [enabled, setEnabled] = useState(initialState.settings.enabled)
  const [observeOnly, setObserveOnly] = useState(initialState.settings.observeOnly)
  const [program, setProgram] = useState<IdentityAdminProgramDraft>(() => (
    initialState.programs[0] ? normalizeProgram(initialState.programs[0]) : createProgram(initialState.enabledLocales)
  ))
  const [translationLocale, setTranslationLocale] = useState(initialState.enabledLocales[0] ?? 'en')
  const [selectedProviderId, setSelectedProviderId] = useState(initialState.providers[0]?.id ?? '')
  const selectedProvider = initialState.providers.find(provider => provider.id === selectedProviderId)
  const [providerKey, setProviderKey] = useState(selectedProvider?.key ?? 'kyc_provider')
  const [providerName, setProviderName] = useState(selectedProvider?.displayName ?? 'KYC provider')
  const [providerEnvironment, setProviderEnvironment] = useState(selectedProvider?.environment ?? 'sandbox')
  const [providerEnabled, setProviderEnabled] = useState(selectedProvider?.enabled ?? false)
  const [providerVerificationUrl, setProviderVerificationUrl] = useState(String(selectedProvider?.publicConfig.verificationUrl ?? ''))
  const [providerStatusUrl, setProviderStatusUrl] = useState(String(selectedProvider?.publicConfig.statusUrl ?? ''))
  const [providerDeletionUrl, setProviderDeletionUrl] = useState(String(selectedProvider?.publicConfig.deletionUrl ?? ''))
  const [providerStatusMapping, setProviderStatusMapping] = useState(JSON.stringify(selectedProvider?.publicConfig.statusMapping ?? {
    approved: 'approved',
    rejected: 'rejected',
    pending: 'pending',
  }, null, 2))
  const [providerMetadataJson, setProviderMetadataJson] = useState(() => JSON.stringify(providerMetadata(selectedProvider?.publicConfig ?? {}), null, 2))
  const [providerSecret, setProviderSecret] = useState('')
  const [reviewDetail, setReviewDetail] = useState<ReviewDetail | null>(null)
  const [reviewReason, setReviewReason] = useState('MANUAL_REVIEW')
  const [reviewNote, setReviewNote] = useState('')
  const [cloneKey, setCloneKey] = useState('')
  const [cloneName, setCloneName] = useState('')
  const [importReport, setImportReport] = useState('')
  const [permissionUserId, setPermissionUserId] = useState('')
  const [permission, setPermission] = useState('identity_review')
  const [holdUserId, setHoldUserId] = useState('')
  const [holdReason, setHoldReason] = useState('')
  const [holdAuthority, setHoldAuthority] = useState('')
  const [holdExpiresAt, setHoldExpiresAt] = useState('')
  const [operationId, setOperationId] = useState('')

  const selectedProgramMetadata = useMemo(
    () => initialState.programs.find(candidate => candidate.id === program.id),
    [initialState.programs, program.id],
  )
  const publishedDiff = useMemo(() => {
    const published = selectedProgramMetadata?.publishedVersion
    if (!published) {
      return []
    }
    const areas: string[] = []
    if (published.mode !== program.version.mode) {
      areas.push('mode')
    }
    if (published.decisionPolicy !== program.version.decisionPolicy) {
      areas.push('decision policy')
    }
    if (published.requiredEvidence !== program.version.requiredEvidence) {
      areas.push('evidence')
    }
    if (JSON.stringify(published.assignmentRules) !== JSON.stringify(program.version.assignmentRules)) {
      areas.push('assignment')
    }
    if (JSON.stringify(published.accessPolicy) !== JSON.stringify(program.version.accessPolicy)) {
      areas.push('access')
    }
    if (JSON.stringify(published.retentionPolicy) !== JSON.stringify(program.version.retentionPolicy)) {
      areas.push('retention')
    }
    if (JSON.stringify(published.fields) !== JSON.stringify(program.version.fields)) {
      areas.push('fields')
    }
    return areas
  }, [program.version, selectedProgramMetadata?.publishedVersion])

  function run(task: () => Promise<{ error: string | null }>, success: string) {
    startTransition(async () => {
      const result = await task()
      if (result.error) {
        toast.error(result.error)
      }
      else {
        toast.success(success)
      }
    })
  }

  function updateVersion(patch: Partial<IdentityAdminProgramDraft['version']>) {
    setProgram(previous => ({ ...previous, version: { ...previous.version, ...patch } }))
  }

  function updateField(index: number, updater: (field: IdentityFieldInput) => IdentityFieldInput) {
    updateVersion({
      fields: program.version.fields.map((field, fieldIndex) => fieldIndex === index ? updater(field) : field),
    })
  }

  function updateFieldTranslation(index: number, patch: Partial<IdentityFieldInput['translations'][number]>) {
    updateField(index, field => ({
      ...field,
      translations: field.translations.some(translation => translation.locale === translationLocale)
        ? field.translations.map(translation => translation.locale === translationLocale
            ? { ...translation, ...patch }
            : translation)
        : [...field.translations, {
            locale: translationLocale as IdentityFieldInput['translations'][number]['locale'],
            label: '',
            description: '',
            helpText: '',
            placeholder: '',
            ...patch,
          }],
    }))
  }

  function selectProgram(id: string) {
    const selected = initialState.programs.find(candidate => candidate.id === id)
    setProgram(selected ? normalizeProgram(selected) : createProgram(initialState.enabledLocales))
  }

  function selectProvider(id: string) {
    const provider = initialState.providers.find(candidate => candidate.id === id)
    setSelectedProviderId(id)
    setProviderKey(provider?.key ?? 'kyc_provider')
    setProviderName(provider?.displayName ?? 'KYC provider')
    setProviderEnvironment(provider?.environment ?? 'sandbox')
    setProviderEnabled(provider?.enabled ?? false)
    setProviderVerificationUrl(String(provider?.publicConfig.verificationUrl ?? ''))
    setProviderStatusUrl(String(provider?.publicConfig.statusUrl ?? ''))
    setProviderDeletionUrl(String(provider?.publicConfig.deletionUrl ?? ''))
    setProviderStatusMapping(JSON.stringify(provider?.publicConfig.statusMapping ?? {}, null, 2))
    setProviderMetadataJson(JSON.stringify(providerMetadata(provider?.publicConfig ?? {}), null, 2))
    setProviderSecret('')
  }

  function saveSettings() {
    run(() => saveIdentitySettingsAction({ enabled, observeOnly }), t('Identity settings saved.'))
  }

  function saveProgram() {
    startTransition(async () => {
      const result = await saveIdentityProgramAction(program)
      if (result.error || !result.saved) {
        toast.error(result.error ?? t('Unable to save the identity program.'))
        return
      }
      setProgram(previous => ({ ...previous, id: result.saved!.programId }))
      toast.success(t('Identity program draft saved.'))
    })
  }

  function publishProgram() {
    if (!program.id) {
      toast.error(t('Save the draft before publishing.'))
      return
    }
    run(() => publishIdentityProgramAction(program.id!), t('Identity program published.'))
  }

  function saveProvider(removeSecret = false) {
    startTransition(async () => {
      let statusMapping: Record<string, unknown>
      let metadata: Record<string, unknown>
      try {
        statusMapping = JSON.parse(providerStatusMapping) as Record<string, unknown>
        metadata = JSON.parse(providerMetadataJson) as Record<string, unknown>
      }
      catch {
        toast.error(t('Provider status mapping and metadata must be valid JSON.'))
        return
      }
      const result = await saveIdentityProviderAction({
        ...(selectedProviderId ? { id: selectedProviderId } : {}),
        key: providerKey,
        displayName: providerName,
        adapter: 'generic_webhook',
        environment: providerEnvironment,
        enabled: providerEnabled,
        publicConfig: {
          ...metadata,
          verificationUrl: providerVerificationUrl,
          ...(providerStatusUrl ? { statusUrl: providerStatusUrl } : {}),
          ...(providerDeletionUrl ? { deletionUrl: providerDeletionUrl } : {}),
          statusMapping,
          stateParameter: 'state',
          referenceParameter: 'reference',
          returnUrlParameter: 'return_url',
          sessionTtlSeconds: 900,
        },
        ...(providerSecret ? { secret: providerSecret } : {}),
        removeSecret,
      })
      if (result.error) {
        toast.error(result.error)
      }
      else {
        setProviderSecret('')
        toast.success(t('Provider configuration saved.'))
      }
    })
  }

  function loadReview(submissionId: string) {
    startTransition(async () => {
      const result = await loadIdentityReviewDetailAction({ submissionId, reasonCode: reviewReason })
      if (result.error || !result.detail) {
        toast.error(result.error ?? t('Unable to load review.'))
      }
      else {
        setReviewDetail(result.detail as ReviewDetail)
      }
    })
  }

  function downloadReviewDocument(documentId: string) {
    startTransition(async () => {
      const result = await createIdentityDocumentDownloadAction({ documentId, reasonCode: reviewReason })
      if (result.error || !result.token) {
        toast.error(result.error ?? t('Unable to create the secure download.'))
        return
      }
      window.open(`/api/identity/documents/${documentId}?token=${encodeURIComponent(result.token)}`, '_blank', 'noopener,noreferrer')
    })
  }

  function decideReview(decision: 'approved' | 'rejected' | 'needs_resubmission' | 'suspended') {
    if (!reviewDetail) {
      return
    }
    run(() => decideIdentityReviewAction({
      submissionId: reviewDetail.id,
      expectedRevision: reviewDetail.revision,
      decision,
      reasonCode: reviewReason,
      internalNote: reviewNote,
    }), t('Review decision saved.'))
  }

  function exportProgram() {
    if (!program.id) {
      return
    }
    startTransition(async () => {
      const result = await exportIdentityProgramAction(program.id!)
      if (result.error || !result.configuration) {
        toast.error(result.error ?? t('Unable to export program.'))
        return
      }
      const href = URL.createObjectURL(new Blob([JSON.stringify(result.configuration, null, 2)], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = `${program.key}.identity.json`
      anchor.click()
      URL.revokeObjectURL(href)
    })
  }

  function importProgram(file: File | null, dryRun: boolean) {
    if (!file) {
      return
    }
    startTransition(async () => {
      try {
        const configuration = JSON.parse(await file.text()) as unknown
        const result = await importIdentityProgramAction({ configuration, dryRun })
        if (result.error || !result.imported) {
          toast.error(result.error ?? t('Unable to import program.'))
          return
        }
        setImportReport(JSON.stringify(result.imported.report, null, 2))
        toast.success(dryRun ? t('Import validation completed.') : t('Identity program imported.'))
      }
      catch {
        toast.error(t('The import file is not valid JSON.'))
      }
    })
  }

  return (
    <SettingsAccordionSection
      value="identity-compliance"
      isOpen={openSections.includes('identity-compliance')}
      onToggle={onToggleSection}
      header={(
        <h3 className="flex items-center gap-2 text-base font-medium">
          <ScanFaceIcon className="size-4 text-muted-foreground" />
          {t('Identity verification and KYC')}
        </h3>
      )}
    >
      <div className="grid gap-6">
        <section className={panelClassName}>
          <div className="grid gap-1">
            <h3 className="font-semibold">{t('Module rollout')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('Configure and publish a program before enabling enforcement. Observe-only evaluates users without blocking them.')}
            </p>
          </div>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>{t('Enable identity verification')}</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} disabled={disabled} />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>{t('Observe-only rollout')}</span>
            <Switch checked={observeOnly} onCheckedChange={setObserveOnly} disabled={disabled} />
          </label>
          <p className="text-xs text-muted-foreground">
            {t('Policy revision')}
            {': '}
            {initialState.settings.policyRevision}
          </p>
          <Button type="button" className="w-fit" disabled={disabled} onClick={saveSettings}>
            {t('Save identity settings')}
          </Button>
        </section>

        <section className={panelClassName}>
          <div>
            <h3 className="font-semibold">{t('Aggregate health metrics')}</h3>
            <p className="text-sm text-muted-foreground">{t('These counters contain no personal data.')}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-md border p-3">
              <strong className="block text-xl">{Math.round(initialState.metrics.averageReviewMinutes)}</strong>
              <span className="text-xs text-muted-foreground">
                {t('Average review time (minutes)')}
              </span>
            </div>
            <div className="rounded-md border p-3">
              <strong className="block text-xl">{initialState.metrics.pendingErasures}</strong>
              <span className="text-xs text-muted-foreground">
                {t('Pending erasures')}
              </span>
            </div>
            <div className="rounded-md border p-3">
              <strong className="block text-xl">{initialState.metrics.failedProviderEvents}</strong>
              <span className="text-xs text-muted-foreground">
                {t('Failed provider events')}
              </span>
            </div>
            <div className="rounded-md border p-3">
              <strong className="block text-xl">{initialState.metrics.failedOutboxEvents}</strong>
              <span className="text-xs text-muted-foreground">
                {t('Failed outbox events')}
              </span>
            </div>
            <div className="rounded-md border p-3">
              <strong className="block text-xl">{initialState.metrics.statusCounts.reduce((total, item) => total + item.count, 0)}</strong>
              <span className="text-xs text-muted-foreground">
                {t('Total submissions')}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{initialState.metrics.statusCounts.map(item => `${item.status}: ${item.count}`).join(' · ') || t('No submissions yet.')}</p>
        </section>

        <section className={panelClassName}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">{t('Programs and dynamic form builder')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('Programs are country-neutral snapshots. Published versions are immutable.')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select className={selectClassName} value={program.id ?? ''} onChange={event => selectProgram(event.target.value)} disabled={disabled}>
                <option value="">{t('New program')}</option>
                {initialState.programs.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
              </select>
              <Button type="button" variant="outline" disabled={disabled} onClick={() => setProgram(createProgram(initialState.enabledLocales))}>
                <PlusIcon className="size-4" />
                {t('New')}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClassName}>
              {t('Stable program key')}
              <Input value={program.key} onChange={event => setProgram(previous => ({ ...previous, key: event.target.value }))} disabled={disabled} />
            </label>
            <label className={labelClassName}>
              {t('Administrative name')}
              <Input value={program.name} onChange={event => setProgram(previous => ({ ...previous, name: event.target.value }))} disabled={disabled} />
            </label>
          </div>
          <label className={labelClassName}>
            {t('Purpose and description')}
            <Textarea value={program.description} onChange={event => setProgram(previous => ({ ...previous, description: event.target.value }))} disabled={disabled} />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            <label className={labelClassName}>
              {t('Operation mode')}
              <select className={selectClassName} value={program.version.mode} onChange={event => updateVersion({ mode: event.target.value as typeof program.version.mode })} disabled={disabled}>
                <option value="self_hosted">self_hosted</option>
                <option value="provider">provider</option>
                <option value="hybrid">hybrid</option>
              </select>
            </label>
            <label className={labelClassName}>
              {t('Decision policy')}
              <select className={selectClassName} value={program.version.decisionPolicy} onChange={event => updateVersion({ decisionPolicy: event.target.value as typeof program.version.decisionPolicy })} disabled={disabled}>
                <option value="auto_on_valid_submission">auto_on_valid_submission</option>
                <option value="manual_review">manual_review</option>
                <option value="provider_decision">provider_decision</option>
                <option value="provider_plus_manual">provider_plus_manual</option>
                <option value="rules">rules</option>
              </select>
            </label>
            <label className={labelClassName}>
              {t('Required evidence')}
              <select className={selectClassName} value={program.version.requiredEvidence} onChange={event => updateVersion({ requiredEvidence: event.target.value as typeof program.version.requiredEvidence })} disabled={disabled}>
                <option value="self_declared">self_declared</option>
                <option value="document_submitted">document_submitted</option>
                <option value="provider_verified">provider_verified</option>
                <option value="manual_verified">manual_verified</option>
              </select>
            </label>
          </div>
          <label className={labelClassName}>
            {t('Consent text for the selected locale')}
            <Textarea
              value={program.version.assignmentRules.consent?.contentByLocale[translationLocale as (typeof SUPPORTED_LOCALES)[number]] ?? ''}
              onChange={event => updateVersion({ assignmentRules: {
                ...program.version.assignmentRules,
                consent: {
                  key: program.version.assignmentRules.consent?.key ?? 'identity_consent',
                  documentVersion: program.version.assignmentRules.consent?.documentVersion ?? '1',
                  contentByLocale: {
                    ...(program.version.assignmentRules.consent?.contentByLocale ?? {}),
                    [translationLocale]: event.target.value,
                  } as Record<(typeof SUPPORTED_LOCALES)[number], string>,
                },
              } })}
              disabled={disabled}
            />
          </label>
          {program.version.decisionPolicy === 'auto_on_valid_submission' && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              {t('Automatic approval of self-declared data confirms only completion and format; it does not prove identity.')}
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <label className={labelClassName}>
              {t('Countries (ISO alpha-2, comma separated)')}
              <Input
                value={program.version.assignmentRules.countries.join(', ')}
                onChange={event => updateVersion({ assignmentRules: {
                  ...program.version.assignmentRules,
                  countries: event.target.value.split(',').map(value => value.trim().toUpperCase()).filter(Boolean),
                } })}
                placeholder="BR, US, DE"
                disabled={disabled}
              />
            </label>
            <label className={labelClassName}>
              {t('Minimum age')}
              <Input type="number" min={0} max={150} value={program.version.assignmentRules.minimumAge ?? ''} onChange={event => updateVersion({ assignmentRules: { ...program.version.assignmentRules, minimumAge: event.target.value ? Number(event.target.value) : null } })} disabled={disabled} />
            </label>
            <label className={labelClassName}>
              {t('Provider')}
              <select className={selectClassName} value={program.version.assignmentRules.providerConfigId ?? ''} onChange={event => updateVersion({ assignmentRules: { ...program.version.assignmentRules, providerConfigId: event.target.value || null } })} disabled={disabled}>
                <option value="">{t('None')}</option>
                {initialState.providers.map(provider => <option key={provider.id} value={provider.id}>{provider.displayName}</option>)}
              </select>
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className={labelClassName}>
              {t('Fallback provider IDs (comma separated)')}
              <Input value={program.version.assignmentRules.fallbackProviderConfigIds.join(', ')} onChange={event => updateVersion({ assignmentRules: { ...program.version.assignmentRules, fallbackProviderConfigIds: event.target.value.split(',').map(value => value.trim()).filter(Boolean) } })} disabled={disabled} />
            </label>
            <label className={labelClassName}>
              {t('Grace period (days)')}
              <Input type="number" min={0} max={365} value={program.version.accessPolicy.gracePeriodDays} onChange={event => updateVersion({ accessPolicy: { ...program.version.accessPolicy, gracePeriodDays: Number(event.target.value) } })} disabled={disabled} />
            </label>
            <label className={labelClassName}>
              {t('Approval validity (days)')}
              <Input type="number" min={1} max={3650} value={program.version.accessPolicy.approvalValidityDays ?? ''} onChange={event => updateVersion({ accessPolicy: { ...program.version.accessPolicy, approvalValidityDays: event.target.value ? Number(event.target.value) : null } })} disabled={disabled} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={program.version.accessPolicy.blockExistingUsers} onCheckedChange={checked => updateVersion({ accessPolicy: { ...program.version.accessPolicy, blockExistingUsers: checked } })} disabled={disabled} />
            {t('Apply requirements to existing users')}
          </label>

          <fieldset className="grid gap-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-semibold">{t('Capabilities blocked until approval')}</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {IDENTITY_CAPABILITIES.filter(capability => !['browse_public', 'view_account', 'edit_profile', 'cancel_orders', 'claim_or_redeem', 'withdraw'].includes(capability)).map(capability => (
                <label key={capability} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={program.version.accessPolicy.restrictedCapabilities.includes(capability)}
                    onChange={event => updateVersion({ accessPolicy: {
                      ...program.version.accessPolicy,
                      restrictedCapabilities: event.target.checked
                        ? [...program.version.accessPolicy.restrictedCapabilities, capability]
                        : program.version.accessPolicy.restrictedCapabilities.filter(value => value !== capability),
                    } })}
                    disabled={disabled}
                  />
                  {capability}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60">
                <tr>
                  <th className="p-2">{t('Status')}</th>
                  <th className="p-2">{t('Available capabilities preview')}</th>
                </tr>
              </thead>
              <tbody>
                {IDENTITY_SUBMISSION_STATUSES.map((status) => {
                  const unrestricted = ['not_required', 'approved'].includes(status)
                  const available = unrestricted
                    ? IDENTITY_CAPABILITIES
                    : IDENTITY_CAPABILITIES.filter(capability => !program.version.accessPolicy.restrictedCapabilities.includes(capability))
                  return (
                    <tr key={status} className="border-t align-top">
                      <td className="p-2 font-medium">{status}</td>
                      <td className="p-2 text-muted-foreground">{available.join(', ')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {(['draftDays', 'rejectedDays', 'approvedDays', 'expiredDays', 'documentDays', 'technicalEventDays'] as const).map(key => (
              <label key={key} className={labelClassName}>
                {key}
                <Input type="number" min={1} max={3650} value={program.version.retentionPolicy[key]} onChange={event => updateVersion({ retentionPolicy: { ...program.version.retentionPolicy, [key]: Number(event.target.value) } })} disabled={disabled} />
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div>
              <h4 className="font-semibold">{t('Fields')}</h4>
              <p className="text-sm text-muted-foreground">{t('Labels and options must exist for every enabled locale before publication.')}</p>
            </div>
            <div className="flex gap-2">
              <select className={selectClassName} value={translationLocale} onChange={event => setTranslationLocale(event.target.value)}>
                {initialState.enabledLocales.map(locale => <option key={locale} value={locale}>{locale}</option>)}
              </select>
              <Button type="button" variant="outline" disabled={disabled} onClick={() => updateVersion({ fields: [...program.version.fields, createField(initialState.enabledLocales, program.version.fields.length)] })}>
                <PlusIcon className="size-4" />
                {t('Add field')}
              </Button>
            </div>
          </div>

          {program.version.fields.map((field, index) => {
            const translation = field.translations.find(candidate => candidate.locale === translationLocale)
            return (
              <article key={`${field.id ?? 'new'}-${index}`} className="grid gap-3 rounded-lg border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm">{translation?.label || field.key}</strong>
                  <Button type="button" size="icon" variant="ghost" disabled={disabled} onClick={() => updateVersion({ fields: program.version.fields.filter((_, fieldIndex) => fieldIndex !== index).map((item, order) => ({ ...item, displayOrder: order })) })} aria-label={t('Remove field')}>
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-5">
                  <label className={labelClassName}>
                    {t('Stable key')}
                    <Input value={field.key} onChange={event => updateField(index, item => ({ ...item, key: event.target.value }))} disabled={disabled} />
                  </label>
                  <label className={labelClassName}>
                    {t('Type')}
                    <select
                      className={selectClassName}
                      value={field.type}
                      onChange={event => updateField(index, (item) => {
                        const type = event.target.value as typeof item.type
                        const displayOnly = ['heading', 'paragraph', 'notice', 'separator'].includes(type)
                        return { ...item, type, storageMode: displayOnly ? 'derived_result_only' : item.storageMode, options: ['single_select', 'multi_select', 'radio'].includes(type) ? item.options : [] }
                      })}
                      disabled={disabled}
                    >
                      {IDENTITY_FIELD_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>
                  <label className={labelClassName}>
                    {t('Storage')}
                    <select className={selectClassName} value={field.storageMode} onChange={event => updateField(index, item => ({ ...item, storageMode: event.target.value as typeof item.storageMode }))} disabled={disabled}>
                      <option value="local_encrypted">local_encrypted</option>
                      <option value="provider_only">provider_only</option>
                      <option value="transient_forward_only">transient_forward_only</option>
                      <option value="derived_result_only">derived_result_only</option>
                    </select>
                    {field.storageMode === 'local_encrypted' && program.version.mode !== 'self_hosted' && (
                      <small className="text-amber-600">{t('This stores a local encrypted copy even when a provider may already process the same data.')}</small>
                    )}
                  </label>
                  <label className={labelClassName}>
                    {t('Sensitivity')}
                    <select className={selectClassName} value={field.sensitivity} onChange={event => updateField(index, item => ({ ...item, sensitivity: event.target.value as typeof item.sensitivity }))} disabled={disabled}>
                      <option value="public">public</option>
                      <option value="personal">personal</option>
                      <option value="sensitive">sensitive</option>
                      <option value="restricted">restricted</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className={labelClassName}>
                    {t('Label')}
                    <Input value={translation?.label ?? ''} onChange={event => updateFieldTranslation(index, { label: event.target.value })} disabled={disabled} />
                  </label>
                  <label className={labelClassName}>
                    {t('Placeholder')}
                    <Input value={translation?.placeholder ?? ''} onChange={event => updateFieldTranslation(index, { placeholder: event.target.value })} disabled={disabled} />
                  </label>
                  <label className={labelClassName}>
                    {t('Help text')}
                    <Input value={translation?.helpText ?? ''} onChange={event => updateFieldTranslation(index, { helpText: event.target.value })} disabled={disabled} />
                  </label>
                  <label className={labelClassName}>
                    {t('Purpose')}
                    <Input value={field.config.purpose ?? ''} onChange={event => updateField(index, item => ({ ...item, config: { ...item.config, purpose: event.target.value } }))} disabled={disabled} />
                  </label>
                  <label className={labelClassName}>
                    {t('Operator-defined legal basis or policy')}
                    <Input value={field.config.legalBasis ?? ''} onChange={event => updateField(index, item => ({ ...item, config: { ...item.config, legalBasis: event.target.value || undefined } }))} disabled={disabled} />
                  </label>
                  <label className={labelClassName}>
                    {t('Administrative visibility')}
                    <select className={selectClassName} value={field.config.adminVisibility ?? ''} onChange={event => updateField(index, item => ({ ...item, config: { ...item.config, adminVisibility: event.target.value as 'none' | 'reviewers' | 'pii_authorized' } }))} disabled={disabled}>
                      <option value="">—</option>
                      <option value="none">none</option>
                      <option value="reviewers">reviewers</option>
                      <option value="pii_authorized">pii_authorized</option>
                    </select>
                  </label>
                </div>
                <label className={labelClassName}>
                  {t('Advanced field configuration (JSON)')}
                  <Textarea
                    key={JSON.stringify(field.config)}
                    defaultValue={JSON.stringify(field.config, null, 2)}
                    onBlur={(event) => {
                      try {
                        const config = JSON.parse(event.target.value) as IdentityFieldInput['config']
                        updateField(index, item => ({ ...item, config }))
                      }
                      catch {
                        toast.error(t('Advanced field configuration must be valid JSON.'))
                      }
                    }}
                    disabled={disabled}
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-4">
                  <label className={labelClassName}>
                    {t('Minimum length')}
                    <Input type="number" min={0} value={field.config.minLength ?? ''} onChange={event => updateField(index, item => ({ ...item, config: { ...item.config, minLength: event.target.value ? Number(event.target.value) : undefined } }))} disabled={disabled} />
                  </label>
                  <label className={labelClassName}>
                    {t('Maximum length')}
                    <Input type="number" min={1} value={field.config.maxLength ?? ''} onChange={event => updateField(index, item => ({ ...item, config: { ...item.config, maxLength: event.target.value ? Number(event.target.value) : undefined } }))} disabled={disabled} />
                  </label>
                  <label className={labelClassName}>
                    {t('Display mask')}
                    <Input value={field.config.displayMask ?? ''} onChange={event => updateField(index, item => ({ ...item, config: { ...item.config, displayMask: event.target.value || undefined } }))} disabled={disabled} />
                  </label>
                  <label className={labelClassName}>
                    {t('Trusted validator key')}
                    <Input value={field.config.validatorKey ?? ''} placeholder="br_cpf_v1" onChange={event => updateField(index, item => ({ ...item, config: { ...item.config, validatorKey: event.target.value || undefined } }))} disabled={disabled} />
                  </label>
                  <label className={labelClassName}>
                    {t('Field retention (days)')}
                    <Input type="number" min={1} max={3650} value={field.config.retentionDays ?? ''} onChange={event => updateField(index, item => ({ ...item, config: { ...item.config, retentionDays: event.target.value ? Number(event.target.value) : undefined } }))} disabled={disabled} />
                  </label>
                </div>
                {['file', 'document'].includes(field.type) && (
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className={labelClassName}>
                      {t('Maximum file size (bytes)')}
                      <Input type="number" min={1} max={10 * 1024 * 1024} value={field.config.maximumFileBytes ?? ''} onChange={event => updateField(index, item => ({ ...item, config: { ...item.config, maximumFileBytes: event.target.value ? Number(event.target.value) : undefined } }))} disabled={disabled} />
                    </label>
                    <label className={labelClassName}>
                      {t('Allowed content types (comma separated)')}
                      <Input value={(field.config.allowedContentTypes ?? []).join(', ')} placeholder="image/jpeg, image/png, application/pdf" onChange={event => updateField(index, item => ({ ...item, config: { ...item.config, allowedContentTypes: event.target.value.split(',').map(value => value.trim()).filter(Boolean) as typeof item.config.allowedContentTypes } }))} disabled={disabled} />
                    </label>
                    <label className={labelClassName}>
                      {t('Maximum files')}
                      <Input type="number" min={1} max={10} value={field.config.maximumFiles ?? 1} onChange={event => updateField(index, item => ({ ...item, config: { ...item.config, maximumFiles: Number(event.target.value) } }))} disabled={disabled} />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={field.config.stripMetadata === true} onChange={event => updateField(index, item => ({ ...item, config: { ...item.config, stripMetadata: event.target.checked } }))} disabled={disabled} />
                      {t('Strip image metadata when safe')}
                    </label>
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <label className={labelClassName}>
                    {t('Safe regular expression')}
                    <Input value={field.config.pattern ?? ''} onChange={event => updateField(index, item => ({ ...item, config: { ...item.config, pattern: event.target.value || undefined } }))} disabled={disabled} />
                  </label>
                  <label className={labelClassName}>
                    {t('Conditional rules (JSON)')}
                    <Input
                      defaultValue={JSON.stringify(field.conditions)}
                      onBlur={(event) => {
                        try {
                          const conditions = JSON.parse(event.target.value) as IdentityFieldInput['conditions']
                          updateField(index, item => ({ ...item, conditions }))
                        }
                        catch {
                          toast.error(t('Conditional rules must be valid JSON.'))
                        }
                      }}
                      disabled={disabled}
                    />
                  </label>
                </div>
                {['single_select', 'multi_select', 'radio'].includes(field.type) && (
                  <label className={labelClassName}>
                    {t('Options (one key=label per line)')}
                    <Textarea defaultValue={field.options.map(option => `${option.valueKey}=${option.translations.find(item => item.locale === translationLocale)?.label ?? ''}`).join('\n')} onBlur={event => updateField(index, item => ({ ...item, options: parseOptions(event.target.value, translationLocale, item.options) }))} disabled={disabled} />
                  </label>
                )}
                <div className="flex flex-wrap gap-6 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={field.required} onChange={event => updateField(index, item => ({ ...item, required: event.target.checked }))} disabled={disabled} />
                    {t('Required')}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={field.config.duplicateDetection === true} onChange={event => updateField(index, item => ({ ...item, config: { ...item.config, duplicateDetection: event.target.checked } }))} disabled={disabled} />
                    {t('Detect duplicates with blind index')}
                  </label>
                </div>
              </article>
            )
          })}

          <section className="grid gap-3 rounded-lg border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold">{t('Responsive form preview')}</h4>
              <span className="text-xs text-muted-foreground">
                {selectedProgramMetadata?.publishedVersion
                  ? publishedDiff.length > 0 ? `${t('Changed areas')}: ${publishedDiff.join(', ')}` : t('No changes from the published version.')
                  : t('This program has no published version yet.')}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[...program.version.fields].sort((left, right) => left.displayOrder - right.displayOrder).map((field) => {
                const translation = field.translations.find(candidate => candidate.locale === translationLocale)
                if (field.type === 'separator') {
                  return <hr key={field.key} className="md:col-span-2" />
                }
                if (['heading', 'paragraph', 'notice'].includes(field.type)) {
                  return (
                    <div
                      key={field.key}
                      className="md:col-span-2"
                    >
                      <strong>{translation?.label || field.key}</strong>
                      <p className="text-sm text-muted-foreground">
                        {translation?.description}
                      </p>
                    </div>
                  )
                }
                return (
                  <label key={field.key} className={labelClassName}>
                    {translation?.label || field.key}
                    {['long_text', 'address'].includes(field.type)
                      ? <Textarea disabled placeholder={translation?.placeholder} />
                      : <Input disabled placeholder={translation?.placeholder || field.type} />}
                  </label>
                )
              })}
              {program.version.fields.length === 0 && <p className="text-sm text-muted-foreground">{t('Add fields to preview the form.')}</p>}
            </div>
          </section>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button type="button" disabled={disabled} onClick={saveProgram}>{t('Save draft')}</Button>
            <Button type="button" variant="secondary" disabled={disabled || !program.id} onClick={publishProgram}>{t('Publish')}</Button>
            <Button type="button" variant="outline" disabled={disabled || !program.id} onClick={exportProgram}>{t('Export JSON')}</Button>
            <label className="inline-flex cursor-pointer items-center rounded-md border px-3 text-sm font-medium">
              {t('Validate import')}
              <input type="file" accept="application/json,.json" className="sr-only" onChange={event => importProgram(event.target.files?.[0] ?? null, true)} disabled={disabled} />
            </label>
            <label className="inline-flex cursor-pointer items-center rounded-md border px-3 text-sm font-medium">
              {t('Import JSON')}
              <input type="file" accept="application/json,.json" className="sr-only" onChange={event => importProgram(event.target.files?.[0] ?? null, false)} disabled={disabled} />
            </label>
            {selectedProgramMetadata && (
              <Button type="button" variant="destructive" disabled={disabled} onClick={() => run(() => archiveIdentityProgramAction(selectedProgramMetadata.id), t('Program archived.'))}>
                {t('Archive')}
              </Button>
            )}
          </div>
          {importReport && <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{importReport}</pre>}
          {program.id && (
            <div className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_1fr_auto]">
              <Input value={cloneKey} onChange={event => setCloneKey(event.target.value)} placeholder={t('New stable key')} />
              <Input value={cloneName} onChange={event => setCloneName(event.target.value)} placeholder={t('New program name')} />
              <Button type="button" variant="outline" disabled={disabled || !cloneKey || !cloneName} onClick={() => run(() => cloneIdentityProgramAction({ programId: program.id!, key: cloneKey, name: cloneName }), t('Program cloned.'))}>{t('Clone')}</Button>
            </div>
          )}
        </section>

        <section className={panelClassName}>
          <div>
            <h3 className="font-semibold">{t('Provider adapter')}</h3>
            <p className="text-sm text-muted-foreground">{t('Secrets are encrypted and never returned to this page. Webhooks require HMAC signatures and idempotent event IDs.')}</p>
          </div>
          <select className={selectClassName} value={selectedProviderId} onChange={event => selectProvider(event.target.value)} disabled={disabled}>
            <option value="">{t('New provider')}</option>
            {initialState.providers.map(provider => <option key={provider.id} value={provider.id}>{provider.displayName}</option>)}
          </select>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClassName}>
              {t('Provider key')}
              <Input value={providerKey} onChange={event => setProviderKey(event.target.value)} disabled={disabled} />
            </label>
            <label className={labelClassName}>
              {t('Display name')}
              <Input value={providerName} onChange={event => setProviderName(event.target.value)} disabled={disabled} />
            </label>
            <label className={labelClassName}>
              {t('Environment')}
              <select className={selectClassName} value={providerEnvironment} onChange={event => setProviderEnvironment(event.target.value)} disabled={disabled}>
                <option value="sandbox">sandbox</option>
                <option value="production">production</option>
              </select>
            </label>
            <label className={labelClassName}>
              {t('Verification URL')}
              <Input type="url" value={providerVerificationUrl} onChange={event => setProviderVerificationUrl(event.target.value)} disabled={disabled} />
            </label>
            <label className={labelClassName}>
              {t('Status reconciliation URL (optional)')}
              <Input type="url" value={providerStatusUrl} onChange={event => setProviderStatusUrl(event.target.value)} disabled={disabled} />
            </label>
            <label className={labelClassName}>
              {t('Deletion URL (optional)')}
              <Input type="url" value={providerDeletionUrl} onChange={event => setProviderDeletionUrl(event.target.value)} disabled={disabled} />
            </label>
            <label className={labelClassName}>
              {t('Webhook secret')}
              <Input type="password" autoComplete="new-password" value={providerSecret} onChange={event => setProviderSecret(event.target.value)} placeholder={selectedProvider?.secretConfigured ? t('Configured — leave blank to keep') : ''} disabled={disabled} />
              {selectedProvider?.secretRotatedAt && (
                <small className="text-muted-foreground">
                  {t('Last secret rotation')}
                  :
                  {' '}
                  {new Date(selectedProvider.secretRotatedAt).toLocaleString()}
                </small>
              )}
            </label>
          </div>
          <label className={labelClassName}>
            {t('Provider status mapping (JSON)')}
            <Textarea value={providerStatusMapping} onChange={event => setProviderStatusMapping(event.target.value)} disabled={disabled} />
          </label>
          <label className={labelClassName}>
            {t('Provider coverage, regions, retention, subprocessors and SLA (JSON)')}
            <Textarea value={providerMetadataJson} onChange={event => setProviderMetadataJson(event.target.value)} disabled={disabled} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={providerEnabled} onCheckedChange={setProviderEnabled} disabled={disabled} />
            {t('Enable provider')}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={disabled} onClick={() => saveProvider(false)}>{t('Save provider')}</Button>
            <Button type="button" variant="outline" disabled={disabled || !selectedProviderId} onClick={() => run(() => testIdentityProviderAction(selectedProviderId), t('Provider connection is healthy.'))}>{t('Test connection')}</Button>
            <Button type="button" variant="destructive" disabled={disabled || !selectedProviderId || !selectedProvider?.secretConfigured || providerEnabled} onClick={() => saveProvider(true)}>{t('Remove saved secret')}</Button>
          </div>
        </section>

        {initialState.permissions.includes('identity_review') && (
          <section className={panelClassName}>
            <div>
              <h3 className="font-semibold">{t('Manual review queue')}</h3>
              <p className="text-sm text-muted-foreground">{t('Opening personal data requires the PII permission and two-factor authentication.')}</p>
            </div>
            <div className="grid gap-2">
              {initialState.reviewQueue.length === 0 && <p className="text-sm text-muted-foreground">{t('No submissions waiting for review.')}</p>}
              {initialState.reviewQueue.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="
                    flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-left text-sm
                  "
                  onClick={() => loadReview(item.id)}
                  disabled={disabled}
                >
                  <span>
                    <strong>{item.programName}</strong>
                    <br />
                    <span className="text-muted-foreground">
                      {item.countryCode ?? '—'}
                      {' '}
                      ·
                      {' '}
                      {item.status}
                      {' '}
                      · #
                      {item.attemptNumber}
                    </span>
                  </span>
                  <FileCheckIcon className="size-5" />
                </button>
              ))}
            </div>
            {reviewDetail && (
              <div className="grid gap-3 rounded-md border bg-background p-3">
                <strong>
                  {reviewDetail.programName}
                  {' '}
                  ·
                  {' '}
                  {reviewDetail.countryCode ?? '—'}
                </strong>
                {reviewDetail.fields.map(field => (
                  <div key={field.id} className="grid gap-1 border-b pb-2 text-sm last:border-0">
                    <span className="font-medium">
                      {field.label}
                      {' '}
                      <small className="text-muted-foreground">
                        (
                        {field.sensitivity}
                        )
                      </small>
                    </span>
                    <pre className="overflow-auto text-xs whitespace-pre-wrap">{JSON.stringify(field.value, null, 2)}</pre>
                  </div>
                ))}
                {reviewDetail.documents.map(document => (
                  <button key={document.id} type="button" className="w-fit text-left text-sm text-primary underline" disabled={disabled} onClick={() => downloadReviewDocument(document.id)}>
                    {t('Download scanned document')}
                    {' '}
                    (
                    {document.contentType}
                    ,
                    {Math.ceil(document.sizeBytes / 1024)}
                    {' '}
                    KB)
                  </button>
                ))}
                <Input value={reviewReason} onChange={event => setReviewReason(event.target.value.toUpperCase())} placeholder={t('Public reason code')} />
                <Textarea value={reviewNote} onChange={event => setReviewNote(event.target.value)} placeholder={t('Encrypted internal note')} />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={disabled} onClick={() => decideReview('approved')}>{t('Approve')}</Button>
                  <Button type="button" variant="destructive" disabled={disabled} onClick={() => decideReview('rejected')}>{t('Reject')}</Button>
                  <Button type="button" variant="outline" disabled={disabled} onClick={() => decideReview('needs_resubmission')}>{t('Request resubmission')}</Button>
                  <Button type="button" variant="outline" disabled={disabled} onClick={() => decideReview('suspended')}>{t('Suspend')}</Button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className={panelClassName}>
          <div>
            <h3 className="font-semibold">{t('Restricted operations')}</h3>
            <p className="text-sm text-muted-foreground">{t('These operations require explicit permissions and two-factor authentication. IDs are used instead of searchable plaintext identity data.')}</p>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
            <Input value={permissionUserId} onChange={event => setPermissionUserId(event.target.value)} placeholder={t('Administrator user ID')} />
            <select className={selectClassName} value={permission} onChange={event => setPermission(event.target.value)}>
              {['identity_review', 'identity_view_pii', 'identity_export', 'identity_delete', 'identity_audit', 'identity_manage_legal_hold'].map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <Button type="button" variant="outline" disabled={disabled || !permissionUserId} onClick={() => run(() => setIdentityPermissionAction({ userId: permissionUserId, permission: permission as 'identity_review', enabled: true }), t('Permission granted.'))}>{t('Grant')}</Button>
            <Button type="button" variant="outline" disabled={disabled || !permissionUserId} onClick={() => run(() => setIdentityPermissionAction({ userId: permissionUserId, permission: permission as 'identity_review', enabled: false }), t('Permission revoked.'))}>{t('Revoke')}</Button>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <Input value={holdUserId} onChange={event => setHoldUserId(event.target.value)} placeholder={t('Subject user ID')} />
            <Input value={holdReason} onChange={event => setHoldReason(event.target.value)} placeholder={t('Legal hold reason')} />
            <Input value={holdAuthority} onChange={event => setHoldAuthority(event.target.value)} placeholder={t('Authority or case')} />
            <Input type="datetime-local" value={holdExpiresAt} onChange={event => setHoldExpiresAt(event.target.value)} aria-label={t('Legal hold review deadline')} />
            <Button type="button" variant="outline" disabled={disabled || !holdUserId || !holdReason || !holdAuthority || !holdExpiresAt} onClick={() => run(() => createIdentityLegalHoldAction({ userId: holdUserId, reason: holdReason, authority: holdAuthority, expiresAt: new Date(holdExpiresAt).toISOString() }), t('Legal hold created.'))}>{t('Create hold')}</Button>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <Input value={operationId} onChange={event => setOperationId(event.target.value)} placeholder={t('Erasure request or legal hold ID')} />
            <Button type="button" variant="outline" disabled={disabled || !operationId} onClick={() => run(() => retryIdentityErasureAction(operationId), t('Erasure retried.'))}>{t('Retry erasure')}</Button>
            <Button type="button" variant="outline" disabled={disabled || !operationId} onClick={() => run(() => releaseIdentityLegalHoldAction(operationId), t('Legal hold released.'))}>{t('Release hold')}</Button>
          </div>
        </section>
      </div>
    </SettingsAccordionSection>
  )
}
