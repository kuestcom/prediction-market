import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface TermsOfServiceDocumentProps {
  content: string
  siteName: string
  siteUrl: string
}

interface DocumentBlock {
  type: 'heading' | 'paragraph' | 'unordered-list' | 'ordered-list'
  level?: 1 | 2 | 3
  lines: string[]
}

type TermsOfServiceReplacements = Record<'siteName' | 'siteNameUpper' | 'siteUrl', string>

function getTermsOfServiceReplacements(siteName: string, siteUrl: string): TermsOfServiceReplacements {
  return {
    siteName,
    siteNameUpper: siteName.toUpperCase(),
    siteUrl,
  }
}

function renderInterpolatedText(value: string, replacements: TermsOfServiceReplacements): ReactNode {
  const parts: string[] = []
  let lastIndex = 0

  for (const match of value.matchAll(/\{\{(siteNameUpper|siteName|siteUrl)\}\}/g)) {
    const matchIndex = match.index ?? 0
    if (matchIndex > lastIndex) {
      parts.push(value.slice(lastIndex, matchIndex))
    }
    parts.push(replacements[match[1] as keyof TermsOfServiceReplacements] ?? '')
    lastIndex = matchIndex + match[0].length
  }

  if (lastIndex < value.length) {
    parts.push(value.slice(lastIndex))
  }

  if (parts.length <= 1) {
    return parts[0] ?? null
  }

  return parts.map((part, index) => <span key={index}>{part}</span>)
}

function parseDocument(content: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = []
  let paragraphLines: string[] = []
  let listType: 'unordered-list' | 'ordered-list' | null = null
  let listLines: string[] = []

  function flushParagraph() {
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', lines: paragraphLines })
      paragraphLines = []
    }
  }

  function flushList() {
    if (listType && listLines.length > 0) {
      blocks.push({ type: listType, lines: listLines })
    }
    listType = null
    listLines = []
  }

  for (const line of content.replaceAll('\r\n', '\n').split('\n')) {
    const trimmedLine = line.trim()
    if (!trimmedLine) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      blocks.push({
        type: 'heading',
        level: headingMatch[1]!.length as 1 | 2 | 3,
        lines: [headingMatch[2]!],
      })
      continue
    }

    const unorderedListMatch = trimmedLine.match(/^[-*]\s+(.+)$/)
    if (unorderedListMatch) {
      flushParagraph()
      if (listType !== 'unordered-list') {
        flushList()
        listType = 'unordered-list'
      }
      listLines.push(unorderedListMatch[1]!)
      continue
    }

    const orderedListMatch = trimmedLine.match(/^\d+[.)]\s+(.+)$/)
    if (orderedListMatch) {
      flushParagraph()
      if (listType !== 'ordered-list') {
        flushList()
        listType = 'ordered-list'
      }
      listLines.push(orderedListMatch[1]!)
      continue
    }

    if (listType) {
      flushList()
    }
    paragraphLines.push(trimmedLine)
  }

  flushParagraph()
  flushList()
  return blocks
}

function renderInlineText(value: string, replacements: TermsOfServiceReplacements): ReactNode[] {
  const tokens = value.split(/(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|(?<!\w)_[^_\n]+_(?!\w))/g)

  return tokens.filter(Boolean).map((token, index) => {
    if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
      return <strong key={index}>{renderInterpolatedText(token.slice(2, -2), replacements)}</strong>
    }

    if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      return <em key={index}>{renderInterpolatedText(token.slice(1, -1), replacements)}</em>
    }

    return <span key={index}>{renderInterpolatedText(token, replacements)}</span>
  })
}

function renderBlock(block: DocumentBlock, index: number, siteName: string, siteUrl: string) {
  const replacements = getTermsOfServiceReplacements(siteName, siteUrl)
  const lines = block.lines

  if (block.type === 'heading') {
    const headingClassName = cn(
      'scroll-m-20 font-semibold tracking-tight',
      block.level === 1 && 'text-3xl font-bold tracking-tight lg:text-4xl',
      block.level === 2 && 'text-xl lg:text-2xl',
      block.level === 3 && 'text-lg lg:text-xl',
    )
    const headingContent = renderInlineText(lines[0] ?? '', replacements)

    if (block.level === 1) {
      return (
        <h1 key={index} className={headingClassName}>
          {headingContent}
        </h1>
      )
    }

    if (block.level === 2) {
      return (
        <h2 key={index} className={headingClassName}>
          {headingContent}
        </h2>
      )
    }

    return (
      <h3 key={index} className={headingClassName}>
        {headingContent}
      </h3>
    )
  }

  if (block.type === 'unordered-list' || block.type === 'ordered-list') {
    const items = lines.map((line, itemIndex) => <li key={itemIndex}>{renderInlineText(line, replacements)}</li>)
    const className = 'ml-6 list-outside space-y-2'

    return block.type === 'unordered-list' ? (
      <ul key={index} className={cn(className, 'list-disc')}>
        {items}
      </ul>
    ) : (
      <ol key={index} className={cn(className, 'list-decimal')}>
        {items}
      </ol>
    )
  }

  return (
    <p key={index} className="whitespace-pre-line">
      {renderInlineText(lines.join(' '), replacements)}
    </p>
  )
}

export default function TermsOfServiceDocument({ content, siteName, siteUrl }: TermsOfServiceDocumentProps) {
  const blocks = parseDocument(content)

  return (
    <article className="space-y-8 leading-relaxed text-foreground dark:text-foreground">
      {blocks.map((block, index) => renderBlock(block, index, siteName, siteUrl))}
    </article>
  )
}
