import { NextResponse } from 'next/server'
import { getAddress, isAddress } from 'viem'
import { z } from 'zod'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'

const GENERAL_SETTINGS_GROUP = 'general'
const GENERAL_MARKET_CREATORS_KEY = 'market_creators'

const addCreatorSchema = z.object({
  address: z.string().trim().min(1, 'Address is required.'),
})

function parseWalletList(value: string | null | undefined) {
  const text = value ?? ''
  const rows = text
    .split(/[\n,]+/)
    .map(item => item.trim())
    .filter(Boolean)

  const deduped: string[] = []
  const seen = new Set<string>()

  rows.forEach((row) => {
    if (!isAddress(row)) {
      return
    }
    const normalized = getAddress(row)
    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    deduped.push(normalized)
  })

  return deduped
}

function toWalletMap(wallets: string[]) {
  return new Set(wallets.map(wallet => wallet.toLowerCase()))
}

export async function GET(request: Request) {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const { data, error } = await SettingsRepository.getSettings()
    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    const wallets = parseWalletList(
      data?.[GENERAL_SETTINGS_GROUP]?.[GENERAL_MARKET_CREATORS_KEY]?.value,
    )
    const walletSet = toWalletMap(wallets)

    const addressParam = new URL(request.url).searchParams.get('address')?.trim() ?? ''
    const normalizedAddress = isAddress(addressParam) ? getAddress(addressParam) : null

    return NextResponse.json({
      wallets,
      allowed: normalizedAddress ? walletSet.has(normalizedAddress.toLowerCase()) : false,
    })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const payload = await request.json().catch(() => null)
    const parsed = addCreatorSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
    }

    if (!isAddress(parsed.data.address)) {
      return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 })
    }

    const nextAddress = getAddress(parsed.data.address)

    const { data, error } = await SettingsRepository.getSettings()
    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    const wallets = parseWalletList(
      data?.[GENERAL_SETTINGS_GROUP]?.[GENERAL_MARKET_CREATORS_KEY]?.value,
    )

    const byLower = new Set(wallets.map(item => item.toLowerCase()))
    if (!byLower.has(nextAddress.toLowerCase())) {
      wallets.push(nextAddress)
    }

    const { error: updateError } = await SettingsRepository.updateSettings([
      {
        group: GENERAL_SETTINGS_GROUP,
        key: GENERAL_MARKET_CREATORS_KEY,
        value: wallets.join('\n'),
      },
    ])

    if (updateError) {
      return NextResponse.json({ error: updateError }, { status: 500 })
    }

    return NextResponse.json({
      wallets,
      allowed: true,
    })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE,
    }, { status: 500 })
  }
}
