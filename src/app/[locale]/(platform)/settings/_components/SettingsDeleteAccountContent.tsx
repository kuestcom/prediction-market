'use client'

import type { User } from '@/types'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useAccount, useSignMessage, useSignTypedData } from 'wagmi'
import { deleteAccountAction, deleteRelayerUserDataAction } from '@/app/[locale]/(platform)/settings/_actions/delete-account'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { useAppKit } from '@/hooks/useAppKit'
import { useIsMobile } from '@/hooks/useIsMobile'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import {
  clearCommunityAuth,
  ensureCommunityToken,
  parseCommunityError,
} from '@/lib/community-auth'
import {
  deleteCommunityProfileData,
  requestCommunityProfileDeleteNonce,
} from '@/lib/community-profile'
import { signOutAndRedirect } from '@/lib/logout'
import {
  buildTradingAuthMessage,
  getTradingAuthDomain,
  TRADING_AUTH_PRIMARY_TYPE,
  TRADING_AUTH_TYPES,
} from '@/lib/trading-auth/client'
import { isUserRejectedRequestError, normalizeAddress } from '@/lib/wallet'

function useDeleteAccountState() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [shouldResumeDeleteAfterWalletConnection, setShouldResumeDeleteAfterWalletConnection] = useState(false)
  const [isPending, startTransition] = useTransition()
  return {
    isDialogOpen,
    setIsDialogOpen,
    error,
    setError,
    deleteConfirmation,
    setDeleteConfirmation,
    shouldResumeDeleteAfterWalletConnection,
    setShouldResumeDeleteAfterWalletConnection,
    isPending,
    startTransition,
  }
}

export default function SettingsDeleteAccountContent({ user }: { user: User }) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const account = useAccount()
  const { open: openAppKit, isReady: isAppKitReady } = useAppKit()
  const { signMessageAsync } = useSignMessage()
  const { signTypedDataAsync } = useSignTypedData()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const { communityUrl } = usePublicRuntimeConfig()
  const {
    isDialogOpen,
    setIsDialogOpen,
    error,
    setError,
    deleteConfirmation,
    setDeleteConfirmation,
    shouldResumeDeleteAfterWalletConnection,
    setShouldResumeDeleteAfterWalletConnection,
    isPending,
    startTransition,
  } = useDeleteAccountState()
  const isDeleteConfirmed = deleteConfirmation === 'DELETE'
  const normalizedConnectedAddress = normalizeAddress(account.address)
  const normalizedUserAddress = normalizeAddress(user.address)
  const linkedWalletAddress = normalizedConnectedAddress && normalizedUserAddress && normalizedConnectedAddress.toLowerCase() === normalizedUserAddress.toLowerCase()
    ? normalizedConnectedAddress
    : null

  function handleDialogOpenChange(nextOpen: boolean) {
    if (isPending) {
      return
    }
    setIsDialogOpen(nextOpen)
    if (!nextOpen) {
      setDeleteConfirmation('')
      setShouldResumeDeleteAfterWalletConnection(false)
    }
  }

  const requestLinkedWallet = useCallback(() => {
    if (isAppKitReady) {
      setShouldResumeDeleteAfterWalletConnection(true)
      void openAppKit().catch(() => {
        setShouldResumeDeleteAfterWalletConnection(false)
        toast.error(t('Wallet connection is not ready. Please try again.'))
      })
    }
    else {
      toast.error(t('Wallet connection is not ready. Please try again.'))
    }
  }, [isAppKitReady, openAppKit, setShouldResumeDeleteAfterWalletConnection, t])

  const deleteCommunityData = useCallback(async (address: `0x${string}`) => {
    const token = await ensureCommunityToken({
      address,
      signMessageAsync: args => runWithSignaturePrompt(
        () => signMessageAsync(args),
        {
          title: t('Delete account'),
          description: t('Open your wallet and approve the signature to continue.'),
        },
      ),
      communityApiUrl: communityUrl,
      depositWalletAddress: user.deposit_wallet_address ?? null,
      forceRefresh: true,
    })

    const noncePayload = await requestCommunityProfileDeleteNonce({
      communityApiUrl: communityUrl,
      token,
    })
    const signature = await runWithSignaturePrompt(
      () => signMessageAsync({ message: noncePayload.message }),
      {
        title: t('Delete account'),
        description: t('Open your wallet and approve the signature to continue.'),
      },
    )
    const response = await deleteCommunityProfileData({
      communityApiUrl: communityUrl,
      token,
      signature,
    })

    if (response.status === 401) {
      clearCommunityAuth()
    }
    if (!response.ok) {
      throw new Error(await parseCommunityError(response, t('Failed to delete account. Please try again.')))
    }

    clearCommunityAuth()
  }, [communityUrl, runWithSignaturePrompt, signMessageAsync, t, user.deposit_wallet_address])

  const deleteRelayerData = useCallback(async (address: `0x${string}`) => {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = Date.now().toString()
    const message = buildTradingAuthMessage({
      address,
      timestamp,
      nonce,
    })
    const signature = await runWithSignaturePrompt(
      () => signTypedDataAsync({
        domain: getTradingAuthDomain(),
        types: TRADING_AUTH_TYPES,
        primaryType: TRADING_AUTH_PRIMARY_TYPE,
        message,
      }),
      {
        title: t('Delete account'),
        description: t('Open your wallet and approve the signature to continue.'),
      },
    )
    const result = await deleteRelayerUserDataAction({
      address,
      signature,
      timestamp,
      nonce,
    })

    if (result.error) {
      throw new Error(result.error)
    }
  }, [runWithSignaturePrompt, signTypedDataAsync, t])

  const runDeleteAccount = useCallback((address: `0x${string}`) => {
    setShouldResumeDeleteAfterWalletConnection(false)
    startTransition(async () => {
      try {
        await deleteCommunityData(address)
        await deleteRelayerData(address)

        const result = await deleteAccountAction()

        if (result.error) {
          setError(result.error)
          toast.error(result.error)
          return
        }

        await signOutAndRedirect({
          currentPathname: window.location.pathname,
        })
      }
      catch (caughtError) {
        const errorMessage = isUserRejectedRequestError(caughtError)
          ? t('Signature was rejected in your wallet.')
          : t('Failed to delete account. Please try again.')
        setError(errorMessage)
        toast.error(errorMessage)
      }
    })
  }, [deleteCommunityData, deleteRelayerData, setError, setShouldResumeDeleteAfterWalletConnection, startTransition, t])

  useEffect(function resumeDeleteAfterWalletConnection() {
    const resumedWalletAddress = shouldResumeDeleteAfterWalletConnection && isDialogOpen && isDeleteConfirmed && !isPending
      ? linkedWalletAddress
      : null
    void (resumedWalletAddress && runDeleteAccount(resumedWalletAddress))
  }, [isDeleteConfirmed, isDialogOpen, isPending, linkedWalletAddress, runDeleteAccount, shouldResumeDeleteAfterWalletConnection])

  function handleDeleteAccount() {
    setError(null)

    if (!linkedWalletAddress) {
      requestLinkedWallet()
      return
    }

    runDeleteAccount(linkedWalletAddress)
  }

  return (
    <>
      <section className="grid gap-4 rounded-lg border border-destructive/30 p-6">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{t('Delete account')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('Permanently delete your account. This action cannot be undone.')}
          </p>
        </div>

        {error && <InputError message={error} />}

        <div className="ms-auto">
          <Button
            type="button"
            variant="destructive"
            className="bg-destructive hover:bg-destructive"
            onClick={() => {
              setDeleteConfirmation('')
              setShouldResumeDeleteAfterWalletConnection(false)
              setIsDialogOpen(true)
            }}
            disabled={isPending}
          >
            {t('Delete account')}
          </Button>
        </div>
      </section>

      {isMobile
        ? (
            <Drawer open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
                <div className="space-y-6">
                  <DrawerHeader className="space-y-3 text-center">
                    <DrawerTitle className="text-2xl font-bold">
                      {t('Are you sure?')}
                    </DrawerTitle>
                    <DrawerDescription className="text-sm text-muted-foreground">
                      {t('This will permanently delete your account. All your data will be removed and you will be logged out of all devices. This action cannot be undone.')}
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="space-y-2 px-4">
                    <p className="text-sm text-muted-foreground">{t('Type DELETE to confirm')}</p>
                    <Input
                      value={deleteConfirmation}
                      onChange={event => setDeleteConfirmation(event.target.value)}
                      placeholder="DELETE"
                      autoComplete="off"
                    />
                  </div>
                  <DrawerFooter className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-background"
                      onClick={() => handleDialogOpenChange(false)}
                      disabled={isPending}
                    >
                      {t('Never mind')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="bg-destructive hover:bg-destructive"
                      onClick={handleDeleteAccount}
                      disabled={isPending || !isDeleteConfirmed}
                    >
                      {isPending ? t('Deleting...') : t('Confirm')}
                    </Button>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
          )
        : (
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogContent className="bg-background sm:max-w-sm sm:p-8">
                <div className="space-y-6">
                  <DialogHeader className="space-y-3">
                    <DialogTitle className="text-center text-2xl font-bold">
                      {t('Are you sure?')}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      {t('This will permanently delete your account. All your data will be removed and you will be logged out of all devices. This action cannot be undone.')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{t('Type DELETE to confirm')}</p>
                    <Input
                      value={deleteConfirmation}
                      onChange={event => setDeleteConfirmation(event.target.value)}
                      placeholder="DELETE"
                      autoComplete="off"
                    />
                  </div>
                  <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-background sm:w-36"
                      onClick={() => handleDialogOpenChange(false)}
                      disabled={isPending}
                    >
                      {t('Never mind')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="bg-destructive hover:bg-destructive sm:w-36"
                      onClick={handleDeleteAccount}
                      disabled={isPending || !isDeleteConfirmed}
                    >
                      {isPending ? t('Deleting...') : t('Confirm')}
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          )}
    </>
  )
}
