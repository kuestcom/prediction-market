'use client'

import { useAppKitAccount } from '@reown/appkit/react'
import { InfoIcon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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
import { useClientMounted } from '@/hooks/useClientMounted'
import { useIsMobile } from '@/hooks/useIsMobile'
import { usePathname } from '@/i18n/navigation'
import { cn, triggerConfetti } from '@/lib/utils'
import { useIsSingleMarket } from '@/stores/useOrder'

export default function HeaderHowItWorks() {
  const isMounted = useClientMounted()
  const t = useExtracted()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const isSingleMarket = useIsSingleMarket()
  const { open } = useAppKit()
  const { isConnected, status } = useAppKitAccount()
  const [isOpen, setIsOpen] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [isMobileBannerDismissed, setIsMobileBannerDismissed] = useState(false)

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const dismissed = window.localStorage.getItem('how_it_works_banner_dismissed')
    if (dismissed === 'true') {
      queueMicrotask(() => setIsMobileBannerDismissed(true))
    }
  }, [])

  function handleDismissBanner() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('how_it_works_banner_dismissed', 'true')
    }
    setIsMobileBannerDismissed(true)
  }

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen)
    setActiveStep(0)
  }

  function handleNext() {
    if (isLastStep) {
      triggerConfetti('primary')
      setIsOpen(false)
      setActiveStep(0)
      setTimeout(() => {
        void open()
      }, 1000)
      return
    }

    setActiveStep(step => Math.min(step + 1, steps.length - 1))
  }

  if (!isMounted || status === 'connecting' || isConnected) {
    return <></>
  }

  const showMobileBanner = !isMobileBannerDismissed
  const shouldOffsetForEventOrderPanel = pathname.startsWith('/event/') && isSingleMarket

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={handleOpenChange}>
        {showMobileBanner && createPortal(
          <div
            className={cn(
              'fixed inset-x-0 z-40 rounded-t-xl border-t bg-background sm:hidden',
              shouldOffsetForEventOrderPanel ? 'bottom-20' : 'bottom-0',
            )}
            data-testid="how-it-works-mobile-banner"
          >
            <div className="container flex items-center justify-between gap-2 py-2">
              <Button
                type="button"
                variant="link"
                size="sm"
                className={`
                  flex-1 justify-center gap-2 text-primary/80 no-underline
                  hover:text-primary hover:no-underline
                `}
                onClick={() => setIsOpen(true)}
                data-testid="how-it-works-trigger-mobile"
              >
                <InfoIcon className="size-4" />
                {t('How it works')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handleDismissBanner}
                data-testid="how-it-works-dismiss-banner"
              >
                <XIcon className="size-4" />
                <span className="sr-only">{t('Dismiss')}</span>
              </Button>
            </div>
          </div>,
          document.body,
        )}

        <DrawerContent className="max-h-[95vh] gap-0 overflow-y-auto p-0" data-testid="how-it-works-dialog">
          <div className="mt-2 h-85 overflow-hidden lg:rounded-t-lg">
            <Image
              src={currentStep.image}
              alt={currentStep.imageAlt}
              width={448}
              height={252}
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
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="link"
          size="sm"
          className={`
            hidden items-center gap-1.5 text-primary/80 no-underline
            hover:text-primary hover:no-underline
            lg:inline-flex
            [&>svg]:text-primary
          `}
          data-testid="how-it-works-trigger-desktop"
        >
          <InfoIcon className="size-4" />
          {t('How it works')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[95vh] gap-0 overflow-y-auto p-0 sm:max-w-md" data-testid="how-it-works-dialog">
        <div className="h-85 overflow-hidden rounded-t-lg">
          <Image
            src={currentStep.image}
            alt={currentStep.imageAlt}
            width={448}
            height={252}
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
