import type { CustomJavascriptCodeDisablePage } from '@/lib/custom-javascript-code'
import {
  CUSTOM_JAVASCRIPT_CODE_DISABLE_PAGE_OPTIONS,
} from '@/lib/custom-javascript-code'
import { SettingsRepository } from '@/lib/db/queries/settings'

const GENERAL_SETTINGS_GROUP = 'general'

export const GLOBAL_ANNOUNCEMENT_MESSAGE_KEY = 'global_announcement_message'
export const GLOBAL_ANNOUNCEMENT_LINK_URL_KEY = 'global_announcement_link_url'
export const GLOBAL_ANNOUNCEMENT_DISABLED_ON_KEY = 'global_announcement_disabled_on'
export const MAX_GLOBAL_ANNOUNCEMENT_MESSAGE_LENGTH = 220
const MAX_GLOBAL_ANNOUNCEMENT_LINK_URL_LENGTH = 2048
export const DEFAULT_GLOBAL_ANNOUNCEMENT_DISABLED_ON: CustomJavascriptCodeDisablePage[] = []

const GLOBAL_ANNOUNCEMENT_DISABLED_ON_SET = new Set<string>(CUSTOM_JAVASCRIPT_CODE_DISABLE_PAGE_OPTIONS)

type SettingsGroup = Record<string, { value: string, updated_at: string }>
interface SettingsMap {
  [group: string]: SettingsGroup | undefined
}

export interface GlobalAnnouncementSettings {
  message: string
  linkUrl: string
  disabledOn: CustomJavascriptCodeDisablePage[]
}

interface GlobalAnnouncementValidationResult {
  data: {
    messageValue: string
    linkUrlValue: string
    disabledOnValue: string
    disabledOn: CustomJavascriptCodeDisablePage[]
  } | null
  error: string | null
}

function normalizeStringValue(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  }
  catch {
    return false
  }
}

function isValidAnnouncementLink(value: string) {
  if (value.startsWith('/') && !value.startsWith('//')) {
    return true
  }

  return isValidHttpUrl(value)
}

function parseGlobalAnnouncementDisabledOn(rawValue: string | null | undefined) {
  const normalizedRawValue = normalizeStringValue(rawValue)
  if (!normalizedRawValue) {
    return {
      value: [],
      error: null as string | null,
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(normalizedRawValue)
  }
  catch {
    return {
      value: [],
      error: 'Announcement disabled pages must be valid JSON.',
    }
  }

  if (!Array.isArray(parsed)) {
    return {
      value: [],
      error: 'Announcement disabled pages are invalid.',
    }
  }

  const deduped: CustomJavascriptCodeDisablePage[] = []
  const seen = new Set<CustomJavascriptCodeDisablePage>()

  for (const entry of parsed) {
    if (typeof entry !== 'string' || !GLOBAL_ANNOUNCEMENT_DISABLED_ON_SET.has(entry)) {
      return {
        value: [],
        error: 'Announcement disabled pages are invalid.',
      }
    }

    const normalizedEntry = entry as CustomJavascriptCodeDisablePage

    if (seen.has(normalizedEntry)) {
      continue
    }

    seen.add(normalizedEntry)
    deduped.push(normalizedEntry)
  }

  return {
    value: deduped,
    error: null as string | null,
  }
}

export function getGlobalAnnouncementSettingsFromSettings(settings?: SettingsMap): GlobalAnnouncementSettings {
  const message = normalizeStringValue(settings?.[GENERAL_SETTINGS_GROUP]?.[GLOBAL_ANNOUNCEMENT_MESSAGE_KEY]?.value)
  const linkUrl = normalizeStringValue(settings?.[GENERAL_SETTINGS_GROUP]?.[GLOBAL_ANNOUNCEMENT_LINK_URL_KEY]?.value)
  const disabledOnParsed = parseGlobalAnnouncementDisabledOn(
    settings?.[GENERAL_SETTINGS_GROUP]?.[GLOBAL_ANNOUNCEMENT_DISABLED_ON_KEY]?.value,
  )

  return {
    message,
    linkUrl,
    disabledOn: disabledOnParsed.value,
  }
}

export async function loadGlobalAnnouncementSettings(): Promise<GlobalAnnouncementSettings> {
  const { data } = await SettingsRepository.getSettings()
  return getGlobalAnnouncementSettingsFromSettings(data ?? undefined)
}

export function validateGlobalAnnouncementInput(params: {
  message: string | null | undefined
  linkUrl: string | null | undefined
  disabledOnJson: string | null | undefined
}): GlobalAnnouncementValidationResult {
  const messageValue = normalizeStringValue(params.message)
  const linkUrlValue = normalizeStringValue(params.linkUrl)
  const disabledOnParsed = parseGlobalAnnouncementDisabledOn(params.disabledOnJson)

  if (messageValue.length > MAX_GLOBAL_ANNOUNCEMENT_MESSAGE_LENGTH) {
    return {
      data: null,
      error: `Announcement message must be ${MAX_GLOBAL_ANNOUNCEMENT_MESSAGE_LENGTH} characters or less.`,
    }
  }

  if (linkUrlValue.length > MAX_GLOBAL_ANNOUNCEMENT_LINK_URL_LENGTH) {
    return {
      data: null,
      error: `Announcement link URL must be ${MAX_GLOBAL_ANNOUNCEMENT_LINK_URL_LENGTH} characters or less.`,
    }
  }

  if (linkUrlValue && !isValidAnnouncementLink(linkUrlValue)) {
    return { data: null, error: 'Announcement link URL must be a valid URL or start with /.' }
  }

  if (disabledOnParsed.error) {
    return { data: null, error: disabledOnParsed.error }
  }

  return {
    data: {
      messageValue,
      linkUrlValue,
      disabledOn: disabledOnParsed.value,
      disabledOnValue: JSON.stringify(disabledOnParsed.value),
    },
    error: null,
  }
}
