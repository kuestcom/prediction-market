export const ADMIN_EVENT_ATTENTION_FILTERS = [
  'missing-sports-id',
  'past-due-unresolved',
] as const

export type AdminEventAttentionFilter = (typeof ADMIN_EVENT_ATTENTION_FILTERS)[number]

export function isAdminEventAttentionFilter(value: string | null | undefined): value is AdminEventAttentionFilter {
  return ADMIN_EVENT_ATTENTION_FILTERS.includes(value as AdminEventAttentionFilter)
}
