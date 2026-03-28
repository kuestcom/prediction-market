import { describe, expect, it } from 'vitest'
import wsrvImageLoader from '@/lib/wsrv-image-loader'

describe('wsrvImageLoader', () => {
  it('keeps root-relative local assets on the app origin while encoding width', () => {
    expect(wsrvImageLoader({
      src: '/images/logo.png',
      width: 256,
      quality: 80,
    })).toBe('/images/logo.png?w=256&q=80')
  })

  it('preserves existing query params for root-relative local assets', () => {
    expect(wsrvImageLoader({
      src: '/images/logo.png?v=1',
      width: 128,
    })).toBe('/images/logo.png?v=1&w=128&q=75')
  })

  it('adds width params to irys urls without proxying them through wsrv', () => {
    expect(wsrvImageLoader({
      src: 'https://gateway.irys.xyz/images/logo.png',
      width: 128,
      quality: 70,
    })).toBe('https://gateway.irys.xyz/images/logo.png?w=128&q=70')
  })

  it('normalizes protocol-relative urls before proxying them through wsrv', () => {
    expect(wsrvImageLoader({
      src: '//cdn.example.com/image.png',
      width: 256,
      quality: 80,
    })).toBe(
      'https://wsrv.nl/?url=https%3A%2F%2Fcdn.example.com%2Fimage.png&width=256&w=256&q=80&output=webp',
    )
  })
})
