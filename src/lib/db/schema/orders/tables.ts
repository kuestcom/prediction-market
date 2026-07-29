import { sql } from 'drizzle-orm'
import { bigint, numeric, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core'

import { users } from '@/lib/db/schema/auth/tables'
import { conditions } from '@/lib/db/schema/events/tables'

export const orders = pgTable('orders', {
  id: text()
    .primaryKey()
    .default(sql`generate_ulid()`),

  // begin blockchain data
  salt: numeric({ mode: 'bigint', precision: 78, scale: 0 }),
  maker: text().notNull(),
  signer: text().notNull(),
  taker: text().notNull(),
  token_id: text().notNull(),
  maker_amount: bigint({ mode: 'bigint' }),
  taker_amount: bigint({ mode: 'bigint' }),
  expiration: bigint({ mode: 'bigint' }).notNull(),
  nonce: bigint({ mode: 'bigint' }),
  fee_rate_bps: smallint().notNull(),
  side: smallint().notNull(),
  signature_type: smallint().notNull(),
  signature: text(),
  // end blockchain data

  user_id: text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  condition_id: text()
    .notNull()
    .references(() => conditions.id),
  type: text().notNull(),
  clob_order_id: text().notNull(),
  affiliate_user_id: text().references(() => users.id),
  created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
})
