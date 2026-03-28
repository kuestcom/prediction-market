interface WsrvLoaderParams {
  src: string
  width: number
  quality?: number
}

function appendLoaderParams(src: string, width: number, quality?: number) {
  const isRootRelativeSrc = src.startsWith('/') && !src.startsWith('//')
  const url = isRootRelativeSrc
    ? new URL(src, 'http://localhost')
    : new URL(src)

  url.searchParams.set('w', width.toString())
  url.searchParams.set('q', (quality ?? 75).toString())

  return isRootRelativeSrc ? `${url.pathname}${url.search}` : url.toString()
}

function isIrysUrl(src: string) {
  try {
    const url = new URL(src)
    return url.hostname.endsWith('.irys.xyz')
  }
  catch {
    return false
  }
}

export default function wsrvImageLoader({
  src,
  width,
  quality,
}: WsrvLoaderParams): string {
  if (!src) {
    return src
  }

  const isRootRelativeSrc = src.startsWith('/') && !src.startsWith('//')

  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return src
  }

  if (isRootRelativeSrc) {
    return appendLoaderParams(src, width, quality)
  }

  const normalizedSrc = src.startsWith('//') ? `https:${src}` : src

  if (isIrysUrl(normalizedSrc)) {
    return appendLoaderParams(normalizedSrc, width, quality)
  }

  const url = new URL('https://wsrv.nl/')

  url.searchParams.set('url', normalizedSrc)
  url.searchParams.set('width', width.toString())
  url.searchParams.set('w', width.toString())
  url.searchParams.set('q', (quality ?? 75).toString())
  url.searchParams.set('output', 'webp')

  return url.toString()
}
