import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_SITE_NAME } from '@/lib/theme-site-identity'
import { buildUmaProposeUrl, buildUmaSettledUrl, resolveUmaProposeTarget } from '@/lib/uma'

describe('uma helpers', () => {
  const source = {
    uma_request_tx_hash: '0xabc',
    uma_request_log_index: 7,
  }

  it('uses explicit project name when provided', () => {
    const target = resolveUmaProposeTarget(source, 'Kuest Runtime')
    expect(target).not.toBeNull()

    const url = new URL(target!.url)
    expect(url.searchParams.get('project')).toBe('Kuest Runtime')
    expect(url.searchParams.get('transactionHash')).toBe('0xabc')
    expect(url.searchParams.get('eventIndex')).toBe('7')
    expect(target?.isMirror).toBe(false)
  })

  it('falls back to default project name when missing', () => {
    const proposeUrl = buildUmaProposeUrl(source)
    const settledUrl = buildUmaSettledUrl(source)

    expect(proposeUrl).toBeTruthy()
    expect(settledUrl).toBeTruthy()
    expect(new URL(proposeUrl!).searchParams.get('project')).toBe(DEFAULT_THEME_SITE_NAME)
    expect(new URL(settledUrl!).searchParams.get('project')).toBe(DEFAULT_THEME_SITE_NAME)
  })

  it('prefers mirror UMA request details when present', () => {
    const target = resolveUmaProposeTarget({
      ...source,
      mirror_uma_request_tx_hash: '0xmirror',
      mirror_uma_request_log_index: 99,
    }, 'Kuest Runtime')

    expect(target).not.toBeNull()
    expect(target?.isMirror).toBe(true)
    const url = new URL(target!.url)
    expect(url.searchParams.get('transactionHash')).toBe('0xmirror')
    expect(url.searchParams.get('eventIndex')).toBe('99')
  })
})
