import { sql } from 'drizzle-orm'
import {
  char,
  index,
  pgTable,
  timestamp,
} from 'drizzle-orm/pg-core'
import { users } from '@/lib/db/schema/auth/tables'

export const affiliate_referrals = pgTable(
  'affiliate_referrals',
  {
    id: char({ length: 26 })
      .primaryKey()
      .default(sql`generate_ulid()`),
    user_id: char({ length: 26 })
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    affiliate_user_id: char({ length: 26 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    created_at: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => ({
    affiliateUserIdIdx: index('idx_affiliate_referrals_affiliate_user_id').on(table.affiliate_user_id),
  }),
)
