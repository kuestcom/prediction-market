import { connection } from 'next/server'
import { Suspense } from 'react'

async function RequestTimeConnection() {
  await connection()
  return null
}

export default function RequestTimeDynamicMarker() {
  return (
    <Suspense>
      <RequestTimeConnection />
    </Suspense>
  )
}
