import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

describe('Tooltip', () => {
  it('opens when a rendered button is hovered', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip>
        <TooltipTrigger render={<Button aria-label="More information" />} />
        <TooltipContent>Helpful details</TooltipContent>
      </Tooltip>,
    )

    await user.hover(screen.getByRole('button', { name: 'More information' }))

    expect(await screen.findByRole('tooltip', { name: 'Helpful details' })).toBeVisible()
  })
})
