'use client'

import Script from 'next/script'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'

export default function GoogleAnalytics() {
  const site = useSiteIdentity()
  const gaId = site.googleAnalyticsId

  if (!gaId) {
    return <></>
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}', {
            page_title: document.title,
            page_location: window.location.href,
          });
        `}
      </Script>
    </>
  )
}
