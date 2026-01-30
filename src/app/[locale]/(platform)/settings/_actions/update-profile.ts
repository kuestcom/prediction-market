'use server'

import { Buffer } from 'node:buffer'
import { revalidatePath } from 'next/cache'
import sharp from 'sharp'
import { z } from 'zod'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { supabaseAdmin } from '@/lib/supabase'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

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
  image: z
    .instanceof(File)
    .optional()
    .refine((file) => {
      if (!file || file.size === 0) {
        return true
      }

      return file.size <= MAX_FILE_SIZE
    }, { error: 'Image must be less than 5MB' })
    .refine((file) => {
      if (!file || file.size === 0) {
        return true
      }

      return ACCEPTED_IMAGE_TYPES.includes(file.type)
    }, { error: 'Only JPG, PNG, and WebP images are allowed' }),
  avatar_url: z.url().refine((value) => {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:'
  }, { error: 'Avatar URL must start with http:// or https://' }).optional(),
})

export async function updateUserAction(formData: FormData): Promise<ActionState> {
  try {
    const user = await UserRepository.getCurrentUser()
    if (!user) {
      return { error: 'Unauthenticated.' }
    }

    const imageFile = formData.get('image') as File
    const emailRaw = formData.get('email')
    const avatarUrlRaw = formData.get('avatar_url')
    const avatarUrl = typeof avatarUrlRaw === 'string' && avatarUrlRaw.trim().length > 0
      ? avatarUrlRaw.trim()
      : undefined

    const rawData = {
      email: typeof emailRaw === 'string' ? emailRaw : undefined,
      username: formData.get('username') as string,
      image: imageFile && imageFile.size > 0 ? imageFile : undefined,
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

    const updateData: Record<string, unknown> = {
      username: validated.data.username,
    }

    if (validated.data.email) {
      updateData.email = validated.data.email
    }

    if (validated.data.avatar_url) {
      updateData.image = validated.data.avatar_url
    }
    else if (validated.data.image && validated.data.image.size > 0) {
      updateData.image = await uploadImage(user, validated.data.image)
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

async function uploadImage(user: any, image: File) {
  const fileName = `users/avatars/${user.id}-${Date.now()}.jpg`

  const buffer = Buffer.from(await image.arrayBuffer())

  const resizedBuffer = await sharp(buffer)
    .resize(100, 100, { fit: 'cover' })
    .jpeg({ quality: 90 })
    .toBuffer()

  const { error } = await supabaseAdmin.storage
    .from('kuest-assets')
    .upload(fileName, resizedBuffer, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
    })

  if (error) {
    return user.image?.startsWith('http') ? null : user.image
  }

  return fileName
}
