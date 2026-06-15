const DEFAULT_XLAYER_LIQUIDITY_VAULT_ADDRESSES = {
  crypto: '0xf232cBA052239b4bBcCBBeeA0BCC0c52EFAf43EA',
  culture: '0x727E5154de7032629EEb896B1E9A055b8c95bb49',
  economy: '0x41E9af5BF00cDB03dbbE60E85eE373DB1dcDC0DB',
  elections: '0x74ff8B8b1CB01187422781c19163A6356e22DB9F',
  esports: '0x5b6662059206a55558a878c98B57708E9C8b8918',
  finance: '0xc873Fb06BcE214D740d5007245cCC6dD2117d9DA',
  geopolitics: '0x8bA703aAa1754f7cf5131732aabb53508167baD2',
  mentions: '0x55f31A2AA89623C66215ff11f89964c38C14d503',
  politics: '0x74dEc8050068038Dc12824473E85C34E44EaFCea',
  sports: '0x64eD1e049179f58B5A5A28479c9cC1B0f4d1285b',
  technology: '0xbd75b2136852f6c2913C57b1048dd48940b400cE',
  weather: '0x0609A16D9061fE84fb796Fccd1BEB8ce7Ec3B841',
  world: '0x964a3aF4f740118f795Cc15a8a590fd57B292F6e',
} as const

export const DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT = {
  assetAddress: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736',
  assetDecimals: 6,
  assetSymbol: 'USDT0',
  epochSeconds: 86_400,
  factoryAddress: '0x7f29Ae3bb22dC3A414CCBD7ABbc9a6143ffbD3a0',
  lockSeconds: 604_800,
  reporterThreshold: 2,
  vaultAddresses: DEFAULT_XLAYER_LIQUIDITY_VAULT_ADDRESSES,
} as const

export type XLayerLiquidityVaultSlug = keyof typeof DEFAULT_XLAYER_LIQUIDITY_VAULT_ADDRESSES

export function normalizeLiquidityVaultSlug(slug?: string | null): XLayerLiquidityVaultSlug | null {
  if (!slug) {
    return null
  }

  const normalized = slug.trim().toLowerCase()
  const resolved = normalized === 'tech' ? 'technology' : normalized

  return resolved in DEFAULT_XLAYER_LIQUIDITY_VAULT_ADDRESSES
    ? resolved as XLayerLiquidityVaultSlug
    : null
}
