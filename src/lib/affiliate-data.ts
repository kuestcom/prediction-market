import { formatCurrency, formatPercent } from '@/lib/formatters'

export interface AffiliateSettingsResponse {
  tradeFeePercent: number
  affiliateSharePercent: number
  platformSharePercent: number
  lastUpdated?: string
}

export interface FormattedAffiliateSettings {
  tradeFeePercent: string
  affiliateSharePercent: string
  platformSharePercent: string
  tradeFeeDecimal: number
  affiliateShareDecimal: number
  platformShareDecimal: number
}

export interface AffiliateDataError {
  error: string
}

export type AffiliateDataResult
  = | { success: true, data: FormattedAffiliateSettings }
    | { success: false, error: AffiliateDataError }

export async function fetchAffiliateSettingsFromAPI(): Promise<AffiliateDataResult> {
  try {
    const response = await fetch('/api/affiliate-settings', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        error: errorData,
      }
    }

    const apiData: AffiliateSettingsResponse = await response.json()

    const formattedData: FormattedAffiliateSettings = {
      tradeFeePercent: formatPercent(apiData.tradeFeePercent, { includeSymbol: false }),
      affiliateSharePercent: formatPercent(apiData.affiliateSharePercent, { includeSymbol: false }),
      platformSharePercent: formatPercent(apiData.platformSharePercent, { includeSymbol: false }),
      tradeFeeDecimal: apiData.tradeFeePercent / 100,
      affiliateShareDecimal: apiData.affiliateSharePercent / 100,
      platformShareDecimal: apiData.platformSharePercent / 100,
    }

    return {
      success: true,
      data: formattedData,
    }
  }
  catch (error) {
    console.error('Error fetching affiliate settings from API:', error)
    return {
      success: false,
      error: {
        error: 'Internal server error',
      },
    }
  }
}

export function calculateTradingFee(amount: number, feeDecimal: number): number {
  return amount * feeDecimal
}

export function calculateAffiliateCommission(feeAmount: number, affiliateShareDecimal: number): number {
  return feeAmount * affiliateShareDecimal
}

export function calculatePlatformShare(feeAmount: number, platformShareDecimal: number): number {
  return feeAmount * platformShareDecimal
}

export function createFeeCalculationExample(
  tradeAmount: number,
  affiliateSettings: FormattedAffiliateSettings,
) {
  const tradingFee = calculateTradingFee(tradeAmount, affiliateSettings.tradeFeeDecimal)
  const affiliateCommission = calculateAffiliateCommission(tradingFee, affiliateSettings.affiliateShareDecimal)
  const platformShare = calculatePlatformShare(tradingFee, affiliateSettings.platformShareDecimal)

  return {
    tradeAmount: formatCurrency(tradeAmount, { includeSymbol: false }),
    tradingFee: formatCurrency(tradingFee, { includeSymbol: false }),
    affiliateCommission: formatCurrency(affiliateCommission, { includeSymbol: false }),
    platformShare: formatCurrency(platformShare, { includeSymbol: false }),
    tradeFeePercent: affiliateSettings.tradeFeePercent,
    affiliateSharePercent: affiliateSettings.affiliateSharePercent,
    platformSharePercent: affiliateSettings.platformSharePercent,
  }
}
