import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, jest, mock } from 'bun:test'

import { MeldOnrampDialog } from '@/app/[locale]/(platform)/_components/MeldOnrampDialog'

import { hoisted, stubGlobal, unstubAllGlobals } from '../bun-test-helpers'

const mocks = hoisted(() => ({ fetch: mock() }))
function translate(value: string) {
  return value
}

void mock.module('next-intl', () => ({
  useExtracted: () => translate,
}))

void mock.module('@/components/ui/button', () => ({
  Button: ({ children, className, ...props }: any) => (
    <button className={className} {...props}>
      {children}
    </button>
  ),
}))

void mock.module('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

void mock.module('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}))

void mock.module('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

afterEach(() => {
  jest.restoreAllMocks()
  unstubAllGlobals()
  mocks.fetch.mockReset()
})

describe('MeldOnrampDialog', () => {
  it('locks country, currency, and amount while quotes are loading', async () => {
    let resolveQuotes!: (response: Response) => void
    const quoteResponse = new Promise<Response>((resolve) => {
      resolveQuotes = resolve
    })
    mocks.fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url === '/api/payments/meld/countries') {
        return new Response(JSON.stringify({ countries: [{ countryCode: 'US', name: 'United States' }] }))
      }
      if (url === '/api/payments/meld/currencies?countryCode=US') {
        return new Response(JSON.stringify({ currencies: [{ currencyCode: 'USD', name: 'US Dollar' }] }))
      }
      if (url === '/api/payments/meld/quotes') {
        return quoteResponse
      }
      throw new Error(`unexpected_request:${url}`)
    })
    stubGlobal('fetch', mocks.fetch)

    render(<MeldOnrampDialog open onOpenChange={mock()} onCheckoutCreated={mock()} />)

    const country = await screen.findByRole('combobox', { name: 'Country' })
    await screen.findByRole('option', { name: 'United States' })
    fireEvent.change(country, { target: { value: 'US' } })

    const currency = await screen.findByRole('combobox', { name: 'Pay with' })
    await screen.findByRole('option', { name: 'USD — US Dollar' })
    fireEvent.change(currency, { target: { value: 'USD' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Amount' }), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show payment options' }))

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(3))
    expect(country).toBeDisabled()
    expect(currency).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Amount' })).toBeDisabled()

    await act(async () => {
      resolveQuotes(
        new Response(
          JSON.stringify({
            quotes: [
              {
                quoteId: 'quote-1',
                serviceProvider: 'TEST_PROVIDER',
                paymentMethodType: 'CARD',
                sourceAmount: 50,
                sourceCurrencyCode: 'USD',
                destinationAmount: 49,
                destinationCurrencyCode: 'USDC_POLYGON',
              },
            ],
          }),
        ),
      )
    })

    await screen.findByText('Test Provider')
    expect(country).not.toBeDisabled()
    expect(currency).not.toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Amount' })).not.toBeDisabled()
  })
})
