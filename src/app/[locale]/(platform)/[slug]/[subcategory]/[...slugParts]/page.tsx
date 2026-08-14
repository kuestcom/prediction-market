import { notFound } from 'next/navigation'
import { connection } from 'next/server'

export const instant = false

export default async function UnknownPlatformNestedPage() {
  await connection()
  notFound()
}
