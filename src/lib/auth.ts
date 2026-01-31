import { createHMAC } from '@better-auth/utils/hmac'
import { getChainIdFromMessage } from '@reown/appkit-siwe'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createAuthMiddleware } from 'better-auth/api'
import { deleteSessionCookie } from 'better-auth/cookies'
import { generateRandomString } from 'better-auth/crypto'
import { nextCookies } from 'better-auth/next-js'
import { customSession, siwe, twoFactor } from 'better-auth/plugins'
import { createPublicClient, http } from 'viem'
import { isAdminWallet } from '@/lib/admin'
import { projectId } from '@/lib/appkit'
import { AffiliateRepository } from '@/lib/db/queries/affiliate'
import { db } from '@/lib/drizzle'
import { getSupabaseImageUrl } from '@/lib/supabase'
import { ensureUserTradingAuthSecretFingerprint } from '@/lib/trading-auth/server'
import { sanitizeTradingAuthSettings } from '@/lib/trading-auth/utils'
import * as schema from './db/schema'

const TWO_FACTOR_COOKIE_NAME = 'two_factor'
const TRUST_DEVICE_COOKIE_NAME = 'trust_device'
const TRUST_DEVICE_COOKIE_MAX_AGE = 720 * 60 * 60
const TWO_FACTOR_PENDING_MAX_AGE = 3 * 60
const SIWE_TWO_FACTOR_PENDING_COOKIE = 'siwe_2fa_pending'
const SIWE_TWO_FACTOR_INTENT_COOKIE = 'siwe_2fa_intent'
const AFFILIATE_COOKIE_NAME = 'platform_affiliate'
const AFFILIATE_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function parseTimestampMs(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }
  if (value instanceof Date) {
    return value.getTime()
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const parsed = Date.parse(String(value))
  return Number.isNaN(parsed) ? null : parsed
}

function parseAffiliateCookie(rawValue: string | null) {
  if (!rawValue) {
    return null
  }
  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>
    return {
      affiliateCode: typeof parsed.affiliateCode === 'string' ? parsed.affiliateCode : undefined,
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : undefined,
    }
  }
  catch {
    return null
  }
}

function clearSiweTwoFactorPendingCookie(ctx: any) {
  const pendingCookie = ctx.context.createAuthCookie(SIWE_TWO_FACTOR_PENDING_COOKIE)
  ctx.setCookie(pendingCookie.name, '', {
    ...pendingCookie.attributes,
    maxAge: 0,
  })
}

function siweTwoFactorRedirect() {
  return {
    id: 'siwe-two-factor-redirect',
    hooks: {
      after: [
        {
          matcher(context: any) {
            return context.path === '/siwe/verify'
          },
          handler: createAuthMiddleware(async (ctx) => {
            const data = ctx.context.newSession

            if (!data?.user?.twoFactorEnabled) {
              return
            }

            const sessionToken = await ctx.getSignedCookie(
              ctx.context.authCookies.sessionToken.name,
              ctx.context.secret,
            )
            if (sessionToken) {
              const existingSession = await ctx.context.internalAdapter.findSession(sessionToken)
              if (existingSession?.session?.userId === data.user.id) {
                return
              }
            }

            const trustDeviceCookieAttrs = ctx.context.createAuthCookie(TRUST_DEVICE_COOKIE_NAME, {
              maxAge: TRUST_DEVICE_COOKIE_MAX_AGE,
            })
            const trustDeviceCookie = await ctx.getSignedCookie(trustDeviceCookieAttrs.name, ctx.context.secret)

            if (trustDeviceCookie) {
              const [token, sessionToken] = trustDeviceCookie.split('!')
              const expected = await createHMAC('SHA-256', 'base64urlnopad').sign(
                ctx.context.secret,
                `${data.user.id}!${sessionToken}`,
              )

              if (token === expected) {
                const newTrustDeviceCookie = ctx.context.createAuthCookie(TRUST_DEVICE_COOKIE_NAME, {
                  maxAge: TRUST_DEVICE_COOKIE_MAX_AGE,
                })
                const newToken = await createHMAC('SHA-256', 'base64urlnopad').sign(
                  ctx.context.secret,
                  `${data.user.id}!${data.session.token}`,
                )

                await ctx.setSignedCookie(
                  newTrustDeviceCookie.name,
                  `${newToken}!${data.session.token}`,
                  ctx.context.secret,
                  trustDeviceCookieAttrs.attributes,
                )
                return
              }
            }

            deleteSessionCookie(ctx, true)
            await ctx.context.internalAdapter.deleteSession(data.session.token)

            const twoFactorCookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE_NAME, {
              maxAge: TWO_FACTOR_PENDING_MAX_AGE,
            })
            const identifier = `2fa-${generateRandomString(20)}`

            await ctx.context.internalAdapter.createVerificationValue({
              value: data.user.id,
              identifier,
              expiresAt: new Date(Date.now() + TWO_FACTOR_PENDING_MAX_AGE * 1000),
            })

            const hasIntentCookie = Boolean(ctx.getCookie(SIWE_TWO_FACTOR_INTENT_COOKIE))
            if (hasIntentCookie) {
              const pendingCookie = ctx.context.createAuthCookie(SIWE_TWO_FACTOR_PENDING_COOKIE, {
                maxAge: TWO_FACTOR_PENDING_MAX_AGE,
              })
              ctx.setCookie(pendingCookie.name, '1', pendingCookie.attributes)
            }

            await ctx.setSignedCookie(
              twoFactorCookie.name,
              identifier,
              ctx.context.secret,
              twoFactorCookie.attributes,
            )

            return ctx.json({ twoFactorRedirect: true })
          }),
        },
        {
          matcher(context: any) {
            return context.path === '/two-factor/verify-totp'
          },
          handler: createAuthMiddleware(async (ctx) => {
            clearSiweTwoFactorPendingCookie(ctx)
          }),
        },
      ],
    },
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  appName: process.env.NEXT_PUBLIC_SITE_NAME,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.SITE_URL,
  advanced: {
    database: {
      generateId: false,
    },
  },
  databaseHooks: {
    user: {
      create: {
        async after(user, ctx) {
          if (!ctx) {
            return
          }

          const referral = parseAffiliateCookie(ctx.getCookie(AFFILIATE_COOKIE_NAME))
          if (!referral?.affiliateCode) {
            return
          }

          const referralTimestamp = parseTimestampMs(referral.timestamp)
          if (referralTimestamp === null) {
            return
          }

          const now = Date.now()
          if (referralTimestamp > now || now - referralTimestamp > AFFILIATE_COOKIE_MAX_AGE_MS) {
            return
          }

          try {
            const { data: affiliate } = await AffiliateRepository.getAffiliateByCode(referral.affiliateCode)
            const affiliateUserId = affiliate?.id ?? null

            if (!affiliateUserId || affiliateUserId === user.id) {
              return
            }

            await AffiliateRepository.recordReferral({
              user_id: user.id,
              affiliate_user_id: affiliateUserId,
            })
            ctx.setCookie(AFFILIATE_COOKIE_NAME, '', { path: '/', maxAge: 0 })
          }
          catch (error) {
            ctx.context.logger.error('Failed to record affiliate referral', error)
          }
        },
      },
    },
  },
  plugins: [
    customSession(async ({ user, session }) => {
      const userId = String((user as any).id ?? '')
      const rawSettings = (user as any).settings as Record<string, any> | undefined
      const hydratedSettings = rawSettings && userId
        ? await ensureUserTradingAuthSecretFingerprint(userId, rawSettings)
        : rawSettings
      const settings = hydratedSettings
        ? sanitizeTradingAuthSettings(hydratedSettings)
        : hydratedSettings

      return {
        user: {
          ...user,
          settings,
          image: user.image ? getSupabaseImageUrl(user.image) : `https://avatar.vercel.sh/${user.name}.png`,
          is_admin: isAdminWallet(user.name),
        },
        session,
      }
    }),
    nextCookies(),
    siwe({
      schema: {
        walletAddress: {
          modelName: 'wallets',
          fields: {
            userId: 'user_id',
            address: 'address',
            chainId: 'chain_id',
            isPrimary: 'is_primary',
            createdAt: 'created_at',
          },
        },
      },
      domain: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? 'localhost:3000',
      emailDomainName: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? 'kuest.com',
      anonymous: true,
      getNonce: async () => generateRandomString(32),
      verifyMessage: async ({ message, signature, address }) => {
        const chainId = getChainIdFromMessage(message)

        const publicClient = createPublicClient(
          {
            transport: http(
              `https://rpc.walletconnect.org/v1/?chainId=${chainId}&projectId=${projectId}`,
            ),
          },
        )

        return await publicClient.verifyMessage({
          message,
          address: address as `0x${string}`,
          signature: signature as `0x${string}`,
        })
      },
    }),
    siweTwoFactorRedirect(),
    twoFactor({
      skipVerificationOnEnable: false,
      schema: {
        user: {
          fields: {
            twoFactorEnabled: 'two_factor_enabled',
          },
        },
        twoFactor: {
          modelName: 'two_factors',
          fields: {
            secret: 'secret',
            backupCodes: 'backup_codes',
            userId: 'user_id',
          },
        },
      },
    }),
  ],
  user: {
    modelName: 'users',
    fields: {
      name: 'address',
      email: 'email',
      emailVerified: 'email_verified',
      image: 'image',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    additionalFields: {
      address: {
        type: 'string',
      },
      username: {
        type: 'string',
      },
      settings: {
        type: 'json',
      },
      proxy_wallet_address: {
        type: 'string',
      },
      proxy_wallet_signature: {
        type: 'string',
      },
      proxy_wallet_status: {
        type: 'string',
      },
      proxy_wallet_signed_at: {
        type: 'date',
      },
      proxy_wallet_tx_hash: {
        type: 'string',
      },
      affiliate_code: {
        type: 'string',
      },
      referred_by_user_id: {
        type: 'string',
      },
    },
    changeEmail: {
      enabled: true,
    },
  },
  session: {
    modelName: 'sessions',
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
    fields: {
      userId: 'user_id',
      token: 'token',
      expiresAt: 'expires_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  account: {
    modelName: 'accounts',
    fields: {
      userId: 'user_id',
      accountId: 'account_id',
      providerId: 'provider_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      scope: 'scope',
      password: 'password',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  verification: {
    modelName: 'verifications',
    fields: {
      identifier: 'identifier',
      value: 'value',
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
})
