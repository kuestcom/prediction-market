import { afterEach, describe, expect, it, mock } from 'bun:test'

import { fetchKuestFeeRate } from '@/lib/clob'

import { stubGlobal, unstubAllGlobals } from '../bun-test-helpers'

describe('fetchKuestFeeRate', () => {
  afterEach(() => {
    unstubAllGlobals()
  })

  it('loads the dynamic Kuest fee schedule for the selected token', async () => {
    const fetchMock = mock().mockResolvedValue({
      ok: true,
      status: 200,
      text: mock().mockResolvedValue(
        JSON.stringify({
          base_fee: 441,
          fd: { r: 0.0441, e: 1, to: true },
          fee_schedule: { rate: 0.0441, exponent: 1, takerOnly: true, rebateRate: 0.2 },
        }),
      ),
    })
    stubGlobal('fetch', fetchMock)

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
    stubGlobal(
      'fetch',
      mock().mockResolvedValue({
        ok: true,
        status: 200,
        text: mock().mockResolvedValue(JSON.stringify({ fd: { r: null, e: 1, to: true } })),
      }),
    )

    await expect(fetchKuestFeeRate('token-1', 'https://clob.example')).rejects.toThrow('Invalid dynamic fee schedule')
  })

  it('rejects fee strings with trailing units', async () => {
    stubGlobal(
      'fetch',
      mock().mockResolvedValue({
        ok: true,
        status: 200,
        text: mock().mockResolvedValue(JSON.stringify({ fd: { r: '0.07%', e: 1, to: true } })),
      }),
    )

    await expect(fetchKuestFeeRate('token-1', 'https://clob.example')).rejects.toThrow('Invalid dynamic fee schedule')
  })
})
