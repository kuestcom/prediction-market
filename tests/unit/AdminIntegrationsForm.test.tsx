import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, mock } from 'bun:test'
import * as React from 'react'

import AdminIntegrationsForm from '@/app/[locale]/admin/integrations/_components/AdminIntegrationsForm'

void mock.module('next-intl', () => ({
  useExtracted: () => (value: string | { message: string }) => (typeof value === 'string' ? value : value.message),
}))

void mock.module('next/image', () => ({
  default: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) =>
    React.createElement('img', {
      src: typeof src === 'string' ? src : undefined,
      alt: alt ?? '',
      ...props,
    }),
}))

void mock.module('@/app/[locale]/admin/integrations/_actions/update-integrations-settings', () => ({
  updateIntegrationsSettingsAction: mock().mockResolvedValue({ error: null }),
}))

const props = {
  locale: 'en',
  googleAnalyticsId: '',
  customJavascriptCodes: [],
  lifiIntegrator: '',
  lifiApiKeyConfigured: false,
  openRouterSettings: {
    defaultModel: '',
    translationModel: '',
    isApiKeyConfigured: false,
    modelOptions: [],
    translationModelOptions: [],
  },
  sportsSourceSettings: {
    isPandaScoreTokenConfigured: false,
    isTheSportsDbApiKeyConfigured: false,
  },
  arbitrageSettings: {
    enabled: false,
    multiWalletEnabled: false,
  },
  kuestSupportSettings: {
    enabled: true,
    position: 'right' as const,
  },
  sumsubSettings: {
    enabled: false,
    enforcement: 'disabled' as const,
    levelName: '',
    appTokenConfigured: false,
    secretKeyConfigured: false,
    webhookSecretConfigured: false,
  },
}

describe('adminIntegrationsForm', () => {
  afterEach(() => {
    window.history.replaceState(window.history.state, '', window.location.pathname)
  })

  it('allows an accordion opened by a URL fragment to collapse', () => {
    window.history.replaceState(window.history.state, '', '#openrouter')
    render(<AdminIntegrationsForm {...props} />)
    const trigger = screen.getByRole('button', { name: /OpenRouter/ })

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(window.location.hash).toBe('')
  })

  it('reflects an updated saved support widget position', () => {
    const { rerender } = render(<AdminIntegrationsForm {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Kuest Support/ }))
    const positionSwitch = screen.getByRole('switch', { name: 'Widget position' })
    expect(positionSwitch).toHaveAttribute('data-checked')

    rerender(<AdminIntegrationsForm {...props} kuestSupportSettings={{ enabled: true, position: 'left' }} />)

    fireEvent.click(screen.getByRole('button', { name: /Kuest Support/ }))
    expect(screen.getByRole('switch', { name: 'Widget position' })).toHaveAttribute('data-unchecked')
  })

  it('renders each integration as its own accordion card', () => {
    const { container } = render(<AdminIntegrationsForm {...props} />)

    expect(
      Array.from(container.querySelectorAll('[data-settings-section]')).map((section) =>
        section.getAttribute('data-settings-section'),
      ),
    ).toEqual([
      'google-analytics',
      'openrouter',
      'sumsub',
      'thesportsdb',
      'pandascore',
      'lifi',
      'polymarket',
      'kuest-support',
      'custom',
    ])
    expect(screen.getByRole('button', { name: /TheSportsDB/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /PandaScore/ })).toBeInTheDocument()
    expect(container.querySelectorAll('img')).toHaveLength(8)
    expect(container.querySelector('img[src="/images/logos/sumsub.svg"]')).toBeInTheDocument()
    expect(container.querySelector('[data-settings-section="custom"] svg')).toBeInTheDocument()
  })

  it('shows an official destination inside every provider card', () => {
    const { container } = render(<AdminIntegrationsForm {...props} />)
    const providerSections = [
      'google-analytics',
      'openrouter',
      'sumsub',
      'thesportsdb',
      'pandascore',
      'lifi',
      'polymarket',
    ]

    for (const section of providerSections) {
      expect(container.querySelector(`[data-settings-section="${section}"] a[href^="http"]`)).toBeInTheDocument()
    }
  })
})
