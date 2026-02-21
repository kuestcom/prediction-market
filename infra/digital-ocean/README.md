# DigitalOcean

Manual deployment guide for DigitalOcean App Platform.

See shared docs first:

- `infra/README.md`
- `infra/scheduler-contract.md`

## Prerequisites

1. DigitalOcean account with billing enabled.
2. Access to this repository.
3. Production `.env` values.

## Storage option notes

Current examples in this folder are Supabase-first.

If running Postgres+S3 mode, adjust environment variable sets manually in App Platform.

## 1) Create a DigitalOcean project

1. Open DigitalOcean dashboard.
2. Go to `Projects`.
3. Click `Create Project`.

## 2) Create an App Platform app from GitHub

1. Open `Apps`.
2. Click `Create App`.
3. Choose `GitHub`.
4. Select repository `<your-username>/prediction-market`.
5. Select production branch (`main`).

## 3) Configure build settings

Set component as:

- Type: `Web Service`
- Source type: `Dockerfile`
- Dockerfile path: `infra/docker/Dockerfile`
- Build context: `.`
- HTTP port: `3000`

## 4) Configure environment variables

At minimum:

- `SITE_URL`
- `NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID`
- `CRON_SECRET`
- `BETTER_AUTH_SECRET`
- `POSTGRES_URL`
- `ADMIN_WALLETS`
- `KUEST_ADDRESS`
- `KUEST_API_KEY`
- `KUEST_API_SECRET`
- `KUEST_PASSPHRASE`

If Supabase mode:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

If Postgres+S3 mode:

- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- Optional: `S3_ENDPOINT`, `S3_REGION`, `S3_PUBLIC_URL`, `S3_FORCE_PATH_STYLE`

## 5) Deploy

1. Click `Create Resources`.
2. Wait for build/deploy.
3. Validate app home route.

## 6) Configure custom domain

1. Open app `Settings` > `Domains`.
2. Add your domain.
3. Follow DNS instructions.
4. Set `SITE_URL` to the final HTTPS domain.

## 7) Scheduler implementation on DigitalOcean

App Platform web service deploy does not replace the sync scheduler requirement.

Use one of:

1. Supabase `pg_cron` (Supabase mode only), or
2. External scheduler implementing `infra/scheduler-contract.md`

Recommended external options:

- GitHub Actions schedule
- Cloud Scheduler
- Any cron service with custom HTTP headers

## 8) Migration operations

Run with production env loaded:

```bash
npm run db:push
```

## 9) Rollback

1. Open app `Deployments`.
2. Select previous healthy deployment.
3. Click `Rollback`.

## Optional: Terraform deploy for App Platform

```bash
export DIGITALOCEAN_TOKEN=<your-token>
cd infra/terraform/environments/production/digital-ocean
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```
