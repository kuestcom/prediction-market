import { fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { SupportedLocale } from '@/i18n/locales'

import AdminLocalesSettingsForm from '@/app/[locale]/admin/locales/_components/AdminLocalesSettingsForm'

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string | { message: string }, values?: Record<string, string>) => {
    const message = typeof value === 'string' ? value : value.message
    return values ? message.replace('{name}', values.name ?? '') : message
  },
}))

vi.mock('next/form', () => ({
  __esModule: true,
  default: ({ action: _action, children, ...props }: any) => React.createElement('form', props, children),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) =>
    React.createElement('img', {
      src: typeof src === 'string' ? src : undefined,
      alt: alt ?? '',
      ...props,
    }),
}))

vi.mock('@/app/[locale]/admin/locales/_actions/update-locales-settings', () => ({
  updateLocalesSettingsAction: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const props = {
  supportedLocales: ['en', 'de', 'es', 'pt', 'fr'] as const,
  enabledLocales: ['en', 'fr', 'de'] as SupportedLocale[],
  localeOrder: ['en', 'fr', 'de', 'pt', 'es'] as SupportedLocale[],
  automaticTranslationsEnabled: false,
  isOpenRouterConfigured: false,
}

describe('adminLocalesSettingsForm', () => {
  it('keeps English first and submits the reordered enabled locales', () => {
    const { container, getByRole } = render(<AdminLocalesSettingsForm {...props} />)

    expect(
      Array.from(container.querySelectorAll('input[name="enabled_locales"]')).map((input) =>
        input.getAttribute('value'),
      ),
    ).toEqual(['en', 'fr', 'de'])

    fireEvent.click(getByRole('button', { name: 'Move Deutsch up' }))

    expect(
      Array.from(container.querySelectorAll('input[name="enabled_locales"]')).map((input) =>
        input.getAttribute('value'),
      ),
    ).toEqual(['en', 'de', 'fr'])
  })

  it('persists the reordered position of disabled locales', () => {
    const { container, getByRole } = render(<AdminLocalesSettingsForm {...props} />)

    fireEvent.click(getByRole('button', { name: 'Move Português up' }))

    expect(container.querySelector('input[name="locale_order"]')?.getAttribute('value')).toBe(
      JSON.stringify(['en', 'fr', 'pt', 'de', 'es']),
    )
    expect(
      Array.from(container.querySelectorAll('input[name="enabled_locales"]')).map((input) =>
        input.getAttribute('value'),
      ),
    ).toEqual(['en', 'fr', 'de'])
  })
})
