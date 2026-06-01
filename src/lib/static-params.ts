import { shouldPrerenderPublicShell } from '@/lib/public-shell-rendering'

export const STATIC_PARAMS_PLACEHOLDER = '__placeholder__'

export function getPublicShellStaticParams<T extends Record<string, unknown>>(params: T): T[] {
  return [params]
}

type StaticParamValue = string | string[] | null | undefined

function isStaticParamsPlaceholder(...values: StaticParamValue[]) {
  return values.some(value =>
    value === STATIC_PARAMS_PLACEHOLDER
    || (Array.isArray(value) && value.includes(STATIC_PARAMS_PLACEHOLDER)),
  )
}

export function shouldBypassPublicShellPlaceholder(...values: StaticParamValue[]) {
  return !shouldPrerenderPublicShell() && isStaticParamsPlaceholder(...values)
}
