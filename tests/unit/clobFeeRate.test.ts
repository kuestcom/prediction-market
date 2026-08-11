import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchKuestFeeRate } from '@/lib/clob'

describe('fetchKuestFeeRate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the dynamic Kuest fee schedule for the selected token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          base_fee: 441,
          fd: { r: 0.0441, e: 1, to: true },
          fee_schedule: { rate: 0.0441, exponent: 1, takerOnly: true, rebateRate: 0.2 },
        }),
      ),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchKuestFeeRate('token-1', 'https://clob.example')).resolves.toEqual({
      rate: 0.0441,
      exponent: 1,
      takerOnly: true,
      rebateRate: 0.2,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://clob.example/fee-rate?token_id=token-1',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('rejects invalid fee responses instead of displaying a partial total', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ fd: { r: null, e: 1, to: true } })),
      }),
    )

    await expect(fetchKuestFeeRate('token-1', 'https://clob.example')).rejects.toThrow('Invalid dynamic fee schedule')
  })

  it('rejects fee strings with trailing units', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ fd: { r: '0.07%', e: 1, to: true } })),
      }),
    )

    await expect(fetchKuestFeeRate('token-1', 'https://clob.example')).rejects.toThrow('Invalid dynamic fee schedule')
  })
})
