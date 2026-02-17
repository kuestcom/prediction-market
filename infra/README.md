# Infra

This folder provides a portable deployment foundation outside Vercel.

## Layout

- `docker/`: production image and local compose profile
- `kubernetes/`: baseline manifests for runtime and ingress
- `terraform/`: reusable Kubernetes module and a production stack

## Runtime contract

Use these environment variables across all deployment targets:

- `SITE_URL`: canonical public app URL
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL` (`POSTGRES_URL_NON_POOLING` recommended for `db:push`)
- `CRON_SECRET`: shared secret for `/api/sync/*` routes
- `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID`, and Kuest API credentials

On Vercel, some Supabase/DB variables may be auto-injected by integrations. On Kubernetes/Terraform/self-hosted, you must define them explicitly.

## Quick start

### Docker

```bash
npm run docker:up
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
cd infra/terraform/environments/production
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Scheduler note

Sync scheduling remains managed by Supabase/pg_cron via `npm run db:push` (`scripts/migrate.js`).
Kubernetes and Terraform do not create scheduler jobs in this phase.
