# Infra

This folder provides a portable deployment foundation outside Vercel.

## Layout

- `docker/`: production image and local compose profile
- `kubernetes/`: baseline manifests for runtime and ingress
- `terraform/`: reusable runtime modules and production stacks for Kubernetes, Cloud Run, and Fly.io
- `cloud-run/`: Google Cloud Run deployment target and runbooks
- `fly/`: Fly.io deployment target and runbooks
- `scripts/`: shared runtime env and image validation helpers

## Runtime contract

Use these environment variables across all deployment targets:

- `SITE_URL`: canonical public app URL
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL` (`POSTGRES_URL_NON_POOLING` recommended for `db:push`)
- `CRON_SECRET`: shared secret for `/api/sync/*` routes
- `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID`, and Kuest API credentials

On Vercel, some Supabase/DB variables may be auto-injected by integrations. On Kubernetes/Terraform/self-hosted, you must define them explicitly.

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

- `infra/terraform/environments/production/cloud-run` (declarative Cloud Run deployment via `hashicorp/google`)
- `infra/terraform/environments/production/fly` (orchestrates `infra/fly` scripts)

See `infra/terraform/README.md` for full target-specific instructions.

### Cloud Run

```bash
PROJECT_ID=<gcp-project> ENV_FILE=.env ./infra/cloud-run/sync-secrets.sh
PROJECT_ID=<gcp-project> REGION=us-central1 IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<digest> ENV_FILE=.env ./infra/cloud-run/deploy.sh
```

Dry-run:

```bash
PROJECT_ID=<gcp-project> ENV_FILE=.env ./infra/cloud-run/sync-secrets.sh --dry-run
PROJECT_ID=<gcp-project> REGION=us-central1 IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<digest> ENV_FILE=.env ./infra/cloud-run/deploy.sh --dry-run
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

Dry-run:

```bash
FLY_APP=<fly-app-name> ENV_FILE=.env ./infra/fly/sync-secrets.sh --dry-run
FLY_APP=<fly-app-name> IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<digest> ENV_FILE=.env ./infra/fly/deploy.sh --dry-run
```

Rollback (redeploy previous digest):

```bash
FLY_APP=<fly-app-name> IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<previous-digest> ENV_FILE=.env ./infra/fly/deploy.sh
```

## Scheduler note

Sync scheduling remains managed by Supabase/pg_cron via `npm run db:push` (`scripts/migrate.js`).
Kubernetes, Terraform, Cloud Run, and Fly.io do not create scheduler jobs in this phase.
`SITE_URL` must point to the canonical public endpoint used by Supabase callbacks (`/api/sync/*`).
