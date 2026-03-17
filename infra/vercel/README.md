# Deploy with Vercel + Supabase

Self-hosted deployment using your own Vercel account and Supabase database.

> **Prefer not to manage this yourself?** Launch directly at [kuest.com](https://kuest.com) — no setup required.

---

## 1. Star & Fork

[**⭐ Star the repo**](https://github.com/kuestcom/prediction-market) — then [fork it](https://github.com/kuestcom/prediction-market/fork).

---

## 2. Configure environment variables

Download [`.env.example`](../../.env.example) from the root of the repository and fill in:

| Variable | Description |
|---|---|
| `KUEST_ADDRESS` / `KUEST_API_KEY` / `KUEST_API_SECRET` / `KUEST_PASSPHRASE` | CLOB auth credentials — generate at [auth.kuest.com](https://auth.kuest.com) by connecting your Polygon EVM wallet |
| `ADMIN_WALLETS` | Comma-separated 0x addresses that should have admin access |
| `REOWN_APPKIT_PROJECT_ID` | From [dashboard.reown.com](https://dashboard.reown.com) |
| `BETTER_AUTH_SECRET` | 32-char secret — [generator](https://www.better-auth.com/docs/installation#set-environment-variables) |
| `CRON_SECRET` | Any random 16+ char string |

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

## 5. Redeploy

**Deployments** → click `...` on the latest build → **Redeploy**.

Optionally add your custom domain under **Settings → Domains** after this step.

---

## 6. Enable GitHub Actions sync

In your forked repository:

**Settings → Actions → General → Allow all actions and reusable workflows → Save**

This keeps your fork in sync with upstream Kuest releases.

---

## 7. Finish setup in Admin

1. Log in with a wallet listed in `ADMIN_WALLETS`
2. Go to **Admin → General**
3. Set your company name, branding, fee rate, and event categories

**Your prediction market is live. 🎉**

---

> For deployments outside Vercel, see the [infrastructure guide](https://github.com/kuestcom/prediction-market/blob/main/infra/README.md).
