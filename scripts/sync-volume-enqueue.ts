import { runCronRequest } from './cron-request'

await runCronRequest('/api/sync/volume/enqueue', {
  timeoutMilliseconds: 10000,
})
