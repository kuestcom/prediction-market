import { runCronRequest } from './cron-request.ts'

try {
  await runCronRequest('/api/sync/events')
}
catch (error) {
  console.error('Error syncing events:', error)
  process.exit(1)
}
