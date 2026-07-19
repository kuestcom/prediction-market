import type { NextRequest } from 'next/server'
import { IdentityProviderRepository } from '@/lib/db/queries/identity-provider'
import { IDENTITY_MAX_PROVIDER_PAYLOAD_BYTES } from '@/lib/identity/constants'
import { readResponseBodyWithLimit } from '@/lib/read-response-body-with-limit'

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return Response.json({ error: 'CONTENT_TYPE_INVALID' }, { status: 415 })
  }
  const bodyBytes = await readResponseBodyWithLimit(request, IDENTITY_MAX_PROVIDER_PAYLOAD_BYTES)
  if (!bodyBytes) {
    return Response.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
  }
  const rawBody = new TextDecoder().decode(bodyBytes)
  try {
    const { provider } = await params
    const result = await IdentityProviderRepository.processWebhook({ providerKey: provider, headers: request.headers, rawBody })
    return Response.json({ received: true, duplicate: result.duplicate })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : ''
    const clientError = message.startsWith('IDENTITY_PROVIDER_')
    return Response.json({ error: clientError ? message : 'WEBHOOK_PROCESSING_FAILED' }, { status: clientError ? 400 : 500 })
  }
}
