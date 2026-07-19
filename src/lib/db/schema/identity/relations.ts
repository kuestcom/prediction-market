import { relations } from 'drizzle-orm'
import { users } from '@/lib/db/schema/auth/tables'
import {
  identity_access_grants,
  identity_admin_permissions,
  identity_audit_events,
  identity_consents,
  identity_data_exports,
  identity_document_access_tokens,
  identity_documents,
  identity_erasure_requests,
  identity_field_option_translations,
  identity_field_options,
  identity_field_translations,
  identity_fields,
  identity_legal_holds,
  identity_program_assignments,
  identity_program_versions,
  identity_programs,
  identity_provider_cases,
  identity_provider_configs,
  identity_provider_events,
  identity_reviews,
  identity_submission_values,
  identity_submissions,
} from './tables'

export const identityProgramsRelations = relations(identity_programs, ({ many, one }) => ({
  versions: many(identity_program_versions),
  submissions: many(identity_submissions),
  createdBy: one(users, {
    fields: [identity_programs.created_by_user_id],
    references: [users.id],
  }),
}))

export const identityProgramVersionsRelations = relations(identity_program_versions, ({ many, one }) => ({
  program: one(identity_programs, {
    fields: [identity_program_versions.program_id],
    references: [identity_programs.id],
  }),
  assignments: many(identity_program_assignments),
  fields: many(identity_fields),
  submissions: many(identity_submissions),
  createdBy: one(users, {
    fields: [identity_program_versions.created_by_user_id],
    references: [users.id],
  }),
}))

export const identityProgramAssignmentsRelations = relations(identity_program_assignments, ({ one }) => ({
  version: one(identity_program_versions, {
    fields: [identity_program_assignments.program_version_id],
    references: [identity_program_versions.id],
  }),
}))

export const identityFieldsRelations = relations(identity_fields, ({ many, one }) => ({
  version: one(identity_program_versions, {
    fields: [identity_fields.program_version_id],
    references: [identity_program_versions.id],
  }),
  translations: many(identity_field_translations),
  options: many(identity_field_options),
  values: many(identity_submission_values),
  documents: many(identity_documents),
}))

export const identityFieldTranslationsRelations = relations(identity_field_translations, ({ one }) => ({
  field: one(identity_fields, {
    fields: [identity_field_translations.field_id],
    references: [identity_fields.id],
  }),
}))

export const identityFieldOptionsRelations = relations(identity_field_options, ({ many, one }) => ({
  field: one(identity_fields, {
    fields: [identity_field_options.field_id],
    references: [identity_fields.id],
  }),
  translations: many(identity_field_option_translations),
}))

export const identityFieldOptionTranslationsRelations = relations(identity_field_option_translations, ({ one }) => ({
  option: one(identity_field_options, {
    fields: [identity_field_option_translations.option_id],
    references: [identity_field_options.id],
  }),
}))

export const identitySubmissionsRelations = relations(identity_submissions, ({ many, one }) => ({
  user: one(users, {
    fields: [identity_submissions.user_id],
    references: [users.id],
  }),
  program: one(identity_programs, {
    fields: [identity_submissions.program_id],
    references: [identity_programs.id],
  }),
  version: one(identity_program_versions, {
    fields: [identity_submissions.program_version_id],
    references: [identity_program_versions.id],
  }),
  values: many(identity_submission_values),
  documents: many(identity_documents),
  providerCases: many(identity_provider_cases),
  reviews: many(identity_reviews),
  consents: many(identity_consents),
  grants: many(identity_access_grants),
  legalHolds: many(identity_legal_holds),
}))

export const identitySubmissionValuesRelations = relations(identity_submission_values, ({ one }) => ({
  submission: one(identity_submissions, {
    fields: [identity_submission_values.submission_id],
    references: [identity_submissions.id],
  }),
  field: one(identity_fields, {
    fields: [identity_submission_values.field_id],
    references: [identity_fields.id],
  }),
}))

export const identityDocumentsRelations = relations(identity_documents, ({ one }) => ({
  submission: one(identity_submissions, {
    fields: [identity_documents.submission_id],
    references: [identity_submissions.id],
  }),
  field: one(identity_fields, {
    fields: [identity_documents.field_id],
    references: [identity_fields.id],
  }),
}))

export const identityDocumentAccessTokensRelations = relations(identity_document_access_tokens, ({ one }) => ({
  document: one(identity_documents, {
    fields: [identity_document_access_tokens.document_id],
    references: [identity_documents.id],
  }),
  requestedBy: one(users, {
    fields: [identity_document_access_tokens.requested_by_user_id],
    references: [users.id],
  }),
}))

export const identityProviderConfigsRelations = relations(identity_provider_configs, ({ many, one }) => ({
  cases: many(identity_provider_cases),
  events: many(identity_provider_events),
  createdBy: one(users, {
    fields: [identity_provider_configs.created_by_user_id],
    references: [users.id],
  }),
}))

export const identityProviderCasesRelations = relations(identity_provider_cases, ({ one }) => ({
  provider: one(identity_provider_configs, {
    fields: [identity_provider_cases.provider_config_id],
    references: [identity_provider_configs.id],
  }),
  submission: one(identity_submissions, {
    fields: [identity_provider_cases.submission_id],
    references: [identity_submissions.id],
  }),
}))

export const identityProviderEventsRelations = relations(identity_provider_events, ({ one }) => ({
  provider: one(identity_provider_configs, {
    fields: [identity_provider_events.provider_config_id],
    references: [identity_provider_configs.id],
  }),
}))

export const identityReviewsRelations = relations(identity_reviews, ({ one }) => ({
  submission: one(identity_submissions, {
    fields: [identity_reviews.submission_id],
    references: [identity_submissions.id],
  }),
  reviewer: one(users, {
    fields: [identity_reviews.reviewer_user_id],
    references: [users.id],
  }),
}))

export const identityConsentsRelations = relations(identity_consents, ({ one }) => ({
  submission: one(identity_submissions, {
    fields: [identity_consents.submission_id],
    references: [identity_submissions.id],
  }),
}))

export const identityAccessGrantsRelations = relations(identity_access_grants, ({ one }) => ({
  user: one(users, {
    fields: [identity_access_grants.user_id],
    references: [users.id],
  }),
  submission: one(identity_submissions, {
    fields: [identity_access_grants.submission_id],
    references: [identity_submissions.id],
  }),
}))

export const identityAdminPermissionsRelations = relations(identity_admin_permissions, ({ one }) => ({
  user: one(users, {
    fields: [identity_admin_permissions.user_id],
    references: [users.id],
    relationName: 'identity_admin_permission_user',
  }),
  grantedBy: one(users, {
    fields: [identity_admin_permissions.granted_by_user_id],
    references: [users.id],
    relationName: 'identity_admin_permission_grantor',
  }),
}))

export const identityAuditEventsRelations = relations(identity_audit_events, ({ one }) => ({
  actor: one(users, {
    fields: [identity_audit_events.actor_user_id],
    references: [users.id],
    relationName: 'identity_audit_actor',
  }),
  subject: one(users, {
    fields: [identity_audit_events.subject_user_id],
    references: [users.id],
    relationName: 'identity_audit_subject',
  }),
}))

export const identityErasureRequestsRelations = relations(identity_erasure_requests, ({ one }) => ({
  user: one(users, {
    fields: [identity_erasure_requests.user_id],
    references: [users.id],
    relationName: 'identity_erasure_subject',
  }),
  requestedBy: one(users, {
    fields: [identity_erasure_requests.requested_by_user_id],
    references: [users.id],
    relationName: 'identity_erasure_requester',
  }),
}))

export const identityLegalHoldsRelations = relations(identity_legal_holds, ({ one }) => ({
  user: one(users, {
    fields: [identity_legal_holds.user_id],
    references: [users.id],
  }),
  submission: one(identity_submissions, {
    fields: [identity_legal_holds.submission_id],
    references: [identity_submissions.id],
  }),
  createdBy: one(users, {
    fields: [identity_legal_holds.created_by_user_id],
    references: [users.id],
  }),
}))

export const identityDataExportsRelations = relations(identity_data_exports, ({ one }) => ({
  user: one(users, {
    fields: [identity_data_exports.user_id],
    references: [users.id],
  }),
}))

export const usersIdentityRelations = relations(users, ({ many }) => ({
  identitySubmissions: many(identity_submissions),
  identityAccessGrants: many(identity_access_grants),
  identityAdminPermissions: many(identity_admin_permissions, { relationName: 'identity_admin_permission_user' }),
  identityAuditEventsAsActor: many(identity_audit_events, { relationName: 'identity_audit_actor' }),
  identityAuditEventsAsSubject: many(identity_audit_events, { relationName: 'identity_audit_subject' }),
  identityErasureRequests: many(identity_erasure_requests, { relationName: 'identity_erasure_subject' }),
  identityExports: many(identity_data_exports),
}))
