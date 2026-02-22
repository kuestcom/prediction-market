# VPS (manual)

Deploy target for generic Linux VPS hosts (DigitalOcean Droplets, Vultr, Hetzner, EC2, etc.).

## Prerequisites

1. Ubuntu 22.04+ VPS with public IPv4.
2. Domain pointing to the VPS IP (A record).
3. SSH user with `sudo` access.
4. [Configure Environment Variables](../../README.md#quick-start-15-minutes).
5. Choose storage mode and [set the required env variables](../README.md#storage-options).

## Shared server baseline

```bash
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-timezone UTC

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## Choose your tutorial

<details>
<summary><strong>Option A (click to expand): Node + systemd + Nginx</strong></summary>

### 1) Install runtime packages

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs build-essential git nginx certbot python3-certbot-nginx

node -v
npm -v
```

### 2) Clone repository and configure `.env`

```bash
sudo mkdir -p /opt/kuest
sudo chown "$USER":"$USER" /opt/kuest
cd /opt/kuest
git clone https://github.com/<your-org>/prediction-market.git
cd prediction-market
cp .env.example .env
```

Edit `.env` with keys from:

- [Configure Environment Variables](../../README.md#quick-start-15-minutes)
- [Storage options](../README.md#storage-options)

Storage reminder:

- Supabase mode: set `POSTGRES_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Postgres+S3 mode: set `POSTGRES_URL`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (plus optional `S3_*`).

### 3) Optional: install PostgreSQL locally (only if not using Supabase)

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

### 4) Install dependencies, build, and migrate

```bash
cd /opt/kuest/prediction-market
npm ci
npm run build
npm run db:push
```

### 5) Create systemd service

Create `/etc/systemd/system/kuest.service`:

```ini
[Unit]
Description=Kuest Web App
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/kuest/prediction-market
Environment=NODE_ENV=production
EnvironmentFile=/opt/kuest/prediction-market/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
User=replace-with-linux-user
Group=replace-with-linux-user

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kuest
sudo systemctl status kuest
```

### 6) Configure Nginx + TLS

Create `/etc/nginx/sites-available/kuest`:

```nginx
server {
  listen 80;
  server_name markets.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

Enable and reload:

```bash
sudo ln -sf /etc/nginx/sites-available/kuest /etc/nginx/sites-enabled/kuest
sudo nginx -t
sudo systemctl reload nginx
```

Issue certificate:

```bash
sudo certbot --nginx -d markets.example.com
```

Set `SITE_URL=https://markets.example.com` in `.env` and restart:

```bash
sudo systemctl restart kuest
```

</details>

<details>
<summary><strong>Option B (click to expand): Docker Compose + Caddy</strong></summary>

### 1) Install Docker Engine + Compose plugin

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
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git

sudo usermod -aG docker "$USER"
newgrp docker

docker --version
docker compose version
```

### 2) Clone repository and configure `.env`

```bash
sudo mkdir -p /opt/kuest
sudo chown "$USER":"$USER" /opt/kuest
cd /opt/kuest
git clone https://github.com/<your-org>/prediction-market.git
cd prediction-market
cp .env.example .env
```

Edit `.env` with:

- [Configure Environment Variables](../../README.md#quick-start-15-minutes)
- [Storage options](../README.md#storage-options)

### 3) Optional: local Postgres in Docker Compose (only if not using Supabase)

The production compose file is `infra/docker/docker-compose.production.yml`.

If you are not using Supabase, set:

```env
POSTGRES_DB=kuest
POSTGRES_USER=kuest
POSTGRES_PASSWORD=replace-with-strong-password
POSTGRES_URL=postgresql://kuest:replace-with-strong-password@postgres:5432/kuest?sslmode=disable
```

### 4) Configure Caddy domain

Set these values in `.env`:

```env
CADDY_DOMAIN=markets.example.com
SITE_URL=https://markets.example.com
```

`Caddy` handles reverse proxy and TLS automatically when DNS is already pointing to the VPS.

### 5) Start production compose

Supabase mode:

```bash
cd /opt/kuest/prediction-market
docker compose --env-file .env -f infra/docker/docker-compose.production.yml up -d --build
```

Postgres+S3 mode with local Postgres container:

```bash
cd /opt/kuest/prediction-market
docker compose --env-file .env -f infra/docker/docker-compose.production.yml --profile local-postgres up -d --build
```

### 6) Validate

```bash
docker compose -f infra/docker/docker-compose.production.yml ps
docker compose -f infra/docker/docker-compose.production.yml logs -f caddy
```

</details>

## Scheduler implementation on VPS

> [!CAUTION]
> If you choose [Supabase mode](../README.md#option-a-supabase-mode), do not create VPS cron jobs for sync endpoints, or you will duplicate requests.

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

## Operations

Native Node update:

```bash
cd /opt/kuest/prediction-market
git pull
npm ci
npm run build
npm run db:push
sudo systemctl restart kuest
```

Docker update:

```bash
cd /opt/kuest/prediction-market
git pull
docker compose --env-file .env -f infra/docker/docker-compose.production.yml up -d --build
```

Docker update (with local Postgres profile):

```bash
cd /opt/kuest/prediction-market
git pull
docker compose --env-file .env -f infra/docker/docker-compose.production.yml --profile local-postgres up -d --build
```

## Notes

- Keep only one scheduler backend for `/api/sync/*` endpoints.
- Keep regular backups for your Postgres and object storage.
