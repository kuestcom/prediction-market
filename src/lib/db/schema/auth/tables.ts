import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { CLOB_ORDER_TYPE } from '@/lib/constants'

export const users = pgTable('users', {
  id: text().primaryKey(),
  address: text().notNull(),
  email: text().notNull().unique(),
  email_verified: boolean().default(false).notNull(),
  image: text('image'),
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp()
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  two_factor_enabled: boolean().default(false),
  username: text().unique(),
  settings: jsonb()
    .$type<Record<string, any>>()
    .default({
      trading: {
        market_order_type: CLOB_ORDER_TYPE.FAK,
      },
    }),
  proxy_wallet_address: text('proxy_wallet_address'),
  proxy_wallet_signature: text('proxy_wallet_signature'),
  proxy_wallet_signed_at: timestamp('proxy_wallet_signed_at'),
  proxy_wallet_status: text('proxy_wallet_status').default('not_started').notNull(),
  proxy_wallet_tx_hash: text('proxy_wallet_tx_hash'),
  affiliate_code: text(),
  referred_by_user_id: text().references((): any => users.id, { onDelete: 'set null' }),
})

export const sessions = pgTable('sessions', {
  id: text().primaryKey(),
  expires_at: timestamp().notNull(),
  token: text().notNull().unique(),
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ip_address: text(),
  user_agent: text(),
  user_id: text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
})

export const accounts = pgTable('accounts', {
  id: text().primaryKey(),
  account_id: text().notNull(),
  provider_id: text().notNull(),
  user_id: text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  access_token: text(),
  refresh_token: text(),
  id_token: text(),
  access_token_expires_at: timestamp(),
  refresh_token_expires_at: timestamp(),
  scope: text(),
  password: text(),
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})

export const verifications = pgTable('verifications', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text('value').notNull(),
  expires_at: timestamp().notNull(),
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp()
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})

export const wallets = pgTable('wallets', {
  id: text().primaryKey(),
  user_id: text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  address: text().notNull(),
  chain_id: integer().notNull(),
  is_primary: boolean().default(false),
  created_at: timestamp().notNull(),
})

export const two_factors = pgTable('two_factors', {
  id: text().primaryKey(),
  secret: text().notNull(),
  backup_codes: text().notNull(),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
})
