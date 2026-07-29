'use client'

import type { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'

import arLocale from '@fullcalendar/core/locales/ar'
import deLocale from '@fullcalendar/core/locales/de'
import esLocale from '@fullcalendar/core/locales/es'
import frLocale from '@fullcalendar/core/locales/fr'
import itLocale from '@fullcalendar/core/locales/it'
import jaLocale from '@fullcalendar/core/locales/ja'
import koLocale from '@fullcalendar/core/locales/ko'
import plLocale from '@fullcalendar/core/locales/pl'
import ptLocale from '@fullcalendar/core/locales/pt-br'
import ruLocale from '@fullcalendar/core/locales/ru'
import zhLocale from '@fullcalendar/core/locales/zh-cn'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { useExtracted, useLocale } from 'next-intl'

const CALENDAR_LOCALES = [
  arLocale,
  deLocale,
  esLocale,
  frLocale,
  itLocale,
  jaLocale,
  koLocale,
  plLocale,
  ptLocale,
  ruLocale,
  zhLocale,
]

interface AdminCreateEventCalendarViewProps {
  events: EventInput[]
  onDateClick: (info: DateClickArg) => void
  onSelect: (selection: DateSelectArg) => void
  onEventClick: (info: EventClickArg) => void
}

export default function AdminCreateEventCalendarView({
  events,
  onDateClick,
  onSelect,
  onEventClick,
}: AdminCreateEventCalendarViewProps) {
  const t = useExtracted()
  const locale = useLocale()

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
      locales={CALENDAR_LOCALES}
      locale={locale === 'zh' ? 'zh-cn' : locale === 'pt' ? 'pt-br' : locale}
      initialView="dayGridMonth"
      height="auto"
      selectable
      weekends
      headerToolbar={{
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,listMonth',
      }}
      buttonText={{
        today: t('Today'),
        month: t('Month'),
        week: t('Week'),
        list: t('Agenda'),
      }}
      events={events}
      dateClick={onDateClick}
      select={onSelect}
      eventClick={onEventClick}
      eventDidMount={(info) => {
        const fullLabel = info.timeText ? `${info.timeText} ${info.event.title}` : info.event.title
        info.el.setAttribute('title', fullLabel)
      }}
      dayMaxEventRows={3}
      eventTimeFormat={{
        hour: 'numeric',
        minute: '2-digit',
        meridiem: 'short',
      }}
    />
  )
}
