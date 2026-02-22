# Kubernetes

Deploy target for Kubernetes.

## Prerequisites

1. Working Kubernetes context and cluster.
2. Ingress controller available in the cluster.
3. Access to this repository.
4. [Configure Environment Variables](../../README.md#quick-start-15-minutes).
5. Choose between Supabase vs Postgres+S3 and [set the required env variables](../README.md#storage-options)

## Deploy with Kustomize

Create runtime secret from the template and apply baseline manifests:

```bash
cp infra/kubernetes/secret.example.yaml infra/kubernetes/secret.yaml
kubectl apply -k infra/kubernetes
```

## Scheduler implementation on Kubernetes

> [!CAUTION]
> If you choose [Supabase mode](../README.md#option-a-supabase-mode-recommended), there is no need to apply Kubernetes CronJobs since you will be duplicating requests to your sync endpoints.

Use Kubernetes CronJobs implementing `infra/scheduler-contract.md`.

Edit `infra/kubernetes/cronjobs.yaml` for your environment (`SITE_URL`, namespace, secret name), then apply:

```bash
kubectl apply -f infra/kubernetes/cronjobs.yaml
```

## Optional: Terraform for Kubernetes

```bash
cd infra/terraform/environments/production/kubernetes
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Notes

- `SITE_URL` must be your canonical public URL.
- In `infra/kubernetes/secret.example.yaml`, configure exactly one storage profile: Supabase (`SUPABASE_*`) or S3 (`S3_BUCKET` + `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY`).
