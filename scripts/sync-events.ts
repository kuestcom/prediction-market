import { runCronRequest } from './cron-request'

await runCronRequest('/api/sync/events')
