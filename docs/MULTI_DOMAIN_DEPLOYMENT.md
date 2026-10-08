# Multi-domain Deployment Guide (CloudPanel + one VPS)

This project supports deploying the same codebase to many customer domains on one server.

## Architecture

- One GitHub repo / branch
- One VPS
- Many CloudPanel sites (one per customer domain)
- One PM2 app per customer (separate name + port + `.env`)

---

## 1) One-time server setup

Install runtime tools:

```bash
node -v   # must be 20+
npm -v
pm2 -v
```

If PM2 is missing:

```bash
npm i -g pm2
```

For each customer target, create app directory and `.env`:

```bash
mkdir -p /home/USER/htdocs/example.com/helicoptic-whatsapp
nano /home/USER/htdocs/example.com/helicoptic-whatsapp/.env
```

Each target `.env` must have unique values at least for:
- `PORT`
- `BASE_URL`
- `VITE_BASE_URL`
- customer-specific IDs/tokens (`WHITELABEL_ORG_ID`, OAuth config, etc.)

---

## 2) CloudPanel vhost config

Each domain's vhost should proxy to its target port (from that target's `.env`):

```nginx
location / {
  proxy_pass http://127.0.0.1:5001;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

Use a different port for each domain/PM2 app.

---

## 3) GitHub configuration

Set Action secrets:
- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_PRIVATE_KEY`

Set Action variable:
- `DEPLOY_TARGETS_JSON` (see `.github/workflows/README.md` example)

For multi-server deployments, include `host` and `user` per target:

```json
[
  {
    "name": "customer-a",
    "host": "46.28.44.79",
    "user": "whatsappschatbot",
    "deploy_path": "/home/whatsappschatbot/htdocs/customer-a.com/helicoptic-whatsapp",
    "pm2_app_name": "helicoptic-customer-a",
    "run_db_push": true
  },
  {
    "name": "customer-b",
    "host": "31.97.12.10",
    "user": "deploy",
    "deploy_path": "/home/deploy/htdocs/customer-b.com/helicoptic-whatsapp",
    "pm2_app_name": "helicoptic-customer-b",
    "run_db_push": false
  }
]
```

If `host`/`user` are omitted, workflow falls back to `VPS_HOST`/`VPS_USER` secrets.

---

## 4) First deploy

Push to `main` (or run workflow manually).  
Workflow will:
- build once
- deploy to every target in `DEPLOY_TARGETS_JSON`
- restart target PM2 app names

Check status:

```bash
pm2 ls
pm2 logs helicoptic-ratehonk --lines 100
```

---

## 5) Operational tips

- Keep `run_db_push=true` for only one target if several targets share one DB.
- Keep `run_db_push=true` for all targets only when each target has isolated DB/schema.
- Never store `.env` in git; each target keeps `.env` on server.
- Use workflow `target_name` input to deploy a single customer quickly.
