'use client'

import type { SdkApiKeyActionPayload, SdkApiKeyBundle } from '@/lib/sdk-api-keys'
import {
  CopyIcon,
  KeyRoundIcon,
  Loader2Icon,
  Trash2Icon,
} from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAccount, useSignTypedData } from 'wagmi'
import {
  generateSdkApiKeyAction,
  getNextSdkApiKeyNonceAction,
  revokeSdkApiKeyAction,
} from '@/app/[locale]/(platform)/settings/_actions/sdk-api-keys'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Textarea } from '@/components/ui/textarea'
import { useAppKit } from '@/hooks/useAppKit'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import {
  buildClobSdkEnvBlock,
  buildRelayerBuilderSdkEnvBlock,
  hasSdkApiKeyCredentials,
} from '@/lib/sdk-api-keys'
import {
  buildTradingAuthMessage,
  getTradingAuthDomain,
  TRADING_AUTH_PRIMARY_TYPE,
  TRADING_AUTH_TYPES,
} from '@/lib/trading-auth/client'
import {
  isUserRejectedRequestError,
  isWalletRpcRequestAbortedError,
  normalizeAddress,
} from '@/lib/wallet'

type SdkKeyOperation = 'generate' | 'revoke'

export default function SettingsSdkApiKeysContent() {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const account = useAccount()
  const { open: openAppKit, isReady: isAppKitReady } = useAppKit()
  const { signTypedDataAsync } = useSignTypedData()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const [credentials, setCredentials] = useState<SdkApiKeyBundle | null>(null)
  const [pendingOperation, setPendingOperation] = useState<SdkKeyOperation | null>(null)
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false)
  const normalizedConnectedAddress = normalizeAddress(account.address)
  const isPending = pendingOperation !== null
  const hasCredentials = hasSdkApiKeyCredentials(credentials)

  async function ensureWalletReady() {
    if (!normalizedConnectedAddress) {
      if (isAppKitReady) {
        await openAppKit()
      }
      else {
        toast.error(t('Wallet connection is not ready. Please try again.'))
      }
      return false
    }

    return true
  }

  async function signSdkKeyRequest(nonce: string): Promise<SdkApiKeyActionPayload | null> {
    if (!normalizedConnectedAddress) {
      return null
    }

    const timestamp = Math.floor(Date.now() / 1000).toString()
    const message = buildTradingAuthMessage({
      address: normalizedConnectedAddress,
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
        title: t('Approve SDK key request'),
        description: t('Open your wallet and approve the signature to manage your SDK key.'),
      },
    )

    return {
      address: normalizedConnectedAddress,
      signature,
      timestamp,
      nonce,
    }
  }

  async function handleGenerateKey() {
    const walletReady = await ensureWalletReady()
    if (!walletReady) {
      return
    }
    const connectedAddress = normalizedConnectedAddress
    if (!connectedAddress) {
      return
    }

    setPendingOperation('generate')

    try {
      const nonceResult = await getNextSdkApiKeyNonceAction({ address: connectedAddress })
      if (nonceResult.error || !nonceResult.nonce) {
        toast.error(nonceResult.error ?? t('Unable to manage SDK key. Please try again.'))
        return
      }

      const signedPayload = await signSdkKeyRequest(nonceResult.nonce)
      if (!signedPayload) {
        return
      }

      const result = await generateSdkApiKeyAction(signedPayload)
      if (result.error || !result.data) {
        toast.error(result.error ?? t('Unable to manage SDK key. Please try again.'))
        return
      }

      setCredentials(result.data)
      setCredentialsDialogOpen(true)
      toast.success(t('SDK key generated.'))

      if (result.warning) {
        toast.warning(result.warning)
      }
    }
    catch (caughtError) {
      if (isUserRejectedRequestError(caughtError)) {
        toast.error(t('Signature was rejected in your wallet.'))
      }
      else if (isWalletRpcRequestAbortedError(caughtError)) {
        toast.error(t('Unable to manage SDK key. Please try again.'))
      }
      else {
        toast.error(caughtError instanceof Error ? caughtError.message : t('Unable to manage SDK key. Please try again.'))
      }
    }
    finally {
      setPendingOperation(null)
    }
  }

  async function handleRevokeKey() {
    const walletReady = await ensureWalletReady()
    if (!walletReady) {
      return
    }

    setPendingOperation('revoke')

    try {
      if (!credentials?.nonce) {
        toast.error(t('Unable to revoke SDK key. Please try again.'))
        return
      }

      const signedPayload = await signSdkKeyRequest(credentials.nonce)
      if (!signedPayload) {
        return
      }

      const result = await revokeSdkApiKeyAction(signedPayload)
      if (result.error || !result.data) {
        toast.error(result.error ?? t('Unable to revoke SDK key. Please try again.'))
        return
      }

      setCredentials(null)
      setCredentialsDialogOpen(false)
      toast.success(t('SDK key revoked.'))

      if (result.warning) {
        toast.warning(result.warning)
      }
    }
    catch (caughtError) {
      if (isUserRejectedRequestError(caughtError)) {
        toast.error(t('Signature was rejected in your wallet.'))
      }
      else if (isWalletRpcRequestAbortedError(caughtError)) {
        toast.error(t('Unable to revoke SDK key. Please try again.'))
      }
      else {
        toast.error(caughtError instanceof Error ? caughtError.message : t('Unable to revoke SDK key. Please try again.'))
      }
    }
    finally {
      setPendingOperation(null)
    }
  }

  async function handleCopy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(t('{label} copied.', { label }))
    }
    catch {
      toast.error(t('Unable to copy. Please try again.'))
    }
  }

  function handleCredentialsDialogOpenChange(open: boolean) {
    setCredentialsDialogOpen(open)
    if (!open) {
      setCredentials(null)
    }
  }

  return (
    <>
      <section className="
        mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-lg border bg-background p-4
        sm:flex-row sm:items-center sm:justify-between sm:p-6
        lg:mx-0
      "
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <KeyRoundIcon className="size-5" />
          </div>
          <div className="grid gap-1">
            <h2 className="text-base font-semibold tracking-tight">{t('SDK API key')}</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {t('Generate an API key to authenticate your SDK clients.')}
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          className="w-full sm:w-auto"
          onClick={handleGenerateKey}
          disabled={isPending}
        >
          {pendingOperation === 'generate'
            ? <Loader2Icon className="size-4 animate-spin" />
            : <KeyRoundIcon className="size-4" />}
          {pendingOperation === 'generate' ? t('Generating...') : t('Generate key')}
        </Button>
      </section>

      {isMobile
        ? (
            <Drawer open={credentialsDialogOpen && hasCredentials} onOpenChange={handleCredentialsDialogOpenChange}>
              <DrawerContent className="max-h-[90vh] w-full overflow-y-auto bg-background px-4 pt-4 pb-6">
                <DrawerHeader className="space-y-2 p-0 text-left">
                  <DrawerTitle>{t('SDK API key')}</DrawerTitle>
                  <DrawerDescription>
                    {t('Copy these credentials to your SDK environment.')}
                  </DrawerDescription>
                </DrawerHeader>

                <div className="grid gap-4 py-4">
                  {credentials?.clob && (
                    <CredentialBlock
                      title={t('CLOB')}
                      value={buildClobSdkEnvBlock(credentials.address, credentials.clob)}
                      onCopy={value => handleCopy('CLOB', value)}
                    />
                  )}
                  {credentials?.relayer && (
                    <CredentialBlock
                      title={t('Relayer')}
                      value={buildRelayerBuilderSdkEnvBlock(credentials.relayer)}
                      onCopy={value => handleCopy('Relayer', value)}
                    />
                  )}
                </div>

                <DrawerFooter className="p-0">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleRevokeKey}
                    disabled={isPending}
                  >
                    {pendingOperation === 'revoke'
                      ? <Loader2Icon className="size-4 animate-spin" />
                      : <Trash2Icon className="size-4" />}
                    {t('Revoke')}
                  </Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          )
        : (
            <Dialog open={credentialsDialogOpen && hasCredentials} onOpenChange={handleCredentialsDialogOpenChange}>
              <DialogContent className="bg-background sm:max-w-2xl">
                <DialogHeader className="pr-8">
                  <DialogTitle>{t('SDK API key')}</DialogTitle>
                  <DialogDescription>
                    {t('Copy these credentials to your SDK environment.')}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                  {credentials?.clob && (
                    <CredentialBlock
                      title={t('CLOB')}
                      value={buildClobSdkEnvBlock(credentials.address, credentials.clob)}
                      onCopy={value => handleCopy('CLOB', value)}
                    />
                  )}
                  {credentials?.relayer && (
                    <CredentialBlock
                      title={t('Relayer')}
                      value={buildRelayerBuilderSdkEnvBlock(credentials.relayer)}
                      onCopy={value => handleCopy('Relayer', value)}
                    />
                  )}
                </div>

                <DialogFooter className="sm:justify-start">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleRevokeKey}
                    disabled={isPending}
                  >
                    {pendingOperation === 'revoke'
                      ? <Loader2Icon className="size-4 animate-spin" />
                      : <Trash2Icon className="size-4" />}
                    {t('Revoke')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
    </>
  )
}

function CredentialBlock({
  title,
  value,
  onCopy,
}: {
  title: string
  value: string
  onCopy: (value: string) => void
}) {
  return (
    <div className="grid gap-3 rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onCopy(value)}
          aria-label={`Copy ${title} credentials`}
        >
          <CopyIcon className="size-4" />
        </Button>
      </div>
      <Textarea
        value={value}
        readOnly
        rows={4}
        className="min-h-28 resize-none font-mono text-xs/relaxed"
      />
    </div>
  )
}
