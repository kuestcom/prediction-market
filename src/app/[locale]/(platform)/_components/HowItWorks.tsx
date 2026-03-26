'use client'

import { InfoIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { useAppKit } from '@/hooks/useAppKit'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn, triggerConfetti } from '@/lib/utils'

interface HowItWorksProps {
  displayMode?: 'auto' | 'mobile' | 'desktop'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

export default function HowItWorks({
  displayMode = 'auto',
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: HowItWorksProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const { open } = useAppKit()
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  const steps = [
    {
      title: t('1. Choose a Market'),
      description:
        t('Buy ‘Yes’ or ‘No’ shares based on what you honestly think will happen. Prices move in real time as other traders trade.'),
      image: '/images/how-it-works/markets.svg',
      imageAlt: t('Illustration showing how to pick a market'),
      ctaLabel: t('Next'),
    },
    {
      title: t('2. Make Your Trade'),
      description:
        t('Add funds with crypto, card, or bank transfer—then choose your position. Trade on real-world events with full transparency.'),
      image: '/images/how-it-works/trade.svg',
      imageAlt: t('Illustration showing how to place an order'),
      ctaLabel: t('Next'),
    },
    {
      title: t('3. Cash Out 🤑'),
      description:
        t('Sell your ‘Yes’ or ‘No’ shares anytime, or wait until the market settles. Winning shares redeem for $1 each. Start trading in minutes.'),
      image: '/images/how-it-works/cashout.svg',
      imageAlt: t('Illustration showing how profits work'),
      ctaLabel: t('Get Started'),
    },
  ] as const

  const currentStep = steps[activeStep]
  const isLastStep = activeStep === steps.length - 1
  const isOpen = controlledOpen ?? uncontrolledIsOpen
  const shouldUseMobileLayout = displayMode === 'auto'
    ? isMobile
    : displayMode === 'mobile'

  useEffect(() => {
    if (controlledOpen === undefined || controlledOpen) {
      return
    }

    setActiveStep(0)
  }, [controlledOpen])

  function setOpen(nextOpen: boolean) {
    if (controlledOpen === undefined) {
      setUncontrolledIsOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    setActiveStep(0)
  }

  function handleNext() {
    if (isLastStep) {
      triggerConfetti('primary')
      setOpen(false)
      setActiveStep(0)
      setTimeout(() => {
        void open()
      }, 1000)
      return
    }

    setActiveStep(step => Math.min(step + 1, steps.length - 1))
  }

  if (shouldUseMobileLayout) {
    return (
      <Drawer open={isOpen} onOpenChange={handleOpenChange}>
        {!hideTrigger && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="justify-start gap-2 px-0 text-primary hover:no-underline sm:hidden"
            onClick={() => setOpen(true)}
            data-testid="how-it-works-trigger-mobile"
          >
            <InfoIcon className="size-4" />
            {t('How it works')}
          </Button>
        )}

        <DrawerContent className="max-h-[95vh] gap-0 overflow-y-auto p-0" data-testid="how-it-works-dialog">
          <div className="mt-2 h-85 overflow-hidden lg:rounded-t-lg">
            <Image
              src={currentStep.image}
              alt={currentStep.imageAlt}
              width={448}
              height={252}
              unoptimized
              className="size-full object-cover"
            />
          </div>

          <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-center gap-2">
              {steps.map((step, index) => (
                <span
                  key={step.title}
                  className={cn(
                    'h-1.5 w-8 rounded-full bg-muted transition-colors',
                    { 'bg-primary': index === activeStep },
                  )}
                />
              ))}
            </div>

            <DrawerHeader className="gap-2 p-0 text-left">
              <DrawerTitle className="text-xl font-semibold">
                {currentStep.title}
              </DrawerTitle>
              <DrawerDescription className="text-sm/relaxed">
                {currentStep.description}
              </DrawerDescription>
            </DrawerHeader>

            <Button size="lg" className="h-11 w-full" onClick={handleNext} data-testid="how-it-works-next-button">
              {currentStep.ctaLabel}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="hidden items-center gap-1.5 text-primary hover:no-underline lg:inline-flex"
            data-testid="how-it-works-trigger-desktop"
          >
            <InfoIcon className="size-4" />
            {t('How it works')}
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-h-[95vh] gap-0 overflow-y-auto p-0 sm:max-w-md" data-testid="how-it-works-dialog">
        <div className="h-85 overflow-hidden rounded-t-lg">
          <Image
            src={currentStep.image}
            alt={currentStep.imageAlt}
            width={448}
            height={252}
            unoptimized
            className="size-full object-cover"
          />
        </div>

        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-center justify-center gap-2">
            {steps.map((step, index) => (
              <span
                key={step.title}
                className={cn(
                  'h-1.5 w-8 rounded-full bg-muted transition-colors',
                  { 'bg-primary': index === activeStep },
                )}
              />
            ))}
          </div>

          <DialogHeader className="gap-2">
            <DialogTitle className="text-xl font-semibold">
              {currentStep.title}
            </DialogTitle>
            <DialogDescription className="text-sm/relaxed">
              {currentStep.description}
            </DialogDescription>
          </DialogHeader>

          <Button size="lg" className="h-11 w-full" onClick={handleNext} data-testid="how-it-works-next-button">
            {currentStep.ctaLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
