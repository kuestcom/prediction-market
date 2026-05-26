import {
  buildClobSdkEnvBlock,
  buildRelayerBuilderSdkEnvBlock,
  hasSdkApiKeyCredentials,
} from '@/lib/sdk-api-keys'

describe('sdk api key helpers', () => {
  const nonce = '7'
  const credential = {
    key: '11111111-1111-4111-8111-111111111111',
    secret: 'secret_base64_url',
    passphrase: 'passphrase',
  }

  it('builds the CLOB environment block without extra state', () => {
    expect(buildClobSdkEnvBlock('0x0000000000000000000000000000000000000001', credential)).toBe([
      'KUEST_ADDRESS=0x0000000000000000000000000000000000000001',
      'KUEST_API_KEY=11111111-1111-4111-8111-111111111111',
      'KUEST_API_SECRET=secret_base64_url',
      'KUEST_PASSPHRASE=passphrase',
    ].join('\n'))
  })

  it('builds the relayer builder environment block', () => {
    expect(buildRelayerBuilderSdkEnvBlock(credential)).toBe([
      'KUEST_BUILDER_API_KEY=11111111-1111-4111-8111-111111111111',
      'KUEST_BUILDER_SECRET=secret_base64_url',
      'KUEST_BUILDER_PASSPHRASE=passphrase',
    ].join('\n'))
  })

  it('detects whether credentials are present', () => {
    expect(hasSdkApiKeyCredentials(null)).toBe(false)
    expect(hasSdkApiKeyCredentials({
      nonce,
      address: '0x0000000000000000000000000000000000000001',
    })).toBe(false)
    expect(hasSdkApiKeyCredentials({
      nonce,
      address: '0x0000000000000000000000000000000000000001',
      clob: credential,
    })).toBe(true)
    expect(hasSdkApiKeyCredentials({
      nonce,
      address: '0x0000000000000000000000000000000000000001',
      relayer: credential,
    })).toBe(true)
  })
})
