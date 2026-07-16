import { NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { polygon } from 'viem/chains'
import { resolvePolymarketRpcUrl } from '@/lib/polymarket-network'
import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const POLYMARKET_REQUEST_TIMEOUT_MS = 8_000
const { reownAppKitProjectId } = resolvePublicRuntimeEnv(process.env)
const publicClient = createPublicClient({
  chain: polygon,
  transport: http(resolvePolymarketRpcUrl(reownAppKitProjectId)),
})
const SAFE_ABI = [{
  type: 'function',
  name: 'getOwners',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ type: 'address[]' }],
}] as const
const OWNABLE_ABI = [{
  type: 'function',
  name: 'owner',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ type: 'address' }],
}] as const

async function detectSignatureType(ownerAddress: `0x${string}`, funderAddress: `0x${string}`) {
  try {
    const owners = await publicClient.readContract({
      address: funderAddress,
      abi: SAFE_ABI,
      functionName: 'getOwners',
    })
    if (owners.some(owner => owner.toLowerCase() === ownerAddress.toLowerCase())) {
      return 2 as const
    }
  }
  catch {}

  try {
    const depositOwner = await publicClient.readContract({
      address: funderAddress,
      abi: OWNABLE_ABI,
      functionName: 'owner',
    })
    if (depositOwner.toLowerCase() === ownerAddress.toLowerCase()) {
      return 3 as const
    }
  }
  catch {}

  return 1 as const
}

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get('address')?.trim() ?? ''
  if (!ADDRESS_PATTERN.test(address)) {
    return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 })
  }

  let profile: { proxyWallet?: unknown }
  try {
    const response = await fetch(
      `https://gamma-api.polymarket.com/public-profile?address=${encodeURIComponent(address)}`,
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(POLYMARKET_REQUEST_TIMEOUT_MS),
      },
    )
    if (!response.ok) {
      return NextResponse.json({ proxyWallet: null, ready: false })
    }
    profile = await response.json() as { proxyWallet?: unknown }
  }
  catch {
    return NextResponse.json({ proxyWallet: null, ready: false })
  }
  const proxyWallet = typeof profile.proxyWallet === 'string' && ADDRESS_PATTERN.test(profile.proxyWallet)
    ? profile.proxyWallet
    : null

  const bytecode = proxyWallet
    ? await publicClient.getBytecode({ address: proxyWallet as `0x${string}` }).catch(() => undefined)
    : undefined
  const ready = Boolean(proxyWallet && bytecode && bytecode !== '0x')
  const signatureType = ready && proxyWallet
    ? await detectSignatureType(address as `0x${string}`, proxyWallet as `0x${string}`)
    : 0

  return NextResponse.json({ proxyWallet, signatureType, ready })
}
