import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/kuest-support/verify/route'

describe('kuest Support verification route', () => {
  it('rejects an oversized request body before assertion verification', async () => {
    const request = new Request('https://market.example.com/api/kuest-support/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assertion: 'a'.repeat(13 * 1024) }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid support assertion.' })
  })
})
