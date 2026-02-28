import type { NextRequest } from 'next/server'
import type { MarketSearchResult } from '@/types/market-search'
import { and, desc, eq, ilike, isNotNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { markets } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get('limit') ?? '8'),
    20,
  )

  if (q.length < 2) {
    return NextResponse.json<MarketSearchResult[]>([])
  }

  const rows = await db
    .select({
      condition_id: markets.condition_id,
      slug: markets.slug,
      question: markets.question,
      volume: markets.volume,
      is_active: markets.is_active,
      end_time: markets.end_time,
    })
    .from(markets)
    .where(
      and(
        isNotNull(markets.question),
        ilike(markets.question, `%${q}%`),
        eq(markets.is_active, true),
      ),
    )
    .orderBy(desc(markets.volume))
    .limit(limit)

  const results: MarketSearchResult[] = rows.map((row): MarketSearchResult => ({
    id: row.condition_id,
    slug: row.slug,
    question: row.question ?? '',
    probability: 0.5,
    closeTime: row.end_time?.toISOString() ?? '',
    volumeUsdc: Number(row.volume ?? 0),
    active: row.is_active,
    category: undefined,
  }))

  return NextResponse.json(results)
}
