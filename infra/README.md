# Infra

This folder provides a portable deployment foundation outside Vercel.

## Layout

- `docker/`: production image and local compose profile
- `kubernetes/`: baseline manifests for app deployment and ingress
- `terraform/`: reusable deployment target modules and production stacks for Kubernetes, Cloud Run, Fly.io, and DigitalOcean
- `cloud-run/`: Google Cloud Run deployment target and runbooks
- `fly/`: Fly.io deployment target and runbooks
- `digital-ocean/`: beginner-friendly manual deploy guide for DigitalOcean
- `scripts/`: shared env and image validation helpers

## Environment contract

First, define the base environment variables from [Configure environment variables](../README.md#2-configure-environment-variables-before-deploy).
Then fill `POSTGRES_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` with the values now available in your Supabase project.

Then add these for infra targets:

- `SITE_URL` (required): canonical public app URL
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL` (all treated as secrets in infra targets)

On Vercel, some Supabase/DB variables may be auto-injected by integrations. On Kubernetes/Terraform/self-hosted, you must define them explicitly.

## Supabase setup outside Vercel

If you are deploying outside Vercel, create and configure Supabase manually:

1. Create a Supabase project in the [Supabase Dashboard](https://supabase.com/dashboard/projects).
2. Open your project and copy `SUPABASE_URL` from `Project Settings` > `API` (`Project URL`).
3. In the same `API` page, copy `SUPABASE_SERVICE_ROLE_KEY` (`service_role` key).
4. Copy `POSTGRES_URL` from `Project Settings` > `Database` > connection string (URI format).
5. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `POSTGRES_URL` as secrets in your target platform.
6. With production env loaded, run:

```bash
npm run db:push
```

7. Confirm migrations and cron jobs were applied in Supabase.

Validate required variables:

```bash
ENV_FILE=.env ./infra/scripts/validate-runtime-env.sh --env-file "$ENV_FILE"
```

Use immutable image references in production examples (`@sha256:digest` preferred, explicit version tag acceptable, `:latest` forbidden).

## Quick start

### Docker

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build
```

`NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID` is required at build time and is passed as a Docker build argument.
When using `docker compose` directly with `-f infra/docker/docker-compose.yml`, also pass `--env-file .env`.

### Kubernetes (manifests)

```bash
cp infra/kubernetes/secret.example.yaml infra/kubernetes/secret.yaml
kubectl apply -k infra/kubernetes
```

### Terraform

```bash
cd infra/terraform/environments/production/kubernetes
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

Additional Terraform targets:

- `infra/terraform/environments/production/gke` (creates GKE Autopilot cluster)
- `infra/terraform/environments/production/cloud-run` (declarative Cloud Run deployment via `hashicorp/google`)
- `infra/terraform/environments/production/fly` (orchestrates `infra/fly` scripts)
- `infra/terraform/environments/production/digital-ocean` (DigitalOcean App Platform deploy)

See `infra/terraform/README.md` for full target-specific instructions.

For Kubernetes on GCP, run `production/gke` first to create the cluster, fetch credentials with `gcloud container clusters get-credentials`, then run `production/kubernetes`.

### Cloud Run

```bash
PROJECT_ID=<gcp-project> ENV_FILE=.env ./infra/cloud-run/sync-secrets.sh
PROJECT_ID=<gcp-project> REGION=us-central1 IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<digest> ENV_FILE=.env ./infra/cloud-run/deploy.sh
```

Rollback (redeploy previous digest):

```bash
PROJECT_ID=<gcp-project> REGION=us-central1 IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<previous-digest> ENV_FILE=.env ./infra/cloud-run/deploy.sh
```

### Fly.io

```bash
FLY_APP=<fly-app-name> ENV_FILE=.env ./infra/fly/sync-secrets.sh
FLY_APP=<fly-app-name> IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<digest> ENV_FILE=.env ./infra/fly/deploy.sh
```

Rollback (redeploy previous digest):

```bash
FLY_APP=<fly-app-name> IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<previous-digest> ENV_FILE=.env ./infra/fly/deploy.sh
```

### DigitalOcean (manual)

See step-by-step guide for beginners:

```bash
cat infra/digital-ocean/README.md
```
