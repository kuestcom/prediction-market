'use client'

import type { PublicRuntimeConfig } from '@/lib/public-runtime-config'
import { createContext, use } from 'react'
import { DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT } from '@/lib/liquidity/deployment'

const defaultPublicRuntimeConfig: PublicRuntimeConfig = {
  reownAppKitProjectId: '',
  siteUrl: 'http://localhost:3000',
  xlayerLiquidityAssetAddress: DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.assetAddress,
  xlayerLiquidityAssetDecimals: DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.assetDecimals,
  xlayerLiquidityAssetSymbol: DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.assetSymbol,
  xlayerLiquidityEpochSeconds: DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.epochSeconds,
  xlayerLiquidityFactoryAddress: DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.factoryAddress,
  xlayerLiquidityLockSeconds: DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.lockSeconds,
  xlayerLiquidityReporterThreshold: DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.reporterThreshold,
  xlayerLiquidityVaultAddresses: {
    ...DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.vaultAddresses,
  },
  xlayerExchangeAddress: '',
  xlayerCollateralAddress: '',
  xlayerCollateralSymbol: 'USDT0',
  xlayerCollateralDecimals: 6,
}

export const PublicRuntimeConfigContext = createContext<PublicRuntimeConfig>(defaultPublicRuntimeConfig)

export function usePublicRuntimeConfig() {
  return use(PublicRuntimeConfigContext)
}
