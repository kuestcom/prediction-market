import { DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT } from '@/lib/liquidity/deployment'
import resolveSiteUrl from '@/lib/site-url'

export interface PublicRuntimeConfig {
  xlayerLiquidityAssetAddress: string
  xlayerLiquidityAssetDecimals: number
  xlayerLiquidityAssetSymbol: string
  xlayerLiquidityEpochSeconds: number
  xlayerLiquidityFactoryAddress: string
  xlayerLiquidityLockSeconds: number
  xlayerLiquidityReporterThreshold: number
  xlayerLiquidityVaultAddresses: Record<string, string>
  reownAppKitProjectId: string
  siteUrl: string
  xlayerExchangeAddress: string
  xlayerCollateralAddress: string
  xlayerCollateralSymbol: string
  xlayerCollateralDecimals: number
}

function normalizePublicEnvValue(value: string | undefined) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : ''
}

function normalizePublicEnvNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function resolveLiquidityVaultAddresses(env: NodeJS.ProcessEnv) {
  const addresses: Record<string, string> = {
    ...DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.vaultAddresses,
  }

  for (const slug of Object.keys(DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.vaultAddresses)) {
    const envKey = `NEXT_PUBLIC_LIQUIDITY_VAULT_${slug.toUpperCase()}`
    const privateEnvKey = `LIQUIDITY_VAULT_${slug.toUpperCase()}`
    addresses[slug] = normalizePublicEnvValue(env[envKey])
      || normalizePublicEnvValue(env[privateEnvKey])
      || addresses[slug]!
  }

  return addresses
}

export function getPublicRuntimeConfig(env: NodeJS.ProcessEnv = process.env): PublicRuntimeConfig {
  const collateralDecimals = Number.parseInt(
    env.NEXT_PUBLIC_XLAYER_COLLATERAL_DECIMALS || env.XLAYER_COLLATERAL_DECIMALS || '6',
    10,
  )

  return {
    xlayerLiquidityAssetAddress: normalizePublicEnvValue(env.NEXT_PUBLIC_LIQUIDITY_ASSET_ADDRESS)
      || normalizePublicEnvValue(env.LIQUIDITY_ASSET_ADDRESS)
      || DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.assetAddress,
    xlayerLiquidityAssetDecimals: normalizePublicEnvNumber(
      env.NEXT_PUBLIC_LIQUIDITY_ASSET_DECIMALS || env.LIQUIDITY_ASSET_DECIMALS,
      DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.assetDecimals,
    ),
    xlayerLiquidityAssetSymbol: normalizePublicEnvValue(env.NEXT_PUBLIC_LIQUIDITY_ASSET_SYMBOL)
      || normalizePublicEnvValue(env.LIQUIDITY_ASSET_SYMBOL)
      || DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.assetSymbol,
    xlayerLiquidityEpochSeconds: normalizePublicEnvNumber(
      env.NEXT_PUBLIC_LIQUIDITY_EPOCH_SECONDS || env.LIQUIDITY_EPOCH_SECONDS,
      DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.epochSeconds,
    ),
    xlayerLiquidityFactoryAddress: normalizePublicEnvValue(env.NEXT_PUBLIC_LIQUIDITY_FACTORY_ADDRESS)
      || normalizePublicEnvValue(env.LIQUIDITY_FACTORY_ADDRESS)
      || DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.factoryAddress,
    xlayerLiquidityLockSeconds: normalizePublicEnvNumber(
      env.NEXT_PUBLIC_LIQUIDITY_LOCK_SECONDS || env.LIQUIDITY_LOCK_SECONDS,
      DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.lockSeconds,
    ),
    xlayerLiquidityReporterThreshold: normalizePublicEnvNumber(
      env.NEXT_PUBLIC_LIQUIDITY_REPORTER_THRESHOLD || env.LIQUIDITY_REPORTER_THRESHOLD,
      DEFAULT_XLAYER_LIQUIDITY_DEPLOYMENT.reporterThreshold,
    ),
    xlayerLiquidityVaultAddresses: resolveLiquidityVaultAddresses(env),
    reownAppKitProjectId: normalizePublicEnvValue(env.REOWN_APPKIT_PROJECT_ID),
    siteUrl: resolveSiteUrl(env),
    xlayerExchangeAddress: normalizePublicEnvValue(env.NEXT_PUBLIC_XLAYER_EXCHANGE_ADDRESS)
      || normalizePublicEnvValue(env.XLAYER_EXCHANGE_ADDRESS),
    xlayerCollateralAddress: normalizePublicEnvValue(env.NEXT_PUBLIC_XLAYER_COLLATERAL_ADDRESS)
      || normalizePublicEnvValue(env.XLAYER_COLLATERAL_ADDRESS),
    xlayerCollateralSymbol: normalizePublicEnvValue(env.NEXT_PUBLIC_XLAYER_COLLATERAL_SYMBOL)
      || normalizePublicEnvValue(env.XLAYER_COLLATERAL_SYMBOL)
      || 'USDT0',
    xlayerCollateralDecimals: Number.isFinite(collateralDecimals) ? collateralDecimals : 6,
  }
}
