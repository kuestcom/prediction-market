interface ResolveLiveSeriesPillLabelOptions {
  dateLabel: string
  isDailySeries: boolean
  isToday: boolean
  timeLabel: string
}

export function resolveLiveSeriesPillLabel({
  dateLabel,
  isDailySeries,
  isToday,
  timeLabel,
}: ResolveLiveSeriesPillLabelOptions) {
  if (isDailySeries) {
    return dateLabel
  }

  return isToday ? timeLabel : `${timeLabel} ${dateLabel}`
}
