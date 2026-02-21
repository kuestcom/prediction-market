# Scheduler Contract

This document defines the single scheduler contract used by all non-Vercel targets.

Use this contract whether you run Supabase or Postgres+S3.

## Why this exists

- Avoid per-platform drift in job behavior.
- Keep sync behavior consistent across Cloud Run, Fly.io, DigitalOcean, and Kubernetes.
- Allow replacing scheduler backends without changing app code.

## Auth and request format

- Method: `GET`
- Header: `Authorization: Bearer <CRON_SECRET>`
- Base URL: `SITE_URL`
- Endpoints:
  - `/api/sync/events`
  - `/api/sync/resolution`
  - `/api/sync/translations`
  - `/api/sync/volume`

Example:

```bash
curl -sS -X GET \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${SITE_URL}/api/sync/events"
```

## Canonical schedules

These schedules mirror what `scripts/migrate.js` configures with `pg_cron` in Supabase mode.

| Endpoint | Cron schedule | Notes |
| --- | --- | --- |
| `/api/sync/events` | `1-59/5 * * * *` | Every 5 min (offset by 1 min) |
| `/api/sync/resolution` | `3-59/5 * * * *` | Every 5 min (offset by 3 min) |
| `/api/sync/translations` | `*/10 * * * *` | Every 10 min |
| `/api/sync/volume` | `14,44 * * * *` | Every 30 min (minute 14 and 44) |

Use UTC unless your operations team has a strict local-time requirement.

## Runtime behavior and concurrency

- Always set scheduler concurrency to non-overlapping if your platform supports it.
- `events` and `resolution` have DB lock protection and may return `409` when a run is already in progress.
- Treat each endpoint as idempotent operationally, but do not intentionally run duplicate schedulers.
- Pick one scheduler backend for these endpoints:
  - Supabase `pg_cron`, or
  - platform/external scheduler

Do not run both at the same time unless you explicitly accept duplicated invocations.

## Expected status codes

- `200`: accepted/completed
- `401`: missing/invalid `CRON_SECRET`
- `409`: sync already running (expected occasionally for locked routes)
- `500`: runtime failure (investigate app logs)

## Health checklist

1. Trigger each endpoint once with `curl`.
2. Confirm `401` when using an invalid token.
3. Confirm scheduler history has no persistent failures.
4. Confirm app logs show periodic successful runs.
