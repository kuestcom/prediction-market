import type { NextRequest } from 'next/server'
import type { SupportedLocale } from '@/i18n/locales'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import { EventRepository } from '@/lib/db/queries/event'
import { EMBED_SCRIPT_URL } from '@/lib/embed-widget'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

function escapeAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, '')
}

function requireValue(value: string | undefined, name: string) {
  if (!value || !value.trim()) {
    throw new Error(`${name} is required for embeds.`)
  }
  return value
}

function slugifySiteName(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) {
    throw new Error('Site name must include at least one letter or number.')
  }
  return slug
}

async function resolveInitialCategoryMarketSlug(categorySlug: string, locale: SupportedLocale) {
  if (!categorySlug) {
    return ''
  }

  try {
    const { data: events, error } = await EventRepository.listEvents({
      tag: categorySlug,
      search: '',
      userId: '',
      bookmarked: false,
      frequency: 'all',
      status: 'active',
      offset: 0,
      locale,
    })

    if (error || !events?.length) {
      return ''
    }

    for (const event of events) {
      const market = event.markets.find(item => Boolean(item.slug))
      if (market?.slug) {
        return market.slug
      }
    }
  }
  catch (error) {
    console.error('Failed to resolve initial category market slug', error)
  }

  return ''
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const marketSlug = searchParams.get('market') ?? ''
  const eventSlug = searchParams.get('event') ?? ''
  const categorySlug = searchParams.get('category')?.trim() ?? searchParams.get('tag')?.trim() ?? ''
  const embedLocale = searchParams.get('locale')?.trim() ?? ''
  const resolvedLocale = SUPPORTED_LOCALES.includes(embedLocale as SupportedLocale)
    ? embedLocale as SupportedLocale
    : DEFAULT_LOCALE
  const rotateCategory = searchParams.get('rotate') !== 'false'
  const shouldRotateCategory = Boolean(categorySlug) && rotateCategory
  const affiliateCode = searchParams.get('r')?.trim() ?? ''
  const theme = searchParams.get('theme') === 'dark' ? 'dark' : 'light'
  const features = new Set(
    (searchParams.get('features') ?? '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
  )

  const showVolume = features.has('volume')
  const showChart = features.has('chart')
  const showFilters = showChart && features.has('filters')
  const navArrowColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(17, 24, 39, 0.9)'

  const siteUrl = normalizeBaseUrl(requireValue(process.env.SITE_URL, 'SITE_URL'))
  const scriptUrl = EMBED_SCRIPT_URL
  const runtimeTheme = await loadRuntimeThemeState()
  const siteName = requireValue(runtimeTheme.site.name, 'theme.site_name')
  const elementName = `${slugifySiteName(siteName)}-market-embed`
  const siteLogoUrl = runtimeTheme.site.logoUrl
  const initialCategoryMarketSlug = categorySlug
    ? await resolveInitialCategoryMarketSlug(categorySlug, resolvedLocale)
    : ''
  const resolvedMarketSlug = marketSlug || initialCategoryMarketSlug

  const attrs: string[] = [`theme="${theme}"`]
  if (resolvedMarketSlug) {
    attrs.push(`market="${escapeAttr(resolvedMarketSlug)}"`)
  }
  else if (eventSlug) {
    attrs.push(`event="${escapeAttr(eventSlug)}"`)
  }
  if (showVolume) {
    attrs.push('volume="true"')
  }
  if (showChart) {
    attrs.push('chart="true"')
  }
  if (showFilters) {
    attrs.push('filters="true"')
  }
  if (affiliateCode) {
    attrs.push(`affiliate="${escapeAttr(affiliateCode)}"`)
  }

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; background: transparent; }
      body { display: flex; justify-content: center; align-items: center; min-height: 100vh; overflow: hidden; }
      #widget-shell {
        position: relative;
        display: flex;
        width: 100%;
        justify-content: center;
        align-items: center;
      }
      .widget-nav {
        display: none;
        position: absolute;
        top: 50%;
        z-index: 2;
        border: 0;
        padding: 0;
        background: transparent;
        color: ${navArrowColor};
        font-size: 28px;
        line-height: 1;
        appearance: none;
        -webkit-appearance: none;
        transform: translateY(-50%);
        cursor: pointer;
      }
      .widget-nav--left { left: 8px; }
      .widget-nav--right { right: 8px; }
    </style>
    <script>
      window.__KUEST_SITE_URL = ${JSON.stringify(siteUrl)};
      window.__KUEST_SITE_NAME = ${JSON.stringify(siteName)};
      window.__KUEST_SITE_LOGO_URL = ${JSON.stringify(siteLogoUrl)};
    </script>
    <script
      type="module"
      src="${scriptUrl}"
    ></script>
  </head>
  <body>
    <div id="widget-shell">
      <button id="widget-prev" type="button" class="widget-nav widget-nav--left" aria-label="Previous market">&#8249;</button>
      <${elementName} ${attrs.join(' ')}></${elementName}>
      <button id="widget-next" type="button" class="widget-nav widget-nav--right" aria-label="Next market">&#8250;</button>
    </div>
    <script>
      (function setupCategoryRotation() {
        const shouldRotate = ${JSON.stringify(shouldRotateCategory)};
        const category = ${JSON.stringify(categorySlug)};
        const locale = ${JSON.stringify(resolvedLocale)};
        if (!shouldRotate || !category) {
          return
        }

        const shell = document.getElementById('widget-shell');
        let widget = document.querySelector(${JSON.stringify(elementName)});
        const prevButton = document.getElementById('widget-prev');
        const nextButton = document.getElementById('widget-next');
        if (!widget || !shell) {
          return
        }

        const initialTheme = widget.getAttribute('theme') ?? 'light';
        const initialEvent = widget.getAttribute('event') ?? '';
        const initialVolume = widget.getAttribute('volume') ?? '';
        const initialChart = widget.getAttribute('chart') ?? '';
        const initialFilters = widget.getAttribute('filters') ?? '';
        const initialAffiliate = widget.getAttribute('affiliate') ?? '';

        let markets = [];
        let currentIndex = -1;

        function mountWidget(marketSlug) {
          const nextWidget = document.createElement(${JSON.stringify(elementName)});
          nextWidget.setAttribute('theme', initialTheme);
          if (marketSlug) {
            nextWidget.setAttribute('market', marketSlug);
          }
          else if (initialEvent) {
            nextWidget.setAttribute('event', initialEvent);
          }
          if (initialVolume === 'true') {
            nextWidget.setAttribute('volume', 'true');
          }
          if (initialChart === 'true') {
            nextWidget.setAttribute('chart', 'true');
          }
          if (initialFilters === 'true') {
            nextWidget.setAttribute('filters', 'true');
          }
          if (initialAffiliate) {
            nextWidget.setAttribute('affiliate', initialAffiliate);
          }

          if (widget?.parentNode === shell) {
            shell.replaceChild(nextWidget, widget);
          }
          else if (nextButton?.parentNode === shell) {
            shell.insertBefore(nextWidget, nextButton);
          }
          else {
            shell.appendChild(nextWidget);
          }

          widget = nextWidget;
        }

        function setButtonsVisibility(visible) {
          if (!prevButton || !nextButton) {
            return
          }
          const display = visible ? 'inline-flex' : 'none';
          prevButton.style.display = display;
          nextButton.style.display = display;
        }

        function setMarketByIndex(index) {
          if (!markets.length) {
            return
          }
          currentIndex = (index + markets.length) % markets.length;
          mountWidget(markets[currentIndex]);
        }

        function rotate(step) {
          if (markets.length < 2) {
            return
          }
          setMarketByIndex(currentIndex + step);
        }

        prevButton?.addEventListener('click', function onPrevClick() {
          rotate(-1);
        });
        nextButton?.addEventListener('click', function onNextClick() {
          rotate(1);
        });

        async function loadCategoryMarkets() {
          const params = new URLSearchParams({
            tag: category,
            status: 'active',
            offset: '0',
            locale,
          });

          const response = await fetch('/api/events?' + params.toString(), {
            method: 'GET',
            cache: 'no-store',
          });
          if (!response.ok) {
            return;
          }

          const payload = await response.json();
          const events = Array.isArray(payload) ? payload : [];
          const slugs = [];
          for (const event of events) {
            const eventMarkets = Array.isArray(event?.markets) ? event.markets : [];
            for (const market of eventMarkets) {
              if (typeof market?.slug === 'string' && market.slug.trim()) {
                slugs.push(market.slug.trim());
              }
            }
          }

          markets = Array.from(new Set(slugs)).slice(0, 80);
          const currentMarket = widget?.getAttribute('market') ?? '';
          const initialIndex = markets.indexOf(currentMarket);
          setButtonsVisibility(markets.length > 1);
          if (markets.length > 0) {
            setMarketByIndex(initialIndex >= 0 ? initialIndex : 0);
          }
        }

        void loadCategoryMarkets().catch(function onLoadError(error) {
          console.error('Failed to load category markets for embed rotation', error);
          setButtonsVisibility(false);
        });
      })();
    </script>
  </body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
