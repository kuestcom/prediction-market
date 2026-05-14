const STORAGE_KEY = 'community_auth'
const STORAGE_VERSION = 2

interface StoredCommunityAuth {
  version?: number
  token: string
  address: string
  expires_at: string
  deposit_wallet_address?: string | null
}

type SignMessageFn = (args: { message: string }) => Promise<string>

interface AuthNonceResponse {
  nonce: string
  message: string
  expires_at: string
}

interface AuthVerifyResponse {
  token: string
  expires_at: string
}

function normalizeDepositWalletAddress(value?: string | null) {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  return trimmed
}

function isExpired(expiresAt: string) {
  const timestamp = Date.parse(expiresAt)
  if (Number.isNaN(timestamp)) {
    return true
  }
  return timestamp <= Date.now()
}

export async function parseCommunityError(response: Response, fallback: string) {
  try {
    const body = await response.json()
    if (body && typeof body.error === 'string' && body.error.trim().length > 0) {
      return body.error
    }
  }
  catch {
    return fallback
  }
  return fallback
}

export function loadCommunityAuth(address?: string) {
  if (typeof window === 'undefined') {
    return null
  }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as StoredCommunityAuth
    if (!parsed?.token || !parsed?.address || !parsed?.expires_at) {
      return null
    }
    if (parsed.version !== STORAGE_VERSION) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    if (address && parsed.address.toLowerCase() !== address.toLowerCase()) {
      return null
    }
    if (isExpired(parsed.expires_at)) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  }
  catch {
    return null
  }
}

function storeCommunityAuth(auth: StoredCommunityAuth) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

export function clearCommunityAuth() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(STORAGE_KEY)
}

export async function ensureCommunityToken({
  address,
  signMessageAsync,
  communityApiUrl = process.env.COMMUNITY_URL!,
  depositWalletAddress,
}: {
  address: string
  signMessageAsync: SignMessageFn
  communityApiUrl?: string
  depositWalletAddress?: string | null
}) {
  const normalizedDepositWallet = normalizeDepositWalletAddress(depositWalletAddress)
  const existing = loadCommunityAuth(address)
  if (existing?.token) {
    const storedDepositWallet = normalizeDepositWalletAddress(existing.deposit_wallet_address)
    if (!normalizedDepositWallet || storedDepositWallet === normalizedDepositWallet) {
      return existing.token
    }
  }

  const nonceResponse = await fetch(`${communityApiUrl}/auth/nonce`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address }),
  })

  if (!nonceResponse.ok) {
    throw new Error(await parseCommunityError(nonceResponse, 'Failed to request auth nonce'))
  }

  const noncePayload = await nonceResponse.json() as AuthNonceResponse
  const signature = await signMessageAsync({ message: noncePayload.message })

  const verifyResponse = await fetch(`${communityApiUrl}/auth/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      address,
      signature,
      deposit_wallet_address: normalizedDepositWallet ?? undefined,
    }),
  })

  if (!verifyResponse.ok) {
    throw new Error(await parseCommunityError(verifyResponse, 'Failed to verify signature'))
  }

  const verifyPayload = await verifyResponse.json() as AuthVerifyResponse

  storeCommunityAuth({
    version: STORAGE_VERSION,
    token: verifyPayload.token,
    address,
    expires_at: verifyPayload.expires_at,
    deposit_wallet_address: normalizedDepositWallet,
  })

  return verifyPayload.token
}
