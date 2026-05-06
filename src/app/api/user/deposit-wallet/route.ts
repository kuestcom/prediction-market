import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { UserRepository } from '@/lib/db/queries/user'
import { users } from '@/lib/db/schema/auth/tables'
import { isDepositWalletDeployed } from '@/lib/deposit-wallet'
import { db } from '@/lib/drizzle'

export async function GET() {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const depositWalletAddress = user.deposit_wallet_address ?? null
  let depositWalletStatus = user.deposit_wallet_status ?? null

  if (depositWalletAddress) {
    const deployed = await isDepositWalletDeployed(depositWalletAddress as `0x${string}`)
    if (deployed && depositWalletStatus !== 'deployed') {
      await db
        .update(users)
        .set({ deposit_wallet_status: 'deployed', deposit_wallet_tx_hash: null })
        .where(eq(users.id, user.id))
      depositWalletStatus = 'deployed'
    }
    else if (!deployed && depositWalletStatus === 'deployed') {
      await db
        .update(users)
        .set({ deposit_wallet_status: 'deploying' })
        .where(eq(users.id, user.id))
      depositWalletStatus = 'deploying'
    }
  }

  return NextResponse.json({
    deposit_wallet_address: depositWalletAddress,
    deposit_wallet_signature: user.deposit_wallet_signature ?? null,
    deposit_wallet_signed_at: user.deposit_wallet_signed_at ?? null,
    deposit_wallet_status: depositWalletStatus,
    deposit_wallet_tx_hash: user.deposit_wallet_tx_hash ?? null,
  })
}
