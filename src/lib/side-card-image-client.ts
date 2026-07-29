export const SIDE_CARD_IMAGE_MAX_INPUT_BYTES = 2 * 1024 * 1024
export const SIDE_CARD_IMAGE_MAX_OUTPUT_BYTES = 100 * 1024
const SIDE_CARD_IMAGE_MAX_PIXELS = 40_000_000
const SIDE_CARD_IMAGE_MAX_WIDTH = 1200
const SIDE_CARD_IMAGE_MAX_HEIGHT = 800

const SIDE_CARD_IMAGE_ASPECT_RATIO = 3 / 2
const SIDE_CARD_IMAGE_JPEG_QUALITIES = [0.82, 0.7, 0.58] as const
const SIDE_CARD_IMAGE_OUTPUT_SCALES = [1, 0.85, 0.7, 0.55, 0.4, 0.3, 0.2, 0.1] as const
const ACCEPTED_SIDE_CARD_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png'])
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])

export interface SideCardImageTransform {
  sourceX: number
  sourceY: number
  sourceWidth: number
  sourceHeight: number
  outputWidth: number
  outputHeight: number
}

export function calculateSideCardImageTransform(width: number, height: number): SideCardImageTransform {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Side card image dimensions are invalid.')
  }

  const sourceAspectRatio = width / height
  const sourceWidth = sourceAspectRatio > SIDE_CARD_IMAGE_ASPECT_RATIO ? height * SIDE_CARD_IMAGE_ASPECT_RATIO : width
  const sourceHeight = sourceAspectRatio > SIDE_CARD_IMAGE_ASPECT_RATIO ? height : width / SIDE_CARD_IMAGE_ASPECT_RATIO
  const sourceX = (width - sourceWidth) / 2
  const sourceY = (height - sourceHeight) / 2

  if (sourceWidth < 3 || sourceHeight < 2) {
    throw new Error('Side card image must be at least 3 x 2 pixels.')
  }

  const outputUnit = Math.floor(
    Math.min(SIDE_CARD_IMAGE_MAX_WIDTH / 3, SIDE_CARD_IMAGE_MAX_HEIGHT / 2, sourceWidth / 3, sourceHeight / 2),
  )

  return {
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    outputWidth: outputUnit * 3,
    outputHeight: outputUnit * 2,
  }
}

function encodeCanvasAsJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error('Side card image could not be encoded.'))
          return
        }

        resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}

function renderSideCardImage(bitmap: ImageBitmap, transform: SideCardImageTransform, outputUnit: number) {
  const canvas = document.createElement('canvas')
  canvas.width = outputUnit * 3
  canvas.height = outputUnit * 2

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Side card image could not be processed.')
  }

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(
    bitmap,
    transform.sourceX,
    transform.sourceY,
    transform.sourceWidth,
    transform.sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  return canvas
}

function buildSideCardImageOutputUnits(maxOutputUnit: number) {
  return [
    ...new Set([...SIDE_CARD_IMAGE_OUTPUT_SCALES.map((scale) => Math.max(1, Math.floor(maxOutputUnit * scale))), 1]),
  ]
}

function readPngDimensions(buffer: Uint8Array) {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (buffer.length < 24 || pngSignature.some((byte, index) => buffer[index] !== byte)) {
    return null
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const isImageHeader =
    view.getUint32(8) === 13 && buffer[12] === 0x49 && buffer[13] === 0x48 && buffer[14] === 0x44 && buffer[15] === 0x52
  if (!isImageHeader) {
    return null
  }

  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function readJpegDimensions(buffer: Uint8Array) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  let offset = 2
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      return null
    }

    while (buffer[offset] === 0xff) {
      offset += 1
    }

    const marker = buffer[offset]
    if (marker === undefined || marker === 0x00 || marker === 0xd8 || marker === 0xd9) {
      return null
    }
    offset += 1

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue
    }
    if (offset + 2 > buffer.length) {
      return null
    }

    const segmentLength = view.getUint16(offset)
    const segmentEnd = offset + segmentLength
    if (segmentLength < 2 || segmentEnd > buffer.length) {
      return null
    }

    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 7) {
        return null
      }
      return {
        height: view.getUint16(offset + 3),
        width: view.getUint16(offset + 5),
      }
    }
    if (marker === 0xda) {
      return null
    }

    offset = segmentEnd
  }

  return null
}

async function validateSideCardImageDimensions(file: File) {
  const buffer = new Uint8Array(await file.arrayBuffer())
  const dimensions = file.type === 'image/png' ? readPngDimensions(buffer) : readJpegDimensions(buffer)

  if (
    !dimensions ||
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    dimensions.width > Math.floor(SIDE_CARD_IMAGE_MAX_PIXELS / dimensions.height)
  ) {
    throw new Error('Side card image dimensions are invalid or too large.')
  }
}

function buildOptimizedFileName(fileName: string) {
  const baseName = fileName.trim().replace(/\.[^.]+$/, '') || 'side-card'
  return `${baseName}.jpg`
}

export async function optimizeSideCardImage(file: File): Promise<File> {
  if (!ACCEPTED_SIDE_CARD_IMAGE_TYPES.has(file.type)) {
    throw new Error('Side card image must be PNG or JPG.')
  }

  if (file.size > SIDE_CARD_IMAGE_MAX_INPUT_BYTES) {
    throw new Error('Side card image must be 2MB or smaller.')
  }

  await validateSideCardImageDimensions(file)
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

  try {
    const transform = calculateSideCardImageTransform(bitmap.width, bitmap.height)
    const maxOutputUnit = transform.outputWidth / 3

    for (const outputUnit of buildSideCardImageOutputUnits(maxOutputUnit)) {
      const canvas = renderSideCardImage(bitmap, transform, outputUnit)
      for (const quality of SIDE_CARD_IMAGE_JPEG_QUALITIES) {
        const output = await encodeCanvasAsJpeg(canvas, quality)
        if (output.size <= SIDE_CARD_IMAGE_MAX_OUTPUT_BYTES) {
          return new File([output], buildOptimizedFileName(file.name), {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          })
        }
      }
    }

    throw new Error('Optimized side card image must be 100KB or smaller.')
  } finally {
    bitmap.close()
  }
}
