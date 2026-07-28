import type { ReactNode } from 'react'
import type { PlatformCategorySidebarIconKey } from '@/lib/platform-navigation'

function AllGridIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.75" y="2.75" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <rect x="10.75" y="2.75" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <rect x="2.75" y="10.75" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <rect x="10.75" y="10.75" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

function FiveMinuteIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        <line x1="2.75" y1="9" x2="10.25" y2="9" />
        <line x1="5.75" y1="13.75" x2="13.25" y2="13.75" />
        <line x1="7.75" y1="4.25" x2="15.25" y2="4.25" />
      </g>
    </svg>
  )
}

function FifteenMinuteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 12C22 6.47715 17.5228 2 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
      <circle cx="12" cy="22" r="1" fill="currentColor" />
      <circle cx="2" cy="12" r="1" fill="currentColor" />
      <circle cx="7" cy="20.6603" r="1" fill="currentColor" />
      <circle cx="20.6603" cy="17" r="1" fill="currentColor" />
      <circle cx="3.33975" cy="7" r="1" fill="currentColor" />
      <circle cx="3.33975" cy="17" r="1" fill="currentColor" />
      <circle cx="17" cy="20.6603" r="1" fill="currentColor" />
      <circle cx="7" cy="3.33975" r="1" fill="currentColor" />
      <path d="M12 12H17" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  )
}

function HourlyIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 4.75V9L12.25 11.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.2472 9.2027C16.1398 13.113 12.9362 16.25 9 16.25C4.996 16.25 1.75 13.004 1.75 9C1.75 4.996 4.996 1.75 9 1.75C12.0095 1.75 14.5902 3.58371 15.6867 6.19391" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.12 3.30499L15.712 6.25L12.768 5.84302" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FourHourIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="7.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <polyline points="9 4.75 9 9 12.25 11.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <line x1="5.75" y1="3.25" x2="5.75" y2="1.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <line x1="12.25" y1="3.25" x2="12.25" y2="1.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <rect x="2.25" y="3.25" width="13.5" height="12.5" rx="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <line x1="2.25" y1="6.75" x2="15.75" y2="6.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M9 8.75a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" fill="currentColor" />
      <path d="M12.5 8.75a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" fill="currentColor" />
      <path d="M9 11.75a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" fill="currentColor" />
      <path d="M5.5 11.75a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" fill="currentColor" />
      <path d="M12.5 11.75a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" fill="currentColor" />
    </svg>
  )
}

function WeeklyIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="7.75" y="2.75" width="2.5" height="12.5" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <rect x="2.25" y="7.75" width="2.5" height="7.5" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <rect x="13.25" y="11.75" width="2.5" height="3.5" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

function MonthlyIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <polyline points="2 14 5 10.75 6 13.25 10 6.75 12 12.25 16 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

function TargetsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path fill="currentColor" d="M10 5.375c.483 0 .875.392.875.875v1.125H11c.76 0 1.375.616 1.375 1.375v4c0 .76-.616 1.375-1.375 1.375h-.125V17.5a.875.875 0 0 1-1.75 0v-3.375H9c-.76 0-1.375-.616-1.375-1.375v-4c0-.76.616-1.375 1.375-1.375h.125V6.25c0-.483.392-.875.875-.875M15.758 1c.483 0 .875.392.875.875v1h.117c.76 0 1.375.616 1.375 1.375v7.5c0 .76-.616 1.375-1.375 1.375h-.125v2.125a.875.875 0 0 1-1.75 0v-2.125h-.125c-.76 0-1.375-.616-1.375-1.375v-7.5c0-.76.616-1.375 1.375-1.375h.133v-1c0-.483.392-.875.875-.875M4.25 1.875c.483 0 .875.392.875.875v3.125h.125c.76 0 1.375.616 1.375 1.375v3.5c0 .76-.616 1.375-1.375 1.375h-.125v2.125a.875.875 0 0 1-1.75 0v-2.125H3.25c-.76 0-1.375-.616-1.375-1.375v-3.5c0-.76.616-1.375 1.375-1.375h.125V2.75c0-.483.392-.875.875-.875m5.125 10.5h1.25v-3.25h-1.25zm5.75-1h1.25v-6.75h-1.25zm-11.5-1h1.25v-2.75h-1.25z" />
    </svg>
  )
}

function PreMarketIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d="M9.722 2.32c.649-.866 2.025-.36 1.962.718l-.257 4.337h4.323c.927 0 1.456 1.058.9 1.8l-6.372 8.505c-.65.866-2.026.36-1.962-.718l.256-4.337H4.25a1.125 1.125 0 0 1-.9-1.8zm-4.223 8.555h4.002a.876.876 0 0 1 .873.927l-.182 3.073 4.31-5.75h-4.003a.876.876 0 0 1-.874-.927l.182-3.074z" clipRule="evenodd" />
    </svg>
  )
}

function InstitutionsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path fill="currentColor" d="M15.25 9.875c.483 0 .875.392.875.875v4.625h.125a.875.875 0 0 1 0 1.75H3.75a.875.875 0 0 1 0-1.75h.125V10.75a.875.875 0 0 1 1.75 0v4.625h1.75V10.75a.875.875 0 0 1 1.75 0v4.625h1.75V10.75a.875.875 0 0 1 1.75 0v4.625h1.75V10.75c0-.483.392-.875.875-.875m-6.058-7.67a1.87 1.87 0 0 1 1.724.055h.001l5.25 2.94h.001c.59.332.957.958.957 1.636v.414c0 1.035-.84 1.875-1.875 1.875H10l-5.25.001a1.876 1.876 0 0 1-1.875-1.875v-.414c0-.677.365-1.304.958-1.636l5.251-2.94zm.87 1.582a.13.13 0 0 0-.122 0L4.687 6.728a.13.13 0 0 0-.063.11v.413c0 .069.056.125.125.125h10.5a.126.126 0 0 0 .125-.126v-.414a.13.13 0 0 0-.063-.109zM10 4.75a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
    </svg>
  )
}

function IndustryIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path fill="currentColor" d="M10 1.875a8.126 8.126 0 0 1 0 16.25A8.127 8.127 0 0 1 2.266 7.508 8.126 8.126 0 0 1 10 1.875m-1.693 11.75c.11.428.237.82.38 1.167.246.593.516 1.016.771 1.276.252.258.435.307.542.307s.29-.049.542-.307c.255-.26.525-.683.77-1.276.144-.347.27-.74.381-1.167zm-3.55 0a6.4 6.4 0 0 0 2.425 2.093 8 8 0 0 1-.112-.257 11 11 0 0 1-.566-1.836zm8.74 0c-.15.67-.34 1.289-.567 1.836a8 8 0 0 1-.113.257 6.4 6.4 0 0 0 2.426-2.093zm.326-5a18 18 0 0 1-.044 3.25h2.316a6.4 6.4 0 0 0 .13-3.25zm-10.048 0a6.4 6.4 0 0 0 .13 3.25h2.316a18 18 0 0 1-.044-3.25zm4.158 0a16.5 16.5 0 0 0 .051 3.25h4.032a16 16 0 0 0 .051-3.25zm4.997-4.086c.281.681.507 1.472.668 2.336h1.958a6.4 6.4 0 0 0-2.739-2.594q.059.127.113.258m-5.748-.258a6.4 6.4 0 0 0-2.738 2.594h1.958c.16-.864.386-1.655.668-2.336q.054-.13.112-.258M10 3.625c-.107 0-.29.049-.542.307-.255.26-.525.683-.77 1.276a9.7 9.7 0 0 0-.5 1.667h3.624a9.6 9.6 0 0 0-.5-1.667c-.245-.593-.515-1.016-.77-1.276-.252-.258-.435-.307-.542-.307" />
    </svg>
  )
}

function ProtocolMetricsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path fill="currentColor" d="M7.114 8.572a.875.875 0 0 1 1.198.313l1.193 2.038q.24-.046.495-.048a2.626 2.626 0 1 1-2.005.932L6.802 9.77a.876.876 0 0 1 .312-1.198M10 12.625a.9.9 0 0 0-.419.105l-.022.016-.01.004a.875.875 0 1 0 .451-.125m0-7.75A8.125 8.125 0 0 1 18.125 13c0 .074-.005.141-.008.185l-.006.096a.875.875 0 0 1-.874.844H14.75a.875.875 0 0 1 0-1.75h1.594a6.375 6.375 0 0 0-12.688 0H5.25a.875.875 0 0 1 0 1.75H2.763a.875.875 0 0 1-.874-.844l-.006-.096c-.003-.044-.008-.11-.008-.185A8.125 8.125 0 0 1 10 4.875" />
    </svg>
  )
}

export const categorySidebarInlineIcons: Partial<
  Record<PlatformCategorySidebarIconKey, () => ReactNode>
> = {
  'all-grid': AllGridIcon,
  'five-minute': FiveMinuteIcon,
  'fifteen-minute': FifteenMinuteIcon,
  'hourly': HourlyIcon,
  'four-hour': FourHourIcon,
  'daily': CalendarIcon,
  'weekly': WeeklyIcon,
  'monthly': MonthlyIcon,
  'yearly': CalendarIcon,
  'targets': TargetsIcon,
  'pre-market': PreMarketIcon,
  'institutions': InstitutionsIcon,
  'industry': IndustryIcon,
  'protocol-metrics': ProtocolMetricsIcon,
}
