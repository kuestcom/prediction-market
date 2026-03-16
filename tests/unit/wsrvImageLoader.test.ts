import { describe, expect, it } from 'vitest'
import wsrvImageLoader from '@/lib/wsrv-image-loader'

describe('wsrvImageLoader', () => {
  it('keeps root-relative local assets on the app origin', () => {
    expect(wsrvImageLoader({
      src: '/images/logo.png',
      width: 256,
      quality: 80,
    })).toBe('/images/logo.png')
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
