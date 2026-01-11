const DATA_API_URL = process.env.DATA_URL!

interface DataApiHolder {
  proxyWallet: string
  amount: number
  outcomeIndex?: number
  asset?: string
  pseudonym?: string | null
  name?: string | null
  profileImage?: string | null
  profileImageOptimized?: string | null
}

interface DataApiHoldersResponse {
  token: string
  holders: DataApiHolder[]
}

function getAvatar(address: string, holder: DataApiHolder) {
  return holder.profileImageOptimized
    || holder.profileImage
    || `https://avatar.vercel.sh/${address}.png`
}

export interface TopHoldersResult {
  yesHolders: {
    user: {
      id: string
      username: string
      address: string
      proxy_wallet_address?: string | null
      image: string
      created_at?: string
    }
    net_position: string
    outcome_index: number
    outcome_text: string
  }[]
  noHolders: {
    user: {
      id: string
      username: string
      address: string
      proxy_wallet_address?: string | null
      image: string
      created_at?: string
    }
    net_position: string
    outcome_index: number
    outcome_text: string
  }[]
}

function mapHolder(holder: DataApiHolder, outcomeHint: 'yes' | 'no' | null) {
  const address = holder.proxyWallet
  const outcomeIndex = outcomeHint
    ? (outcomeHint === 'yes' ? 0 : 1)
    : (typeof holder.outcomeIndex === 'number' ? holder.outcomeIndex : 0)
  const amount = Number.isFinite(holder.amount) ? Number(holder.amount) : 0

  return {
    user: {
      id: address,
      username: holder.pseudonym || holder.name || address,
      address,
      proxy_wallet_address: address,
      image: getAvatar(address, holder),
    },
    net_position: amount.toString(),
    outcome_index: outcomeIndex,
    outcome_text: outcomeIndex === 0 ? 'Yes' : 'No',
  }
}

export async function fetchTopHoldersFromDataApi(
  conditionId: string,
  limit = 50,
  options?: { yesToken?: string, noToken?: string },
): Promise<TopHoldersResult> {
  if (!conditionId) {
    throw new Error('conditionId is required')
  }

  if (!DATA_API_URL) {
    throw new Error('DATA_URL environment variable is not configured.')
  }

  const params = new URLSearchParams({
    market: conditionId,
    limit: String(Math.min(Math.max(limit, 1), 500)),
  })

  const response = await fetch(`${DATA_API_URL}/holders?${params.toString()}`)

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const errorMessage = errorBody?.error || 'Failed to load top holders'
    throw new Error(errorMessage)
  }

  const result: DataApiHoldersResponse[] = await response.json()

  const yesHolders: TopHoldersResult['yesHolders'] = []
  const noHolders: TopHoldersResult['noHolders'] = []

  result.forEach((entry, entryIndex) => {
    const entryOutcomeHint = (() => {
      if (options?.yesToken && (entry.token === options.yesToken)) {
        return 'yes' as const
      }
      if (options?.noToken && (entry.token === options.noToken)) {
        return 'no' as const
      }
      if (entryIndex === 0) {
        return 'yes' as const
      }
      if (entryIndex === 1) {
        return 'no' as const
      }
      return null
    })()

    entry.holders.forEach((holder) => {
      const outcomeHint = (() => {
        if (entryOutcomeHint) {
          return entryOutcomeHint
        }
        if (options?.yesToken && holder.asset === options.yesToken) {
          return 'yes' as const
        }
        if (options?.noToken && holder.asset === options.noToken) {
          return 'no' as const
        }
        return null
      })()

      const mapped = mapHolder(holder, outcomeHint)
      const netPosition = Number(mapped.net_position)
      if (!Number.isFinite(netPosition) || netPosition <= 0) {
        return
      }

      if (mapped.outcome_index === 0) {
        yesHolders.push(mapped)
      }
      else {
        noHolders.push(mapped)
      }
    })
  })

  return { yesHolders, noHolders }
}

export async function fetchTopHolders(
  conditionId: string,
  limit = 50,
  options?: { yesToken?: string, noToken?: string },
): Promise<TopHoldersResult> {
  if (!conditionId) {
    throw new Error('conditionId is required')
  }

  if (typeof window === 'undefined') {
    return fetchTopHoldersFromDataApi(conditionId, limit, options)
  }

  const params = new URLSearchParams({
    conditionId,
    limit: String(Math.min(Math.max(limit, 1), 500)),
  })

  if (options?.yesToken) {
    params.set('yesToken', options.yesToken)
  }
  if (options?.noToken) {
    params.set('noToken', options.noToken)
  }

  const response = await fetch(`/api/holders?${params.toString()}`)

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const errorMessage = errorBody?.error || 'Failed to load top holders'
    throw new Error(errorMessage)
  }

  return await response.json()
}
