# Fly.io target

This target deploys the existing production image to Fly.io with the same runtime env contract used by other non-Vercel targets.

## Required tooling

- `flyctl` CLI authenticated to your Fly organization
- Existing Fly app (`fly apps create <app-name>`)

## Environment contract

Use the shared validator before secret sync or deploy:

```bash
ENV_FILE=.env ./infra/scripts/validate-runtime-env.sh --env-file "$ENV_FILE"
```

Required vars are listed in `infra/scripts/required-runtime-env.txt`.

## 1) Sync runtime variables/secrets

```bash
FLY_APP=<fly-app-name> ENV_FILE=.env ./infra/fly/sync-secrets.sh
```

Dry-run:

```bash
FLY_APP=<fly-app-name> ENV_FILE=.env ./infra/fly/sync-secrets.sh --dry-run
```

## 2) Deploy image

Use an immutable image reference (digest preferred):

```bash
FLY_APP=<fly-app-name> \
IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<digest> \
ENV_FILE=.env \
./infra/fly/deploy.sh
```

Dry-run:

```bash
FLY_APP=<fly-app-name> \
IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<digest> \
ENV_FILE=.env \
./infra/fly/deploy.sh --dry-run
```

## Rollback

Redeploy the previous image digest:

```bash
FLY_APP=<fly-app-name> \
IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<previous-digest> \
ENV_FILE=.env \
./infra/fly/deploy.sh
```

## Notes

- Base app settings live in `infra/fly/fly.toml`.
- Keep `SITE_URL` set to the canonical public URL used by Supabase `pg_cron` callbacks (`/api/sync/*`).
- Terraform workflow is available at `infra/terraform/environments/production/fly`.
