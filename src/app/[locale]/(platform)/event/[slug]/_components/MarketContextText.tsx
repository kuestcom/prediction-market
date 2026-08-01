import type { ReactNode } from 'react'

interface MarketContextTextProps {
  children: string
  isTyping?: boolean
}

function findClosingMarker(text: string, marker: string, startIndex: number) {
  let index = text.indexOf(marker, startIndex)

  while (index !== -1) {
    const isExactMarker = text[index - 1] !== '*' && text[index + marker.length] !== '*'

    if (isExactMarker) {
      return index
    }

    index = text.indexOf(marker, index + 1)
  }

  return -1
}

function parseMarketContextText(text: string) {
  const nodes: ReactNode[] = []
  let plainTextStart = 0
  let index = 0

  while (index < text.length) {
    let marker = ''

    if (text.startsWith('***', index)) {
      marker = '***'
    } else if (text.startsWith('**', index)) {
      marker = '**'
    } else if (text[index] === '*' && text[index - 1] !== '*' && !/[\s*]/.test(text[index + 1] ?? '')) {
      marker = '*'
    }

    if (!marker) {
      index += 1
      continue
    }

    const closingIndex = findClosingMarker(text, marker, index + marker.length)

    if (closingIndex === -1) {
      index += marker.length
      continue
    }

    if (plainTextStart < index) {
      nodes.push(text.slice(plainTextStart, index))
    }

    const content = parseMarketContextText(text.slice(index + marker.length, closingIndex))

    if (marker === '***') {
      nodes.push(
        <strong key={index}>
          <em>{content}</em>
        </strong>,
      )
    } else if (marker === '**') {
      nodes.push(<strong key={index}>{content}</strong>)
    } else {
      nodes.push(<em key={index}>{content}</em>)
    }

    index = closingIndex + marker.length
    plainTextStart = index
  }

  if (plainTextStart < text.length) {
    nodes.push(text.slice(plainTextStart))
  }

  return nodes
}

export function MarketContextText({ children, isTyping = false }: MarketContextTextProps) {
  return isTyping ? children : parseMarketContextText(children)
}
