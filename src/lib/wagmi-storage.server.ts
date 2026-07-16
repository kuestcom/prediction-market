import { cookies } from 'next/headers'
import { WAGMI_STATE_COOKIE_NAME } from '@/lib/wagmi-storage'
import 'server-only'

export async function getWagmiStateCookieValue() {
  return (await cookies()).get(WAGMI_STATE_COOKIE_NAME)?.value ?? null
}
