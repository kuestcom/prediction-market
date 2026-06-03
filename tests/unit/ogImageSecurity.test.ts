import { lookup } from 'node:dns/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isPublicIpAddress,
  normalizeOutboundImageUrl,
  resolveTrustedOgImageSource,
  validateOutboundImageUrl,
} from '@/lib/og-image-security'

const dnsMocks = vi.hoisted(() => ({
  lookup: vi.fn(),
}))

vi.mock('node:dns/promises', () => ({
  default: {
    lookup: dnsMocks.lookup,
  },
  lookup: dnsMocks.lookup,
}))

const lookupMock = vi.mocked(lookup)

describe('oG image security helpers', () => {
  beforeEach(() => {
    lookupMock.mockReset()
  })

  it('normalizes public HTTP(S) image URLs', () => {
    expect(normalizeOutboundImageUrl(' https://cdn.example.com/avatar.png ')).toBe('https://cdn.example.com/avatar.png')
    expect(normalizeOutboundImageUrl('/avatar.png', { siteUrl: 'https://kuest.example' })).toBe('https://kuest.example/avatar.png')
  })

  it('rejects local, private, single-label, credentialed, and unsupported URLs', () => {
    expect(normalizeOutboundImageUrl('http://localhost:3000/avatar.png')).toBe('')
    expect(normalizeOutboundImageUrl('http://127.0.0.1/avatar.png')).toBe('')
    expect(normalizeOutboundImageUrl('http://2130706433/avatar.png')).toBe('')
    expect(normalizeOutboundImageUrl('http://10.0.0.12/avatar.png')).toBe('')
    expect(normalizeOutboundImageUrl('http://169.254.169.254/latest/meta-data')).toBe('')
    expect(normalizeOutboundImageUrl('http://metadata/avatar.png')).toBe('')
    expect(normalizeOutboundImageUrl('https://user:pass@example.com/avatar.png')).toBe('')
    expect(normalizeOutboundImageUrl('file:///etc/passwd')).toBe('')
  })

  it('classifies public and non-public IP ranges', () => {
    expect(isPublicIpAddress('8.8.8.8')).toBe(true)
    expect(isPublicIpAddress('2606:4700:4700::1111')).toBe(true)
    expect(isPublicIpAddress('0.0.0.0')).toBe(false)
    expect(isPublicIpAddress('127.0.0.1')).toBe(false)
    expect(isPublicIpAddress('192.168.1.10')).toBe(false)
    expect(isPublicIpAddress('::1')).toBe(false)
    expect(isPublicIpAddress('fc00::1')).toBe(false)
    expect(isPublicIpAddress('fe80::1')).toBe(false)
    expect(isPublicIpAddress('fec0::1')).toBe(false)
    expect(isPublicIpAddress('::ffff:127.0.0.1')).toBe(false)
    expect(isPublicIpAddress('::ffff:7f00:1')).toBe(false)
  })

  it('preserves trusted data image sources without outbound resolution', async () => {
    const logo = 'data:image/svg+xml;utf8,%3Csvg%20viewBox%3D%220%200%201%201%22%2F%3E'

    await expect(resolveTrustedOgImageSource(logo)).resolves.toBe(logo)
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('rejects hostnames that resolve to a private address', async () => {
    dnsMocks.lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ])

    await expect(validateOutboundImageUrl('https://cdn.example.com/avatar.png')).resolves.toBe(false)
  })

  it('allows hostnames only when every resolved address is public', async () => {
    dnsMocks.lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ])

    await expect(validateOutboundImageUrl('https://cdn.example.com/avatar.png')).resolves.toBe(true)
  })
})
