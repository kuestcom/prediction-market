# Fly.io

Deploy target for Fly.io.

## Prerequisites

1. Fly.io account and organization.
2. Existing Fly app (`fly apps create <app-name>`).
3. Access to this repository.
4. [Configure Environment Variables](../../README.md#quick-start-15-minutes).
5. Choose between Supabase vs Postgres+S3 and [set the required env variables](../README.md#storage-options)
6. `flyctl` installed and authenticated.

## Manual deploy on Fly.io

### 1) Configure runtime variables

Configure app variables/secrets directly in Fly.io (dashboard or `flyctl secrets set`) using:

- [Configure Environment Variables](../../README.md#quick-start-15-minutes)
- [Storage options](../README.md#storage-options)

### 2) Deploy immutable image

```bash
flyctl deploy \
  --app <fly-app-name> \
  --config infra/fly/fly.toml \
  --image ghcr.io/kuestcom/prediction-market@sha256:<digest>
```

### 3) Rollback

Redeploy the previous healthy image digest:

```bash
flyctl deploy \
  --app <fly-app-name> \
  --config infra/fly/fly.toml \
  --image ghcr.io/kuestcom/prediction-market@sha256:<previous-digest>
```

## Scheduler implementation on Fly.io

> [!CAUTION]
> If you choose [Supabase mode](../README.md#option-a-supabase-mode), there is no need to create external scheduler jobs since you will be duplicating requests to your sync endpoints.

Fly deployment does not replace the sync scheduler requirement.

Use an external scheduler implementing `infra/scheduler-contract.md` when needed.

Common options:

- GitHub Actions schedule
- Google Cloud Scheduler
- Any managed cron service with custom headers

## Optional: Terraform for Fly.io

```bash
cd infra/terraform/environments/production/fly
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Notes

- `SITE_URL` must be your canonical public URL.
