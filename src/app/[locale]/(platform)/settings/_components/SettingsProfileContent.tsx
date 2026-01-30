'use client'

import type { User } from '@/types'
import { useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useSignMessage } from 'wagmi'
import { updateUserAction } from '@/app/[locale]/(platform)/settings/_actions/update-profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Link } from '@/i18n/navigation'
import {
  clearCommunityAuth,
  ensureCommunityToken,
  parseCommunityError,
} from '@/lib/community-auth'
import { useUser } from '@/stores/useUser'

export default function SettingsProfileContent({ user }: { user: User }) {
  const queryClient = useQueryClient()
  const { signMessageAsync } = useSignMessage()
  const communityApiUrl = process.env.COMMUNITY_URL!
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewImage) {
        URL.revokeObjectURL(previewImage)
      }
    }
  }, [previewImage])

  function generatePreviewUrl(file: File): string {
    return URL.createObjectURL(file)
  }

  function clearPreview() {
    if (previewImage) {
      URL.revokeObjectURL(previewImage)
      setPreviewImage(null)
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPending) {
      return
    }

    setErrors({})
    setFormError(null)
    setIsPending(true)

    const formData = new FormData(event.currentTarget)
    const email = (formData.get('email') as string | null)?.trim() ?? ''
    const emailValue = email.length > 0 ? email : undefined
    const username = (formData.get('username') as string | null)?.trim() || ''
    const imageFile = formData.get('image') as File | null

    const shouldUpdateCommunity = Boolean(
      (username && username !== user.username) || (imageFile && imageFile.size > 0),
    )

    let communityUsername = username
    let avatarUrl: string | undefined

    try {
      if (shouldUpdateCommunity) {
        const token = await ensureCommunityToken({
          address: user.address,
          signMessageAsync,
          communityApiUrl,
          proxyWalletAddress: user.proxy_wallet_address ?? null,
        })

        const communityForm = new FormData()
        if (username && username !== user.username) {
          communityForm.append('username', username)
        }
        if (imageFile && imageFile.size > 0) {
          communityForm.append('image', imageFile)
        }

        const response = await fetch(`${communityApiUrl}/profile`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: communityForm,
        })

        if (response.status === 401) {
          clearCommunityAuth()
        }

        if (!response.ok) {
          const message = await parseCommunityError(response, 'Failed to update profile.')
          setFormError(message)
          toast.error(message)
          return
        }

        const payload = await response.json() as {
          username?: string
          avatar_url?: string
        }
        communityUsername = payload.username || username
        avatarUrl = payload.avatar_url
      }

      const localForm = new FormData()
      if (emailValue) {
        localForm.set('email', emailValue)
      }
      localForm.set('username', communityUsername)
      if (avatarUrl) {
        localForm.set('avatar_url', avatarUrl)
      }

      const result = await updateUserAction(localForm)
      if (result.errors || result.error) {
        setErrors(result.errors || {})
        setFormError(result.error || null)
        return
      }

      useUser.setState({
        ...user,
        email: emailValue ?? user.email,
        username: communityUsername,
        image: avatarUrl ?? user.image,
      })
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const [key] = query.queryKey
          return key === 'event-comments' || key === 'event-activity' || key === 'event-holders'
        },
      })
      toast.success('Profile updated successfully!')
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile.'
      setFormError(message)
      toast.error(message)
    }
    finally {
      setIsPending(false)
    }
  }

  return (
    <div className="grid gap-8">
      {formError && <InputError message={formError} />}

      <form onSubmit={handleSubmit} className="grid gap-6" encType="multipart/form-data">
        <div className="rounded-lg border p-6">
          <div className="flex items-center gap-4">
            <div className={`
              flex size-16 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-primary
              to-primary/60
            `}
            >
              {previewImage || user.image
                ? (
                    <Image
                      width={42}
                      height={42}
                      src={previewImage || user.image}
                      alt="Profile"
                      className="size-full object-cover"
                    />
                  )
                : (
                    <span className="text-lg font-semibold text-white">
                      U
                    </span>
                  )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUploadClick}
                disabled={isPending}
              >
                Upload
              </Button>
              {errors?.image && <InputError message={errors.image} />}
              <p className="text-xs text-muted-foreground">Max 5MB, JPG/PNG/WEBP only</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            name="image"
            className="hidden"
            disabled={isPending}
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                if (file.size > 5 * 1024 * 1024) {
                  toast.error('File too big! Max 5MB.')
                  e.target.value = ''
                  clearPreview()
                }
                else {
                  clearPreview()
                  const previewUrl = generatePreviewUrl(file)
                  setPreviewImage(previewUrl)
                }
              }
              else {
                clearPreview()
              }
            }}
          />
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              name="email"
              defaultValue={user.email}
              disabled={isPending}
              placeholder="Enter your email"
            />
            {errors?.email && <InputError message={errors.email} />}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="username">
              Username
            </Label>
            <Input
              id="username"
              required
              name="username"
              maxLength={30}
              defaultValue={user.username}
              disabled={isPending}
              placeholder="Enter your username"
            />
            {errors?.username && <InputError message={errors.username} />}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Link
            href={user.username ? `/@${user.username}` : `/@${user.proxy_wallet_address}`}
            className="text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
          >
            View Public Profile
          </Link>
          <Button type="submit" disabled={isPending} className="w-36">
            {isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
