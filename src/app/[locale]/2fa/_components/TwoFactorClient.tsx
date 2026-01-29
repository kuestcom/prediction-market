'use client'

import type { Route } from 'next'
import { useExtracted } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { authClient } from '@/lib/auth-client'
import { useUser } from '@/stores/useUser'

const CODE_LENGTH = 6
const SIWE_TWO_FACTOR_INTENT_COOKIE = 'siwe_2fa_intent'

function getSafeRedirect(value: string | null | undefined) {
  if (!value) {
    return '/'
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return '/'
  }

  return value
}

function clearSiweTwoFactorIntentCookie() {
  if (typeof document === 'undefined') {
    return
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${SIWE_TWO_FACTOR_INTENT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${secure}`
}

export default function TwoFactorClient({ next }: { next?: string | null }) {
  const t = useExtracted()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const redirectTo = useMemo(() => getSafeRedirect(next), [next])
  const abortHref = '/auth/reset' as Route

  useEffect(() => {
    let isActive = true

    authClient.getSession().then((session) => {
      if (!isActive) {
        return
      }

      const user = session?.data?.user
      if (!user) {
        return
      }

      if (!user.twoFactorEnabled) {
        router.replace('/' as Route)
        return
      }

      useUser.setState({
        ...user,
        image: user.image ?? '',
      })
    }).catch(() => {})

    return () => {
      isActive = false
    }
  }, [router])

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (code.length !== CODE_LENGTH || isVerifying) {
      return
    }

    setIsVerifying(true)

    try {
      const { error } = await authClient.twoFactor.verifyTotp({
        code,
      })

      if (error) {
        toast.error(t('Invalid code. Please try again.'))
        setCode('')
        setIsVerifying(false)
        return
      }

      const session = await authClient.getSession()
      const user = session?.data?.user

      if (user) {
        useUser.setState({
          ...user,
          image: user.image ?? '',
        })
      }

      clearSiweTwoFactorIntentCookie()
      router.replace(redirectTo as Route)
    }
    catch {
      toast.error(t('Something went wrong while verifying your code.'))
      setCode('')
    }
    finally {
      setIsVerifying(false)
    }
  }

  return (
    <Card className="py-6">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">{t('Two-Factor Authentication')}</CardTitle>
        <CardDescription>
          {t('Enter the 6-digit code from your authenticator app to finish signing in.')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-6" onSubmit={handleVerify}>
          <div className="flex flex-col items-center gap-3">
            <InputOTP
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(value: string) => setCode(value)}
              autoFocus={true}
            >
              <InputOTPGroup>
                <InputOTPSlot className="size-12 lg:size-14" index={0} />
                <InputOTPSlot className="size-12 lg:size-14" index={1} />
                <InputOTPSlot className="size-12 lg:size-14" index={2} />
                <InputOTPSlot className="size-12 lg:size-14" index={3} />
                <InputOTPSlot className="size-12 lg:size-14" index={4} />
                <InputOTPSlot className="size-12 lg:size-14" index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button type="submit" disabled={code.length !== CODE_LENGTH || isVerifying}>
            {isVerifying ? t('Verifying...') : t('Verify')}
          </Button>
          <Button variant="link" className="text-muted-foreground" asChild>
            <Link href={abortHref}>
              {t('or go to home')}
            </Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
