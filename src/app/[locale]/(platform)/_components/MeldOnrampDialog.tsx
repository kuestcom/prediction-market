'use client'

import { useExtracted } from 'next-intl'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CountryOption {
  countryCode: string
  name: string
}

interface CurrencyOption {
  currencyCode: string
  name: string
}

interface QuoteOption {
  quoteId: string
  serviceProvider: string
  paymentMethodType: string
  sourceAmount: number
  sourceCurrencyCode: string
  destinationAmount: number
  destinationCurrencyCode: 'USDC_POLYGON'
  totalFee: number | null
  rampScore: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asCountries(value: unknown): CountryOption[] {
  if (!isRecord(value) || !Array.isArray(value.countries)) {
    return []
  }
  return value.countries.flatMap((country: unknown) =>
    isRecord(country) && typeof country.countryCode === 'string' && typeof country.name === 'string'
      ? [{ countryCode: country.countryCode, name: country.name }]
      : [],
  )
}

function asCurrencies(value: unknown): CurrencyOption[] {
  if (!isRecord(value) || !Array.isArray(value.currencies)) {
    return []
  }
  return value.currencies.flatMap((currency: unknown) =>
    isRecord(currency) && typeof currency.currencyCode === 'string' && typeof currency.name === 'string'
      ? [{ currencyCode: currency.currencyCode, name: currency.name }]
      : [],
  )
}

function asQuotes(value: unknown): QuoteOption[] {
  if (!isRecord(value) || !Array.isArray(value.quotes)) {
    return []
  }
  return value.quotes.flatMap((quote: unknown) => {
    if (
      !isRecord(quote) ||
      typeof quote.quoteId !== 'string' ||
      typeof quote.serviceProvider !== 'string' ||
      typeof quote.paymentMethodType !== 'string' ||
      typeof quote.sourceAmount !== 'number' ||
      typeof quote.sourceCurrencyCode !== 'string' ||
      typeof quote.destinationAmount !== 'number' ||
      quote.destinationCurrencyCode !== 'USDC_POLYGON'
    ) {
      return []
    }
    return [
      {
        quoteId: quote.quoteId,
        serviceProvider: quote.serviceProvider,
        paymentMethodType: quote.paymentMethodType,
        sourceAmount: quote.sourceAmount,
        sourceCurrencyCode: quote.sourceCurrencyCode,
        destinationAmount: quote.destinationAmount,
        destinationCurrencyCode: 'USDC_POLYGON',
        totalFee: typeof quote.totalFee === 'number' ? quote.totalFee : null,
        rampScore: typeof quote.rampScore === 'number' ? quote.rampScore : null,
      },
    ]
  })
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

function providerLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function MeldOnrampDialog({
  open,
  onOpenChange,
  onCheckoutCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCheckoutCreated: () => void
}) {
  const t = useExtracted()
  const [countries, setCountries] = useState<CountryOption[]>([])
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([])
  const [quotes, setQuotes] = useState<QuoteOption[]>([])
  const [countryCode, setCountryCode] = useState('')
  const [sourceCurrencyCode, setSourceCurrencyCode] = useState('')
  const [sourceAmount, setSourceAmount] = useState('')
  const [selectedQuoteId, setSelectedQuoteId] = useState('')
  const [fallbackLaunchUrl, setFallbackLaunchUrl] = useState<string | null>(null)
  const [isLoadingCountries, setIsLoadingCountries] = useState(true)
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(false)
  const [isGettingQuotes, setIsGettingQuotes] = useState(false)
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const controller = new AbortController()
    let isActive = true

    void fetch('/api/payments/meld/countries', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result: unknown = await response.json()
        if (!response.ok) {
          throw new Error('country_options_unavailable')
        }
        const options = asCountries(result)
        if (!options.length) {
          throw new Error('country_options_unavailable')
        }
        if (isActive) {
          setCountries(options)
        }
      })
      .catch(() => {
        if (isActive) {
          setErrorMessage(t('Country options are unavailable. Please try again later.'))
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingCountries(false)
        }
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [open, t])

  useEffect(() => {
    if (!countryCode) {
      return
    }
    const controller = new AbortController()
    let isActive = true

    void fetch(`/api/payments/meld/currencies?countryCode=${encodeURIComponent(countryCode)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result: unknown = await response.json()
        if (!response.ok) {
          throw new Error('currency_options_unavailable')
        }
        const options = asCurrencies(result)
        if (!options.length) {
          throw new Error('currency_options_unavailable')
        }
        if (isActive) {
          setCurrencies(options)
        }
      })
      .catch(() => {
        if (isActive) {
          setErrorMessage(t('Fiat currency options are unavailable. Please try again later.'))
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingCurrencies(false)
        }
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [countryCode, t])

  async function getQuotes() {
    const normalizedAmount = Number(sourceAmount.trim().replace(',', '.'))
    if (!countryCode || !sourceCurrencyCode || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setErrorMessage(t('Choose your country, currency, and a valid amount.'))
      return
    }

    setIsGettingQuotes(true)
    setErrorMessage(null)
    setQuotes([])
    setSelectedQuoteId('')
    try {
      const response = await fetch('/api/payments/meld/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode, sourceCurrencyCode, sourceAmount: normalizedAmount }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        if (isRecord(result) && result.error === 'no_compatible_quotes') {
          throw new Error('no_compatible_quotes')
        }
        throw new Error('quotes_unavailable')
      }
      const options = asQuotes(result)
      if (!options.length) {
        throw new Error('no_compatible_quotes')
      }
      setQuotes(options)
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message === 'no_compatible_quotes'
          ? t('No compatible payment options are available for these details. Try another amount or currency.')
          : t('Could not load payment options. Please try again.'),
      )
    } finally {
      setIsGettingQuotes(false)
    }
  }

  async function startCheckout() {
    const quote = quotes.find((item) => item.quoteId === selectedQuoteId)
    if (!quote || isStartingCheckout) {
      return
    }

    const popup = window.open('', 'meld_onramp', 'width=520,height=900,scrollbars=yes,resizable=yes')
    if (popup) {
      popup.opener = null
      popup.focus()
    }

    setIsStartingCheckout(true)
    setErrorMessage(null)
    setFallbackLaunchUrl(null)
    try {
      const response = await fetch('/api/payments/meld/checkouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: quote.quoteId }),
      })
      const result: unknown = await response.json()
      if (
        !response.ok ||
        !isRecord(result) ||
        typeof result.checkoutId !== 'string' ||
        typeof result.launchUrl !== 'string'
      ) {
        if (isRecord(result) && result.error === 'quote_expired') {
          throw new Error('quote_expired')
        }
        throw new Error('checkout_creation_failed')
      }

      try {
        window.localStorage.setItem('kuest:pending-meld-checkout', result.checkoutId)
      } catch {
        // Status polling still runs in the return page when browser storage is unavailable.
      }
      window.dispatchEvent(new CustomEvent('kuest:meld-checkout-created', { detail: result.checkoutId }))
      onCheckoutCreated()
      if (popup) {
        popup.location.replace(result.launchUrl)
        onOpenChange(false)
      } else {
        setFallbackLaunchUrl(result.launchUrl)
        setErrorMessage(t('The popup was blocked. Continue in this tab to open the payment provider.'))
      }
    } catch (error) {
      popup?.close()
      setQuotes([])
      setSelectedQuoteId('')
      setErrorMessage(
        error instanceof Error && error.message === 'quote_expired'
          ? t('This offer expired. Request fresh payment options.')
          : t('Could not start checkout. Request fresh payment options and try again.'),
      )
    } finally {
      setIsStartingCheckout(false)
    }
  }

  function clearOffers() {
    setQuotes([])
    setSelectedQuoteId('')
    setFallbackLaunchUrl(null)
    setErrorMessage(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('Buy USDC')}</DialogTitle>
          <DialogDescription>
            {t('Choose your country and payment amount. You will receive USDC on Polygon in your Deposit Wallet.')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="meld-country">{t('Country')}</Label>
            <select
              id="meld-country"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={countryCode}
              onChange={(event) => {
                const nextCountryCode = event.target.value
                setCountryCode(nextCountryCode)
                setCurrencies([])
                setSourceCurrencyCode('')
                setIsLoadingCurrencies(Boolean(nextCountryCode))
                clearOffers()
              }}
              disabled={isLoadingCountries || isStartingCheckout}
            >
              <option value="">{isLoadingCountries ? t('Loading...') : t('Select a country')}</option>
              {countries.map((country) => (
                <option key={country.countryCode} value={country.countryCode}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="meld-fiat-currency">{t('Pay with')}</Label>
            <select
              id="meld-fiat-currency"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={sourceCurrencyCode}
              onChange={(event) => {
                setSourceCurrencyCode(event.target.value)
                clearOffers()
              }}
              disabled={!countryCode || isLoadingCurrencies || isStartingCheckout}
            >
              <option value="">{isLoadingCurrencies ? t('Loading...') : t('Select a currency')}</option>
              {currencies.map((currency) => (
                <option key={currency.currencyCode} value={currency.currencyCode}>
                  {currency.currencyCode} — {currency.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="meld-source-amount">{t('Amount')}</Label>
            <Input
              id="meld-source-amount"
              inputMode="decimal"
              autoComplete="off"
              value={sourceAmount}
              onChange={(event) => {
                setSourceAmount(event.target.value)
                clearOffers()
              }}
              disabled={isStartingCheckout}
              placeholder={sourceCurrencyCode || t('Amount')}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void getQuotes()}
            disabled={!countryCode || !sourceCurrencyCode || !sourceAmount || isGettingQuotes || isStartingCheckout}
          >
            {isGettingQuotes ? t('Loading...') : t('Show payment options')}
          </Button>

          {quotes.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">{t('Choose a payment provider')}</legend>
              {quotes.map((quote) => (
                <label
                  key={quote.quoteId}
                  className={`grid cursor-pointer gap-1 rounded-lg border p-3 text-sm ${
                    selectedQuoteId === quote.quoteId ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-medium">
                      <input
                        type="radio"
                        name="meld-quote"
                        value={quote.quoteId}
                        checked={selectedQuoteId === quote.quoteId}
                        onChange={() => setSelectedQuoteId(quote.quoteId)}
                      />
                      {providerLabel(quote.serviceProvider)}
                    </span>
                    <span>{quote.destinationAmount.toFixed(2)} USDC</span>
                  </span>
                  <span className="ps-6 text-muted-foreground">
                    {t('Pay {amount} with {method}', {
                      amount: formatMoney(quote.sourceAmount, quote.sourceCurrencyCode),
                      method: quote.paymentMethodType.replaceAll('_', ' ').toLowerCase(),
                    })}
                    {quote.totalFee !== null && quote.totalFee > 0
                      ? ` · ${t('Fees {amount}', { amount: formatMoney(quote.totalFee, quote.sourceCurrencyCode) })}`
                      : ''}
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {errorMessage && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          {fallbackLaunchUrl && (
            <Button type="button" onClick={() => window.location.assign(fallbackLaunchUrl)}>
              {t('Continue in this tab')}
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isStartingCheckout}>
            {t('Cancel')}
          </Button>
          <Button type="button" onClick={() => void startCheckout()} disabled={!selectedQuoteId || isStartingCheckout}>
            {isStartingCheckout ? t('Starting...') : t('Continue to payment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
