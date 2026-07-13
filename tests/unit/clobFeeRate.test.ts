import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchKuestFeeRate } from '@/lib/clob'

describe('fetchKuestFeeRate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads and normalizes the Kuest base fee for the selected token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ base_fee: '200' })),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchKuestFeeRate('token-1', 'https://clob.example')).resolves.toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://clob.example/fee-rate?token_id=token-1',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('rejects invalid fee responses instead of displaying a partial total', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ base_fee: null })),
    }))

    await expect(fetchKuestFeeRate('token-1', 'https://clob.example')).rejects.toThrow('Invalid fee rate')
  })

  it('rejects fee strings with trailing units', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ base_fee: '200bps' })),
    }))

    await expect(fetchKuestFeeRate('token-1', 'https://clob.example')).rejects.toThrow('Invalid fee rate')
  })
})
