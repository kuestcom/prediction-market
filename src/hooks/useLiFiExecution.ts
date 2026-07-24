import type { EIP1193Provider } from 'viem'
import type { LiFiWalletTokenItem } from '@/hooks/useLiFiWalletTokens'
import type { LiFiWalletProvider } from '@/lib/lifi-wallet-chain'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { createPublicClient, createWalletClient, custom, encodeFunctionData, erc20Abi, parseUnits } from 'viem'
import { useAccount } from 'wagmi'
import { ZERO_ADDRESS } from '@/lib/contracts'
import { sanitizeLiFiAmount } from '@/lib/lifi-amount'
import { waitForLiFiTransfer } from '@/lib/lifi-transfer'
import { ensureLiFiWalletChain } from '@/lib/lifi-wallet-chain'
import { DEFAULT_CHAIN_ID } from '@/lib/network'

interface UseLiFiExecutionParams {
  fromToken?: LiFiWalletTokenItem | null
  amountValue: string
  fromAddress?: string | null
  toAddress?: string | null
}

export function useLiFiExecution({
  fromToken,
  amountValue,
  fromAddress,
  toAddress,
}: UseLiFiExecutionParams) {
  const { address: connectedAddress, connector } = useAccount()
  const [executionPhase, setExecutionPhase] = useState<'idle' | 'switching' | 'quoting' | 'approving' | 'submitting' | 'settling'>('idle')
  const executionAbortControllerRef = useRef<AbortController | null>(null)

  useEffect(function registerExecutionCleanup() {
    return function abortPendingExecution() {
      executionAbortControllerRef.current?.abort()
    }
  }, [])

  const mutation = useMutation({
    mutationFn: async () => {
      const executionAbortController = new AbortController()
      executionAbortControllerRef.current?.abort()
      executionAbortControllerRef.current = executionAbortController

      if (!connector || !connectedAddress) {
        throw new Error('Wallet not connected.')
      }
      if (!fromToken || !fromAddress || !toAddress) {
        throw new Error('Missing token or wallet addresses.')
      }
      if (connectedAddress.toLowerCase() !== fromAddress.toLowerCase()) {
        throw new Error('The connected wallet does not match the deposit source wallet.')
      }

      const sanitizedAmount = sanitizeLiFiAmount(amountValue, fromToken.decimals)
      let fromAmountBigInt: bigint
      try {
        fromAmountBigInt = parseUnits(sanitizedAmount, fromToken.decimals)
      }
      catch {
        throw new Error('Enter a valid amount.')
      }
      if (fromAmountBigInt <= 0n) {
        throw new Error('Enter a valid amount.')
      }

      const rawProvider = await connector.getProvider()
      if (!rawProvider || typeof rawProvider !== 'object' || !('request' in rawProvider)) {
        throw new Error('Wallet provider not available.')
      }
      const provider = rawProvider as EIP1193Provider & LiFiWalletProvider
      setExecutionPhase('switching')
      await ensureLiFiWalletChain(provider, fromToken.chainId, fromToken.chainConfig)

      const walletClient = createWalletClient({
        account: fromAddress as `0x${string}`,
        transport: custom(provider),
      })
      const publicClient = createPublicClient({
        transport: custom(provider),
      })

      setExecutionPhase('quoting')
      const quoteResponse = await fetch('/api/lifi/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fromChainId: fromToken.chainId,
          fromTokenAddress: fromToken.address,
          fromTokenDecimals: fromToken.decimals,
          fromAddress,
          toAddress,
          amount: sanitizedAmount,
        }),
      })

      if (!quoteResponse.ok) {
        throw new Error('Failed to fetch LI.FI quote.')
      }

      const quoteJson = await quoteResponse.json()
      const quoteStep = quoteJson?.quote

      if (!quoteStep?.estimate) {
        throw new Error('Invalid LI.FI quote response.')
      }

      const approvalAddress = quoteStep.estimate?.approvalAddress
      const requiresApproval = Boolean(
        approvalAddress
        && fromToken.address.toLowerCase() !== ZERO_ADDRESS.toLowerCase()
        && approvalAddress.toLowerCase() !== ZERO_ADDRESS.toLowerCase(),
      )
      let approvalSubmitted = false

      if (requiresApproval) {
        const allowance = await publicClient.readContract({
          address: fromToken.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [fromAddress as `0x${string}`, approvalAddress as `0x${string}`],
        })

        if (allowance < fromAmountBigInt) {
          setExecutionPhase('approving')
          const approveHash = await walletClient.sendTransaction({
            account: fromAddress as `0x${string}`,
            chain: null,
            to: fromToken.address as `0x${string}`,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [approvalAddress as `0x${string}`, fromAmountBigInt],
            }),
            value: 0n,
          })

          const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash })
          if (approvalReceipt.status !== 'success') {
            throw new Error('Token approval reverted.')
          }
          approvalSubmitted = true
        }
      }

      let stepWithTx = quoteStep
      if (approvalSubmitted || !stepWithTx.transactionRequest?.to) {
        const stepResponse = await fetch('/api/lifi/step-transaction', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ step: quoteStep }),
        })

        if (!stepResponse.ok) {
          throw new Error('Failed to prepare LI.FI transaction.')
        }

        const stepJson = await stepResponse.json()
        stepWithTx = stepJson?.step
      }

      const tx = stepWithTx?.transactionRequest

      if (!tx?.to) {
        throw new Error('No transaction request returned by LI.FI.')
      }

      const transactionChainId = Number(tx.chainId)
      if (Number.isFinite(transactionChainId) && transactionChainId !== fromToken.chainId) {
        throw new Error('LI.FI returned a transaction for the wrong source chain.')
      }

      setExecutionPhase('submitting')
      const hash = await walletClient.sendTransaction({
        account: fromAddress as `0x${string}`,
        chain: null,
        to: tx.to as `0x${string}`,
        data: (tx.data ?? '0x') as `0x${string}`,
        value: tx.value ? BigInt(tx.value) : 0n,
        gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') {
        throw new Error('LI.FI source transaction reverted.')
      }

      if (fromToken.chainId !== DEFAULT_CHAIN_ID) {
        if (!stepWithTx.tool) {
          throw new Error('LI.FI did not identify the bridge used by this transfer.')
        }

        setExecutionPhase('settling')
        await waitForLiFiTransfer({
          txHash: hash,
          fromChainId: fromToken.chainId,
          toChainId: DEFAULT_CHAIN_ID,
          bridge: stepWithTx.tool,
          fromAddress,
          transactionId: stepWithTx.transactionId,
        }, {
          signal: executionAbortController.signal,
        })
      }

      return hash
    },
    onSettled: () => {
      setExecutionPhase('idle')
    },
  })

  return {
    execute: mutation.mutateAsync,
    isExecuting: mutation.isPending,
    isAwaitingSettlement: executionPhase === 'settling',
    executionError: mutation.error,
    executionHash: mutation.data,
  }
}
