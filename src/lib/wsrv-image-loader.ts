interface WsrvLoaderParams {
  src: string
  width: number
  quality?: number
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

  if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('/')) {
    return src
  }

  const normalizedSrc = src.startsWith('//') ? `https:${src}` : src

  if (isIrysUrl(normalizedSrc)) {
    return normalizedSrc
  }

  const url = new URL('https://wsrv.nl/')

  url.searchParams.set('url', normalizedSrc)
  url.searchParams.set('w', width.toString())
  url.searchParams.set('q', (quality ?? 75).toString())
  url.searchParams.set('output', 'webp')

  return url.toString()
}
