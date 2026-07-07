'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { normalizeOutboundImageUrl, validateOutboundImageUrl } from '@/lib/og-image-security'

export interface ActionState {
  error?: string
  errors?: Record<string, string | undefined>
}

function emptyStringToUndefined(value: unknown) {
  if (value === null || value === undefined) {
    return undefined
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return undefined
  }

  return value
}

const UpdateUserSchema = z.object({
  email: z.preprocess(
    emptyStringToUndefined,
    z.email({ pattern: z.regexes.html5Email, error: 'Invalid email address.' }).optional(),
  ),
  username: z
    .string()
    .min(3, 'Username must be at least 3 character long')
    .max(42, 'Username must be at most 42 characters long')
    .regex(/^[A-Z0-9.-]+$/i, 'Only letters, numbers, dots and hyphens are allowed')
    .regex(/^(?![.-])/, 'Cannot start with a dot or hyphen')
    .regex(/(?<![.-])$/, 'Cannot end with a dot or hyphen'),
  avatar_url: z.url().refine((value) => {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:'
  }, { error: 'Avatar URL must start with http:// or https://' }).optional(),
})

export async function updateUserAction(formData: FormData): Promise<ActionState> {
  try {
    const user = await UserRepository.getCurrentUser({ minimal: true })
    if (!user) {
      return { error: 'Unauthenticated.' }
    }

    const emailRaw = formData.get('email')
    const avatarUrlRaw = formData.get('avatar_url')
    const avatarUrl = typeof avatarUrlRaw === 'string' && avatarUrlRaw.trim().length > 0
      ? avatarUrlRaw.trim()
      : undefined

    const rawData = {
      email: typeof emailRaw === 'string' ? emailRaw : undefined,
      username: formData.get('username') as string,
      avatar_url: avatarUrl,
    }

    const validated = UpdateUserSchema.safeParse(rawData)
    if (!validated.success) {
      const errors: ActionState['errors'] = {}
      validated.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0] as keyof typeof errors] = issue.message
        }
      })

      return { errors }
    }

    const normalizedAvatarUrl = validated.data.avatar_url
      ? normalizeOutboundImageUrl(validated.data.avatar_url)
      : undefined

    if (
      validated.data.avatar_url
      && (!normalizedAvatarUrl || !(await validateOutboundImageUrl(normalizedAvatarUrl)))
    ) {
      return {
        errors: {
          avatar_url: 'Avatar URL must point to a public HTTP(S) image host.',
        },
      }
    }

    const updateData: Record<string, unknown> = {
      username: validated.data.username,
    }

    if (validated.data.email) {
      updateData.email = validated.data.email
    }

    if (normalizedAvatarUrl) {
      updateData.image = normalizedAvatarUrl
    }

    const { error } = await UserRepository.updateUserProfileById(user.id, updateData)
    if (error) {
      return { error }
    }

    revalidatePath('/settings')
    return {}
  }
  catch {
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
