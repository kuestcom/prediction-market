function parseAdminWalletsEnv(value: string): string[] {
  const trimmed = value.trim()

  if (!trimmed) {
    return []
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item).toLowerCase())
    }
  }
  catch {
    //
  }

  return trimmed
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
}

let cachedAdminWallets: string[] | null = null

function getAdminWallets(): string[] {
  if (cachedAdminWallets) {
    return cachedAdminWallets
  }

  const envValue = process.env.ADMIN_WALLETS
  if (!envValue) {
    cachedAdminWallets = []
    return cachedAdminWallets
  }

  cachedAdminWallets = parseAdminWalletsEnv(envValue)
  return cachedAdminWallets
}

export function isAdminWallet(address?: string | null): boolean {
  if (!address) {
    return false
  }

  return getAdminWallets().includes(address.toLowerCase())
}
