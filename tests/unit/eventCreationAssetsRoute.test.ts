import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  getCurrentUser: mock(),
  getDraftByIdForUser: mock(),
  updateDraftCoreFields: mock(),
  uploadPublicAsset: mock(),
}))

void mock.module('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args),
  },
}))

void mock.module('@/lib/db/queries/event-creations', () => ({
  EventCreationRepository: {
    getDraftByIdForUser: (...args: any[]) => mocks.getDraftByIdForUser(...args),
    updateDraftCoreFields: (...args: any[]) => mocks.updateDraftCoreFields(...args),
  },
}))

void mock.module('@/lib/storage', () => ({
  getPublicAssetUrl: (path: string) => `https://example.com/${path}`,
}))

void mock.module('@/lib/storage-upload', () => ({
  uploadPublicAsset: (...args: any[]) => mocks.uploadPublicAsset(...args),
}))

const { POST } = await import('@/app/[locale]/admin/api/event-creations/[id]/assets/route')

describe('event creation assets route', () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset()
    mocks.getDraftByIdForUser.mockReset()
    mocks.updateDraftCoreFields.mockReset()
    mocks.uploadPublicAsset.mockReset()
  })

  it('rejects invalid option image targets before uploading', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.getDraftByIdForUser.mockResolvedValueOnce({
      data: { assetPayload: null },
      error: null,
    })

    const formData = new FormData()
    formData.set('kind', 'optionImage')
    formData.set('targetKey', '__proto__')
    formData.set('file', new File(['image'], 'option.png', { type: 'image/png' }))

    const response = await POST(
      {
        formData: mock().mockResolvedValue(formData),
      } as any,
      {
        params: Promise.resolve({ id: 'draft-1', locale: 'en' }),
      },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid option image target.',
    })
    expect(mocks.uploadPublicAsset).not.toHaveBeenCalled()
    expect(mocks.updateDraftCoreFields).not.toHaveBeenCalled()
  })

  it('rejects invalid team logo targets before uploading', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.getDraftByIdForUser.mockResolvedValueOnce({
      data: { assetPayload: null },
      error: null,
    })

    const formData = new FormData()
    formData.set('kind', 'teamLogo')
    formData.set('targetKey', 'bench')
    formData.set('file', new File(['image'], 'logo.png', { type: 'image/png' }))

    const response = await POST(
      {
        formData: mock().mockResolvedValue(formData),
      } as any,
      {
        params: Promise.resolve({ id: 'draft-1', locale: 'en' }),
      },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid team logo target.',
    })
    expect(mocks.uploadPublicAsset).not.toHaveBeenCalled()
    expect(mocks.updateDraftCoreFields).not.toHaveBeenCalled()
  })
})
