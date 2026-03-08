import type { StructuredDataNode } from '@/lib/structured-data'

interface StructuredDataScriptProps {
  data: StructuredDataNode
}

function serializeStructuredData(data: StructuredDataNode) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export default function StructuredDataScript({ data }: StructuredDataScriptProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeStructuredData(data) }}
    />
  )
}
