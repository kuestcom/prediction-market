import type { Address, Hash } from 'viem'
import { NextResponse } from 'next/server'
import { createPublicClient, createWalletClient, getAddress, http, isAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { z } from 'zod'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { AllowedMarketCreatorRepository } from '@/lib/db/queries/allowed-market-creators'
import { UserRepository } from '@/lib/db/queries/user'
import { loadEventCreationSignersFromEnv } from '@/lib/event-creation-signers'
import {
  getServerCreatorProposerWhitelistRegistryAddress,
  normalizeProposerAddressList,
  omitCreatorFromProposerAddressList,
  readCreatorProposerWhitelistStatus,
  readProposerWhitelistError,
  shortenProposerWhitelistAddress,
} from '@/lib/proposer-whitelist'
import {
  CREATOR_PROPOSER_WHITELIST_ABI,
  CREATOR_PROPOSER_WHITELIST_BYTECODE,
  CREATOR_PROPOSER_WHITELIST_REGISTRY_ABI,
} from '@/lib/proposer-whitelist-contracts'
import { sendWithEstimatedFeeRetry } from '@/lib/transaction-fees'
import { defaultViemNetwork, defaultViemRpcUrl } from '@/lib/viem-network'

export const maxDuration = 120

const mutateProposerWhitelistSchema = z.object({
  action: z.enum(['create', 'deploy', 'add', 'remove']),
  creator: z.string().trim().min(1),
  proposers: z.array(z.string().trim().min(1)).default([]),
})

async function requireAdmin() {
  const currentUser = await UserRepository.getCurrentUser({ minimal: true })
  return Boolean(currentUser?.is_admin)
}

function buildSignerMap() {
  return new Map(loadEventCreationSignersFromEnv().map(signer => [signer.address.toLowerCase(), signer]))
}

async function buildCreatorOptions() {
  const creatorsResult = await AllowedMarketCreatorRepository.list()
  if (creatorsResult.error || !creatorsResult.data) {
    throw new Error(creatorsResult.error ?? DEFAULT_ERROR_MESSAGE)
  }

  const signersByAddress = buildSignerMap()
  const creatorsByAddress = new Map<string, {
    address: Address
    displayName: string
    shortAddress: string
    hasServerSigner: boolean
  }>()

  for (const creator of creatorsResult.data) {
    if (!isAddress(creator.walletAddress)) {
      continue
    }
    const address = getAddress(creator.walletAddress) as Address
    creatorsByAddress.set(address.toLowerCase(), {
      address,
      displayName: creator.displayName,
      shortAddress: shortenProposerWhitelistAddress(address),
      hasServerSigner: signersByAddress.has(address.toLowerCase()),
    })
  }

  return [...creatorsByAddress.values()]
}

async function buildStatusResponse(creatorParam: string | null) {
  const registryAddress = getServerCreatorProposerWhitelistRegistryAddress()
  const creators = await buildCreatorOptions()

  if (!creatorParam) {
    return {
      registryAddress,
      creators,
      status: null,
    }
  }

  if (!isAddress(creatorParam)) {
    throw new Error('Invalid creator address.')
  }

  const creator = getAddress(creatorParam) as Address
  const signersByAddress = buildSignerMap()
  const status = await readCreatorProposerWhitelistStatus({
    creator,
    registryAddress,
    hasServerSigner: signersByAddress.has(creator.toLowerCase()),
  })

  return {
    registryAddress,
    creators,
    status,
  }
}

function getServerSigner(creator: Address) {
  const signer = buildSignerMap().get(creator.toLowerCase())
  if (!signer) {
    throw new Error('Selected creator does not have a server signer configured in prediction-market.')
  }
  return privateKeyToAccount(signer.privateKey)
}

function getServerDeployer() {
  const signer = loadEventCreationSignersFromEnv()[0]
  if (!signer) {
    throw new Error('No server signer is configured to deploy proposer whitelist.')
  }
  return privateKeyToAccount(signer.privateKey)
}

async function waitForSuccess(publicClient: ReturnType<typeof createPublicClient>, hash: Hash) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error(`Transaction failed: ${hash}`)
  }
  return receipt
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const creator = new URL(request.url).searchParams.get('creator')
    if (creator && !isAddress(creator)) {
      return NextResponse.json({ error: 'Invalid creator address.' }, { status: 400 })
    }

    return NextResponse.json(await buildStatusResponse(creator))
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE,
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const payload = await request.json().catch(() => null)
    const parsed = mutateProposerWhitelistSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
    }
    if (!isAddress(parsed.data.creator)) {
      return NextResponse.json({ error: 'Invalid creator address.' }, { status: 400 })
    }

    const creator = getAddress(parsed.data.creator) as Address
    let requestedProposers: Address[]
    try {
      requestedProposers = normalizeProposerAddressList(parsed.data.proposers)
    }
    catch (error) {
      return NextResponse.json({ error: readProposerWhitelistError(error) }, { status: 400 })
    }

    if (parsed.data.action !== 'create' && parsed.data.action !== 'deploy' && requestedProposers.length === 0) {
      return NextResponse.json({ error: 'At least one proposer wallet is required.' }, { status: 400 })
    }

    const registryAddress = getServerCreatorProposerWhitelistRegistryAddress()
    const proposers = omitCreatorFromProposerAddressList(creator, requestedProposers)
    if (parsed.data.action !== 'create' && parsed.data.action !== 'deploy' && proposers.length === 0) {
      const currentStatus = await readCreatorProposerWhitelistStatus({
        creator,
        registryAddress,
        hasServerSigner: buildSignerMap().has(creator.toLowerCase()),
      })
      return NextResponse.json({ status: currentStatus, txHashes: [] })
    }

    const account = parsed.data.action === 'deploy'
      ? getServerDeployer()
      : getServerSigner(creator)
    const publicClient = createPublicClient({
      chain: defaultViemNetwork,
      transport: http(defaultViemRpcUrl),
    })
    const walletClient = createWalletClient({
      account,
      chain: defaultViemNetwork,
      transport: http(defaultViemRpcUrl),
    })

    const hasCreatorServerSigner = buildSignerMap().has(creator.toLowerCase())
    const currentStatus = await readCreatorProposerWhitelistStatus({
      creator,
      registryAddress,
      hasServerSigner: parsed.data.action === 'deploy' ? hasCreatorServerSigner : true,
    })
    const txHashes: Hash[] = []
    const chainId = defaultViemNetwork.id

    if (parsed.data.action === 'deploy') {
      if (currentStatus.whitelistAddress) {
        return NextResponse.json({
          whitelistAddress: currentStatus.whitelistAddress,
          txHashes,
        })
      }

      const deployHash = await sendWithEstimatedFeeRetry({
        chainId,
        client: publicClient,
        send: overrides => walletClient.deployContract({
          abi: CREATOR_PROPOSER_WHITELIST_ABI,
          bytecode: CREATOR_PROPOSER_WHITELIST_BYTECODE,
          args: [creator, proposers],
          ...(overrides ?? {}),
        }),
      })
      txHashes.push(deployHash)
      const deployReceipt = await waitForSuccess(publicClient, deployHash)
      const whitelistAddress = deployReceipt.contractAddress
      if (!whitelistAddress || !isAddress(whitelistAddress)) {
        throw new Error('Whitelist deployment did not return a contract address.')
      }

      return NextResponse.json({
        whitelistAddress: getAddress(whitelistAddress) as Address,
        txHashes,
      })
    }

    if (parsed.data.action === 'create') {
      if (!currentStatus.whitelistAddress) {
        const deployHash = await sendWithEstimatedFeeRetry({
          chainId,
          client: publicClient,
          send: overrides => walletClient.deployContract({
            abi: CREATOR_PROPOSER_WHITELIST_ABI,
            bytecode: CREATOR_PROPOSER_WHITELIST_BYTECODE,
            args: [creator, proposers],
            ...(overrides ?? {}),
          }),
        })
        txHashes.push(deployHash)
        const deployReceipt = await waitForSuccess(publicClient, deployHash)
        const whitelistAddress = deployReceipt.contractAddress
        if (!whitelistAddress || !isAddress(whitelistAddress)) {
          throw new Error('Whitelist deployment did not return a contract address.')
        }
        const normalizedWhitelistAddress = getAddress(whitelistAddress) as Address

        const registerHash = await sendWithEstimatedFeeRetry({
          chainId,
          client: publicClient,
          send: overrides => walletClient.writeContract({
            address: registryAddress,
            abi: CREATOR_PROPOSER_WHITELIST_REGISTRY_ABI,
            functionName: 'registerWhitelist',
            args: [normalizedWhitelistAddress],
            ...(overrides ?? {}),
          }),
        })
        txHashes.push(registerHash)
        await waitForSuccess(publicClient, registerHash)
      }
      else if (proposers.length > 0) {
        const existingWhitelistAddress = currentStatus.whitelistAddress
        const addHash = await sendWithEstimatedFeeRetry({
          chainId,
          client: publicClient,
          send: overrides => walletClient.writeContract({
            address: existingWhitelistAddress,
            abi: CREATOR_PROPOSER_WHITELIST_ABI,
            functionName: 'addProposers',
            args: [proposers],
            ...(overrides ?? {}),
          }),
        })
        txHashes.push(addHash)
        await waitForSuccess(publicClient, addHash)
      }
    }
    else {
      if (!currentStatus.whitelistAddress) {
        return NextResponse.json({ error: 'Creator whitelist is not registered yet.' }, { status: 409 })
      }
      const existingWhitelistAddress = currentStatus.whitelistAddress

      const hash = await sendWithEstimatedFeeRetry({
        chainId,
        client: publicClient,
        send: overrides => walletClient.writeContract({
          address: existingWhitelistAddress,
          abi: CREATOR_PROPOSER_WHITELIST_ABI,
          functionName: parsed.data.action === 'add' ? 'addProposers' : 'removeProposers',
          args: [proposers],
          ...(overrides ?? {}),
        }),
      })
      txHashes.push(hash)
      await waitForSuccess(publicClient, hash)
    }

    const status = await readCreatorProposerWhitelistStatus({
      creator,
      registryAddress,
      hasServerSigner: true,
    })

    return NextResponse.json({ status, txHashes })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({
      error: readProposerWhitelistError(error),
    }, { status: 500 })
  }
}
