<h1 align="center">Open-source Prediction Market</h1>

<p align="center">
  Have your own on-chain Web3 prediction market stack inspired by Polymarket.
  Transparent, open source, and early-stage.
</p>
<p align="center"> [
  <a href="https://kuest.com">Demo</a>
  • <a href="#why-kuest">About</a>
  • <a href="#quick-start-15-minutes">Installation</a>
  • <a href="#roadmap">Roadmap</a> ]
</p>

<p align="center">
  <a href="https://kuest.com">
    <img src="https://github.com/user-attachments/assets/7f7ab1dc-2571-4f71-a184-1cef722ea24d" alt="Kuest Prediction Market Open Source" />
  </a>
</p>

## Why Kuest

- Launch your own on-chain prediction market in minutes.
- Polygon-native for low fees and fast settlement.
- Same USDC on Polygon — plug-and-play for Polymarket users.
- Earn trading fees from your fork.
- Amplify volume via on-chain affiliate attribution.
- UMA-powered outcome resolution with public, verifiable oracles.
- Full web UI plus bot-ready APIs and SDKs (Python/Rust). No backend infrastructure to manage.

<p>
  <img src="https://github.com/user-attachments/assets/295d3cbe-d361-4205-991e-a9f855fa8c0e" height="52" alt="Polymarket" />
  <img src="https://github.com/user-attachments/assets/ec0dbc79-33aa-4367-b292-aae7fbfc4490" height="52" alt="Kalshi (soon)" />
</p>

> [!TIP]
> ### Want your own Polymarket-style prediction market?
>
> Launch quickly with your own brand, rules, and fee configuration. Arbitrage flows are live (Kalshi connector soon) and [bot SDKs](https://github.com/kuestcom) are ready today.

## Core Web3 Stack

<p align="center">
  <img src="https://github.com/user-attachments/assets/dd1c533d-001f-4732-87d9-2b76f4280b58" height="42" alt="Polygon" />
  <img src="https://github.com/user-attachments/assets/a403c566-08cc-4bfc-82f2-d1e2e77d1809" height="42" alt="USDC" />
  <img src="https://github.com/user-attachments/assets/c644944a-ce74-464c-9036-e0a63326fd35" height="42" alt="UMA" />
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/9bed7d91-57ba-4652-90d4-e7c83873b24b" height="42" alt="Safe (Gnosis)" />
  <img src="https://github.com/user-attachments/assets/23dbcdb4-ce31-40b9-a1c5-bedd3ce55a6c" height="42" alt="Reown" />
  <img src="https://github.com/user-attachments/assets/af482998-d80c-4156-8eed-84c2681d0a30" height="42" alt="Better Auth" />
  <img src="https://github.com/user-attachments/assets/5f2935d3-ee8d-43d3-8362-873003e92f03" height="42" alt="wevm (wagmi/viem)" />
</p>

---

## Quick Start (15 minutes)

> [!NOTE]
> **Get Started Now!**
> Follow these simple steps to launch your own prediction market:
> <p>
>   <img src="https://github.com/user-attachments/assets/5386379f-7b96-4826-9d4e-1b7883bedf8e" height="42" alt="Vercel" />
>   <img src="https://github.com/user-attachments/assets/364a3525-7102-4a20-b096-12eb5337a62b" height="42" alt="Next.js" />
>   <img src="https://github.com/user-attachments/assets/88cc61ff-e068-46a4-b197-0c7b7d421bb3" height="42" alt="TypeScript" />
>   <img src="https://github.com/user-attachments/assets/d1c1f2a5-d6f8-44cb-ae47-262b1ecb195f" height="42" alt="Supabase" />
> </p>
>
> ### 1. Fork the Repository
> 1. In the top right corner, click the [**⭐ Star**] button
> 2. From the same menu, click [**Fork**]
>
> ### 2. Create a New Project on Vercel
> 1. Go to [Vercel](https://vercel.com) dashboard
> 2. Select **Add New** → **Project**
> 3. Connect your **GitHub account**
> 4. Import and Deploy your **forked repository**
>
> *Note: The initial deployment may fail due to missing environment variables. This is expected.
> Complete Step 3 (Supabase) and Step 4 (environment) first, then redeploy from your project dashboard.*
> ### 3. Create Database (Supabase)
> 1. Go to your project dashboard
> 2. Navigate to the **Storage** tab
> 3. Find **Supabase** in the database list and click **Create**
> 4. Keep all default settings and click **Create** in the final step
> 5. Once ready, click the **Connect Project** button to link to your project
> ### 4. Configure Your Environment
> 1. **Download** the `.env.example` file from this repository
> 2. **Edit** it with your configuration:
>    - **Kuest CLOB Ordersbook**: Connect your wallet at [auth.kuest.com](https://auth.kuest.com), sign to verify ownership, and copy the API key, secret, and passphrase
>    - **Reown AppKit**: Get Project ID at [dashboard.reown.com](https://dashboard.reown.com)
>    - **Better Auth**: Generate secret at [better-auth.com](https://www.better-auth.com/docs/installation#set-environment-variables)
>    - **CRON_SECRET**: Create a random secret of at least 16 characters
> 3. Go to your Vercel project dashboard
> 4. Navigate to **Settings** → **Environment Variables**
> 5. Click **"Import .env"** button
> 6. Select your edited `.env.example` file
> ### 5. Redeploy your project
> Optionally, wait 15 minutes after deployment, then add your custom domain in **Settings** → **Domains** on your project dashboard.
> ### 6. Sync Your Fork (via GitHub Actions)
> In your forked Kuest repository:
> 1. Go to **Settings** → **Actions** → **General**
> 2. Select **"Allow all actions and reusable workflows"**
> 3. Click **Save** - This enables automatic sync with the main repository

**Ready! 🎉** Your prediction market will be online with automatic database setup in a few minutes.

---

## Roadmap

- [x] Polymarket-inspired UI and market pages
- [x] Polygon network support
- [x] On-chain configurable fees per fork
- [x] On-chain affiliate mode (trustless fee sharing)
- [x] Shared liquidity across multiple forks
- [x] Wallet onboarding via Reown AppKit
- [x] Safe-compatible proxy wallet flows
- [x] Relayer server
- [x] Matching engine
- [x] Split and Merge functions
- [x] PnL system
- [x] Negative Risk Conversion Positions function
- [x] Public bot SDK (Python/Rust)
- [x] Activity page
- [x] Traders Ranking
- [ ] UMA Oracle implementation
- [ ] 🏆 MVP Ready (stress tests, security and calculation checks)
- [ ] Move matching engine to mainnet
- [ ] Auto‑renew Crypto and X counter markets (soon)
- [ ] Sports markets (soon)
- [ ] Fork-created markets with opt-in cross-fork sharing (soon)
- [ ] Kalshi arbitrage connector (soon)

---

## Follow Us

<p>
  <a href="https://x.com/kuest">
    <img alt="X" src="https://img.shields.io/badge/X-@kuest-000?logo=x&style=social" />
  </a>
</p>
<p>
  <a href="https://discord.gg/kuest">
    <img alt="Discord" src="https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&style=social" />
  </a>
</p>
<p>
  <a href="https://kuest.com">
    <img alt="Website" src="https://img.shields.io/badge/Website-kuest.com-111?logo=website&style=social" />
  </a>
</p>
<p>
  <a href="mailto:hello@kuest.com">
    <img alt="Email" src="https://img.shields.io/badge/Email-hello%40kuest.com-444?logo=gmail&style=social" />
  </a>
</p>
</p>

---

License: [Kuest MIT+Commons](LICENSE).
