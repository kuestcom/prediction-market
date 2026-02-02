import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const URL_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi
const TRAILING_PUNCTUATION = /[).,!?:;]+$/

function normalizeUrl(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value
  }
  return `https://${value}`
}

function splitContent(content: string) {
  const parts: ReactNode[] = []
  let lastIndex = 0

  content.replace(URL_REGEX, (match, _url, offset) => {
    if (offset > lastIndex) {
      parts.push(content.slice(lastIndex, offset))
    }

    let url = match
    let trailing = ''
    const trailingMatch = match.match(TRAILING_PUNCTUATION)
    if (trailingMatch) {
      trailing = trailingMatch[0]
      url = match.slice(0, -trailing.length)
    }

    parts.push(
      <a
        key={`${offset}-${match}`}
        href={normalizeUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline-offset-2 transition-colors hover:text-primary/80 hover:underline"
      >
        {url}
      </a>,
    )

    if (trailing) {
      parts.push(trailing)
    }

    lastIndex = offset + match.length
    return match
  })

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts
}

export default function EventCommentContent({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <p className={cn('text-sm/5.25 font-normal wrap-break-word', className)}>
      {splitContent(content)}
    </p>
  )
}
