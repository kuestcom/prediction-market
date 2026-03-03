import { getLLMText } from '@/lib/get-llm-text'
import { source } from '@/lib/source'

export async function GET() {
  const scanned = await Promise.all(source.getPages().map(getLLMText))

  return new Response(scanned.join('\n\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
