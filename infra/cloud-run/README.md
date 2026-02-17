# Cloud Run target

This target deploys the existing production image to Google Cloud Run and keeps runtime configuration aligned with the shared infra contract.

## Required tooling

- `gcloud` CLI authenticated to your project
- Access to Google Secret Manager and Cloud Run APIs

## Environment contract

Use the shared validator before deploy:

```bash
ENV_FILE=.env ./infra/scripts/validate-runtime-env.sh --env-file "$ENV_FILE"
```

Required vars are listed in `infra/scripts/required-runtime-env.txt`.

## 1) Sync secrets to Secret Manager

```bash
PROJECT_ID=<gcp-project> ENV_FILE=.env ./infra/cloud-run/sync-secrets.sh
```

Dry-run:

```bash
PROJECT_ID=<gcp-project> ENV_FILE=.env ./infra/cloud-run/sync-secrets.sh --dry-run
```

## 2) Deploy service

Use an immutable image reference (digest preferred):

```bash
PROJECT_ID=<gcp-project> \
REGION=us-central1 \
IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<digest> \
ENV_FILE=.env \
./infra/cloud-run/deploy.sh
```

Dry-run:

```bash
PROJECT_ID=<gcp-project> \
REGION=us-central1 \
IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<digest> \
ENV_FILE=.env \
./infra/cloud-run/deploy.sh --dry-run
```

## 3) Build + deploy with Cloud Build

`infra/cloud-run/cloudbuild.yaml` builds from `infra/docker/Dockerfile`, pushes to Artifact Registry, and deploys to Cloud Run.

```bash
gcloud builds submit \
  --config infra/cloud-run/cloudbuild.yaml \
  --substitutions _SERVICE=kuest-web,_REGION=us-central1,_AR_REGION=us-central1,_AR_REPOSITORY=kuest,_IMAGE_NAME=prediction-market,_SITE_URL=https://markets.example.com,_NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID=replace-me
```

Before running this pipeline:
- ensure Artifact Registry repo `<ar-region>-docker.pkg.dev/<project-id>/<repository>` exists
- sync required runtime secrets with `infra/cloud-run/sync-secrets.sh`

## 4) Deploy via Dashboard + GitHub (no CLI)

Use Cloud Build Triggers to deploy automatically from GitHub commits.

### One-time setup in Google Cloud Console

1. Open `Cloud Build` > `Triggers` > `Create trigger`.
2. Connect your GitHub repository (via GitHub App integration if not connected yet).
3. Configure trigger:
   - Event: push to branch (for example `main`)
   - Configuration type: `Cloud Build configuration file (yaml/json)`
   - Cloud Build config file location: `infra/cloud-run/cloudbuild.yaml`
4. In trigger substitutions, set at least:
   - `_SERVICE`
   - `_REGION`
   - `_AR_REGION`
   - `_AR_REPOSITORY`
   - `_IMAGE_NAME`
   - `_SITE_URL`
   - `_NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID`
5. Save trigger.

### Deploy from the dashboard

1. Open `Cloud Build` > `Triggers`.
2. Click `Run` on the trigger.
3. Track progress in `Build history`.
4. Confirm new revision in `Cloud Run` > your service.

### Notes for dashboard workflow

- Secrets are still read from Secret Manager during deploy, so run `infra/cloud-run/sync-secrets.sh` whenever secret values change.
- `SUPABASE_URL` is resolved from Secret Manager (not from Cloud Build substitutions).
- Keep production substitutions pinned to your canonical production values (especially `_SITE_URL`).

## Rollback

Redeploy the previous image digest:

```bash
PROJECT_ID=<gcp-project> \
REGION=us-central1 \
IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<previous-digest> \
ENV_FILE=.env \
./infra/cloud-run/deploy.sh
```

## Notes

- `infra/cloud-run/service.template.yaml` is a reference manifest for teams that prefer YAML-based Cloud Run management.
- Keep `SITE_URL` set to the canonical public URL used by Supabase `pg_cron` callbacks (`/api/sync/*`).
- Terraform workflow is available at `infra/terraform/environments/production/cloud-run`.
