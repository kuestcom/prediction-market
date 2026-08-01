import type { ReactNode } from 'react'

interface MarketContextTextProps {
  children: string
  isTyping?: boolean
}

function findClosingMarker(text: string, marker: string, startIndex: number) {
  const nestedMarkers: number[] = []
  let index = startIndex

  while (index < text.length) {
    const runStart = text.indexOf('*', index)

    if (runStart === -1) {
      return -1
    }

    let runEnd = runStart

    while (text[runEnd] === '*') {
      runEnd += 1
    }

    const characterBefore = text[runStart - 1]
    const characterAfter = text[runEnd]
    const runLength = runEnd - runStart
    const beforeIsWhitespace = !characterBefore || /\s/.test(characterBefore)
    const afterIsWhitespace = !characterAfter || /\s/.test(characterAfter)
    const beforeIsPunctuation = Boolean(characterBefore) && /[\p{P}\p{S}]/u.test(characterBefore)
    const afterIsPunctuation = Boolean(characterAfter) && /[\p{P}\p{S}]/u.test(characterAfter)
    const canOpen = !afterIsWhitespace && (!afterIsPunctuation || beforeIsWhitespace || beforeIsPunctuation)
    const canClose = !beforeIsWhitespace && (!beforeIsPunctuation || afterIsWhitespace || afterIsPunctuation)
    let remainingMarkers = runLength

    if (canClose) {
      while (nestedMarkers.length > 0 && remainingMarkers >= nestedMarkers[nestedMarkers.length - 1]) {
        remainingMarkers -= nestedMarkers.pop() ?? 0
      }

      if (nestedMarkers.length === 0 && remainingMarkers >= marker.length) {
        return runEnd - marker.length
      }
    }

    if (canOpen && remainingMarkers > 0) {
      nestedMarkers.push(remainingMarkers)
    }

    index = runEnd
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
