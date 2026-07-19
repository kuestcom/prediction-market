import type {
  IdentityFieldInput,
  IdentityFieldOptionInput,
  IdentityProgramInput,
  IdentityProgramVersionInput,
} from '@/lib/identity/types'
import { createHash } from 'node:crypto'
import { and, asc, desc, eq, inArray, max } from 'drizzle-orm'
import {
  identity_audit_events,
  identity_field_option_translations,
  identity_field_options,
  identity_field_translations,
  identity_fields,
  identity_outbox_events,
  identity_program_assignments,
  identity_program_versions,
  identity_programs,
} from '@/lib/db/schema/identity/tables'
import { db } from '@/lib/drizzle'
import { IdentityProgramSchema, validateIdentityProgramForPublication } from '@/lib/identity/schemas'
import 'server-only'

interface IdentityProgramAdminDto {
  id: string
  key: string
  name: string
  description: string
  status: string
  activeVersionId: string | null
  draftVersionId: string | null
  versionNumber: number
  versionStatus: string
  version: IdentityProgramVersionInput
  publishedVersion: IdentityProgramVersionInput | null
}

type IdentityTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

function mapField(
  row: typeof identity_fields.$inferSelect,
  translations: Array<typeof identity_field_translations.$inferSelect>,
  options: Array<typeof identity_field_options.$inferSelect>,
  optionTranslations: Array<typeof identity_field_option_translations.$inferSelect>,
): IdentityFieldInput {
  return {
    id: row.id,
    key: row.key,
    type: row.type as IdentityFieldInput['type'],
    storageMode: row.storage_mode as IdentityFieldInput['storageMode'],
    sensitivity: row.sensitivity as IdentityFieldInput['sensitivity'],
    section: row.section,
    displayOrder: row.display_order,
    required: row.required,
    config: row.config ?? {},
    conditions: (row.conditions ?? []) as unknown as IdentityFieldInput['conditions'],
    translations: translations
      .filter(translation => translation.field_id === row.id)
      .map(translation => ({
        locale: translation.locale as IdentityFieldInput['translations'][number]['locale'],
        label: translation.label,
        description: translation.description,
        helpText: translation.help_text,
        placeholder: translation.placeholder,
      })),
    options: options
      .filter(option => option.field_id === row.id)
      .sort((left, right) => left.display_order - right.display_order)
      .map((option): IdentityFieldOptionInput => ({
        id: option.id,
        valueKey: option.value_key,
        displayOrder: option.display_order,
        config: option.config ?? {},
        translations: optionTranslations
          .filter(translation => translation.option_id === option.id)
          .map(translation => ({
            locale: translation.locale as IdentityFieldOptionInput['translations'][number]['locale'],
            label: translation.label,
          })),
      })),
  }
}

async function loadVersionRows(versionIds: string[]) {
  if (versionIds.length === 0) {
    return { fields: [], translations: [], options: [], optionTranslations: [] }
  }
  const fields = await db.select().from(identity_fields).where(inArray(identity_fields.program_version_id, versionIds)).orderBy(asc(identity_fields.display_order))
  const fieldIds = fields.map(field => field.id)
  if (fieldIds.length === 0) {
    return { fields, translations: [], options: [], optionTranslations: [] }
  }
  const [translations, options] = await Promise.all([
    db.select().from(identity_field_translations).where(inArray(identity_field_translations.field_id, fieldIds)),
    db.select().from(identity_field_options).where(inArray(identity_field_options.field_id, fieldIds)),
  ])
  const optionIds = options.map(option => option.id)
  const optionTranslations = optionIds.length > 0
    ? await db.select().from(identity_field_option_translations).where(inArray(identity_field_option_translations.option_id, optionIds))
    : []
  return { fields, translations, options, optionTranslations }
}

async function loadVersionRowsForUpdate(tx: IdentityTransaction, versionId: string) {
  const fields = await tx.select().from(identity_fields).where(eq(identity_fields.program_version_id, versionId)).orderBy(asc(identity_fields.display_order))
  const fieldIds = fields.map(field => field.id)
  if (fieldIds.length === 0) {
    return { fields, translations: [], options: [], optionTranslations: [] }
  }
  const [translations, options] = await Promise.all([
    tx.select().from(identity_field_translations).where(inArray(identity_field_translations.field_id, fieldIds)),
    tx.select().from(identity_field_options).where(inArray(identity_field_options.field_id, fieldIds)),
  ])
  const optionIds = options.map(option => option.id)
  const optionTranslations = optionIds.length > 0
    ? await tx.select().from(identity_field_option_translations).where(inArray(identity_field_option_translations.option_id, optionIds))
    : []
  return { fields, translations, options, optionTranslations }
}

async function insertVersionFields(
  tx: IdentityTransaction,
  versionId: string,
  fields: IdentityFieldInput[],
) {
  for (const field of fields) {
    const [createdField] = await tx.insert(identity_fields).values({
      program_version_id: versionId,
      key: field.key,
      type: field.type,
      storage_mode: field.storageMode,
      sensitivity: field.sensitivity,
      section: field.section,
      display_order: field.displayOrder,
      required: field.required,
      config: field.config,
      conditions: field.conditions as Record<string, unknown>[],
    }).returning({ id: identity_fields.id })
    if (!createdField) {
      throw new Error('IDENTITY_FIELD_CREATE_FAILED')
    }

    if (field.translations.length > 0) {
      await tx.insert(identity_field_translations).values(field.translations.map(translation => ({
        field_id: createdField.id,
        locale: translation.locale,
        label: translation.label,
        description: translation.description,
        help_text: translation.helpText,
        placeholder: translation.placeholder,
      })))
    }

    for (const option of field.options) {
      const [createdOption] = await tx.insert(identity_field_options).values({
        field_id: createdField.id,
        value_key: option.valueKey,
        display_order: option.displayOrder,
        config: option.config,
      }).returning({ id: identity_field_options.id })
      if (!createdOption) {
        throw new Error('IDENTITY_FIELD_OPTION_CREATE_FAILED')
      }
      if (option.translations.length > 0) {
        await tx.insert(identity_field_option_translations).values(option.translations.map(translation => ({
          option_id: createdOption.id,
          locale: translation.locale,
          label: translation.label,
        })))
      }
    }
  }
}

export const IdentityProgramRepository = {
  async getVersionForm(versionId: string) {
    const [version] = await db.select().from(identity_program_versions).where(eq(identity_program_versions.id, versionId)).limit(1)
    if (!version) {
      return null
    }
    const rows = await loadVersionRows([versionId])
    return {
      id: version.id,
      programId: version.program_id,
      versionNumber: version.version,
      status: version.status,
      mode: version.mode,
      decisionPolicy: version.decision_policy,
      requiredEvidence: version.required_evidence,
      assignmentRules: version.assignment_rules,
      accessPolicy: version.access_policy,
      retentionPolicy: version.retention_policy,
      fields: rows.fields.map(field => mapField(field, rows.translations, rows.options, rows.optionTranslations)),
    } as const
  },

  async listAdminPrograms(): Promise<IdentityProgramAdminDto[]> {
    const programs = await db.select().from(identity_programs).orderBy(asc(identity_programs.name))
    if (programs.length === 0) {
      return []
    }
    const versions = await db.select().from(identity_program_versions).where(inArray(identity_program_versions.program_id, programs.map(program => program.id))).orderBy(desc(identity_program_versions.version))

    const selectedVersions = programs.map((program) => {
      const programVersions = versions.filter(version => version.program_id === program.id)
      return programVersions.find(version => version.status === 'draft')
        ?? programVersions.find(version => version.id === program.active_version_id)
        ?? programVersions[0]
    }).filter((version): version is typeof identity_program_versions.$inferSelect => Boolean(version))
    const activeVersions = versions.filter(version => programs.some(program => program.active_version_id === version.id))

    const rows = await loadVersionRows([...new Set([...selectedVersions, ...activeVersions].map(version => version.id))])

    function versionInput(version: typeof identity_program_versions.$inferSelect): IdentityProgramVersionInput {
      return {
        mode: version.mode,
        decisionPolicy: version.decision_policy,
        requiredEvidence: version.required_evidence,
        assignmentRules: version.assignment_rules,
        accessPolicy: version.access_policy,
        retentionPolicy: version.retention_policy,
        fields: rows.fields
          .filter(field => field.program_version_id === version.id)
          .map(field => mapField(field, rows.translations, rows.options, rows.optionTranslations)),
      } as unknown as IdentityProgramVersionInput
    }

    return programs.flatMap((program) => {
      const version = selectedVersions.find(candidate => candidate.program_id === program.id)
      if (!version) {
        return []
      }
      const publishedVersion = activeVersions.find(candidate => candidate.id === program.active_version_id)
      return [{
        id: program.id,
        key: program.key,
        name: program.name,
        description: program.description,
        status: program.status,
        activeVersionId: program.active_version_id,
        draftVersionId: version.status === 'draft' ? version.id : null,
        versionNumber: version.version,
        versionStatus: version.status,
        version: versionInput(version),
        publishedVersion: publishedVersion ? versionInput(publishedVersion) : null,
      }]
    })
  },

  async saveDraft(input: IdentityProgramInput, actorUserId: string) {
    const parsed = IdentityProgramSchema.parse(input)
    return db.transaction(async (tx) => {
      let program: typeof identity_programs.$inferSelect | undefined
      if (parsed.id) {
        ;[program] = await tx.select().from(identity_programs).where(eq(identity_programs.id, parsed.id)).for('update')
        if (!program) {
          throw new Error('IDENTITY_PROGRAM_NOT_FOUND')
        }
      }
      else {
        ;[program] = await tx.insert(identity_programs).values({
          key: parsed.key,
          name: parsed.name,
          description: parsed.description,
          created_by_user_id: actorUserId,
        }).returning()
      }
      if (!program) {
        throw new Error('IDENTITY_PROGRAM_CREATE_FAILED')
      }

      const versions = await tx.select().from(identity_program_versions).where(eq(identity_program_versions.program_id, program.id)).orderBy(desc(identity_program_versions.version))
      let draft = versions.find(version => version.status === 'draft')
      if (!draft) {
        const nextVersion = (versions[0]?.version ?? 0) + 1
        ;[draft] = await tx.insert(identity_program_versions).values({
          program_id: program.id,
          version: nextVersion,
          created_by_user_id: actorUserId,
        }).returning()
      }
      if (!draft) {
        throw new Error('IDENTITY_VERSION_CREATE_FAILED')
      }

      await tx.update(identity_program_versions).set({
        mode: parsed.version.mode,
        decision_policy: parsed.version.decisionPolicy,
        required_evidence: parsed.version.requiredEvidence,
        assignment_rules: parsed.version.assignmentRules,
        access_policy: parsed.version.accessPolicy,
        retention_policy: parsed.version.retentionPolicy,
      }).where(eq(identity_program_versions.id, draft.id))

      await tx.delete(identity_program_assignments)
        .where(eq(identity_program_assignments.program_version_id, draft.id))
      const countries = parsed.version.assignmentRules.countries
      await tx.insert(identity_program_assignments).values(countries.length > 0
        ? countries.map((country, index) => ({
            program_version_id: draft!.id,
            country_code: country,
            priority: index,
            is_fallback: false,
            rules: {},
          }))
        : [{
            program_version_id: draft.id,
            country_code: null,
            priority: 0,
            is_fallback: true,
            rules: {},
          }])

      await tx.delete(identity_fields).where(eq(identity_fields.program_version_id, draft.id))
      await insertVersionFields(tx, draft.id, parsed.version.fields)

      await tx.update(identity_programs).set({
        key: parsed.key,
        name: parsed.name,
        description: parsed.description,
        status: program.status === 'archived'
          ? 'archived'
          : program.active_version_id ? 'published' : 'draft',
      }).where(eq(identity_programs.id, program.id))

      await tx.insert(identity_audit_events).values({
        actor_user_id: actorUserId,
        action: 'identity.program.draft_saved',
        target_type: 'identity_program',
        target_id: program.id,
        result: 'success',
        metadata: { version: draft.version, fieldCount: parsed.version.fields.length },
      })

      return { programId: program.id, versionId: draft.id, version: draft.version }
    })
  },

  async publish(
    programId: string,
    enabledLocales: readonly string[],
    actorUserId: string,
    assertActivationReady?: (version: IdentityProgramVersionInput) => Promise<void>,
  ) {
    return db.transaction(async (tx) => {
      const [lockedProgram] = await tx.select().from(identity_programs).where(eq(identity_programs.id, programId)).for('update')
      const [draft] = await tx.select().from(identity_program_versions).where(and(
        eq(identity_program_versions.program_id, programId),
        eq(identity_program_versions.status, 'draft'),
      )).orderBy(desc(identity_program_versions.version)).limit(1).for('update')
      if (!lockedProgram || !draft) {
        throw new Error('IDENTITY_DRAFT_NOT_FOUND')
      }

      const rows = await loadVersionRowsForUpdate(tx, draft.id)
      const version = {
        mode: draft.mode,
        decisionPolicy: draft.decision_policy,
        requiredEvidence: draft.required_evidence,
        assignmentRules: draft.assignment_rules,
        accessPolicy: draft.access_policy,
        retentionPolicy: draft.retention_policy,
        fields: rows.fields.map(field => mapField(field, rows.translations, rows.options, rows.optionTranslations)),
      } as unknown as IdentityProgramVersionInput
      const validation = validateIdentityProgramForPublication({
        id: lockedProgram.id,
        key: lockedProgram.key,
        name: lockedProgram.name,
        description: lockedProgram.description,
        version,
      }, enabledLocales)
      if (!validation.success) {
        throw validation.error
      }
      if (assertActivationReady) {
        await assertActivationReady(validation.data.version)
      }

      if (lockedProgram.active_version_id && lockedProgram.active_version_id !== draft.id) {
        await tx.update(identity_program_versions).set({
          status: 'archived',
          archived_at: new Date(),
        }).where(eq(identity_program_versions.id, lockedProgram.active_version_id))
      }
      await tx.update(identity_program_versions).set({
        status: 'published',
        published_at: new Date(),
      }).where(eq(identity_program_versions.id, draft.id))
      await tx.update(identity_programs).set({
        status: 'published',
        active_version_id: draft.id,
      }).where(eq(identity_programs.id, programId))

      const [{ currentMax }] = await tx.select({ currentMax: max(identity_program_versions.version) })
        .from(identity_program_versions)
        .where(eq(identity_program_versions.program_id, programId))
      const policyRevision = currentMax ?? draft.version
      await tx.insert(identity_outbox_events).values({
        event_type: 'identity.program.published',
        aggregate_type: 'identity_program',
        aggregate_id: programId,
        idempotency_key: `identity-program-published:${programId}:${draft.version}`,
        payload: { contractVersion: 1, programId, versionId: draft.id, version: draft.version, policyRevision },
      }).onConflictDoNothing()
      await tx.insert(identity_audit_events).values({
        actor_user_id: actorUserId,
        action: 'identity.program.published',
        target_type: 'identity_program',
        target_id: programId,
        result: 'success',
        metadata: { version: draft.version },
      })

      return { programId, versionId: draft.id, version: draft.version }
    })
  },

  async archive(programId: string, actorUserId: string) {
    return db.transaction(async (tx) => {
      const [program] = await tx.update(identity_programs).set({ status: 'archived' }).where(eq(identity_programs.id, programId)).returning({ id: identity_programs.id })
      if (!program) {
        throw new Error('IDENTITY_PROGRAM_NOT_FOUND')
      }
      await tx.insert(identity_audit_events).values({
        actor_user_id: actorUserId,
        action: 'identity.program.archived',
        target_type: 'identity_program',
        target_id: programId,
        result: 'success',
        metadata: {},
      })
      return program
    })
  },

  async clone(programId: string, key: string, name: string, actorUserId: string) {
    const source = (await this.listAdminPrograms()).find(program => program.id === programId)
    if (!source) {
      throw new Error('IDENTITY_PROGRAM_NOT_FOUND')
    }
    return this.saveDraft({
      key,
      name,
      description: source.description,
      version: source.version,
    }, actorUserId)
  },

  async exportConfiguration(programId: string) {
    const program = (await this.listAdminPrograms()).find(candidate => candidate.id === programId)
    if (!program) {
      throw new Error('IDENTITY_PROGRAM_NOT_FOUND')
    }
    const configuration = {
      schema: 'kuest.identity.program.v1',
      exportedAt: new Date().toISOString(),
      program: {
        key: program.key,
        name: program.name,
        description: program.description,
        version: program.version,
      },
    }
    const canonical = JSON.stringify(configuration)
    return {
      ...configuration,
      checksum: `sha256:${createHash('sha256').update(canonical, 'utf8').digest('base64url')}`,
    }
  },

  async importConfiguration(rawInput: unknown, actorUserId: string, dryRun: boolean) {
    if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
      throw new Error('IDENTITY_IMPORT_INVALID')
    }
    const input = rawInput as Record<string, unknown>
    if (input.schema !== 'kuest.identity.program.v1' || typeof input.exportedAt !== 'string' || typeof input.checksum !== 'string') {
      throw new Error('IDENTITY_IMPORT_SCHEMA_UNSUPPORTED')
    }
    const canonical = JSON.stringify({ schema: input.schema, exportedAt: input.exportedAt, program: input.program })
    const expected = `sha256:${createHash('sha256').update(canonical, 'utf8').digest('base64url')}`
    if (input.checksum !== expected) {
      throw new Error('IDENTITY_IMPORT_CHECKSUM_INVALID')
    }
    const program = IdentityProgramSchema.parse(input.program)
    const existing = (await this.listAdminPrograms()).find(candidate => candidate.key === program.key)
    const report = {
      valid: true,
      conflict: existing ? 'PROGRAM_KEY_EXISTS' : null,
      fieldCount: program.version.fields.length,
      mode: program.version.mode,
    }
    if (dryRun || existing) {
      return { report, saved: null }
    }
    return { report, saved: await this.saveDraft(program, actorUserId) }
  },
}
