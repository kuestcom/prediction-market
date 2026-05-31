export async function runCronRequest(endpointPath: string, options: any = {}) {
  const siteUrl = process.env.SITE_URL?.trim()
  if (!siteUrl) {
    throw new Error('SITE_URL is not set')
  }

  const timeoutMilliseconds = options.timeoutMilliseconds ?? 30000
  const response = await fetch(new URL(endpointPath, siteUrl), {
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
    },
    signal: AbortSignal.timeout(timeoutMilliseconds),
  })

  const body = await response.text()

  console.log(response.status, response.statusText)

  if (body) {
    console.log(body)
  }

  if (!response.ok) {
    process.exit(1)
  }
}
