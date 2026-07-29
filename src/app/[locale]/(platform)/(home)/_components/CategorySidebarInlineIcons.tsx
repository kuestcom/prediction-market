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

function PrivatesIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <line x1="5.75" y1="16.25" x2="6.75" y2="13.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <line x1="12.25" y1="16.25" x2="11.25" y2="13.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <rect x="1.75" y="2.75" width="14.5" height="10.5" rx="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <line x1="9" y1="2.75" x2="9" y2="1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M12.75,6.75l-2.146,2.146c-.195,.195-.512,.195-.707,0l-1.793-1.793c-.195-.195-.512-.195-.707,0l-2.146,2.146" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

function AcquisitionsIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <line x1="12.345" y1="11.75" x2="15.25" y2="11.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M8.779,4.67l-.231-.313c-.283-.382-.73-.608-1.206-.608h-1.458c-.388,0-.761,.151-1.041,.42l-1.867,1.8c-.07,.067-.148,.123-.232,.167" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M2.75,11.75h1.26c.303,0,.59,.138,.78,.374l1.083,1.349c.596,.742,1.632,.962,2.478,.525l3.274-1.693c1.111-.574,1.428-2.016,.661-3.003l-1.648-2.122" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M15.258,6.138c-.085-.044-.163-.1-.233-.168l-1.867-1.8c-.28-.269-.653-.42-1.041-.42h-1.807c-.404,0-.791,.163-1.074,.453l-2.495,2.558c-.498,.51-.493,1.326,.011,1.83h0c.447,.447,1.15,.508,1.668,.145l2.83-1.985" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M.75,5.25H1.75c.552,0,1,.448,1,1v6c0,.552-.448,1-1,1H.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M17.25,5.25h-1c-.552,0-1,.448-1,1v6c0,.552,.448,1,1,1h1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

function EarningsCalendarIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <line x1="5.75" y1="3.25" x2="5.75" y2="1.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <line x1="12.25" y1="3.25" x2="12.25" y2="1.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <rect x="2.25" y="3.25" width="13.5" height="12.5" rx="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <line x1="2.25" y1="6.75" x2="15.75" y2="6.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <circle cx="11.25" cy="11.25" r="1" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

function IpoIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M11.75 7.5C12.44 7.5 13 6.9404 13 6.25C13 5.5596 12.44 5 11.75 5C11.06 5 10.5 5.5596 10.5 6.25C10.5 6.9404 11.06 7.5 11.75 7.5Z" fill="currentColor" />
      <path d="M2.85699 12.4692C2.20309 12.7981 1.75 13.468 1.75 14.25V16.25H3.75C4.5317 16.25 5.2016 15.7971 5.5305 15.1433" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M13.1707 10.0588C16.6759 6.381 16.2472 2.0942 16.2108 1.7892C15.9049 1.7528 11.619 1.3241 7.94118 4.8293C5.71338 6.9526 4.96349 9.3233 4.74579 10.1164L7.88368 13.2543C8.67678 13.0366 11.0474 12.2865 13.1707 10.0588Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M8.26601 4.5279L6.892 4.2819C5.637 4.0569 4.737 3.959 4 5L1.75 8.2699C1.75 8.2699 3.3528 7.6568 5.5921 7.9669" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M10.033 12.4078C10.3431 14.647 9.72998 16.2499 9.72998 16.2499L13 14C14.041 13.263 13.943 12.3629 13.718 11.1079L13.472 9.7339" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

function FedRatesIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="2.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <circle cx="13" cy="13" r="2.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <line x1="4.75" y1="15.25" x2="13.25" y2="2.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

function PredictionMarketsIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M13.061 13.25L13.98 15.566C14.11 15.894 13.868 16.25 13.515 16.25H4.487C4.134 16.25 3.892 15.894 4.022 15.566L4.94 13.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M11.745 8.49101L10.799 8.17601L10.483 7.22901C10.381 6.92301 9.87399 6.92301 9.77199 7.22901L9.45599 8.17601L8.50999 8.49101C8.35699 8.54201 8.25299 8.68501 8.25299 8.84701C8.25299 9.00901 8.35699 9.15201 8.50999 9.20301L9.45599 9.51801L9.77199 10.465C9.82299 10.618 9.96599 10.721 10.127 10.721C10.288 10.721 10.432 10.617 10.482 10.465L10.798 9.51801L11.744 9.20301C11.897 9.15201 12.001 9.00901 12.001 8.84701C12.001 8.68501 11.898 8.54201 11.745 8.49101Z" fill="currentColor" />
      <path d="M2.75101 2.5C3.16521 2.5 3.50101 2.1642 3.50101 1.75C3.50101 1.3358 3.16521 1 2.75101 1C2.33681 1 2.00101 1.3358 2.00101 1.75C2.00101 2.1642 2.33681 2.5 2.75101 2.5Z" fill="currentColor" />
      <path d="M16.66 2.99L15.397 2.569L14.976 1.306C14.839 0.898 14.164 0.898 14.027 1.306L13.606 2.569L12.343 2.99C12.139 3.058 12.001 3.249 12.001 3.464C12.001 3.679 12.139 3.87 12.343 3.938L13.606 4.359L14.027 5.622C14.095 5.826 14.287 5.964 14.502 5.964C14.717 5.964 14.908 5.826 14.977 5.622L15.398 4.359L16.661 3.938C16.865 3.87 17.003 3.679 17.003 3.464C17.003 3.249 16.864 3.058 16.66 2.99Z" fill="currentColor" />
      <path d="M9.99371 2.3339C9.67051 2.28 9.33961 2.25 9.00101 2.25C5.54901 2.25 2.75101 5.048 2.75101 8.5C2.75101 10.401 3.60001 12.104 4.93901 13.25H13.062C14.402 12.104 15.251 10.401 15.251 8.5C15.251 8.3701 15.2457 8.2416 15.2364 8.1143" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M5.75 8.5C5.75 6.708 7.208 5.25 9 5.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

function TreasuriesIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M13.25 2.75H4.75C3.645 2.75 2.75 3.645 2.75 4.75V13.25C2.75 14.355 3.645 15.25 4.75 15.25H13.25C14.355 15.25 15.25 14.355 15.25 13.25V4.75C15.25 3.645 14.355 2.75 13.25 2.75Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M4.75 15.25V16.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M13.25 15.25V16.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M9 11C10.105 11 11 10.105 11 9C11 7.895 10.105 7 9 7C7.895 7 7 7.895 7 9C7 10.105 7.895 11 9 11Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M10.414 7.586L11.75 6.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M10.414 10.414L11.75 11.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M7.586 10.414L6.25 11.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M7.586 7.586L6.25 6.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

function KpisIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="13.25" y="2.75" width="2.5" height="12.5" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <rect x="7.75" y="7.75" width="2.5" height="7.5" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <rect x="2.25" y="11.75" width="2.5" height="3.5" rx="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <polyline points="6.25 2.75 8.75 2.75 8.75 5.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <line x1="8.5" y1="3" x2="2.75" y2="8.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
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
  'privates': PrivatesIcon,
  'acquisitions': AcquisitionsIcon,
  'earnings-calendar': EarningsCalendarIcon,
  'ipo': IpoIcon,
  'fed-rates': FedRatesIcon,
  'prediction-markets': PredictionMarketsIcon,
  'treasuries': TreasuriesIcon,
  'kpis': KpisIcon,
}
