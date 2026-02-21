# Cloud Run

Deploy target for Google Cloud Run.

## Prerequisites

1. GCP project with billing enabled.
2. Access to this repository.
3. [Configure Environment Variables](../../README.md#quick-start-15-minutes).
4. `gcloud` installed and authenticated.
5. Required APIs enabled:
   - Cloud Build API
   - Artifact Registry API
   - Cloud Run Admin API
   - Secret Manager API
6. Choose between Supabase vs Postgres+S3 and [set the required env variables](../README.md#storage-options)

## Build and deploy with Cloud Build

[`infra/cloud-run/cloudbuild.yaml`](./cloudbuild.yaml) builds from `infra/docker/Dockerfile`, pushes to Artifact Registry, and deploys to Cloud Run.

### Storage mode and required secrets

Always create these secrets in Secret Manager:

- `POSTGRES_URL`
- `CRON_SECRET`
- `BETTER_AUTH_SECRET`
- `ADMIN_WALLETS`
- `KUEST_ADDRESS`
- `KUEST_API_KEY`
- `KUEST_API_SECRET`
- `KUEST_PASSPHRASE`

Choose one storage profile:

- Supabase mode (`_STORAGE_MODE=supabase`, default):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- S3 mode (`_STORAGE_MODE=s3`):
  - `S3_BUCKET`
  - `S3_ACCESS_KEY_ID`
  - `S3_SECRET_ACCESS_KEY`
  - Optional Cloud Build substitutions for S3 settings:
    - `_S3_ENDPOINT`
    - `_S3_REGION`
    - `_S3_PUBLIC_URL`
    - `_S3_FORCE_PATH_STYLE`

Example (Supabase mode):

```bash
gcloud builds submit --config infra/cloud-run/cloudbuild.yaml \
  --substitutions=_SERVICE=kuest-web,_REGION=us-central1,_SITE_URL=https://markets.example.com,_NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID=replace-me,_STORAGE_MODE=supabase
```

Example (S3 mode):

```bash
gcloud builds submit --config infra/cloud-run/cloudbuild.yaml \
  --substitutions=_SERVICE=kuest-web,_REGION=us-central1,_SITE_URL=https://markets.example.com,_NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID=replace-me,_STORAGE_MODE=s3,_S3_ENDPOINT=https://s3.example.com,_S3_REGION=us-east-1,_S3_FORCE_PATH_STYLE=true
```

## Scheduler implementation on Cloud Run

> [!CAUTION]
> If you choose [Supabase mode](../README.md#option-a-supabase-mode-recommended), there is no need to create Cloud Scheduler jobs since you will be duplicating requests to your sync endpoints.

Use Cloud Scheduler HTTP jobs implementing `infra/scheduler-contract.md`.

Create jobs:

```bash
SITE_URL=https://markets.example.com
CRON_SECRET=replace-me

gcloud scheduler jobs create http kuest-sync-events \
  --location=us-central1 \
  --schedule="1-59/5 * * * *" \
  --uri="${SITE_URL}/api/sync/events" \
  --http-method=GET \
  --headers="Authorization=Bearer ${CRON_SECRET}"

gcloud scheduler jobs create http kuest-sync-resolution \
  --location=us-central1 \
  --schedule="3-59/5 * * * *" \
  --uri="${SITE_URL}/api/sync/resolution" \
  --http-method=GET \
  --headers="Authorization=Bearer ${CRON_SECRET}"

gcloud scheduler jobs create http kuest-sync-translations \
  --location=us-central1 \
  --schedule="*/10 * * * *" \
  --uri="${SITE_URL}/api/sync/translations" \
  --http-method=GET \
  --headers="Authorization=Bearer ${CRON_SECRET}"

gcloud scheduler jobs create http kuest-sync-volume \
  --location=us-central1 \
  --schedule="14,44 * * * *" \
  --uri="${SITE_URL}/api/sync/volume" \
  --http-method=GET \
  --headers="Authorization=Bearer ${CRON_SECRET}"
```

## Optional: Terraform for Cloud Run

```bash
cd infra/terraform/environments/production/cloud-run
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Notes

- `SITE_URL` must be your canonical public URL.
- `infra/cloud-run/service.template.yaml` is a reference YAML manifest.
