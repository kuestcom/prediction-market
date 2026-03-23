import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { AllowedMarketCreatorRepository } from '@/lib/db/queries/allowed-market-creators'
import { UserRepository } from '@/lib/db/queries/user'
import { loadEventCreationSignersFromEnv } from '@/lib/event-creation-signers'

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export async function GET() {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const signers = loadEventCreationSignersFromEnv()
    const creatorsResult = await AllowedMarketCreatorRepository.list()
    if (creatorsResult.error || !creatorsResult.data) {
      return NextResponse.json({ error: creatorsResult.error ?? DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const aliasByWallet = new Map(
      creatorsResult.data.map(item => [item.walletAddress.toLowerCase(), item.displayName]),
    )

    return NextResponse.json({
      data: signers.map((signer) => {
        const displayName = aliasByWallet.get(signer.address.toLowerCase()) ?? shortenAddress(signer.address)
        return {
          address: signer.address,
          displayName,
          shortAddress: shortenAddress(signer.address),
        }
      }),
    })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
