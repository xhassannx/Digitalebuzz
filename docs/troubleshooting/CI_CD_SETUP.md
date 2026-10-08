# CI/CD Setup — GitHub → Hostinger VPS (multi-site)

This project includes an automated pipeline. After setup, **push to `main`** and every configured site deploys automatically — no more manual `git pull` in CloudPanel terminal.

## How it works

```
git push main
    ↓
GitHub Actions: build once (npm ci → check → build) — validates code; artifact is a source bundle
    ↓
For each site in DEPLOY_TARGETS_JSON:
    SSH → upload release.tgz → scripts/deploy-target.sh
    ↓
    Keep server .env → npm ci → source .env → npm run build → pm2 restart
```

### Landing page template (`VITE_TEMPLATE_ID`)

`VITE_TEMPLATE_ID` is **baked into the frontend at build time** (Vite), not read from `.env` when users open the site.

| Value | Landing page |
|-------|----------------|
| `1` | Default marketing (Helicoptic) |
| `2` | Partner With Us |
| `3` | Login as home |
| `4` | White-label marketing |

Set on the **server** `.env` (per site):

```env
VITE_TEMPLATE_ID=2
VITE_BASE_URL=https://helicopticsolutions.in
```

Deploy **rebuilds on the VPS** using that `.env`, so each site can use a different template. Your server `.env` is never overwritten by CI.

Supports:
- **Multiple sites on one VPS** (same IP, different folders + PM2 names + ports)
- **Multiple sites on different VPS** (different `host` per target in JSON)

---

## Part 1 — One-time VPS setup (per site)

Run these in **Hostinger CloudPanel → Terminal** (or SSH) for **each customer/site**.

### 1.1 Install Node 20+ and PM2 (once per VPS)

```bash
node -v   # need v20+
npm -v
pm2 -v    # if missing: npm i -g pm2
```

If Node is old:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm i -g pm2
pm2 startup    # follow printed command, then: pm2 save
```

### 1.2 Create deploy folder + `.env` (per site)

Replace paths/ports with your CloudPanel site path:

```bash
# Example for wa.example.com on port 5002
bash scripts/vps-bootstrap.sh /home/YOUR_USER/htdocs/wa.example.com/helicoptic-whatsapp 5002
```

Or manually:

```bash
mkdir -p /home/YOUR_USER/htdocs/wa.example.com/helicoptic-whatsapp/logs
nano /home/YOUR_USER/htdocs/wa.example.com/helicoptic-whatsapp/.env
```

Each site **must** have its own `.env` with at least:

```env
NODE_ENV=production
PORT=5002
BASE_URL=https://wa.example.com
VITE_BASE_URL=https://wa.example.com
DATABASE_URL=postgresql://...
SESSION_SECRET=long-random-secret
```

**Important:** Each site on the same VPS needs a **unique `PORT`**.

### 1.3 CloudPanel reverse proxy (per domain)

In CloudPanel → site → Vhost, proxy to that site's `PORT`:

```nginx
location / {
  proxy_pass http://127.0.0.1:5002;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

Use a different port per domain (5002, 5003, 5004, …).

---

## Part 2 — GitHub SSH key (once)

On your **local PC** (PowerShell or terminal):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy -N ""
```

Copy **public** key to each VPS:

```bash
# Show public key
cat ~/.ssh/github_actions_deploy.pub

# On each VPS (as deploy user):
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Test:

```bash
ssh -i ~/.ssh/github_actions_deploy YOUR_USER@YOUR_VPS_IP
```

---

## Part 3 — GitHub Secrets & Variables

Open your repo: **Settings → Secrets and variables → Actions**

### Secrets (required)

| Name | Value |
|------|--------|
| `VPS_HOST` | Default VPS IP (fallback when target has no `host`) |
| `VPS_USER` | Default SSH user (fallback when target has no `user`) |
| `VPS_SSH_PRIVATE_KEY` | Full private key: `cat ~/.ssh/github_actions_deploy` |

Optional:

| Name | Value |
|------|--------|
| `VPS_SSH_PORT` | SSH port if not 22 (default `22`) |

### Variable (required): `DEPLOY_TARGETS_JSON`

**Settings → Secrets and variables → Actions → Variables → New variable**

Name: `DEPLOY_TARGETS_JSON`

Value: JSON array — copy from `.github/deploy-targets.example.json` and edit.

#### Example A — Multiple sites, **same VPS** (one IP)

```json
[
  {
    "name": "ratehonk",
    "host": "46.28.44.79",
    "user": "whatsappschatbot",
    "deploy_path": "/home/whatsappschatbot/htdocs/wa.ratehonk.com/helicoptic-whatsapp",
    "pm2_app_name": "helicoptic-ratehonk",
    "run_db_push": true
  },
  {
    "name": "automate",
    "host": "46.28.44.79",
    "user": "whatsappschatbot",
    "deploy_path": "/home/whatsappschatbot/htdocs/www.automate.example.com/helicoptic-whatsapp",
    "pm2_app_name": "helicoptic-automate",
    "run_db_push": false
  }
]
```

#### Example — **helicopticsolutions.in** (single site)

Use PM2 name **`helicoptic-whatsapp`** (must match `pm2 ls` on the server):

```json
[
  {
    "name": "helicopticsolutions",
    "host": "46.28.44.79",
    "user": "helicopticsolutions",
    "ssh_port": 22,
    "deploy_path": "/home/helicopticsolutions/htdocs/helicopticsolutions.in/helicoptic-whatsapp",
    "pm2_app_name": "helicoptic-whatsapp",
    "run_db_push": true
  }
]
```

Copy from `.github/deploy-targets.helicopticsolutions.json`. After changing `pm2_app_name`, delete the old duplicate process once:

```bash
pm2 delete helicoptic-helicopticsolutions
pm2 save
```

#### Example B — Sites on **different VPS** (different IPs)

```json
[
  {
    "name": "customer-a",
    "host": "46.28.44.79",
    "user": "whatsappschatbot",
    "deploy_path": "/home/whatsappschatbot/htdocs/a.com/helicoptic-whatsapp",
    "pm2_app_name": "helicoptic-a",
    "run_db_push": true
  },
  {
    "name": "customer-b",
    "host": "31.97.12.10",
    "user": "deploy",
    "deploy_path": "/home/deploy/htdocs/b.com/helicoptic-whatsapp",
    "pm2_app_name": "helicoptic-b",
    "run_db_push": false
  }
]
```

#### Field reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Short id for logs / manual deploy filter |
| `deploy_path` | yes | Absolute path on VPS (must contain `.env`) |
| `pm2_app_name` | yes | Unique PM2 process name per site |
| `host` | no* | VPS IP — omit to use `VPS_HOST` secret |
| `user` | no* | SSH user — omit to use `VPS_USER` secret |
| `ssh_port` | no | Default 22 or `VPS_SSH_PORT` secret |
| `run_db_push` | no | `true` only for one target per shared DB |

\*If all sites share one VPS, you can omit `host`/`user` on every target and only set `VPS_HOST` + `VPS_USER` secrets.

---

## Part 4 — First deploy

### Automatic

```bash
git add .
git commit -m "Enable CI/CD"
git push origin main
```

Watch: **GitHub → Actions → Multi-domain CI/CD**

### Manual (one site only)

**Actions → Multi-domain CI/CD → Run workflow**

- `target_name`: e.g. `ratehonk` (must match `name` in JSON)
- Leave empty to deploy **all** targets

### Verify on VPS

```bash
pm2 ls
pm2 logs helicoptic-ratehonk --lines 50
curl -I http://127.0.0.1:5002
```

---

## Part 5 — Daily workflow (replaces manual pull)

| Before (manual) | After (CI/CD) |
|-----------------|---------------|
| Push to GitHub | Push to GitHub |
| SSH to VPS | *(automatic)* |
| `git pull` | *(automatic)* |
| `npm run build` | Built on GitHub |
| `pm2 restart` | *(automatic)* |

You only SSH when debugging:

```bash
pm2 logs <app-name>
pm2 restart <app-name> --update-env
```

---

## Adding a new site later

1. Create folder + `.env` on VPS (`scripts/vps-bootstrap.sh`)
2. Set CloudPanel proxy to that site's `PORT`
3. Add one object to `DEPLOY_TARGETS_JSON` in GitHub Variables
4. Push to `main` or run workflow with that `target_name`

No workflow file changes needed.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| SSH fails in Actions | Check `VPS_SSH_PRIVATE_KEY` is full key with BEGIN/END lines; test `ssh -i key user@host` |
| One site fails, others OK | Check that site's `deploy_path` exists and is writable; check `.env` |
| Blank page after deploy | `pm2 logs <name>` — usually wrong `PORT` or `BASE_URL` in `.env` |
| DB migration errors | Set `run_db_push: true` on **one** target only if DB is shared |
| `drizzle-kit: not found` (exit 127) | Fixed in `deploy-target.sh` — pull latest and redeploy; script installs drizzle-kit before `db:push` |
| Wrong landing page after deploy (template 1 instead of 2) | Set `VITE_TEMPLATE_ID=2` in **server** `.env`; push latest `deploy-target.sh` (rebuilds on VPS) |
| `pm2: command not found` (exit 127) | PM2 lives under nvm; latest `deploy-target.sh` adds node's `bin` to PATH before restart |
| Node v18 in Actions but v22 in terminal | Non-interactive SSH uses system `node`; nvm loads in `deploy-target.sh` — push latest script |
| Node v18 warnings / deploy fails | Upgrade VPS to **Node 20+** (section 1.1); deploy script requires v20 |
| Build fails on `npm run check` | Fix TypeScript errors locally, or temporarily remove type-check step in `deploy.yml` |

---

## Files reference

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | GitHub Actions pipeline |
| `.github/deploy-targets.example.json` | Example targets JSON |
| `scripts/deploy-target.sh` | Runs on VPS per target (keeps `.env`, restarts PM2) |
| `scripts/vps-bootstrap.sh` | One-time folder + `.env` setup on VPS |
| `docs/MULTI_DOMAIN_DEPLOYMENT.md` | Architecture notes |
