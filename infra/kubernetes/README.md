# Kubernetes target

Baseline Kubernetes deployment using the manifests in this folder.

See shared docs first:

- `infra/README.md`
- `infra/scheduler-contract.md`

## Prerequisites

1. Working Kubernetes context.
2. Ingress controller available in the cluster.
3. Production image reference and runtime secrets.

## Apply baseline manifests

```bash
cp infra/kubernetes/secret.example.yaml infra/kubernetes/secret.yaml
kubectl apply -k infra/kubernetes
```

## Storage option notes

`infra/kubernetes/secret.example.yaml` is currently Supabase-first.

If using Postgres+S3 mode:

1. Add required `S3_*` variables to your generated `secret.yaml`.
2. Keep `POSTGRES_URL`.
3. Omit `SUPABASE_*` only when your operational profile does not require them.

## Scheduler implementation on Kubernetes

Implement `infra/scheduler-contract.md` with CronJobs.

Recommended:

- One CronJob per sync endpoint
- `concurrencyPolicy: Forbid`
- `restartPolicy: Never`

Use and edit the provided template:

- `infra/kubernetes/sync-cronjobs.example.yaml`

Apply:

```bash
kubectl apply -f infra/kubernetes/sync-cronjobs.example.yaml
```
