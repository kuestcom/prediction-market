import type { EventCreationRecurrenceUnit } from '@/lib/event-creation'
import { parseGwei } from 'viem'
import { AMOY_CHAIN_ID, IS_TEST_MODE, POLYGON_MAINNET_CHAIN_ID } from '@/lib/network'

export const TOTAL_STEPS = 5
export const MIN_SUB_CATEGORIES = 4
export const USDC_DECIMALS = 6
export const FALLBACK_REQUIRED_USDC = 5
export const CREATE_EVENT_SIGNATURE_STORAGE_KEY = 'admin_create_event_signature_flow_v1'
export const TITLE_CATEGORY_MIN_LENGTH = 4
export const CONTENT_CHECK_PROGRESS_INTERVAL_MS = 1400
export const SIGNATURE_COUNTDOWN_INTERVAL_MS = 1000
export const PREPARE_POLL_DELAY_MS = 1500
export const PREPARE_POLL_MAX_ATTEMPTS = 240
export const FINALIZE_RETRY_DELAY_MS = 1000
export const FINALIZE_MAX_ATTEMPTS = 8
export const FINALIZE_POLL_DELAY_MS = 1500
export const FINALIZE_POLL_MAX_ATTEMPTS = 240
export const SLUG_CHECK_TIMEOUT_MS = 12000
export const OPENROUTER_CHECK_TIMEOUT_MS = 12000
export const CONTENT_CHECK_TIMEOUT_MS = 45000
export const CONTENT_CHECK_PROGRESS = [
  'checking content language...',
  'checking deterministic rules...',
  'checking mandatory fields...',
  'checking event date coherence...',
  'checking resolution source format...',
  'checking market structure consistency...',
  'checking outcomes consistency...',
  'checking final consistency...',
] as const
export const FALLBACK_MAX_FEE_PER_GAS_WEI = parseGwei('30')
export const APPROVE_GAS_UNITS_ESTIMATE = 70_000n
export const INITIALIZE_GAS_UNITS_ESTIMATE = 700_000n
export const GAS_ESTIMATE_BUFFER_NUMERATOR = 13n
export const GAS_ESTIMATE_BUFFER_DENOMINATOR = 10n
export const DEFAULT_CREATE_EVENT_CHAIN_ID = IS_TEST_MODE ? AMOY_CHAIN_ID : POLYGON_MAINNET_CHAIN_ID
export const CUSTOM_SPORTS_SLUG_SELECT_VALUE = '__custom__'
export const EOA_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

export const RECURRENCE_OPTIONS: Array<{ value: EventCreationRecurrenceUnit, label: string }> = [
  { value: 'minute', label: 'Minutes' },
  { value: 'hour', label: 'Hours' },
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
  { value: 'quarter', label: 'Quarters' },
  { value: 'semiannual', label: '6 months' },
  { value: 'year', label: 'Years' },
]

export const TEMPLATE_TOKEN_EXAMPLES = [
  '{{day}} -> 22',
  '{{day_padded}} -> 22',
  '{{month}} -> 3',
  '{{month_name_lower}} -> march',
  '{{date}} -> 22 March',
  '{{date-7}} -> 15 March',
  '{{date_short}} -> 22/03/2026',
  '{{year}} -> 2026',
] as const

export const TEMPLATE_TOKEN_HELP_TEXT = 'All variables use the resolution date. Use + or - days for offsets, for example {{date-7}}.'
