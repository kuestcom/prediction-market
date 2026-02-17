# Terraform targets

Terraform environments available:

- `environments/production/kubernetes`: Kubernetes target (`modules/runtime-kubernetes`)
- `environments/production/cloud-run`: Cloud Run target (`modules/runtime-cloud-run`)
- `environments/production/fly`: Fly.io target (`modules/runtime-fly`)

## Kubernetes target

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

## Notes

- Use immutable image refs (`@sha256:` preferred, explicit non-`latest` tag allowed).
- `SITE_URL` must point to the canonical public endpoint used by Supabase `pg_cron` callbacks.
- Fly target supports `sync_secrets` and `dry_run` for script-based deploys.
