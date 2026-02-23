import { relations } from 'drizzle-orm'
import {
  conditions,
  event_sports,
  event_tags,
  event_translations,
  events,
  market_sports,
  markets,
  outcomes,
  tag_translations,
  tags,
} from './tables'

export const conditionsRelations = relations(conditions, ({ many }) => ({
  markets: many(markets),
  outcomes: many(outcomes),
}))

export const eventsRelations = relations(events, ({ many, one }) => ({
  markets: many(markets),
  eventTags: many(event_tags),
  translations: many(event_translations),
  sports: one(event_sports, {
    fields: [events.id],
    references: [event_sports.event_id],
  }),
}))

export const marketsRelations = relations(markets, ({ one, many }) => ({
  event: one(events, {
    fields: [markets.event_id],
    references: [events.id],
  }),
  sports: one(market_sports, {
    fields: [markets.condition_id],
    references: [market_sports.condition_id],
  }),
  condition: one(conditions, {
    fields: [markets.condition_id],
    references: [conditions.id],
  }),
  outcomes: many(outcomes),
}))

export const eventSportsRelations = relations(event_sports, ({ one }) => ({
  event: one(events, {
    fields: [event_sports.event_id],
    references: [events.id],
  }),
}))

export const marketSportsRelations = relations(market_sports, ({ one }) => ({
  market: one(markets, {
    fields: [market_sports.condition_id],
    references: [markets.condition_id],
  }),
  event: one(events, {
    fields: [market_sports.event_id],
    references: [events.id],
  }),
}))

export const outcomesRelations = relations(outcomes, ({ one }) => ({
  condition: one(conditions, {
    fields: [outcomes.condition_id],
    references: [conditions.id],
  }),
}))

export const tagsRelations = relations(tags, ({ many, one }) => ({
  eventTags: many(event_tags),
  translations: many(tag_translations),
  parentTag: one(tags, {
    fields: [tags.parent_tag_id],
    references: [tags.id],
    relationName: 'parent_child',
  }),
  childTags: many(tags, {
    relationName: 'parent_child',
  }),
}))

export const eventTagsRelations = relations(event_tags, ({ one }) => ({
  event: one(events, {
    fields: [event_tags.event_id],
    references: [events.id],
  }),
  tag: one(tags, {
    fields: [event_tags.tag_id],
    references: [tags.id],
  }),
}))

export const tagTranslationsRelations = relations(tag_translations, ({ one }) => ({
  tag: one(tags, {
    fields: [tag_translations.tag_id],
    references: [tags.id],
  }),
}))

export const eventTranslationsRelations = relations(event_translations, ({ one }) => ({
  event: one(events, {
    fields: [event_translations.event_id],
    references: [events.id],
  }),
}))
