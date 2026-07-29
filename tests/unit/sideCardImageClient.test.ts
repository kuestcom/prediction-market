import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  calculateSideCardImageTransform,
  optimizeSideCardImage,
  SIDE_CARD_IMAGE_MAX_INPUT_BYTES,
  SIDE_CARD_IMAGE_MAX_OUTPUT_BYTES,
} from '@/lib/side-card-image-client'

function buildPngFile(width: number, height: number, name = 'side-card.png', lastModified = 0) {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return new File([bytes], name, { type: 'image/png', lastModified })
}

function buildJpegFile(width: number, height: number, name = 'side-card.jpg') {
  const bytes = new Uint8Array(15)
  bytes.set([0xff, 0xd8, 0xff, 0xc0])
  const view = new DataView(bytes.buffer)
  view.setUint16(4, 11)
  bytes[6] = 8
  view.setUint16(7, height)
  view.setUint16(9, width)
  bytes.set([1, 1, 0x11, 0], 11)
  return new File([bytes], name, { type: 'image/jpeg' })
}

describe('sideCardImageClient', () => {
  const fillRect = vi.fn()
  const drawImage = vi.fn()
  const context = {
    fillStyle: '',
    fillRect,
    drawImage,
  }
  let getContextSpy: ReturnType<typeof vi.spyOn>
  let toBlobSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fillRect.mockReset()
    drawImage.mockReset()
    context.fillStyle = ''
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as any)
    toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
  })

  afterEach(() => {
    getContextSpy.mockRestore()
    toBlobSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('calculates a centered 3:2 crop and caps large images at 1200x800', () => {
    expect(calculateSideCardImageTransform(2400, 1000)).toEqual({
      sourceX: 450,
      sourceY: 0,
      sourceWidth: 1500,
      sourceHeight: 1000,
      outputWidth: 1200,
      outputHeight: 800,
    })

    expect(calculateSideCardImageTransform(900, 1200)).toEqual({
      sourceX: 0,
      sourceY: 300,
      sourceWidth: 900,
      sourceHeight: 600,
      outputWidth: 900,
      outputHeight: 600,
    })
  })

  it('does not enlarge a smaller image that already has a 3:2 aspect ratio', () => {
    expect(calculateSideCardImageTransform(600, 400)).toEqual({
      sourceX: 0,
      sourceY: 0,
      sourceWidth: 600,
      sourceHeight: 400,
      outputWidth: 600,
      outputHeight: 400,
    })
  })

  it.each([
    [1, 1],
    [2, 2],
  ])('rejects a %sx%s image that cannot produce a 3:2 output', (width, height) => {
    expect(() => calculateSideCardImageTransform(width, height)).toThrow(
      'Side card image must be at least 3 x 2 pixels.',
    )
  })

  it.each([
    {
      file: new File(['image'], 'side-card.webp', { type: 'image/webp' }),
      message: 'Side card image must be PNG or JPG.',
    },
    {
      file: new File([new Uint8Array(SIDE_CARD_IMAGE_MAX_INPUT_BYTES + 1)], 'side-card.png', { type: 'image/png' }),
      message: 'Side card image must be 2MB or smaller.',
    },
  ])('rejects invalid input before decoding it', async ({ file, message }) => {
    const createImageBitmapMock = vi.fn()
    vi.stubGlobal('createImageBitmap', createImageBitmapMock)

    await expect(optimizeSideCardImage(file)).rejects.toThrow(message)
    expect(createImageBitmapMock).not.toHaveBeenCalled()
  })

  it.each([
    { label: 'PNG', file: buildPngFile(10_000, 5_000) },
    { label: 'JPEG', file: buildJpegFile(8_000, 6_000) },
    { label: 'malformed JPEG', file: new File(['not-an-image'], 'side-card.jpg', { type: 'image/jpeg' }) },
  ])('rejects an oversized or malformed $label before decoding it', async ({ file }) => {
    const createImageBitmapMock = vi.fn()
    vi.stubGlobal('createImageBitmap', createImageBitmapMock)

    await expect(optimizeSideCardImage(file)).rejects.toThrow('Side card image dimensions are invalid or too large.')
    expect(createImageBitmapMock).not.toHaveBeenCalled()
  })

  it('applies orientation, center-crops, paints a white background, and returns a JPEG', async () => {
    const close = vi.fn()
    const bitmap = { width: 2400, height: 1000, close } as unknown as ImageBitmap
    const createImageBitmapMock = vi.fn().mockResolvedValue(bitmap)
    vi.stubGlobal('createImageBitmap', createImageBitmapMock)
    toBlobSpy.mockImplementation(((callback: BlobCallback) => {
      callback(new Blob([new Uint8Array(100)], { type: 'image/jpeg' }))
    }) as typeof HTMLCanvasElement.prototype.toBlob)
    const input = buildPngFile(2400, 1000, 'campaign.banner.png', 1234)

    const output = await optimizeSideCardImage(input)
    const canvas = getContextSpy.mock.instances[0] as HTMLCanvasElement

    expect(createImageBitmapMock).toHaveBeenCalledWith(input, { imageOrientation: 'from-image' })
    expect(canvas.width).toBe(1200)
    expect(canvas.height).toBe(800)
    expect(context.fillStyle).toBe('#ffffff')
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1200, 800)
    expect(drawImage).toHaveBeenCalledWith(bitmap, 450, 0, 1500, 1000, 0, 0, 1200, 800)
    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.82)
    expect(output).toBeInstanceOf(File)
    expect(output.name).toBe('campaign.banner.jpg')
    expect(output.type).toBe('image/jpeg')
    expect(output.size).toBe(100)
    expect(output.lastModified).toBe(1234)
    expect(close).toHaveBeenCalledOnce()
  })

  it('lowers JPEG quality until the encoded image fits the output limit', async () => {
    const close = vi.fn()
    const bitmap = { width: 1200, height: 800, close } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    const encodedSizes = [
      SIDE_CARD_IMAGE_MAX_OUTPUT_BYTES + 2,
      SIDE_CARD_IMAGE_MAX_OUTPUT_BYTES + 1,
      SIDE_CARD_IMAGE_MAX_OUTPUT_BYTES,
    ]
    toBlobSpy.mockImplementation(((callback: BlobCallback) => {
      const size = encodedSizes.shift() ?? 0
      callback(new Blob([new Uint8Array(size)], { type: 'image/jpeg' }))
    }) as typeof HTMLCanvasElement.prototype.toBlob)

    const output = await optimizeSideCardImage(buildJpegFile(1200, 800, 'side-card.jpeg'))

    expect(toBlobSpy.mock.calls.map(([, , quality]) => quality)).toEqual([0.82, 0.7, 0.58])
    expect(output.size).toBe(SIDE_CARD_IMAGE_MAX_OUTPUT_BYTES)
    expect(close).toHaveBeenCalledOnce()
  })

  it('reduces resolution when quality changes alone cannot reach the output limit', async () => {
    const close = vi.fn()
    const bitmap = { width: 1200, height: 800, close } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    const encodedSizes = [
      SIDE_CARD_IMAGE_MAX_OUTPUT_BYTES + 3,
      SIDE_CARD_IMAGE_MAX_OUTPUT_BYTES + 2,
      SIDE_CARD_IMAGE_MAX_OUTPUT_BYTES + 1,
      SIDE_CARD_IMAGE_MAX_OUTPUT_BYTES,
    ]
    toBlobSpy.mockImplementation(((callback: BlobCallback) => {
      const size = encodedSizes.shift() ?? 0
      callback(new Blob([new Uint8Array(size)], { type: 'image/jpeg' }))
    }) as typeof HTMLCanvasElement.prototype.toBlob)

    const output = await optimizeSideCardImage(buildJpegFile(1200, 800))
    const resizedCanvas = getContextSpy.mock.instances[1] as HTMLCanvasElement

    expect(toBlobSpy.mock.calls.map(([, , quality]) => quality)).toEqual([0.82, 0.7, 0.58, 0.82])
    expect(resizedCanvas.width).toBe(1020)
    expect(resizedCanvas.height).toBe(680)
    expect(output.size).toBe(SIDE_CARD_IMAGE_MAX_OUTPUT_BYTES)
    expect(close).toHaveBeenCalledOnce()
  })

  it('closes the bitmap when every encoded quality remains too large', async () => {
    const close = vi.fn()
    const bitmap = { width: 1200, height: 800, close } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    toBlobSpy.mockImplementation(((callback: BlobCallback) => {
      callback(new Blob([new Uint8Array(SIDE_CARD_IMAGE_MAX_OUTPUT_BYTES + 1)], { type: 'image/jpeg' }))
    }) as typeof HTMLCanvasElement.prototype.toBlob)

    await expect(optimizeSideCardImage(buildJpegFile(1200, 800))).rejects.toThrow(
      'Optimized side card image must be 100KB or smaller.',
    )

    const smallestCanvas = getContextSpy.mock.instances.at(-1) as HTMLCanvasElement
    expect(smallestCanvas.width).toBe(3)
    expect(smallestCanvas.height).toBe(2)
    expect(toBlobSpy.mock.calls.length).toBeGreaterThan(3)
    expect(close).toHaveBeenCalledOnce()
  })
})
