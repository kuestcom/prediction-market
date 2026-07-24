'use client'

import type { RefObject } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { encodeFunctionData, erc20Abi, getAddress, isAddress } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { useAppKit } from '@/hooks/useAppKit'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { COLLATERAL_TOKEN_ADDRESS } from '@/lib/contracts'
import { DEFAULT_CHAIN_ID } from '@/lib/network'
import { isUserRejectedRequestError } from '@/lib/wallet'

const SUPPORT_ORIGIN = 'https://chat.kuest.com'
const SETTLED_INVOICE_STORAGE_PREFIX = 'kuest.support.settled-invoice:'
const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/

interface SupportInvoice {
  amountMicros: number
  description: string
  id: string
  payerEoa: string
  receiverAddress: string
  status: 'pending' | 'paid'
}

interface AdminSupportInvoicePaymentHandlerProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
  visitorEoa: string | null
}

function parseInvoice(value: unknown): SupportInvoice | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const invoice = value as Record<string, unknown>
  if (
    typeof invoice.id !== 'string'
    || !/^[0-9a-f-]{36}$/i.test(invoice.id)
    || typeof invoice.description !== 'string'
    || !invoice.description.trim()
    || typeof invoice.amountMicros !== 'number'
    || !Number.isSafeInteger(invoice.amountMicros)
    || invoice.amountMicros <= 0
    || typeof invoice.receiverAddress !== 'string'
    || !isAddress(invoice.receiverAddress)
    || typeof invoice.payerEoa !== 'string'
    || !isAddress(invoice.payerEoa)
    || (invoice.status !== 'pending' && invoice.status !== 'paid')
  ) {
    return null
  }

  return {
    amountMicros: invoice.amountMicros,
    description: invoice.description.trim(),
    id: invoice.id,
    payerEoa: getAddress(invoice.payerEoa),
    receiverAddress: getAddress(invoice.receiverAddress),
    status: invoice.status,
  }
}

function readSettledInvoiceTransaction(invoiceId: string) {
  try {
    const transactionHash = window.localStorage.getItem(`${SETTLED_INVOICE_STORAGE_PREFIX}${invoiceId}`)
    return transactionHash && TRANSACTION_HASH_PATTERN.test(transactionHash)
      ? transactionHash
      : null
  }
  catch {
    return null
  }
}

function storeSettledInvoiceTransaction(invoiceId: string, transactionHash: string) {
  try {
    window.localStorage.setItem(
      `${SETTLED_INVOICE_STORAGE_PREFIX}${invoiceId}`,
      transactionHash,
    )
  }
  catch {
    // The in-memory guard still prevents duplicate payment for the current page.
  }
}

export default function AdminSupportInvoicePaymentHandler({
  iframeRef,
  visitorEoa,
}: AdminSupportInvoicePaymentHandlerProps) {
  const t = useExtracted()
  const { open } = useAppKit()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const { address: connectedAddress, isConnected } = useAppKitAccount()
  const { data: walletClient } = useWalletClient()
  const networkClient = usePublicClient({ chainId: DEFAULT_CHAIN_ID })
  const pendingInvoiceIdsRef = useRef(new Set<string>())
  const settledInvoiceTransactionsRef = useRef(new Map<string, string>())

  const postResult = useCallback((payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'kuest-support-invoice-result', ...payload },
      SUPPORT_ORIGIN,
    )
  }, [iframeRef])

  const payInvoice = useCallback(async (invoice: SupportInvoice) => {
    const settledTransaction = settledInvoiceTransactionsRef.current.get(invoice.id)
      ?? readSettledInvoiceTransaction(invoice.id)
    if (settledTransaction) {
      settledInvoiceTransactionsRef.current.set(invoice.id, settledTransaction)
      postResult({ id: invoice.id, txHash: settledTransaction })
      return
    }
    if (pendingInvoiceIdsRef.current.has(invoice.id) || invoice.status === 'paid') {
      return
    }
    if (!visitorEoa || invoice.payerEoa.toLowerCase() !== visitorEoa.toLowerCase()) {
      postResult({
        id: invoice.id,
        error: t({
          id: 'adminSupportInvoices.wrongAdministrator',
          message: 'This invoice belongs to another administrator.',
        }),
      })
      return
    }
    if (
      !isConnected
      || !connectedAddress
      || connectedAddress.toLowerCase() !== visitorEoa.toLowerCase()
    ) {
      try {
        await open()
      }
      catch (error) {
        postResult({
          id: invoice.id,
          error: t({
            id: 'adminSupportInvoices.paymentFailed',
            message: 'The invoice payment could not be completed.',
          }),
        })
        if (!isUserRejectedRequestError(error)) {
          console.error('Failed to open the administrator wallet.', error)
        }
        return
      }
      postResult({
        id: invoice.id,
        error: t({
          id: 'adminSupportInvoices.connectAdministratorWallet',
          message: 'Connect the administrator wallet and click the invoice again.',
        }),
      })
      return
    }
    if (!walletClient || !networkClient) {
      postResult({
        id: invoice.id,
        error: t({
          id: 'adminSupportInvoices.walletNotReady',
          message: 'Wallet is not ready. Please try again.',
        }),
      })
      return
    }

    pendingInvoiceIdsRef.current.add(invoice.id)
    try {
      const txHash = await runWithSignaturePrompt(async () => {
        if (await walletClient.getChainId() !== DEFAULT_CHAIN_ID) {
          await walletClient.switchChain({ id: DEFAULT_CHAIN_ID })
        }
        if (await walletClient.getChainId() !== DEFAULT_CHAIN_ID) {
          throw new Error('Configured network is required.')
        }

        const hash = await walletClient.sendTransaction({
          account: getAddress(connectedAddress),
          to: COLLATERAL_TOKEN_ADDRESS,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [getAddress(invoice.receiverAddress), BigInt(invoice.amountMicros)],
          }),
          value: 0n,
        })
        const receipt = await networkClient.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') {
          throw new Error('USDC transfer reverted.')
        }
        return hash
      }, {
        title: t({
          id: 'adminSupportInvoices.approveTitle',
          message: 'Approve support invoice',
        }),
        description: t({
          id: 'adminSupportInvoices.approveDescription',
          message: 'Pay {amount} USDC for {description}.',
          values: {
            amount: (invoice.amountMicros / 1_000_000).toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
            description: invoice.description,
          },
        }),
      })

      settledInvoiceTransactionsRef.current.set(invoice.id, txHash)
      storeSettledInvoiceTransaction(invoice.id, txHash)
      postResult({ id: invoice.id, txHash })
    }
    catch (error) {
      const errorMessage = isUserRejectedRequestError(error)
        ? t({
            id: 'adminSupportInvoices.transactionRejected',
            message: 'You rejected the transaction.',
          })
        : t({
            id: 'adminSupportInvoices.paymentFailed',
            message: 'The invoice payment could not be completed.',
          })
      postResult({ id: invoice.id, error: errorMessage })
      if (!isUserRejectedRequestError(error)) {
        console.error('Failed to pay Kuest Support invoice.', error)
      }
    }
    finally {
      pendingInvoiceIdsRef.current.delete(invoice.id)
    }
  }, [
    connectedAddress,
    isConnected,
    open,
    networkClient,
    postResult,
    runWithSignaturePrompt,
    t,
    visitorEoa,
    walletClient,
  ])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        event.origin !== SUPPORT_ORIGIN
        || event.source !== iframeRef.current?.contentWindow
        || !event.data
        || event.data.type !== 'kuest-support-invoice-request'
      ) {
        return
      }

      const invoice = parseInvoice(event.data.invoice)
      if (invoice) {
        void payInvoice(invoice)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [iframeRef, payInvoice])

  useEffect(() => {
    function handleConfirmation(event: MessageEvent) {
      if (
        event.origin === SUPPORT_ORIGIN
        && event.source === iframeRef.current?.contentWindow
        && event.data?.type === 'kuest-support-invoice-confirmed'
      ) {
        toast.success(t({
          id: 'adminSupportInvoices.paymentSucceeded',
          message: 'Support invoice paid successfully.',
        }))
      }
    }

    window.addEventListener('message', handleConfirmation)
    return () => window.removeEventListener('message', handleConfirmation)
  }, [iframeRef, t])

  return null
}
