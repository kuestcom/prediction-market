export const cacheTags = {
  notifications: (key: string) => `notifications:${key}`,
  activity: (key: string) => `activity:${key}`,
  holders: (key: string) => `holders:${key}`,
  events: (key: string) => `events:${key}`,
  eventsGlobal: 'events:all',
  event: (key: string) => `event:${key}`,
  adminCategories: 'admin:categories',
  mainTags: (locale: string) => `main-tags:${locale}`,
  settings: 'settings',
}
