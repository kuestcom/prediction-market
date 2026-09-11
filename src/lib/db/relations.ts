import { defineRelations } from 'drizzle-orm'

import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
  users: {
    sessions: r.many.sessions({ from: r.users.id, to: r.sessions.user_id }),
    accounts: r.many.accounts({ from: r.users.id, to: r.accounts.user_id }),
    wallets: r.many.wallets({ from: r.users.id, to: r.wallets.user_id }),
    twoFactors: r.many.two_factors({ from: r.users.id, to: r.two_factors.user_id }),
    bookmarks: r.many.bookmarks({ from: r.users.id, to: r.bookmarks.user_id }),
    orders: r.many.orders({ from: r.users.id, to: r.orders.user_id }),
    notifications: r.many.notifications({ from: r.users.id, to: r.notifications.user_id }),
    referredByUser: r.one.users({
      from: r.users.referred_by_user_id,
      to: r.users.id,
      alias: 'user_referrals',
    }),
    referredUsers: r.many.users({
      from: r.users.id,
      to: r.users.referred_by_user_id,
      alias: 'user_referrals',
    }),
    referrals: r.many.affiliate_referrals({
      from: r.users.id,
      to: r.affiliate_referrals.user_id,
      alias: 'user_referrals',
    }),
    affiliateReferrals: r.many.affiliate_referrals({
      from: r.users.id,
      to: r.affiliate_referrals.affiliate_user_id,
      alias: 'affiliate_referrals',
    }),
  },
  sessions: {
    users: r.one.users({ from: r.sessions.user_id, to: r.users.id }),
  },
  accounts: {
    users: r.one.users({ from: r.accounts.user_id, to: r.users.id }),
  },
  wallets: {
    users: r.one.users({ from: r.wallets.user_id, to: r.users.id }),
  },
  two_factors: {
    users: r.one.users({ from: r.two_factors.user_id, to: r.users.id }),
  },
  affiliate_referrals: {
    user: r.one.users({
      from: r.affiliate_referrals.user_id,
      to: r.users.id,
      alias: 'user_referrals',
    }),
    affiliateUser: r.one.users({
      from: r.affiliate_referrals.affiliate_user_id,
      to: r.users.id,
      alias: 'affiliate_referrals',
    }),
  },
  bookmarks: {
    event: r.one.events({ from: r.bookmarks.event_id, to: r.events.id }),
    user: r.one.users({ from: r.bookmarks.user_id, to: r.users.id }),
  },
  conditions: {
    markets: r.many.markets({ from: r.conditions.id, to: r.markets.condition_id }),
    outcomes: r.many.outcomes({ from: r.conditions.id, to: r.outcomes.condition_id }),
  },
  events: {
    markets: r.many.markets({ from: r.events.id, to: r.markets.event_id }),
    eventTags: r.many.event_tags({ from: r.events.id, to: r.event_tags.event_id }),
    translations: r.many.event_translations({ from: r.events.id, to: r.event_translations.event_id }),
    homeFeaturedEntries: r.many.home_featured_events({
      from: r.events.id,
      to: r.home_featured_events.event_id,
    }),
    homeFeaturedContextItems: r.many.home_featured_event_context_items({
      from: r.events.id,
      to: r.home_featured_event_context_items.event_id,
    }),
    sports: r.one.event_sports({ from: r.events.id, to: r.event_sports.event_id }),
    bookmarks: r.many.bookmarks({ from: r.events.id, to: r.bookmarks.event_id }),
  },
  markets: {
    event: r.one.events({ from: r.markets.event_id, to: r.events.id }),
    contextCacheEntries: r.many.market_context_cache({
      from: r.markets.condition_id,
      to: r.market_context_cache.condition_id,
    }),
    sports: r.one.market_sports({ from: r.markets.condition_id, to: r.market_sports.condition_id }),
    condition: r.one.conditions({ from: r.markets.condition_id, to: r.conditions.id }),
    outcomes: r.many.outcomes({ from: r.markets.condition_id, to: r.outcomes.condition_id }),
  },
  market_context_cache: {
    market: r.one.markets({ from: r.market_context_cache.condition_id, to: r.markets.condition_id }),
  },
  home_featured_events: {
    event: r.one.events({ from: r.home_featured_events.event_id, to: r.events.id }),
    contextItems: r.many.home_featured_event_context_items({
      from: r.home_featured_events.id,
      to: r.home_featured_event_context_items.featured_event_id,
    }),
  },
  home_featured_event_context_items: {
    featuredEvent: r.one.home_featured_events({
      from: r.home_featured_event_context_items.featured_event_id,
      to: r.home_featured_events.id,
    }),
    event: r.one.events({ from: r.home_featured_event_context_items.event_id, to: r.events.id }),
  },
  event_sports: {
    event: r.one.events({ from: r.event_sports.event_id, to: r.events.id }),
  },
  market_sports: {
    market: r.one.markets({ from: r.market_sports.condition_id, to: r.markets.condition_id }),
    event: r.one.events({ from: r.market_sports.event_id, to: r.events.id }),
  },
  outcomes: {
    condition: r.one.conditions({ from: r.outcomes.condition_id, to: r.conditions.id }),
  },
  tags: {
    eventTags: r.many.event_tags({ from: r.tags.id, to: r.event_tags.tag_id }),
    translations: r.many.tag_translations({ from: r.tags.id, to: r.tag_translations.tag_id }),
  },
  event_tags: {
    event: r.one.events({ from: r.event_tags.event_id, to: r.events.id }),
    tag: r.one.tags({ from: r.event_tags.tag_id, to: r.tags.id }),
  },
  tag_translations: {
    tag: r.one.tags({ from: r.tag_translations.tag_id, to: r.tags.id }),
  },
  event_translations: {
    event: r.one.events({ from: r.event_translations.event_id, to: r.events.id }),
  },
  notifications: {
    user: r.one.users({ from: r.notifications.user_id, to: r.users.id }),
  },
  orders: {
    user: r.one.users({ from: r.orders.user_id, to: r.users.id }),
    outcome: r.one.outcomes({ from: r.orders.token_id, to: r.outcomes.token_id }),
    condition: r.one.conditions({ from: r.orders.condition_id, to: r.conditions.id }),
  },
}))
