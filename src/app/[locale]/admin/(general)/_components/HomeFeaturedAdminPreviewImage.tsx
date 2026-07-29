function normalizePreviewImageSrc(src: string | null | undefined) {
  const normalizedSrc = src?.trim()
  if (!normalizedSrc) {
    return null
  }
  if (normalizedSrc.startsWith('/') && !normalizedSrc.startsWith('//')) {
    return normalizedSrc
  }
  if (normalizedSrc.startsWith('data:image/') || normalizedSrc.startsWith('blob:')) {
    return normalizedSrc
  }

  try {
    const url = new URL(normalizedSrc.startsWith('//') ? `https:${normalizedSrc}` : normalizedSrc)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export default function HomeFeaturedAdminPreviewImage({
  src,
  alt,
  className,
}: {
  src: string | null | undefined
  alt: string
  className: string
}) {
  const normalizedSrc = normalizePreviewImageSrc(src)
  if (!normalizedSrc) {
    return null
  }

  return (
    // oxlint-disable-next-line next/no-img-element -- Admin previews accept transient and external sources that bypass Next image optimization.
    <img
      src={normalizedSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
    />
  )
}
