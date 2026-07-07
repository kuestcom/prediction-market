import { runCronRequest } from './cron-request.ts'

await runCronRequest('/api/sync/events')
