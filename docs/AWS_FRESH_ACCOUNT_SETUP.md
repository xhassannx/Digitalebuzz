# AWS Fresh Account Setup Guide (Helicoptic Whitelabel)

Complete checklist for a **new AWS account** — avoid the ~$400/15-day bill from the old setup.

**Region:** Asia Pacific (Mumbai) `ap-south-1` only.

---

## What went wrong before (do NOT repeat)

| Mistake | Result |
|---------|--------|
| App on **Hostinger VPS** + RDS on AWS with **public access** | Every DB read = **internet egress** (~$0.11/GB) → **$341 data transfer** |
| Campaign webhooks scanned full message tables | Multiplied egress (fixed in latest code — **deploy it**) |
| Possibly oversized RDS / extra resources | Higher baseline cost |

**Golden rule:** App and RDS must live in the **same VPC**. RDS **never** open to `0.0.0.0/0`.

---

## Target architecture (cost-safe)

```
Internet → EC2 (Nginx + PM2, all whitelabel domains)
              ↓ private (free)
           RDS PostgreSQL (one server, many databases)
              +
           S3 bucket (media files, private)
```

| Resource | Count | Notes |
|----------|-------|-------|
| EC2 | **1** for all whitelabel | PM2 per domain, different PORT |
| RDS | **1** | One `CREATE DATABASE` per customer in SQL |
| S3 | **1** bucket | Gallery, inbox media |
| ALB | **0** at start | Nginx + Let's Encrypt on EC2 |
| NAT Gateway | **0** | EC2 public IP is enough |

---

## Realistic monthly budget (Mumbai)

| Stage | Sites | ~USD/month (pre-tax) |
|-------|-------|----------------------|
| **Pilot** | 1–3 | **$75–95** |
| **Growth** | 10–25 | **$130–180** |
| **Scale** | 50 moderate | **$200–280** |

$80–85/month works for **1–3 pilot sites** with lean sizing — not 50 heavy sites.

**Recommended pilot stack:**

| Service | Spec | ~$/mo |
|---------|------|-------|
| RDS | `db.t4g.medium`, Single-AZ, 50 GB gp3 | ~$55 |
| EC2 | `t4g.large` (2 vCPU, 8 GB) | ~$55 |
| S3 | ~50 GB media | ~$2 |
| Elastic IP | 1 (attached to EC2) | ~$3 |
| **Total** | | **~$115** (+ 18% GST in India) |

After 1–2 stable months, buy **1-year Reserved Instances** on EC2/RDS to save ~20–30%.

---

## Phase 0 — New AWS account (Day 1)

### 0.1 Account security

1. Sign up at [aws.amazon.com](https://aws.amazon.com) (India billing OK).
2. Enable **MFA** on root account.
3. Create **IAM admin user** — use this for daily work, not root.
4. Console region → **Asia Pacific (Mumbai) ap-south-1**.

### 0.2 Billing alarms (mandatory)

1. **Billing** → **Budgets** → Create budget.
2. Amount: **$100/month** (or your cap).
3. Alert at **80%** and **100%** → your email.
4. **Billing** → **Billing preferences** → enable **Receive PDF Invoice By Email**.

### 0.3 Cost tags (optional but useful)

Tag all resources: `Project=helicoptic`, `Environment=production`.

---

## Phase 1 — Network & security groups (Day 1)

Use **default VPC** in `ap-south-1` (simplest for pilot).

### 1.1 Create security groups

**SG-EC2-APP** (for your server):

| Type | Port | Source |
|------|------|--------|
| SSH | 22 | **Your IP only** `/32` |
| HTTP | 80 | `0.0.0.0/0` |
| HTTPS | 443 | `0.0.0.0/0` |
| Custom TCP | 5001–5100 | `127.0.0.1/32` only (optional; Nginx proxies) |

**SG-RDS** (database):

| Type | Port | Source |
|------|------|--------|
| PostgreSQL | 5432 | **SG-EC2-APP only** (not an IP!) |

**Never** add `0.0.0.0/0` on port 5432.

---

## Phase 2 — RDS PostgreSQL (Day 1)

RDS → **Create database**

| Setting | Value |
|---------|-------|
| Engine | **PostgreSQL 17** |
| Template | Dev/Test (pilot) or Production |
| Instance | **`db.t4g.medium`** |
| Storage | **gp3, 50 GB**, autoscaling max **100 GB** |
| Multi-AZ | **No** (pilot) |
| VPC | Default VPC |
| **Public access** | **No** |
| Security group | **SG-RDS** |
| Initial DB name | `postgres` |
| Master username | e.g. `helicoptic_admin` |
| Backup | 7 days retention |

Note the **endpoint** (private):  
`helicoptic-prod.xxxxx.ap-south-1.rds.amazonaws.com`

**Do NOT** use the AWS console **Create database** button for each whitelabel — that buys a new RDS server ($$$).

---

## Phase 3 — S3 for media (Day 1)

1. S3 → **Create bucket**
   - Name: e.g. `helicoptic-media-prod`
   - Region: **ap-south-1**
   - **Block all public access:** ON
2. No static website hosting needed — app serves `/uploads/...` URLs.

---

## Phase 4 — EC2 application server (Day 1–2)

### 4.1 Launch instance

| Setting | Value |
|---------|-------|
| AMI | Ubuntu 24.04 LTS |
| Instance type | **`t4g.large`** (ARM, cheap) or `m6g.large` |
| Key pair | Create/download `.pem` |
| VPC / subnet | Same as RDS, prefer **same AZ** (e.g. `ap-south-1a`) |
| Security group | **SG-EC2-APP** |
| Storage | 30–50 GB gp3 |
| Elastic IP | Allocate and **associate** to this instance |

### 4.2 IAM role for EC2 (S3 access)

1. IAM → Role → **EC2** → Create role.
2. Attach inline policy (replace bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::helicoptic-media-prod",
      "arn:aws:s3:::helicoptic-media-prod/*"
    ]
  }]
}
```

3. Attach role to EC2 instance (Actions → Security → Modify IAM role).

### 4.3 Install software (SSH to EC2)

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx postgresql-client git
sudo npm install -g pm2
node -v   # must be 20+
```

### 4.4 Clone & build app

```bash
sudo mkdir -p /var/www/helicoptic
sudo chown $USER:$USER /var/www/helicoptic
cd /var/www/helicoptic
git clone YOUR_REPO_URL .
npm ci
npm run build
```

Deploy latest code with **all cost/performance fixes** from the repo (webhook lookups, S3 storage, db:sync).

---

## Phase 5 — First whitelabel database on RDS

From EC2 (can reach private RDS):

```bash
psql "postgresql://helicoptic_admin:PASSWORD@helicoptic-prod.xxxxx.ap-south-1.rds.amazonaws.com:5432/postgres?sslmode=require"
```

```sql
CREATE DATABASE customer_a;
CREATE USER customer_a_app WITH ENCRYPTED PASSWORD 'strong-unique-password';
GRANT ALL PRIVILEGES ON DATABASE customer_a TO customer_a_app;
\c customer_a
GRANT ALL ON SCHEMA public TO customer_a_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO customer_a_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO customer_a_app;
```

Repeat `CREATE DATABASE` + user for each new whitelabel — **never** a new RDS instance.

---

## Phase 6 — `.env` per whitelabel site

Example for `customer-a.com` (PM2 on port 5002):

```env
# Database — private RDS endpoint only
DATABASE_URL=postgresql://customer_a_app:PASSWORD@helicoptic-prod.xxxxx.ap-south-1.rds.amazonaws.com:5432/customer_a?sslmode=require

# Or split:
# PGHOST=helicoptic-prod.xxxxx.ap-south-1.rds.amazonaws.com
# PGPORT=5432
# PGUSER=customer_a_app
# PGPASSWORD=...
# PGDATABASE=customer_a

PORT=5002
BASE_URL=https://customer-a.com
VITE_BASE_URL=https://customer-a.com
NODE_ENV=production

# Connection pool — critical when many PM2 apps on one EC2
PG_POOL_MAX=3

# Media — S3 (recommended)
MEDIA_STORAGE=s3
AWS_S3_BUCKET=helicoptic-media-prod
AWS_REGION=ap-south-1
AWS_S3_PREFIX=uploads

# Campaign / background load
CAMPAIGN_PACING_MODE=safe
CAMPAIGN_MAX_PARALLEL_EXECUTIONS=1
CONTACTS_SYNC_INTERVAL_MS=1800000

# Only on YOUR main licensor app — not every whitelabel:
# DISABLE_PLATFORM_MASTER_SYNC=true
```

---

## Phase 7 — Database schema sync

```bash
cd /var/www/helicoptic   # or per-site folder
npm run db:sync -- --skip-push   # first time if Drizzle warns about data loss
```

If Drizzle shows **"delete tables / data loss"** → choose **No, abort**.  
Use `--skip-push` until `shared/schema.ts` matches your DB.

When safe (only adds columns/indexes):

```bash
npm run db:sync
```

Then:

```bash
pm2 start ecosystem.config.cjs --only your-app-name
pm2 save
pm2 startup
```

---

## Phase 8 — Nginx + SSL (per domain)

```bash
sudo nano /etc/nginx/sites-available/customer-a.com
```

```nginx
server {
    listen 80;
    server_name customer-a.com www.customer-a.com;
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
}
```

```bash
sudo ln -s /etc/nginx/sites-available/customer-a.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d customer-a.com -d www.customer-a.com
```

DNS: **A record** → EC2 **Elastic IP**.

---

## Phase 9 — Migrate data from old account / Neon / Hostinger

### 9.1 Database

```bash
# Dump from old source
pg_dump "OLD_DATABASE_URL" -Fc -f backup.dump

# Restore to new RDS (from EC2)
pg_restore -d "postgresql://helicoptic_admin:PASS@NEW_RDS:5432/customer_a?sslmode=require" \
  --no-owner --no-acl backup.dump
```

One-time transfer — not daily. Do during low traffic.

### 9.2 Media files

```bash
# From old server
rsync -avz old-server:/path/to/uploads/ ./uploads/

# Upload to S3
MEDIA_STORAGE=dual AWS_S3_BUCKET=helicoptic-media-prod AWS_REGION=ap-south-1 \
  npx tsx scripts/sync-uploads-to-s3.ts

# Then switch to S3-only in .env
MEDIA_STORAGE=s3
```

### 9.3 Cutover

1. Lower DNS TTL 24h before switch.
2. Point domain to new Elastic IP.
3. Test inbox, campaigns, webhooks.
4. **Shut down old AWS account resources** (RDS, EC2) so old account stops billing.

---

## Phase 10 — Adding whitelabel #2, #3, …

On **same EC2**, **same RDS**:

1. `CREATE DATABASE` + user in SQL (Phase 5).
2. New folder or path, copy `.env` (new `PORT`, `PGDATABASE`, `BASE_URL`).
3. `npm run db:sync -- --skip-push` (or full sync if clean DB).
4. `pm2 start` with new app name.
5. New Nginx vhost + certbot.
6. DNS A → same Elastic IP.

---

## What NOT to buy

| Avoid | Why |
|-------|-----|
| RDS per customer | $50+ each/month |
| EC2 per customer | $50+ each/month |
| ALB (initially) | ~$18–25/month |
| NAT Gateway | ~$32+/month + data |
| RDS public + app outside AWS | Egress trap |
| Multi-AZ RDS (pilot) | 2× DB cost |
| `db.t4g.large` until CPU > 60% | Wasted money |

---

## Weekly monitoring

1. **Cost Explorer** → filter **Data Transfer** — should stay **under $5/month**.
2. **RDS** → Monitoring → CPU, connections.
3. If connections high: lower `PG_POOL_MAX` per PM2 app.
4. If CPU high: scale RDS to `db.t4g.large` or EC2 to `t4g.xlarge` — one step at a time.

---

## Checklist summary

- [ ] New AWS account + MFA + $100 budget alert
- [ ] Region: `ap-south-1`
- [ ] SG-RDS: 5432 from EC2 SG only
- [ ] RDS `db.t4g.medium`, **public access = No**
- [ ] S3 bucket (private)
- [ ] EC2 `t4g.large` + Elastic IP + IAM role for S3
- [ ] Deploy **latest code** (cost fixes)
- [ ] `.env`: private RDS, `MEDIA_STORAGE=s3`, `PG_POOL_MAX=3`
- [ ] `npm run db:sync` (abort if data-loss warning)
- [ ] Nginx + Certbot per domain
- [ ] Migrate DB + uploads once
- [ ] **Delete/shutdown old AWS resources**

---

## Related docs in repo

- `docs/AWS_COST_CONTROL.md` — cost breakdown & S3 details
- `docs/AWS_RDS_NEON_MIGRATION.md` — SQL templates for new databases
- `docs/MULTI_DOMAIN_DEPLOYMENT.md` — PM2 multi-domain pattern
- `.env.example` — all env variables

---

## Support commands cheat sheet

```bash
# DB sync (safe SQL only)
npm run db:sync -- --skip-push

# Full sync
npm run db:sync

# PM2
pm2 restart all --update-env
pm2 logs

# DB size
psql "$DATABASE_URL" -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
```
