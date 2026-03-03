interface ServiceUrls {
  createMarketUrl: string
  clobUrl: string
  relayerUrl: string
  dataUrl: string
  userPnlUrl: string
  communityUrl: string
  priceReferenceUrl: string
  wsClobUrl: string
  wsLiveDataUrl: string
}

function normalizeServiceUrl(url: string) {
  return url.replace(/\/+$/, '')
}

function resolveServiceUrl(value: string | undefined) {
  const normalizedValue = value?.trim()
  if (!normalizedValue) {
    return ''
  }

  return normalizeServiceUrl(normalizedValue)
}

export function resolveServiceUrls(): ServiceUrls {
  return {
    createMarketUrl: resolveServiceUrl(process.env.CREATE_MARKET_URL),
    clobUrl: resolveServiceUrl(process.env.CLOB_URL),
    relayerUrl: resolveServiceUrl(process.env.RELAYER_URL),
    dataUrl: resolveServiceUrl(process.env.DATA_URL),
    userPnlUrl: resolveServiceUrl(process.env.USER_PNL_URL),
    communityUrl: resolveServiceUrl(process.env.COMMUNITY_URL),
    priceReferenceUrl: resolveServiceUrl(process.env.PRICE_REFERENCE_URL),
    wsClobUrl: resolveServiceUrl(process.env.WS_CLOB_URL),
    wsLiveDataUrl: resolveServiceUrl(process.env.WS_LIVE_DATA_URL),
  }
}

export function toUrlOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  }
  catch {
    return null
  }
}
