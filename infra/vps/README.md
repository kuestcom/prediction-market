# VPS (manual)

Deploy target for generic Linux VPS hosts (DigitalOcean Droplets, Vultr, Hetzner, EC2, etc.).

## Prerequisites

1. Ubuntu 22.04+ VPS with public IPv4.
2. Domain pointing to the VPS IP (A record).
3. SSH user with `sudo` access.
4. [Configure Environment Variables](../../README.md#quick-start-15-minutes).
5. Choose storage mode and [set the required env variables](../README.md#storage-options).

## 1) Prepare the server

```bash
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-timezone UTC

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## 2) Install Docker Engine + Compose plugin

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker "$USER"
newgrp docker

docker --version
docker compose version
```

## 3) Clone repository and configure `.env`

```bash
sudo mkdir -p /opt/kuest
sudo chown "$USER":"$USER" /opt/kuest
cd /opt/kuest
git clone https://github.com/<your-org>/prediction-market.git
cd prediction-market
cp .env.example .env
```

Edit `.env` and fill required keys from:

- [Configure Environment Variables](../../README.md#quick-start-15-minutes)
- [Storage options](../README.md#storage-options)

Storage reminder:

- Supabase mode: set `POSTGRES_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Postgres+S3 mode: set `POSTGRES_URL`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (plus optional `S3_*`).

## 4) Optional: install PostgreSQL locally (only if not using Supabase)

If you already have `POSTGRES_URL` from Supabase or managed Postgres, skip this section.

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Create database and user:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER kuest WITH PASSWORD 'replace-with-strong-password';
CREATE DATABASE kuest OWNER kuest;
GRANT ALL PRIVILEGES ON DATABASE kuest TO kuest;
SQL
```

Set `POSTGRES_URL` in `.env` (local DB example):

```env
POSTGRES_URL=postgresql://kuest:replace-with-strong-password@127.0.0.1:5432/kuest?sslmode=disable
```

## 5) Run application with Docker Compose

```bash
cd /opt/kuest/prediction-market
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build
docker compose -f infra/docker/docker-compose.yml ps
docker compose -f infra/docker/docker-compose.yml logs -f web
```

## 6) Configure HTTPS reverse proxy (Caddy)

Install Caddy:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Create `/etc/caddy/Caddyfile`:

```text
markets.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

Apply config:

```bash
sudo systemctl reload caddy
```

Then set `SITE_URL=https://markets.example.com` in `.env` and redeploy:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build
```

## 7) Scheduler implementation on VPS

> [!CAUTION]
> If you choose [Supabase mode](../README.md#option-a-supabase-mode-recommended), do not create VPS cron jobs for sync endpoints, or you will duplicate requests.

If you are not using Supabase scheduler, configure Linux cron with `infra/scheduler-contract.md`.

Open crontab:

```bash
crontab -e
```

Add jobs (replace domain/token):

```cron
1-59/5 * * * * curl -fsS -H "Authorization: Bearer replace-me" "https://markets.example.com/api/sync/events" >/dev/null 2>&1
3-59/5 * * * * curl -fsS -H "Authorization: Bearer replace-me" "https://markets.example.com/api/sync/resolution" >/dev/null 2>&1
*/10 * * * * curl -fsS -H "Authorization: Bearer replace-me" "https://markets.example.com/api/sync/translations" >/dev/null 2>&1
14,44 * * * * curl -fsS -H "Authorization: Bearer replace-me" "https://markets.example.com/api/sync/volume" >/dev/null 2>&1
```

## 8) Operations

Update deploy:

```bash
cd /opt/kuest/prediction-market
git pull
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build
```

Rollback:

```bash
cd /opt/kuest/prediction-market
git checkout <previous-commit-or-tag>
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build
```

## Notes

- Keep only one scheduler backend for `/api/sync/*` endpoints.
- Keep regular backups for your Postgres and object storage.
- If you run local Postgres, keep it bound to localhost unless you explicitly need remote access.
