import type { ActivityOrder } from '@/types'

export function filterActivitiesByMinAmount(activities: ActivityOrder[], minAmount?: number): ActivityOrder[] {
  if (!minAmount || minAmount <= 0) {
    return activities
  }

  return activities.filter((activity) => {
    if (activity.total_value == null) {
      return false
    }

    return Number(activity.total_value) >= minAmount
  })
}
