function resolveServerUrl(envValue: string | undefined): string | undefined {
  const value = envValue?.trim()

  if (!value) {
    return undefined
  }

  return value
}

export const OPENAPI_SERVER_URLS = {
  clob: resolveServerUrl(process.env.CLOB_URL),
  createMarket: resolveServerUrl(process.env.CREATE_MARKET_URL),
  community: resolveServerUrl(process.env.COMMUNITY_URL),
  dataApi: resolveServerUrl(process.env.DATA_URL),
  gamma: resolveServerUrl(process.env.GAMMA_URL),
  priceReference: resolveServerUrl(process.env.PRICE_REFERENCE_URL),
  relayer: resolveServerUrl(process.env.RELAYER_URL),
} as const
