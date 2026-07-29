'use client'

import { ArrowLeftIcon, ExternalLinkIcon, Loader2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'

import EventIconImage from '@/components/EventIconImage'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

import type { useAdminCreateEventForm } from './useAdminCreateEventForm'

type AdminCreateEventFormState = ReturnType<typeof useAdminCreateEventForm>

const AdminProposersDialog = dynamic(() => import('./AdminProposersDialog'), {
  ssr: false,
})

export function AdminCreateEventDialogs({ state }: { state: AdminCreateEventFormState }) {
  const t = useExtracted()
  const {
    eoaAddress,
    selectedCreatorAddress,
    form,
    isAddingCreatorWallet,
    creatorWalletDialogOpen,
    setCreatorWalletDialogOpen,
    proposersDialogOpen,
    setProposersDialogOpen,
    creatorWalletName,
    setCreatorWalletName,
    isGeneratingRules,
    rulesGeneratorDialogOpen,
    setRulesGeneratorDialogOpen,
    finalPreviewDialogOpen,
    setFinalPreviewDialogOpen,
    resetFormDialogOpen,
    setResetFormDialogOpen,
    eventImagePreviewUrl,
    selectedCategoryChips,
    recurringRequiresServerWalletSetup,
    previewEndDate,
    previewTitle,
    previewMarkets,
    tradePreviewMarket,
    previewEventUrl,
    isMultiMarketPreview,
    effectiveResolutionRules,
    addCurrentWalletToAllowedCreators,
    setProposerWhitelistCheckState,
    confirmResetForm,
    continueFromFinalPreview,
    generateRulesWithAi,
  } = state

  return (
    <>
      <Dialog
        open={creatorWalletDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isAddingCreatorWallet) {
            setCreatorWalletDialogOpen(nextOpen)
            if (!nextOpen) {
              setCreatorWalletName('')
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Name this wallet')}</DialogTitle>
            <DialogDescription>
              {t('Add a display name so this wallet can be recognized in mirrored market sources.')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="creator-wallet-name">{t('Wallet name')}</Label>
            <Input
              id="creator-wallet-name"
              value={creatorWalletName}
              onChange={(event) => setCreatorWalletName(event.target.value)}
              maxLength={80}
              placeholder={t('My creator wallet')}
              disabled={isAddingCreatorWallet}
            />
            <p className="text-xs text-muted-foreground">{eoaAddress ?? t('Wallet not connected')}</p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreatorWalletDialogOpen(false)
                setCreatorWalletName('')
              }}
              disabled={isAddingCreatorWallet}
            >
              {t('Cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void addCurrentWalletToAllowedCreators()}
              disabled={isAddingCreatorWallet || !creatorWalletName.trim() || !eoaAddress}
            >
              {isAddingCreatorWallet && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              {t('Add wallet')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminProposersDialog
        open={proposersDialogOpen}
        onOpenChange={setProposersDialogOpen}
        initialCreatorAddress={selectedCreatorAddress}
        lockCreatorSelection
        onStatusChange={(nextStatus) => {
          if (!selectedCreatorAddress || nextStatus.creator.toLowerCase() !== selectedCreatorAddress.toLowerCase()) {
            return
          }
          setProposerWhitelistCheckState(nextStatus.whitelistAddress ? 'ok' : 'missing')
        }}
      />

      <Dialog open={recurringRequiresServerWalletSetup} onOpenChange={() => {}}>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t('Server Wallet Required')}</DialogTitle>
            <DialogDescription>
              {t('Recurring events require adding the creator wallet private key to')}{' '}
              <code>{t('EVENT_CREATION_SIGNER_PRIVATE_KEYS')}</code>{' '}
              {t("in Vercel Environment Variables or your project's")} <code>{t('.env')}</code>{' '}
              {t('before you can create or edit recurring drafts.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/events/calendar">
                <ArrowLeftIcon className="size-4" />
                {t('Back to calendar')}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rulesGeneratorDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isGeneratingRules) {
            setRulesGeneratorDialogOpen(nextOpen)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Generate rules with AI')}</DialogTitle>
            <DialogDescription>
              {t(
                'Experimental output generated by your configured AI provider. We recommend paid models (for example xAI or Manus with internet access) for better quality. Validate all text manually, including dates and links. You are responsible for the final rules.',
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRulesGeneratorDialogOpen(false)}
              disabled={isGeneratingRules}
            >
              {t('Cancel')}
            </Button>
            <Button type="button" onClick={() => void generateRulesWithAi()} disabled={isGeneratingRules}>
              {isGeneratingRules && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              {t('Generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetFormDialogOpen} onOpenChange={setResetFormDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Clear form?')}</DialogTitle>
            <DialogDescription>
              {t('This will remove all filled fields, uploaded images, and pre-sign checks from the wizard.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetFormDialogOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmResetForm}>
              {t('Clear form')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={finalPreviewDialogOpen} onOpenChange={setFinalPreviewDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{t('Event preview')}</DialogTitle>
            <DialogDescription>
              {t('Review how your event and markets will look before starting signatures.')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[90vh] flex-col">
            <div className="border-b px-6 py-3">
              <div
                className={cn(
                  `mx-auto w-full max-w-2xl rounded-md border bg-muted/20 px-3 py-2 text-center font-mono text-xs text-muted-foreground`,
                )}
              >
                {previewEventUrl}
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-h-0 space-y-4 overflow-y-auto p-6">
                <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 rounded-md border p-4">
                  <div className="relative size-22 overflow-hidden rounded-md border bg-muted">
                    {eventImagePreviewUrl ? (
                      <EventIconImage
                        src={eventImagePreviewUrl}
                        alt={t('Event preview')}
                        sizes="88px"
                        containerClassName="size-full"
                      />
                    ) : (
                      <Skeleton className="size-full rounded-none" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-lg font-semibold text-foreground">{previewTitle}</p>
                    <p className="text-xs text-muted-foreground">{previewEndDate}</p>
                  </div>
                </div>

                {isMultiMarketPreview && previewMarkets.length > 0 && (
                  <div className="space-y-3 rounded-md border p-4">
                    <p className="text-sm font-semibold text-foreground">{t('Outcomes')}</p>
                    <div className="space-y-3">
                      {previewMarkets.map((market, index) => (
                        <div key={market.key} className="rounded-md border bg-muted/20 p-3">
                          <div className="flex items-center gap-3">
                            {market.imageUrl && (
                              <div className="relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                                <EventIconImage
                                  src={market.imageUrl}
                                  alt={`Market ${index + 1} preview`}
                                  sizes="48px"
                                  containerClassName="size-full"
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-sm font-semibold text-foreground">
                                {market.title || `Market ${index + 1}`}
                              </p>
                              <p className="text-xs text-muted-foreground">{market.question || 'Question pending'}</p>
                            </div>
                            <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                              <span
                                className={cn(
                                  `rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-sm font-semibold text-emerald-600`,
                                )}
                              >
                                {market.outcomeYes}
                              </span>
                              <span
                                className={cn(
                                  `rounded-md border border-red-500/40 bg-red-500/15 px-2.5 py-1.5 text-sm font-semibold text-red-500`,
                                )}
                              >
                                {market.outcomeNo}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 sm:hidden">
                            <span
                              className={cn(
                                `rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-sm font-semibold text-emerald-600`,
                              )}
                            >
                              {market.outcomeYes}
                            </span>
                            <span
                              className={cn(
                                `rounded-md border border-red-500/40 bg-red-500/15 px-2.5 py-1.5 text-sm font-semibold text-red-500`,
                              )}
                            >
                              {market.outcomeNo}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 rounded-md border p-4">
                  <p className="text-sm font-semibold text-foreground">{t('Resolution rules')}</p>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {effectiveResolutionRules || t('Rules not set.')}
                  </p>
                  {form.resolutionSource ? (
                    <a
                      href={form.resolutionSource}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {form.resolutionSource}
                      <ExternalLinkIcon className="size-3" />
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('No resolution source URL.')}</p>
                  )}
                </div>
              </div>

              <div className="border-t bg-muted/10 p-6 lg:border-t-0 lg:border-l">
                <p className="text-sm font-semibold text-foreground">{t('Trade panel preview')}</p>
                <div className="mt-3 space-y-3 rounded-md border bg-background p-4">
                  <div className="flex items-center gap-4 text-sm font-semibold">
                    <span className="text-muted-foreground">{t('Buy')}</span>
                    <span className="text-muted-foreground">{t('Sell')}</span>
                  </div>
                  <div className="h-px w-full bg-border" />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled
                      className={cn(
                        `rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-600`,
                      )}
                    >
                      {tradePreviewMarket?.outcomeYes || t('Yes')}
                    </button>
                    <button
                      type="button"
                      disabled
                      className={cn(
                        `rounded-md border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-500`,
                      )}
                    >
                      {tradePreviewMarket?.outcomeNo || t('No')}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{t('Categories')}</p>
                  {selectedCategoryChips.length > 0 ? (
                    <div
                      className={cn(
                        `flex scrollbar-none gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`,
                      )}
                    >
                      {selectedCategoryChips.map((item) => (
                        <span
                          key={item.slug}
                          className={cn(
                            `shrink-0 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground`,
                          )}
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('No categories selected.')}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setFinalPreviewDialogOpen(false)}>
                {t('Back to edit')}
              </Button>
              <Button type="button" onClick={continueFromFinalPreview}>
                {t('Continue to sign')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
