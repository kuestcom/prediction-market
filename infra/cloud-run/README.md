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

## Scheduler implementation on Cloud Run

> [!CAUTION]
> If you choose [Supabase mode](../README.md#option-a-supabase-mode-recommended), there is no need to create cloud scheduler since you will being duplicating requests to your sync endpoints.

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
