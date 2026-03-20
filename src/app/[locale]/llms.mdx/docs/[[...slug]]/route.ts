import { getEnglishDocsLlmStaticParams } from '@/lib/docs-static-params'
import { getLLMText } from '@/lib/get-llm-text'
import { source } from '@/lib/source'

interface RouteProps {
  params: Promise<{ locale: string, slug?: string[] }>
}

export async function GET(_request: Request, { params }: RouteProps) {
  const { slug } = await params
  const page = source.getPage(slug)

  if (!page) {
    return new Response('Not found', { status: 404 })
  }

  return new Response(await getLLMText(page), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  })
}

export function generateStaticParams() {
  return getEnglishDocsLlmStaticParams()
}
