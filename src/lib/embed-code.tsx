export const EMBED_CODE_TOKEN_STYLES = {
  tag: 'text-muted-foreground',
  attr: 'text-red-500',
  value: 'text-rose-500',
  punctuation: 'text-muted-foreground',
} as const

export interface EmbedCodeToken {
  text: string
  className?: string
}

export type EmbedCodeLine = EmbedCodeToken[]

export function embedCodeToken(text: string, className?: string): EmbedCodeToken {
  return { text, className }
}

export function tagOpenLine(indent: string, tagName: string): EmbedCodeLine {
  return [
    embedCodeToken(indent),
    embedCodeToken('<', EMBED_CODE_TOKEN_STYLES.tag),
    embedCodeToken(tagName, EMBED_CODE_TOKEN_STYLES.tag),
  ]
}

export function tagWithAttributeLine(indent: string, tagName: string, attrName: string, attrValue: string, closing: string) {
  return [
    embedCodeToken(indent),
    embedCodeToken('<', EMBED_CODE_TOKEN_STYLES.tag),
    embedCodeToken(tagName, EMBED_CODE_TOKEN_STYLES.tag),
    embedCodeToken(' '),
    embedCodeToken(attrName, EMBED_CODE_TOKEN_STYLES.attr),
    embedCodeToken('=', EMBED_CODE_TOKEN_STYLES.punctuation),
    embedCodeToken('"', EMBED_CODE_TOKEN_STYLES.punctuation),
    embedCodeToken(attrValue, EMBED_CODE_TOKEN_STYLES.value),
    embedCodeToken('"', EMBED_CODE_TOKEN_STYLES.punctuation),
    embedCodeToken(closing, EMBED_CODE_TOKEN_STYLES.tag),
  ]
}

export function attributeLine(indent: string, name: string, value: string): EmbedCodeLine {
  return [
    embedCodeToken(indent),
    embedCodeToken(name, EMBED_CODE_TOKEN_STYLES.attr),
    embedCodeToken('=', EMBED_CODE_TOKEN_STYLES.punctuation),
    embedCodeToken('"', EMBED_CODE_TOKEN_STYLES.punctuation),
    embedCodeToken(value, EMBED_CODE_TOKEN_STYLES.value),
    embedCodeToken('"', EMBED_CODE_TOKEN_STYLES.punctuation),
  ]
}

export function tagCloseLine(indent: string, tagName: string): EmbedCodeLine {
  return [
    embedCodeToken(indent),
    embedCodeToken('</', EMBED_CODE_TOKEN_STYLES.tag),
    embedCodeToken(tagName, EMBED_CODE_TOKEN_STYLES.tag),
    embedCodeToken('>', EMBED_CODE_TOKEN_STYLES.tag),
  ]
}

export function tagSelfCloseLine(indent: string): EmbedCodeLine {
  return [
    embedCodeToken(indent),
    embedCodeToken('/>', EMBED_CODE_TOKEN_STYLES.tag),
  ]
}

export function tagEndLine(indent: string): EmbedCodeLine {
  return [
    embedCodeToken(indent),
    embedCodeToken('>', EMBED_CODE_TOKEN_STYLES.tag),
  ]
}

export function EmbedCodePreview({ lines }: { lines: EmbedCodeLine[] }) {
  return (
    <pre className="min-w-max font-mono text-xs/5">
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} className="whitespace-pre">
          {line.map((segment, segmentIndex) => (
            <span key={segmentIndex} className={segment.className}>
              {segment.text}
            </span>
          ))}
        </div>
      ))}
    </pre>
  )
}
