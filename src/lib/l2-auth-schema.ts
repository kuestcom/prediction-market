import { z } from 'zod'

/**
 * Common L2 auth context field for action schemas
 */
export const l2AuthContextField = {
  l2_auth_context_id: z.string().optional(),
}

/**
 * Helper to extend schemas with L2 auth context
 */
export function withL2AuthContext<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.extend(l2AuthContextField)
}

/**
 * Standalone L2 auth context schema for actions that only need this field
 */
export const L2AuthContextSchema = z.object(l2AuthContextField)

export type L2AuthContextInput = z.infer<typeof L2AuthContextSchema>
