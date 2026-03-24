import { NextResponse } from 'next/server'
import { getAddress, isAddress } from 'viem'
import { z } from 'zod'
import {
  groupAllowedMarketCreatorItems,
  isPublicAllowedMarketCreatorsResponse,
  normalizeAllowedMarketCreatorSiteInput,
} from '@/lib/allowed-market-creators'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { AllowedMarketCreatorRepository } from '@/lib/db/queries/allowed-market-creators'
import { UserRepository } from '@/lib/db/queries/user'

const addSiteCreatorSchema = z.object({
  sourceType: z.literal('site'),
  url: z.string().trim().min(1, 'Site URL is required.'),
})

const addWalletCreatorSchema = z.object({
  sourceType: z.literal('wallet'),
  walletAddress: z.string().trim().min(1, 'Wallet address is required.'),
  name: z.string().trim().min(1, 'Wallet name is required.').max(80, 'Wallet name is too long.'),
})

const addCreatorSchema = z.discriminatedUnion('sourceType', [
  addSiteCreatorSchema,
  addWalletCreatorSchema,
])

function toNormalizedWalletList(wallets: string[]) {
  const dedupedWallets = new Map<string, string>()

  for (const wallet of wallets) {
    if (!isAddress(wallet)) {
      continue
    }

    const normalizedWallet = getAddress(wallet)
    dedupedWallets.set(normalizedWallet.toLowerCase(), normalizedWallet)
  }

  return [...dedupedWallets.values()]
}

async function requireAdmin() {
  const currentUser = await UserRepository.getCurrentUser()
  return Boolean(currentUser?.is_admin)
}

async function buildAdminResponse(addressParam?: string | null) {
  const { data: records, error } = await AllowedMarketCreatorRepository.list()
  if (error || !records) {
    return {
      response: NextResponse.json({ error: error ?? DEFAULT_ERROR_MESSAGE }, { status: 500 }),
      items: null,
    }
  }

  const wallets = [...new Set(records.map(record => record.walletAddress.toLowerCase()))]
  const normalizedAddress = typeof addressParam === 'string' && isAddress(addressParam)
    ? getAddress(addressParam)
    : null

  return {
    response: NextResponse.json({
      items: groupAllowedMarketCreatorItems(records),
      wallets,
      allowed: normalizedAddress ? wallets.some(wallet => wallet.toLowerCase() === normalizedAddress.toLowerCase()) : false,
    }),
    items: records,
  }
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const addressParam = new URL(request.url).searchParams.get('address')
    const { response } = await buildAdminResponse(addressParam)
    return response
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const payload = await request.json().catch(() => null)
    const parsed = addCreatorSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
    }

    if (parsed.data.sourceType === 'wallet') {
      if (!isAddress(parsed.data.walletAddress)) {
        return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 })
      }

      const normalizedWalletAddress = getAddress(parsed.data.walletAddress)
      const { error } = await AllowedMarketCreatorRepository.upsertMany([{
        walletAddress: normalizedWalletAddress,
        displayName: parsed.data.name.trim(),
        sourceType: 'wallet',
      }])

      if (error) {
        return NextResponse.json({ error }, { status: 500 })
      }

      const { response } = await buildAdminResponse(normalizedWalletAddress)
      return response
    }

    const normalizedSite = normalizeAllowedMarketCreatorSiteInput(parsed.data.url)
    if ('error' in normalizedSite) {
      return NextResponse.json({ error: normalizedSite.error }, { status: 400 })
    }

    if (!normalizedSite.origin.startsWith('https://')) {
      return NextResponse.json({ error: 'Site URL must use https.' }, { status: 400 })
    }

    const upstreamResponse = await fetch(normalizedSite.endpointUrl, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12_000),
    }).catch((error) => {
      console.error('Failed to fetch remote allowed market creators:', error)
      return null
    })

    if (!upstreamResponse) {
      return NextResponse.json({ error: 'Could not reach the site endpoint.' }, { status: 400 })
    }

    if (!upstreamResponse.ok) {
      return NextResponse.json({ error: `Site endpoint failed (${upstreamResponse.status}).` }, { status: 400 })
    }

    const upstreamPayload = await upstreamResponse.json().catch(() => null)
    if (!isPublicAllowedMarketCreatorsResponse(upstreamPayload)) {
      return NextResponse.json({ error: 'Site endpoint returned an invalid payload.' }, { status: 400 })
    }

    const normalizedWallets = toNormalizedWalletList(upstreamPayload.wallets)
    if (normalizedWallets.length === 0) {
      return NextResponse.json({ error: 'Site endpoint did not return any valid wallets.' }, { status: 400 })
    }

    const { error } = await AllowedMarketCreatorRepository.replaceSiteSource({
      sourceUrl: normalizedSite.origin,
      displayName: normalizedSite.displayName,
      walletAddresses: normalizedWallets,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    const { response } = await buildAdminResponse()
    return response
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE,
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const searchParams = new URL(request.url).searchParams
    const sourceUrl = searchParams.get('sourceUrl')?.trim() ?? ''
    if (sourceUrl) {
      const normalizedSource = normalizeAllowedMarketCreatorSiteInput(sourceUrl)
      if ('error' in normalizedSource) {
        return NextResponse.json({ error: normalizedSource.error }, { status: 400 })
      }

      const { error } = await AllowedMarketCreatorRepository.deleteBySourceUrl(normalizedSource.origin)
      if (error) {
        return NextResponse.json({ error }, { status: 500 })
      }

      const { response } = await buildAdminResponse()
      return response
    }

    const walletAddress = searchParams.get('wallet')?.trim() ?? ''
    if (!isAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 })
    }

    const { error } = await AllowedMarketCreatorRepository.deleteByWallet(walletAddress)
    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    const { response } = await buildAdminResponse()
    return response
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
