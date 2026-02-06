import { sql } from 'drizzle-orm'
import {
  boolean,
  char,
  integer,
  jsonb,
  numeric,
  pgTable,
  pgView,
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const conditions = pgTable(
  'conditions',
  {
    id: text().primaryKey(),
    oracle: text().notNull(),
    question_id: text().notNull(),
    resolved: boolean().default(false),
    metadata_hash: text(),
    creator: char('creator', { length: 42 }),
    uma_request_tx_hash: char('uma_request_tx_hash', { length: 66 }),
    uma_request_log_index: integer('uma_request_log_index'),
    uma_oracle_address: char('uma_oracle_address', { length: 42 }),
    mirror_uma_request_tx_hash: char('mirror_uma_request_tx_hash', { length: 66 }),
    mirror_uma_request_log_index: integer('mirror_uma_request_log_index'),
    mirror_uma_oracle_address: char('mirror_uma_oracle_address', { length: 42 }),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
)

export const conditions_audit = pgTable(
  'conditions_audit',
  {
    id: char({ length: 26 })
      .primaryKey()
      .default(sql`generate_ulid()`),
    condition_id: text()
      .notNull()
      .references(() => conditions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    old_values: jsonb().notNull(),
    new_values: jsonb().notNull(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
)

export const events = pgTable(
  'events',
  {
    id: char({ length: 26 })
      .primaryKey()
      .default(sql`generate_ulid()`),
    slug: text()
      .notNull()
      .unique(),
    title: text()
      .notNull(),
    creator: char({ length: 42 }),
    icon_url: text(),
    show_market_icons: boolean()
      .default(true),
    enable_neg_risk: boolean()
      .default(false),
    neg_risk_augmented: boolean()
      .default(false),
    neg_risk: boolean()
      .default(false),
    neg_risk_market_id: char({ length: 66 }),
    status: text()
      .notNull()
      .default('active'),
    rules: text(),
    active_markets_count: integer()
      .default(0),
    total_markets_count: integer()
      .default(0),
    created_at: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow(),
    end_date: timestamp({ withTimezone: true }),
    resolved_at: timestamp({ withTimezone: true }),
  },
)

export const markets = pgTable(
  'markets',
  {
    condition_id: text()
      .primaryKey()
      .references(() => conditions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    event_id: char({ length: 26 })
      .notNull()
      .references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    title: text().notNull(),
    slug: text().notNull(),
    short_title: text(),
    question: text(),
    market_rules: text(),
    resolution_source: text(),
    resolution_source_url: text(),
    resolver: char({ length: 42 }),
    neg_risk: boolean().default(false).notNull(),
    neg_risk_other: boolean().default(false).notNull(),
    neg_risk_market_id: char({ length: 66 }),
    neg_risk_request_id: char({ length: 66 }),
    metadata_version: text(),
    metadata_schema: text(),
    icon_url: text(),
    is_active: boolean().default(true).notNull(),
    is_resolved: boolean().default(false).notNull(),
    metadata: text(),
    volume_24h: numeric({ precision: 20, scale: 6 }).default('0').notNull(),
    volume: numeric({ precision: 20, scale: 6 }).default('0').notNull(),
    end_time: timestamp({ withTimezone: true }),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
)

export const outcomes = pgTable(
  'outcomes',
  {
    condition_id: text()
      .notNull()
      .references(() => conditions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    outcome_text: text().notNull(),
    outcome_index: smallint().notNull(),
    token_id: text().notNull().primaryKey(),
    is_winning_outcome: boolean().default(false),
    payout_value: numeric({ precision: 20, scale: 6 }),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
)

export const tags = pgTable(
  'tags',
  {
    id: smallint().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull().unique(),
    slug: text().notNull().unique(),
    is_main_category: boolean().default(false),
    is_hidden: boolean().notNull().default(false),
    hide_events: boolean().notNull().default(false),
    display_order: smallint().default(0),
    parent_tag_id: smallint().references((): any => tags.id),
    active_markets_count: integer().default(0),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
)

export const tag_translations = pgTable(
  'tag_translations',
  {
    tag_id: smallint()
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    locale: text().notNull(),
    name: text().notNull(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    pk: primaryKey({ columns: [table.tag_id, table.locale] }),
  }),
)

export const event_tags = pgTable(
  'event_tags',
  {
    event_id: char({ length: 26 })
      .notNull()
      .references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tag_id: smallint()
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  },
)

export const v_main_tag_subcategories = pgView(
  'v_main_tag_subcategories',
  {
    main_tag_id: integer(),
    main_tag_slug: text(),
    main_tag_name: text(),
    main_tag_is_hidden: boolean(),
    sub_tag_id: integer(),
    sub_tag_name: text(),
    sub_tag_slug: text(),
    sub_tag_is_main_category: boolean(),
    sub_tag_is_hidden: boolean(),
    active_markets_count: integer(),
    last_market_activity_at: timestamp(),
  },
).existing()
