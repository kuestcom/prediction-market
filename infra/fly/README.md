# Fly.io target

This target deploys the existing production image to Fly.io with the same runtime env contract used by other non-Vercel targets.

## What you need first

1. A Fly.io account and organization.
2. An existing Fly app (`fly apps create <app-name>`).
3. Access to this GitHub repository.
4. A `.env` file with production values.
5. Supabase already configured for your project (if not, follow [Supabase setup outside Vercel](../README.md#supabase-setup-outside-vercel)).
6. If you plan to use terminal commands directly, `flyctl` installed and authenticated.

First, define base env vars from [Configure environment variables](../../README.md#2-configure-environment-variables-before-deploy).
Then fill `POSTGRES_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` with the values now available in your Supabase project.

You can validate your env locally before deploying:

```bash
ENV_FILE=.env ./infra/scripts/validate-runtime-env.sh --env-file "$ENV_FILE"
```

## 1) Sync runtime variables/secrets

```bash
FLY_APP=<fly-app-name> ENV_FILE=.env ./infra/fly/sync-secrets.sh
```

## 2) Deploy image

Use an immutable image reference (digest preferred):

```bash
FLY_APP=<fly-app-name> \
IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<digest> \
ENV_FILE=.env \
./infra/fly/deploy.sh
```

## Rollback

Redeploy the previous image digest:

```bash
FLY_APP=<fly-app-name> \
IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<previous-digest> \
ENV_FILE=.env \
./infra/fly/deploy.sh
```

## Optional: Terraform deploy for Fly.io

If you prefer managing Fly.io deploys with Terraform:

```bash
cd infra/terraform/environments/production/fly
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Notes

- Base app settings live in `infra/fly/fly.toml`.
- Keep `SITE_URL` set to the canonical public URL used by Supabase `pg_cron` callbacks (`/api/sync/*`).
- Terraform workflow is available at `infra/terraform/environments/production/fly`.
