'use client'

import type { useAdminCreateEventForm } from './useAdminCreateEventForm'
import { ArrowLeftIcon, ExternalLinkIcon, Loader2Icon } from 'lucide-react'
import dynamic from 'next/dynamic'
import AppLink from '@/components/AppLink'
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
import { cn } from '@/lib/utils'

type AdminCreateEventFormState = ReturnType<typeof useAdminCreateEventForm>

const AdminProposersDialog = dynamic(() => import('./AdminProposersDialog'), {
  ssr: false,
})

export function AdminCreateEventDialogs({
  state,
}: {
  state: AdminCreateEventFormState
}) {
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
            <DialogTitle>Name this wallet</DialogTitle>
            <DialogDescription>
              Add a display name so this wallet can be recognized in mirrored market sources.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="creator-wallet-name">Wallet name</Label>
            <Input
              id="creator-wallet-name"
              value={creatorWalletName}
              onChange={event => setCreatorWalletName(event.target.value)}
              maxLength={80}
              placeholder="My creator wallet"
              disabled={isAddingCreatorWallet}
            />
            <p className="text-xs text-muted-foreground">
              {eoaAddress ?? 'Wallet not connected'}
            </p>
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
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void addCurrentWalletToAllowedCreators()}
              disabled={isAddingCreatorWallet || !creatorWalletName.trim() || !eoaAddress}
            >
              {isAddingCreatorWallet && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Add wallet
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
          onEscapeKeyDown={event => event.preventDefault()}
          onInteractOutside={event => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Server Wallet Required</DialogTitle>
            <DialogDescription>
              Recurring events require adding the creator wallet private key to
              {' '}
              <code>EVENT_CREATION_SIGNER_PRIVATE_KEYS</code>
              {' '}
              in Vercel Environment Variables or your project&apos;s
              {' '}
              <code>.env</code>
              {' '}
              before you can create or edit recurring drafts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" asChild>
              <AppLink href="/admin/events/calendar">
                <ArrowLeftIcon className="size-4" />
                Back to calendar
              </AppLink>
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
            <DialogTitle>Generate rules with AI</DialogTitle>
            <DialogDescription>
              Experimental output generated by your configured AI provider.
              We recommend paid models (for example xAI or Manus with internet access) for better quality.
              Validate all text manually, including dates and links. You are responsible for the final rules.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRulesGeneratorDialogOpen(false)}
              disabled={isGeneratingRules}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void generateRulesWithAi()} disabled={isGeneratingRules}>
              {isGeneratingRules && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetFormDialogOpen} onOpenChange={setResetFormDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear form?</DialogTitle>
            <DialogDescription>
              This will remove all filled fields, uploaded images, and pre-sign checks from the wizard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetFormDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmResetForm}>
              Clear form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={finalPreviewDialogOpen} onOpenChange={setFinalPreviewDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Event preview</DialogTitle>
            <DialogDescription>
              Review how your event and markets will look before starting signatures.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[90vh] flex-col">
            <div className="border-b px-6 py-3">
              <div className={cn(`
                mx-auto w-full max-w-2xl rounded-md border bg-muted/20 px-3 py-2 text-center font-mono text-xs
                text-muted-foreground
              `)}
              >
                {previewEventUrl}
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-h-0 space-y-4 overflow-y-auto p-6">
                <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 rounded-md border p-4">
                  <div className="relative size-22 overflow-hidden rounded-md border bg-muted">
                    {eventImagePreviewUrl
                      ? (
                          <EventIconImage
                            src={eventImagePreviewUrl}
                            alt="Event preview"
                            sizes="88px"
                            containerClassName="size-full"
                          />
                        )
                      : (
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
                    <p className="text-sm font-semibold text-foreground">Outcomes</p>
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
                              <span className={cn(`
                                rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-sm
                                font-semibold text-emerald-600
                              `)}
                              >
                                {market.outcomeYes}
                              </span>
                              <span className={cn(`
                                rounded-md border border-red-500/40 bg-red-500/15 px-2.5 py-1.5 text-sm font-semibold
                                text-red-500
                              `)}
                              >
                                {market.outcomeNo}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 sm:hidden">
                            <span className={cn(`
                              rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-sm
                              font-semibold text-emerald-600
                            `)}
                            >
                              {market.outcomeYes}
                            </span>
                            <span className={cn(`
                              rounded-md border border-red-500/40 bg-red-500/15 px-2.5 py-1.5 text-sm font-semibold
                              text-red-500
                            `)}
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
                  <p className="text-sm font-semibold text-foreground">Resolution rules</p>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {effectiveResolutionRules || 'Rules not set.'}
                  </p>
                  {form.resolutionSource
                    ? (
                        <a
                          href={form.resolutionSource}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {form.resolutionSource}
                          <ExternalLinkIcon className="size-3" />
                        </a>
                      )
                    : (
                        <p className="text-xs text-muted-foreground">No resolution source URL.</p>
                      )}
                </div>
              </div>

              <div className="border-t bg-muted/10 p-6 lg:border-t-0 lg:border-l">
                <p className="text-sm font-semibold text-foreground">Trade panel preview</p>
                <div className="mt-3 space-y-3 rounded-md border bg-background p-4">
                  <div className="flex items-center gap-4 text-sm font-semibold">
                    <span className="text-muted-foreground">Buy</span>
                    <span className="text-muted-foreground">Sell</span>
                  </div>
                  <div className="h-px w-full bg-border" />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled
                      className={cn(`
                        rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold
                        text-emerald-600
                      `)}
                    >
                      {tradePreviewMarket?.outcomeYes || 'Yes'}
                    </button>
                    <button
                      type="button"
                      disabled
                      className={cn(`
                        rounded-md border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-500
                      `)}
                    >
                      {tradePreviewMarket?.outcomeNo || 'No'}
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
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Categories</p>
                  {selectedCategoryChips.length > 0
                    ? (
                        <div className={cn(`
                          flex scrollbar-none gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none]
                          [&::-webkit-scrollbar]:hidden
                        `)}
                        >
                          {selectedCategoryChips.map(item => (
                            <span
                              key={item.slug}
                              className={cn(`
                                shrink-0 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground
                              `)}
                            >
                              {item.label}
                            </span>
                          ))}
                        </div>
                      )
                    : (
                        <p className="text-xs text-muted-foreground">No categories selected.</p>
                      )}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFinalPreviewDialogOpen(false)}
              >
                Back to edit
              </Button>
              <Button type="button" onClick={continueFromFinalPreview}>
                Continue to sign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
