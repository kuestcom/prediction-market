# Fly.io target

Deploy target for Fly.io using the same runtime contract as other non-Vercel targets.

See shared docs first:

- `infra/README.md`
- `infra/scheduler-contract.md`

## Prerequisites

1. Fly.io account and organization.
2. Existing Fly app (`fly apps create <app-name>`).
3. Access to this repository.
4. Production `.env` values.
5. `flyctl` installed and authenticated.

## Storage option notes

Fly helper scripts are still Supabase-first:

- `infra/fly/sync-secrets.sh` currently expects `SUPABASE_*`.

If using Postgres+S3 mode, adapt secret sync/wiring manually.

## Deploy

Sync runtime variables/secrets:

```bash
FLY_APP=<fly-app-name> ENV_FILE=.env ./infra/fly/sync-secrets.sh
```

Deploy immutable image:

```bash
FLY_APP=<fly-app-name> \
IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<digest> \
ENV_FILE=.env \
./infra/fly/deploy.sh
```

Rollback:

```bash
FLY_APP=<fly-app-name> \
IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<previous-digest> \
ENV_FILE=.env \
./infra/fly/deploy.sh
```

## Scheduler implementation on Fly.io

Fly Machines do not provide the scheduler behavior you need for this app out of the box.

Use one of:

1. Supabase `pg_cron` (Supabase mode only), or
2. External scheduler hitting `SITE_URL/api/sync/*` using `infra/scheduler-contract.md`

Recommended external options:

- GitHub Actions scheduled workflow
- Cloud Scheduler
- Any cron service that supports custom HTTP headers

Do not run both Supabase `pg_cron` and external scheduler for the same endpoints unless intentional.

## Optional: Terraform deploy for Fly.io

```bash
cd infra/terraform/environments/production/fly
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Notes

- Base app settings live in `infra/fly/fly.toml`.
- Keep `SITE_URL` set to your canonical public URL.
