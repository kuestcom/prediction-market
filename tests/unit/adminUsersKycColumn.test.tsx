import type { ReactNode } from 'react'
import { render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAdminUsersColumns } from '@/app/[locale]/admin/users/_components/columns'

vi.mock('next-intl', () => ({ useExtracted: () => (message: string) => message }))
vi.mock('@/components/ProfileLink', () => ({ default: () => null }))

function renderKycCell(status: string) {
  const { result } = renderHook(() => useAdminUsersColumns(true))
  const column = result.current.find(item => item.id === 'kyc')
  expect(column).toBeDefined()
  const Cell = column?.cell as (context: unknown) => ReactNode
  render(<>{Cell({ row: { original: { sumsub_status: status } } })}</>)
  return document.querySelector('svg')
}

describe('admin users KYC column', () => {
  it('is absent when Sumsub is inactive', () => {
    const { result } = renderHook(() => useAdminUsersColumns(false))
    expect(result.current.some(column => column.id === 'kyc')).toBe(false)
  })

  it.each([
    ['not_started', 'text-muted-foreground', 'Identity verification required'],
    ['pending', 'text-muted-foreground', 'Verification is under review'],
    ['on_hold', 'text-muted-foreground', 'Verification is on hold'],
    ['error', 'text-muted-foreground', 'Verification status is temporarily unavailable'],
    ['approved', 'text-primary', 'KYC approved'],
    ['rejected', 'text-destructive', 'KYC rejected'],
  ])('renders %s with the palette color and accessible label', (status, className, label) => {
    expect(renderKycCell(status)).toHaveClass(className)
    expect(screen.getByText(label)).toHaveClass('sr-only')
  })
})
