import type { ClobOrderType, OrderSide } from '@/types'

import { orders } from '@/lib/db/schema/orders/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'

export const OrderRepository = {
  async createOrder(args: {
    // begin blockchain data
    salt: bigint
    maker: string
    signer: string
    taker: string
    token_id: string
    maker_amount: bigint
    taker_amount: bigint
    expiration: bigint
    nonce: bigint
    fee_rate_bps: number
    side: OrderSide
    signature_type: number
    signature: string
    // end blockchain data

    type: ClobOrderType
    user_id: string
    affiliate_user_id: string
    condition_id: string
    clob_order_id: string
  }) {
    return await runQuery(async () => {
      const result = await db.insert(orders).values(args).returning()

      return { data: result[0], error: null }
    })
  },
}
