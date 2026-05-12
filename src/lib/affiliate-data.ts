import { formatCurrency, formatPercent } from '@/lib/formatters'

interface AffiliateSettingsResponse {
  builderTakerFeePercent: number
  builderMakerFeePercent: number
  affiliateSharePercent: number
  lastUpdated?: string
}

export interface FormattedAffiliateSettings {
  builderTakerFeePercent: string
  builderMakerFeePercent: string
  affiliateSharePercent: string
  operatorSharePercent: string
  builderTakerFeeDecimal: number
  builderMakerFeeDecimal: number
  affiliateShareDecimal: number
  operatorShareDecimal: number
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
    const operatorSharePercent = 100 - apiData.affiliateSharePercent

    const formattedData: FormattedAffiliateSettings = {
      builderTakerFeePercent: formatPercent(apiData.builderTakerFeePercent, { includeSymbol: false }),
      builderMakerFeePercent: formatPercent(apiData.builderMakerFeePercent, { includeSymbol: false }),
      affiliateSharePercent: formatPercent(apiData.affiliateSharePercent, { includeSymbol: false }),
      operatorSharePercent: formatPercent(operatorSharePercent, { includeSymbol: false }),
      builderTakerFeeDecimal: apiData.builderTakerFeePercent / 100,
      builderMakerFeeDecimal: apiData.builderMakerFeePercent / 100,
      affiliateShareDecimal: apiData.affiliateSharePercent / 100,
      operatorShareDecimal: operatorSharePercent / 100,
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

export function calculateOperatorShare(feeAmount: number, operatorShareDecimal: number): number {
  return feeAmount * operatorShareDecimal
}

export function createFeeCalculationExample(
  tradeAmount: number,
  affiliateSettings: FormattedAffiliateSettings,
) {
  const operatorTakerFee = calculateTradingFee(tradeAmount, affiliateSettings.builderTakerFeeDecimal)
  const affiliateCommission = calculateAffiliateCommission(operatorTakerFee, affiliateSettings.affiliateShareDecimal)
  const operatorShare = calculateOperatorShare(operatorTakerFee, affiliateSettings.operatorShareDecimal)

  return {
    tradeAmount: formatCurrency(tradeAmount, { includeSymbol: false }),
    operatorTakerFee: formatCurrency(operatorTakerFee, { includeSymbol: false }),
    affiliateCommission: formatCurrency(affiliateCommission, { includeSymbol: false }),
    operatorShare: formatCurrency(operatorShare, { includeSymbol: false }),
    builderTakerFeePercent: affiliateSettings.builderTakerFeePercent,
    affiliateSharePercent: affiliateSettings.affiliateSharePercent,
    operatorSharePercent: affiliateSettings.operatorSharePercent,
  }
}
