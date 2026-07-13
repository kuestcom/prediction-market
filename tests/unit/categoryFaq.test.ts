import type { CategoryFaqMessageKey } from '@/lib/category-faq'
import { describe, expect, it } from 'vitest'
import { buildCategoryFaqItems } from '@/lib/category-faq'

const messages: Record<CategoryFaqMessageKey, string> = {
  whatIsSiteQuestion: 'What is {siteName}?',
  whatIsSiteAnswer: '{siteName} covers {categoryName}.',
  whatIsCategoryQuestion: 'What is {categoryName}?',
  whatIsCategoryAnswer: '{categoryName} category answer.',
  topicsQuestion: 'Topics in {categoryName}?',
  topicsAnswer: '{eventCount} events, {marketCount} markets: {subcategories}.',
  oddsQuestion: 'Odds for {categoryName} on {siteName}?',
  oddsAnswer: 'Odds answer.',
  activeQuestion: 'Active {categoryName} markets?',
  activeAnswer: '{popularEvents}.',
  resolutionQuestion: 'Resolution?',
  resolutionAnswer: 'Resolution answer.',
  changesQuestion: 'Changes?',
  changesAnswer: 'Changes answer.',
  countQuestion: 'Count?',
  countAnswer: '{eventCount} and {marketCount}.',
  futureQuestion: 'Future?',
  futureAnswer: 'Future answer.',
  accuracyQuestion: 'Accuracy?',
  accuracyAnswer: 'Accuracy answer.',
  startQuestion: 'Start?',
  startAnswer: 'Start answer.',
  movesQuestion: 'Moves?',
  movesAnswer: 'Moves answer.',
  liveQuestion: 'Live?',
  liveAnswer: 'Live answer.',
}

function translate(key: CategoryFaqMessageKey, values: Record<string, number | string>) {
  return messages[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]))
}

describe('buildCategoryFaqItems', () => {
  it('builds 13 category-aware FAQ items in the expected order', () => {
    const items = buildCategoryFaqItems({
      categoryName: 'Politics',
      eventCount: 128,
      marketCount: 2048,
      popularEventTitles: ['Election winner', 'Approval rating'],
      siteName: 'Kuest',
      subcategoryNames: ['Elections', 'Economy', 'Geopolitics'],
      translate,
    })

    expect(items).toHaveLength(13)
    expect(items[0]).toEqual({
      id: 'category-faq-what-is-site',
      question: 'What is Kuest?',
      answer: 'Kuest covers Politics.',
    })
    expect(items[2].answer).toBe('128 events, 2,048 markets: Elections, Economy, Geopolitics.')
    expect(items[4].answer).toBe('“Election winner”, “Approval rating”.')
  })

  it('ignores blank popular-event titles before quoting them', () => {
    const items = buildCategoryFaqItems({
      categoryName: 'Politics',
      eventCount: 1,
      marketCount: 1,
      popularEventTitles: ['', '   '],
      siteName: 'Kuest',
      subcategoryNames: [],
      translate,
    })

    expect(items[4].answer).toBe('Politics.')
  })
})
