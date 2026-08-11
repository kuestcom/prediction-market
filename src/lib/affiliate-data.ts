import { formatPercent } from '@/lib/formatters'

interface AffiliateSettingsResponse {
  builderTakerSharePercent: number
  builderMakerFlatFeePercent: number
  affiliateSharePercent: number
  lastUpdated?: string
}

interface FormattedAffiliateSettings {
  builderTakerSharePercent: string
  builderMakerFlatFeePercent: string
  affiliateSharePercent: string
  operatorSharePercent: string
  builderTakerShareDecimal: number
  builderMakerFlatFeeDecimal: number
  affiliateShareDecimal: number
  operatorShareDecimal: number
}

export interface AffiliateDataError {
  error: string
}

export type AffiliateDataResult =
  | { success: true; data: FormattedAffiliateSettings }
  | { success: false; error: AffiliateDataError }

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
      builderTakerSharePercent: formatPercent(apiData.builderTakerSharePercent, { includeSymbol: false }),
      builderMakerFlatFeePercent: formatPercent(apiData.builderMakerFlatFeePercent, { includeSymbol: false }),
      affiliateSharePercent: formatPercent(apiData.affiliateSharePercent, { includeSymbol: false }),
      operatorSharePercent: formatPercent(operatorSharePercent, { includeSymbol: false }),
      builderTakerShareDecimal: apiData.builderTakerSharePercent / 100,
      builderMakerFlatFeeDecimal: apiData.builderMakerFlatFeePercent / 100,
      affiliateShareDecimal: apiData.affiliateSharePercent / 100,
      operatorShareDecimal: operatorSharePercent / 100,
    }

    return {
      success: true,
      data: formattedData,
    }
  } catch (error) {
    console.error('Error fetching affiliate settings from API:', error)
    return {
      success: false,
      error: {
        error: 'Internal server error',
      },
    }
  }
}

export function calculateAffiliateCommission(feeAmount: number, affiliateShareDecimal: number): number {
  return feeAmount * affiliateShareDecimal
}

export function calculateOperatorShare(feeAmount: number, operatorShareDecimal: number): number {
  return feeAmount * operatorShareDecimal
}
