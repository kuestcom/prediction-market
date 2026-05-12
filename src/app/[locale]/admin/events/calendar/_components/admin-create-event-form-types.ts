import type { AdminSportsTeamHostStatus } from '@/lib/admin-sports-create'

export type MarketMode = 'binary' | 'multi_multiple' | 'multi_unique'
export type EventCreationMode = 'single' | 'recurring'

export type SlugValidationState = 'idle' | 'checking' | 'unique' | 'duplicate' | 'error'
export type FundingCheckState = 'idle' | 'checking' | 'ok' | 'insufficient' | 'no_wallet' | 'error'
export type NativeGasCheckState = 'idle' | 'checking' | 'ok' | 'insufficient' | 'no_wallet' | 'error'
export type AllowedCreatorCheckState = 'idle' | 'checking' | 'ok' | 'missing' | 'no_wallet' | 'error'
export type OpenRouterCheckState = 'idle' | 'checking' | 'ok' | 'error'
export type ContentCheckState = 'idle' | 'checking' | 'ok' | 'error'
export type SignatureTxStatus = 'idle' | 'awaiting_wallet' | 'confirming' | 'success' | 'error'
export type PreSignCheckKey = 'funding' | 'nativeGas' | 'allowedCreator' | 'slug' | 'openRouter' | 'content'

export interface CategorySuggestion {
  name: string
  slug: string
}

export interface MainCategory {
  id: number
  name: string
  slug: string
  childs: CategorySuggestion[]
}

export interface MainTagsApiResponse {
  mainCategories: MainCategory[]
  globalCategories: CategorySuggestion[]
}

export interface CategoryItem {
  label: string
  slug: string
}

export interface OptionItem {
  id: string
  question: string
  title: string
  shortName: string
  slug: string
  outcomeYes: string
  outcomeNo: string
}

export interface FormState {
  title: string
  slug: string
  endDateIso: string
  mainCategorySlug: string
  categories: CategoryItem[]
  marketMode: MarketMode | null
  binaryQuestion: string
  binaryOutcomeYes: string
  binaryOutcomeNo: string
  options: OptionItem[]
  resolutionSource: string
  resolutionRules: string
}

export interface SignerOption {
  address: string
  displayName: string
  shortAddress: string
}

export interface SlugCheckResponse {
  exists: boolean
}

export interface MarketConfigResponse {
  defaultChainId?: number
  supportedChainIds?: number[]
  chains?: Array<{
    chainId: number
    usdcToken: string
  }>
  requiredCreatorFundingUsdc?: string
  usdcToken?: string
}

export interface AllowedCreatorsResponse {
  wallets: string[]
  allowed: boolean
}

export interface AiValidationIssue {
  code: 'english' | 'url' | 'rules' | 'mandatory' | 'date'
  reason: string
  step: 1 | 2 | 3
}

export interface AiValidationResponse {
  ok: boolean
  checks: {
    mandatory: boolean
    language: boolean
    deterministic: boolean
  }
  errors: AiValidationIssue[]
  warnings?: AiValidationIssue[]
}

export interface RecurringOccurrencePreview {
  endDateIso: string
  title: string
  slug: string
  resolutionRules: string
}

export interface AiRulesResponse {
  rules: string
  samplesUsed: number
}

export interface OpenRouterStatusResponse {
  configured: boolean
}

interface PreparePayloadOption {
  id: string
  question: string
  title: string
  shortName: string
  slug: string
}

export interface PreparePayloadBody {
  chainId: number
  creator: string
  title: string
  slug: string
  endDateIso: string
  mainCategorySlug: string
  categories: CategoryItem[]
  marketMode: MarketMode
  binaryQuestion?: string
  binaryOutcomeYes?: string
  binaryOutcomeNo?: string
  options?: PreparePayloadOption[]
  resolutionSource: string
  resolutionRules: string
  sports?: unknown
}

export type TeamLogoFileMap = Record<AdminSportsTeamHostStatus, File | null>

export interface PrepareTxPlanItem {
  id: string
  to: string
  value: string
  data: string
  description: string
  marketKey?: string
}

export interface PrepareResponse {
  requestId: string
  chainId: number
  creator: string
  txPlan: PrepareTxPlanItem[]
}

export interface PrepareAcceptedResponse {
  requestId: string
  chainId: number
  creator: string
  status: string
}

export interface PrepareAuthChallengeResponse {
  requestId: string
  nonce: string
  expiresAt: number
  creator: string
  chainId: number
  payloadHash: string
  domain: {
    name: string
    version: string
    verifyingContract: string
  }
  primaryType: 'CreateMarketAuth'
  types: {
    CreateMarketAuth: Array<{
      name: string
      type: string
    }>
  }
}

export interface PrepareFinalizeRequestTx {
  id: string
  hash: string
}

export interface FinalizeResponse {
  requestId: string
  status: string
}

export interface PendingRequestItem {
  requestId: string
  payloadHash: string
  status: string
  creator: string
  chainId: number
  expiresAt: number
  updatedAt: number
  errorMessage: string | null
  prepared: PrepareResponse | null
  txs: PrepareFinalizeRequestTx[]
}

export interface PendingRequestResponse {
  request: PendingRequestItem | null
}

export interface SignatureExecutionTx extends PrepareTxPlanItem {
  status: SignatureTxStatus
  hash?: string
  error?: string
}

export interface AdminCreateEventFormProps {
  sportsSlugCatalog: import('@/lib/admin-sports-create').AdminSportsSlugCatalog
  creationMode?: EventCreationMode
  initialDraftRecord?: import('@/lib/db/queries/event-creations').EventCreationDraftRecord | null
  draftId?: string | null
  initialTitle?: string
  initialSlug?: string
  initialEndDateIso?: string
  allowPastResolutionDate?: boolean
  hasConfiguredServerSigners?: boolean
  serverDraftPayload?: Record<string, unknown> | null
  serverAssetPayload?: import('@/lib/event-creation').EventCreationAssetPayload | null
}
