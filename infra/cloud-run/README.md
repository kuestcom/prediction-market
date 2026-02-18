# Cloud Run

## What you need first

1. A GCP project with billing enabled.
2. Access to this GitHub repository.
3. A `.env` file with production values.
4. Supabase already configured for your project (if not, follow [Supabase setup outside Vercel](../README.md#supabase-setup-outside-vercel)).
5. If you plan to use the terminal workflow, `gcloud` installed and authenticated to your project.

First, define base env vars from [Configure environment variables](../../README.md#2-configure-environment-variables-before-deploy).
Then fill `POSTGRES_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` with the values now available in your Supabase project.

You can validate your env locally before deploying:

```bash
ENV_FILE=.env ./infra/scripts/validate-runtime-env.sh --env-file "$ENV_FILE"
```

## 1) UI workflow (beginner-friendly)

Use this path if you want to deploy only through Google Cloud Console.
Always confirm the selected project in the top bar before each action.

### Step 1: One-time project setup in Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select your target project.
2. Confirm billing is enabled in [Billing > My Projects](https://console.cloud.google.com/billing/projects).
3. Enable required APIs (click `Enable` on each page):
   - [Cloud Build API](https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com)
   - [Artifact Registry API](https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com)
   - [Cloud Run Admin API](https://console.cloud.google.com/apis/library/run.googleapis.com)
   - [Secret Manager API](https://console.cloud.google.com/apis/library/secretmanager.googleapis.com)
4. Open [Artifact Registry repositories](https://console.cloud.google.com/artifacts) and create a Docker repository:
   - Format: `Docker`
   - Region: same region you will use in Cloud Run (example `us-central1`)
   - Name: for example `kuest`

### Step 2: Create runtime secrets in Secret Manager (UI)

If you still need to create a Supabase project and retrieve credentials, follow [Supabase setup outside Vercel](../README.md#supabase-setup-outside-vercel).

1. Open [Secret Manager](https://console.cloud.google.com/security/secret-manager).
2. Create one secret per env var below (secret name must be exactly the same as the env var):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `POSTGRES_URL`
   - `CRON_SECRET`
   - `BETTER_AUTH_SECRET`
   - `ADMIN_WALLETS`
   - `KUEST_ADDRESS`
   - `KUEST_API_KEY`
   - `KUEST_API_SECRET`
   - `KUEST_PASSPHRASE`

### Step 3: Create a Cloud Build trigger from GitHub

1. Open [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers) and click `Create trigger`.
2. Connect your GitHub repository (if not connected yet).
3. Configure:
   - Event: push to branch (example: `main`)
   - Configuration type: `Cloud Build configuration file`
   - Config file location: `infra/cloud-run/cloudbuild.yaml`
4. Set substitutions:
   - `_SERVICE` (example `kuest-web`)
   - `_REGION` (example `us-central1`)
   - `_AR_REGION` (same Artifact Registry region)
   - `_AR_REPOSITORY` (example `kuest`)
   - `_IMAGE_NAME` (example `prediction-market`)
   - `_SITE_URL` (your canonical HTTPS domain)
   - `_NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID`
5. Save the trigger.

### Step 4: Deploy from the dashboard

1. Open [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers).
2. Click `Run` on your trigger.
3. Watch logs in [Build history](https://console.cloud.google.com/cloud-build/builds).
4. Confirm the new revision in [Cloud Run services](https://console.cloud.google.com/run) > your service.

### Step 5: Rollback in the UI

1. Open [Cloud Run services](https://console.cloud.google.com/run) and open your service.
2. Open `Revisions`.
3. Route traffic back to the previous healthy revision.

### Notes for dashboard flow

- `SITE_URL` must be your canonical public URL used by Supabase callbacks (`/api/sync/*`).

## 2) Terminal workflow

### Sync secrets to Secret Manager

```bash
PROJECT_ID=<gcp-project> ENV_FILE=.env ./infra/cloud-run/sync-secrets.sh
```

### Deploy service with existing image

Use an immutable image reference (digest preferred):

```bash
PROJECT_ID=<gcp-project> \
REGION=us-central1 \
IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<digest> \
ENV_FILE=.env \
./infra/cloud-run/deploy.sh
```

### Build and deploy with Cloud Build

`infra/cloud-run/cloudbuild.yaml` builds from `infra/docker/Dockerfile`, pushes to Artifact Registry, and deploys to Cloud Run.

```bash
gcloud builds submit \
  --config infra/cloud-run/cloudbuild.yaml \
  --substitutions _SERVICE=kuest-web,_REGION=us-central1,_AR_REGION=us-central1,_AR_REPOSITORY=kuest,_IMAGE_NAME=prediction-market,_SITE_URL=https://markets.example.com,_NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID=replace-me
```

Before running this pipeline:
- ensure Artifact Registry repo `<ar-region>-docker.pkg.dev/<project-id>/<repository>` exists
- sync required runtime secrets with `infra/cloud-run/sync-secrets.sh`

### Rollback in the terminal

Redeploy the previous image digest:

```bash
PROJECT_ID=<gcp-project> \
REGION=us-central1 \
IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<previous-digest> \
ENV_FILE=.env \
./infra/cloud-run/deploy.sh
```

## Optional: Terraform deploy for Cloud Run

If you prefer managing Cloud Run with Terraform:

```bash
cd infra/terraform/environments/production/cloud-run
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Notes

- `infra/cloud-run/service.template.yaml` is a reference manifest for teams that prefer YAML-based Cloud Run management.
- Terraform workflow is available at `infra/terraform/environments/production/cloud-run`.
