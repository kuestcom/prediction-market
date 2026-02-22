# DigitalOcean

Deploy target for DigitalOcean (Droplet or App Platform).

## Prerequisites

1. DigitalOcean account with billing enabled.
2. Access to this repository.
3. [Configure Environment Variables](../../README.md#quick-start-15-minutes).
4. Choose between Supabase vs Postgres+S3 and [set the required env variables](../README.md#storage-options)

## Deployment options

<details>
<summary><strong>Option A (click to expand): VPS (Droplets)</strong></summary>

Use the VPS manual installation guide:

- [VPS deployment guide](../vps/README.md)

</details>

<details>
<summary><strong>Option B (click to expand): App Platform</strong></summary>

### 1) Create project

1. Open DigitalOcean dashboard.
2. Go to `Projects`.
3. Click `Create Project`.

### 2) Create app from GitHub

1. Open `Apps`.
2. Click `Create App`.
3. Choose `GitHub`.
4. Select repository `<your-username>/prediction-market`.
5. Select production branch (`main`).

### 3) Configure service build

Set component as:

- Type: `Web Service`
- Source type: `Dockerfile`
- Dockerfile path: `infra/docker/Dockerfile`
- Build context: `.`
- HTTP port: `3000`

### 4) Configure environment variables

Set environment variables in App Platform from:

- [Configure Environment Variables](../../README.md#quick-start-15-minutes)
- [Storage options](../README.md#storage-options)

In DigitalOcean App Platform, mark secrets as encrypted.

### 5) Create resources and validate

1. Click `Create Resources`.
2. Wait for build/deploy.
3. Validate the main route.

### 6) Configure custom domain

1. Open app `Settings` > `Domains`.
2. Add your domain.
3. Follow DNS instructions.
4. Set `SITE_URL` to the final HTTPS domain.

### 7) Scheduler implementation

> [!CAUTION]
> If you choose [Supabase mode](../README.md#option-a-supabase-mode), there is no need to create external scheduler jobs since you will be duplicating requests to your sync endpoints.

App Platform web deploy does not replace the sync scheduler requirement.

Use an external scheduler implementing `infra/scheduler-contract.md` when needed.

Common options:

- GitHub Actions schedule
- Google Cloud Scheduler
- Any managed cron service that supports custom headers

### 8) Optional: Terraform for App Platform

```bash
export DIGITALOCEAN_TOKEN=<your-token>
cd infra/terraform/environments/production/digital-ocean
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

### 9) Rollback

1. Open app `Deployments`.
2. Select previous healthy deployment.
3. Click `Rollback`.

</details>

## Migration operations

Run with production env loaded:

```bash
npm run db:push
```

## Notes

- `SITE_URL` must be your canonical public URL.
