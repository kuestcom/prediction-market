interface MarketContextTextProps {
  children: string
}

export function MarketContextText({ children }: MarketContextTextProps) {
  return children.split(/(\*\*.*?(?:\*\*|$)|\*.*?(?:\*|$))/g).map((segment, index) => {
    if (segment.startsWith('**')) {
      const content = segment.endsWith('**') ? segment.slice(2, -2) : segment.slice(2)

      return <strong key={index}>{content}</strong>
    }

    if (segment.startsWith('*')) {
      const content = segment.length > 1 && segment.endsWith('*') ? segment.slice(1, -1) : segment.slice(1)

      return <em key={index}>{content}</em>
    }

    return segment
  })
}
