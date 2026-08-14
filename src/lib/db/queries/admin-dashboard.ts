import { count, sql } from 'drizzle-orm'

import {
  buildMissingSportsSourceCondition,
  buildPastDueUnresolvedEventCondition,
} from '@/lib/db/queries/admin-event-attention'
import { users } from '@/lib/db/schema/auth/tables'
import { events } from '@/lib/db/schema/events/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'

interface AdminDashboardSeriesPoint {
  date: string
  value: number
}

interface AdminDashboardMetrics {
  missingSportsSourceCount: number
  pendingResolutionCount: number
  registeredUsersCount: number
  registeredUsersLastSevenDaysCount: number
  registeredUsersSeries: AdminDashboardSeriesPoint[]
}

const SERIES_DAY_COUNT = 30

function buildUtcDateKeys(dayCount: number) {
  const today = new Date()
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())

  return Array.from({ length: dayCount }, (_, index) => {
    const offset = dayCount - index - 1
    return new Date(end - offset * 86_400_000).toISOString().slice(0, 10)
  })
}

function fillDailySeries(rows: Array<{ date: string; value: number }>, dateKeys: string[]) {
  const valueByDate = new Map(rows.map((row) => [row.date, Number(row.value ?? 0)]))
  return dateKeys.map((date) => ({ date, value: valueByDate.get(date) ?? 0 }))
}

export const AdminDashboardRepository = {
  async getMetrics() {
    return runQuery(async () => {
      const utcDay = sql`(date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`
      const userUtcDay = sql`date_trunc('day', ${users.created_at} AT TIME ZONE 'UTC')`

      const [missingSportsSourceRows, pendingResolutionRows, userRows, userDailyRows] = await Promise.all([
        db.select({ value: count() }).from(events).where(buildMissingSportsSourceCondition()),
        db.select({ value: count() }).from(events).where(buildPastDueUnresolvedEventCondition()),
        db
          .select({
            total: count(),
            lastSevenDays: sql<number>`COUNT(*) FILTER (
              WHERE ${users.created_at} >= NOW() - INTERVAL '7 days'
            )::integer`,
          })
          .from(users),
        db
          .select({
            date: sql<string>`TO_CHAR(${userUtcDay}, 'YYYY-MM-DD')`,
            value: count(),
          })
          .from(users)
          .where(sql`${users.created_at} >= ${utcDay} - INTERVAL '29 days'`)
          .groupBy(userUtcDay)
          .orderBy(userUtcDay),
      ])

      const dateKeys = buildUtcDateKeys(SERIES_DAY_COUNT)
      const registeredUsersCount = Number(userRows[0]?.total ?? 0)

      return {
        data: {
          missingSportsSourceCount: Number(missingSportsSourceRows[0]?.value ?? 0),
          pendingResolutionCount: Number(pendingResolutionRows[0]?.value ?? 0),
          registeredUsersCount,
          registeredUsersLastSevenDaysCount: Number(userRows[0]?.lastSevenDays ?? 0),
          registeredUsersSeries: fillDailySeries(userDailyRows, dateKeys),
        } satisfies AdminDashboardMetrics,
        error: null,
      }
    })
  },
}
