# Terraform targets

Terraform environments available:

- `environments/production/gke`: GKE Autopilot deployment target (`modules/target-gke-autopilot`)
- `environments/production/kubernetes`: Kubernetes deployment target (`modules/target-kubernetes`)
- `environments/production/cloud-run`: Cloud Run deployment target (`modules/target-cloud-run`)
- `environments/production/fly`: Fly.io deployment target (`modules/target-fly`)
- `environments/production/digital-ocean`: DigitalOcean App Platform deployment target

## GKE Autopilot target

This target creates a Kubernetes cluster on Google Kubernetes Engine Autopilot.

```bash
cd infra/terraform/environments/production/gke
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

After apply, fetch cluster credentials:

```bash
gcloud container clusters get-credentials <cluster-name> --region <region> --project <project-id>
```

## Kubernetes target

This target deploys application resources into an existing cluster (for example, one created by the GKE Autopilot target).

```bash
cd infra/terraform/environments/production/kubernetes
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Cloud Run target

This target manages Cloud Run resources declaratively with provider `hashicorp/google`.
Secrets must already exist in Secret Manager; pass `secret_env` as `ENV_VAR_NAME = "SECRET_NAME"`.

Prerequisites:

- Terraform authenticated for Google provider (ADC/service account)
- Cloud Run and Secret Manager permissions in the target project

```bash
cd infra/terraform/environments/production/cloud-run
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Fly.io target

This target orchestrates `infra/fly/sync-secrets.sh` and `infra/fly/deploy.sh` through Terraform local-exec.

Prerequisites:

- `flyctl` CLI authenticated
- Existing Fly app

```bash
cd infra/terraform/environments/production/fly
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## DigitalOcean target

This target creates and manages the app on DigitalOcean App Platform using the official Terraform provider (`digitalocean/digitalocean`).

Prerequisites:

- DigitalOcean API token exported as `DIGITALOCEAN_TOKEN`
- Repository access configured in DigitalOcean App Platform (GitHub integration)

```bash
export DIGITALOCEAN_TOKEN=<your-token>
cd infra/terraform/environments/production/digital-ocean
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Notes

- Use immutable image refs (`@sha256:` preferred, explicit non-`latest` tag allowed).
- `SITE_URL` must point to the canonical public endpoint used by Supabase `pg_cron` callbacks.
- Fly target supports `sync_secrets` for script-based deploys.
