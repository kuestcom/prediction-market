import { runCronRequest } from './cron-request'

await runCronRequest('/api/sync/event-creations/enqueue', {
  timeoutMilliseconds: 10000,
})
