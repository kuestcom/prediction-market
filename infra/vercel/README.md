# Deploy with Vercel + Supabase

Self-hosted deployment using your own Vercel account and Supabase database.

> **Prefer not to manage this yourself?** Launch directly at [kuest.com](https://kuest.com) — no setup required.

---

## 1. Star & Fork

[**⭐ Star the repo**](https://github.com/kuestcom/prediction-market) — then [fork it](https://github.com/kuestcom/prediction-market/fork).

---

## 2. Configure environment variables

Start from [`.env.example`](../../.env.example) and fill in the shared
[required environment variables](../README.md#required-environment-variables).

---

## 3. Deploy to Vercel

1. Open [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Connect your GitHub account and import your forked repository
3. In the import modal → **Environment Variables** → **Import .env** → select your edited file
4. Click **Deploy**
5. After deployment finishes → **Continue to Dashboard**

---

## 4. Add Supabase database

1. In your Vercel project → **Storage** → **Create** → select **Supabase** with default settings
   *(Create a Supabase account if prompted)*
2. After setup → click **Connect Project**

---

## 5. Automate migrate-then-deploy

This repository keeps Vercel builds focused on `next build`. Database migrations
run in GitHub Actions before a production deploy is triggered.

1. In GitHub → **Settings → Secrets and variables → Actions**, add:
   - `POSTGRES_URL`
   - `POSTGRES_URL_NON_POOLING`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
   - `SITE_URL`
   - `VERCEL_DEPLOY_HOOK_URL`
2. In Vercel → **Settings → Deploy Hooks** → create a production deploy hook and
   copy it into `VERCEL_DEPLOY_HOOK_URL`.
3. Use the workflow in [`.github/workflows/vercel-deploy.yml`](../../.github/workflows/vercel-deploy.yml)
   for production releases.
4. Disable automatic Git-based production deployments in Vercel before enabling
   the workflow, otherwise pushes to `main` will trigger two production builds.

The migration runner now takes an advisory lock so concurrent workflows do not
apply or schedule against the database at the same time.

## 6. Redeploy

**Deployments** → click `...` on the latest build → **Redeploy**.

Optionally add your custom domain under **Settings → Domains** after this step.

## 7. Finish setup in Admin

1. Log in with a wallet listed in `ADMIN_WALLETS`
2. Go to **Admin → General**
3. Set your company name, branding, fee rate, and event categories

**Your prediction market is live. 🎉**

---

> For deployments outside Vercel, see the [infrastructure guide](../README.md).
