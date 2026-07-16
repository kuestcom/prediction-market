'use client'

import { useQuery } from '@tanstack/react-query'

interface ArbitrageConfig {
  enabled: boolean
  multiWalletEnabled: boolean
}

const DISABLED_ARBITRAGE_CONFIG: ArbitrageConfig = {
  enabled: false,
  multiWalletEnabled: false,
}

export function useArbitrageConfig() {
  return useQuery({
    queryKey: ['arbitrage-config'],
    queryFn: async () => {
      const response = await fetch('/api/arbitrage/config')
      if (!response.ok) {
        return DISABLED_ARBITRAGE_CONFIG
      }
      const data = await response.json() as Partial<ArbitrageConfig>
      return {
        enabled: data.enabled === true,
        multiWalletEnabled: data.multiWalletEnabled === true,
      }
    },
    staleTime: 30_000,
  })
}
