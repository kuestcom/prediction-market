import { getPublicAssetUrl } from '@/lib/storage'

const GENERAL_SETTINGS_GROUP = 'general'

export const TERMS_OF_SERVICE_PDF_PATH_KEY = 'tos_pdf_path'

type SettingsMap = Record<string, Record<string, { value: string, updated_at: string }> | undefined>

export function normalizeTermsOfServicePdfPath(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : ''

  if (!normalized) {
    return { value: '', error: null as string | null }
  }

  if (normalized.length > 2048) {
    return { value: '', error: 'Terms of Use PDF path is too long.' }
  }

  return { value: normalized, error: null as string | null }
}

export function getTermsOfServicePdfPath(allSettings?: SettingsMap) {
  return normalizeTermsOfServicePdfPath(
    allSettings?.[GENERAL_SETTINGS_GROUP]?.[TERMS_OF_SERVICE_PDF_PATH_KEY]?.value,
  ).value
}

export function getTermsOfServicePdfUrl(allSettings?: SettingsMap) {
  const pdfPath = getTermsOfServicePdfPath(allSettings)

  if (!pdfPath) {
    return ''
  }

  return getPublicAssetUrl(pdfPath)
}
