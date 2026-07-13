import type { EventFaqItem } from '@/lib/event-faq'
import { formatCompactCount } from '@/lib/formatters'

export interface CategoryFaqContext {
  categoryName: string
  eventCount: number
  marketCount: number
  popularEventTitles: string[]
  subcategoryNames: string[]
}

export type CategoryFaqMessageKey
  = | 'whatIsSiteQuestion'
    | 'whatIsSiteAnswer'
    | 'whatIsCategoryQuestion'
    | 'whatIsCategoryAnswer'
    | 'topicsQuestion'
    | 'topicsAnswer'
    | 'oddsQuestion'
    | 'oddsAnswer'
    | 'activeQuestion'
    | 'activeAnswer'
    | 'resolutionQuestion'
    | 'resolutionAnswer'
    | 'changesQuestion'
    | 'changesAnswer'
    | 'countQuestion'
    | 'countAnswer'
    | 'futureQuestion'
    | 'futureAnswer'
    | 'accuracyQuestion'
    | 'accuracyAnswer'
    | 'startQuestion'
    | 'startAnswer'
    | 'movesQuestion'
    | 'movesAnswer'
    | 'liveQuestion'
    | 'liveAnswer'

type CategoryFaqTranslationValues = Record<string, number | string>
type CategoryFaqTranslator = (
  key: CategoryFaqMessageKey,
  values: CategoryFaqTranslationValues,
) => string

interface BuildCategoryFaqItemsOptions extends CategoryFaqContext {
  siteName: string
  translate: CategoryFaqTranslator
}

function joinList(values: string[], fallback: string) {
  return values.filter(Boolean).slice(0, 3).join(', ') || fallback
}

export function buildCategoryFaqItems({
  categoryName,
  eventCount,
  marketCount,
  popularEventTitles,
  siteName,
  subcategoryNames,
  translate,
}: BuildCategoryFaqItemsOptions): EventFaqItem[] {
  const values = {
    categoryName,
    eventCount: formatCompactCount(Math.max(0, eventCount)),
    marketCount: formatCompactCount(Math.max(0, marketCount)),
    popularEvents: joinList(
      popularEventTitles.filter(title => title.trim().length > 0).map(title => `“${title}”`),
      categoryName,
    ),
    siteName,
    subcategories: joinList(subcategoryNames, categoryName),
  }

  const entries: Array<[string, CategoryFaqMessageKey, CategoryFaqMessageKey]> = [
    ['what-is-site', 'whatIsSiteQuestion', 'whatIsSiteAnswer'],
    ['what-is-category', 'whatIsCategoryQuestion', 'whatIsCategoryAnswer'],
    ['topics', 'topicsQuestion', 'topicsAnswer'],
    ['odds', 'oddsQuestion', 'oddsAnswer'],
    ['active', 'activeQuestion', 'activeAnswer'],
    ['resolution', 'resolutionQuestion', 'resolutionAnswer'],
    ['changes', 'changesQuestion', 'changesAnswer'],
    ['count', 'countQuestion', 'countAnswer'],
    ['future', 'futureQuestion', 'futureAnswer'],
    ['accuracy', 'accuracyQuestion', 'accuracyAnswer'],
    ['start', 'startQuestion', 'startAnswer'],
    ['moves', 'movesQuestion', 'movesAnswer'],
    ['live', 'liveQuestion', 'liveAnswer'],
  ]

  return entries.map(([id, questionKey, answerKey]) => ({
    id: `category-faq-${id}`,
    question: translate(questionKey, values),
    answer: translate(answerKey, values),
  }))
}
