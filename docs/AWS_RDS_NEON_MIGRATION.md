# AWS RDS + Neon Migration Guide (Multi-Whitelabel)

This guide covers:

1. Using **one AWS RDS PostgreSQL instance** in **Mumbai (`ap-south-1`)** for multiple whitelabel sites
2. Creating a **new database per site** from the VPS (not the AWS “Create database” button)
3. **Dumping from Neon** and **restoring to AWS RDS**
4. Connecting each site via `.env` and PM2

---

## Architecture

```
Hostinger VPS (Mumbai)                    AWS RDS Mumbai (one instance)
┌─────────────────────────┐              ┌──────────────────────────────┐
│ PM2: helicopticsolutions│──┐           │  helicoptic-prod (RDS server) │
│ PM2: letmelogin         │  ├─────────►│  ├── helicoptic   (site 1)  │
│ PM2: other-site         │──┘           │  ├── letmelogin   (site 2)  │
└─────────────────────────┘              │  └── other_db     (site 3)  │
                                         └──────────────────────────────┘
```

| Item | Rule |
|------|------|
| AWS **Create database** button | Creates a **new RDS server** ($$$) — use only for the first server |
| `CREATE DATABASE` in SQL | Creates a **new database on the same server** (correct for each whitelabel) |
| One site | One `PGDATABASE` + one app user + one `.env` + one PM2 app |

---

## Prerequisites

### AWS (one-time)

- RDS PostgreSQL in **Asia Pacific (Mumbai) `ap-south-1`**
- Instance: **Single-AZ**, e.g. `db.t4g.medium`
- **Engine: PostgreSQL 17** if migrating from Neon 17 (avoids `transaction_timeout` errors)
- **Public access: Yes** (while apps run on Hostinger VPS)
- Security group inbound: **PostgreSQL 5432** from VPS IP only, e.g. `46.28.44.79/32`
- Note the **endpoint**, e.g. `helicoptic.xxxxx.ap-south-1.rds.amazonaws.com`
- Master user/password (e.g. `Helicoptic` / your master password)

### VPS (per server, one-time)

```bash
sudo apt update
sudo apt install -y postgresql-client
```

When prompted to upgrade local PostgreSQL cluster, choose **No** (you only need client tools for RDS).

Confirm `pg_dump` / `pg_restore` 18 exist:

```bash
/usr/lib/postgresql/18/bin/pg_dump --version
/usr/lib/postgresql/18/bin/pg_restore --version
```

If missing:

```bash
sudo apt install -y postgresql-client-18
```

---

## Part 1 — Create a new database on existing RDS (from VPS)

Do this for **each new whitelabel site**. Do **not** click **Create database** in the AWS RDS console (that buys another server).

### 1.1 SSH to VPS

```bash
ssh root@YOUR_VPS_IP
sudo su - SITE_LINUX_USER
```

### 1.2 Connect as RDS master user

Connect to the `postgres` admin database:

```bash
psql "postgresql://MASTER_USER:MASTER_PASSWORD@RDS_ENDPOINT:5432/postgres?sslmode=require"
```

Example:

```bash
psql "postgresql://Helicoptic:YOUR_PASSWORD@helicoptic.xxxxx.ap-south-1.rds.amazonaws.com:5432/postgres?sslmode=require"
```

### 1.3 Create database and app user

Replace `SITE_DB`, `SITE_APP_USER`, and `SITE_APP_PASSWORD`:

```sql
CREATE DATABASE site_db;
CREATE USER site_app_user WITH ENCRYPTED PASSWORD 'StrongUniquePassword123!';
GRANT ALL PRIVILEGES ON DATABASE site_db TO site_app_user;
```

Switch into the new database (**run this line alone**, press Enter, wait for prompt):

```sql
\c site_db
```

Then run **one command per line**:

```sql
GRANT ALL ON SCHEMA public TO site_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO site_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO site_app_user;
\q
```

**Example for letmelogin:**

| Setting | Value |
|---------|--------|
| Database | `letmelogin` |
| User | `letmelogin_app` |

### 1.4 Test app user connection

```bash
psql "postgresql://site_app_user:StrongUniquePassword123!@RDS_ENDPOINT:5432/site_db?sslmode=require" -c "SELECT 1;"
```

Expected: `1` row.

---

## Part 2 — Dump from Neon

### 2.1 Get Neon connection string

From **Neon Console → Connection details**:

- Use **pooler** URL for dump (or **direct** host if pooler times out on large DBs)
- Format: `postgresql://USER:PASSWORD@HOST/neondb?sslmode=require`
- Remove `channel_binding=require` if tools complain (keep `sslmode=require`)

```bash
export NEON_URL="postgresql://neondb_owner:NEON_PASSWORD@YOUR_NEON_HOST/neondb?sslmode=require"
```

### 2.2 Run pg_dump (must use version 17+ client)

Neon is usually PostgreSQL **17**. Default `pg_dump` on Ubuntu may be **16** and will fail with “server version mismatch”.

```bash
/usr/lib/postgresql/18/bin/pg_dump "$NEON_URL" \
  --no-owner \
  --no-acl \
  -Fc \
  -f /tmp/neon-SITE_NAME.dump
```

Check file size:

```bash
ls -lh /tmp/neon-SITE_NAME.dump
```

Large DBs (1+ GB) can take many minutes.

### 2.3 Optional — compare row counts on Neon before cutover

```bash
psql "$NEON_URL" -c "SELECT COUNT(*) FROM users;"
psql "$NEON_URL" -c "SELECT COUNT(*) FROM messages;"
psql "$NEON_URL" -c "SELECT COUNT(*) FROM chats;"
```

---

## Part 3 — Restore dump to AWS RDS

### 3.1 RDS engine version

| Neon version | RDS must be |
|--------------|-------------|
| PostgreSQL 17 | **PostgreSQL 17** on RDS |
| PostgreSQL 16 | PostgreSQL 16+ |

If restore fails with:

```text
unrecognized configuration parameter "transaction_timeout"
```

Upgrade RDS: **RDS → helicoptic → Modify → Engine version → PostgreSQL 17.x → Apply immediately**. Wait until **Available**.

### 3.2 Restore with pg_restore 18

Use the **master** user and target **site database** (not `postgres`):

```bash
export RDS_URL="postgresql://MASTER_USER:MASTER_PASSWORD@RDS_ENDPOINT:5432/site_db?sslmode=require"

/usr/lib/postgresql/18/bin/pg_restore -d "$RDS_URL" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  /tmp/neon-SITE_NAME.dump 2>&1 | tee /tmp/restore-SITE_NAME.log
```

**Important:**

- Use `/usr/lib/postgresql/18/bin/pg_restore` (not default `pg_restore` 16)
- Do **not** press Ctrl+C — large dumps can take **20–60+ minutes**
- Some warnings in the log are normal; check for **FATAL** errors:

```bash
grep -i "fatal\|error" /tmp/restore-SITE_NAME.log | tail -30
```

### 3.3 Grant permissions after restore

Restore as master user; grant access to the site app user:

```bash
psql "$RDS_URL" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO site_app_user;"
psql "$RDS_URL" -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO site_app_user;"
psql "$RDS_URL" -c "GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO site_app_user;"
```

### 3.4 Verify data on AWS

```bash
export APP_URL="postgresql://site_app_user:StrongUniquePassword123!@RDS_ENDPOINT:5432/site_db?sslmode=require"

psql "$APP_URL" -c "SELECT COUNT(*) FROM users;"
psql "$APP_URL" -c "SELECT COUNT(*) FROM messages;"
psql "$APP_URL" -c "SELECT COUNT(*) FROM chats;"
```

Counts should match Neon (Part 2.3).

---

## Part 4 — Fresh database (no Neon import)

If the site is **new** and has no Neon data:

1. Complete **Part 1** (create DB + user)
2. Set `.env` (Part 5)
3. Push schema:

```bash
cd ~/htdocs/DOMAIN/helicoptic-whatsapp
set -a && source .env && set +a
npm run db:push
```

4. Continue with indexes and PM2 (Parts 6–7)

---

## Part 5 — Site `.env` configuration

Each whitelabel site has its **own** `.env`. Same RDS **host**, different **database** and **user**.

### 5.1 Comment out Neon

```env
# DATABASE_URL="postgresql://neondb_owner:...@....neon.tech/neondb?..."
```

### 5.2 AWS connection (recommended for Node.js)

```env
DATABASE_URL=postgresql://site_app_user:StrongUniquePassword123!@RDS_ENDPOINT:5432/site_db?sslmode=no-verify
PG_POOL_MAX=8
```

Alternative (if SSL errors in Node):

```env
DATABASE_URL=postgresql://site_app_user:PASSWORD@RDS_ENDPOINT:5432/site_db?uselibpqcompat=true&sslmode=require
```

### 5.3 Site-specific settings (do not copy from other sites)

```env
BASE_URL=https://your-domain.com
VITE_BASE_URL=https://your-domain.com
PORT=5003
NODE_ENV=production
WHITELABEL_ORG_ID=your-org-uuid
```

Each site needs a **unique `PORT`** on the same VPS.

### 5.4 Examples

**helicopticsolutions.in:**

```env
DATABASE_URL=postgresql://Helicoptic:PASSWORD@helicoptic.xxxxx.ap-south-1.rds.amazonaws.com:5432/helicoptic?sslmode=no-verify
```

**letmelogin.in:**

```env
DATABASE_URL=postgresql://letmelogin_app:PASSWORD@helicoptic.xxxxx.ap-south-1.rds.amazonaws.com:5432/letmelogin?sslmode=no-verify
```

---

## Part 6 — Performance indexes (inbox)

After restore or `db:push`:

```bash
cd ~/htdocs/DOMAIN/helicoptic-whatsapp
psql "$APP_URL" -f migrations/add_dashboard_performance_indexes.sql
```

---

## Part 7 — Restart application

```bash
pm2 list
pm2 restart SITE_PM2_APP_NAME --update-env
pm2 logs SITE_PM2_APP_NAME --lines 50
```

Restart **only** the site you migrated. Do not restart other whitelabel PM2 apps unless their `.env` changed.

---

## Part 8 — Testing and cutover

1. Open the site in browser — login with existing Neon credentials
2. Test inbox / chat / messages
3. Send and receive a test WhatsApp message
4. After **2–3 days** stable, pause or delete the Neon branch to stop billing

---

## Part 9 — CI/CD notes

In `DEPLOY_TARGETS_JSON`:

- `run_db_push: true` for **only one** target per database
- Other targets sharing the same DB: `run_db_push: false`
- Each site: unique `pm2_app_name`, `deploy_path`, `PORT`

---

## Quick reference — tool versions

| Task | Command |
|------|---------|
| Dump from Neon 17 | `/usr/lib/postgresql/18/bin/pg_dump` |
| Restore to RDS | `/usr/lib/postgresql/18/bin/pg_restore` |
| Interactive SQL | `psql` with `?sslmode=require` |
| App / Drizzle | `DATABASE_URL` with `sslmode=no-verify` or `uselibpqcompat=true&sslmode=require` |

---

## Troubleshooting

### `role "linuxuser" does not exist` when running psql

`$RDS_URL` is empty. Run `export RDS_URL=...` again or paste the full connection string inline.

### `server version mismatch` on pg_dump

Use `/usr/lib/postgresql/18/bin/pg_dump`, not default `pg_dump`.

### `unsupported version (1.16) in file header` on pg_restore

Use `/usr/lib/postgresql/18/bin/pg_restore`, not default `pg_restore`.

### `transaction_timeout` on restore

Neon is PG **17**, RDS is PG **16**. Upgrade RDS to **PostgreSQL 17**, then restore again.

### `password authentication failed`

- Check username case (`Helicoptic` vs `helicoptic`)
- Reset master password: **RDS → Modify → New master password**

### `no encryption` / SSL errors in Node or `db:push`

Use `DATABASE_URL` with `sslmode=no-verify` or `uselibpqcompat=true&sslmode=require`. Do not use `PGHOST` alone without SSL.

### `connection timed out`

- Security group must allow VPS IP `x.x.x.x/32` on port **5432**
- RDS **Public access** must be **Yes** (Phase 1 on Hostinger)

### Restore finished but app shows empty data

```bash
psql "$APP_URL" -c "\dt" | head -20
grep -i fatal /tmp/restore-SITE_NAME.log
```

Re-run restore after fixing RDS version or permissions.

### Database not visible in AWS console

Check region is **Mumbai (`ap-south-1`)**, not Europe/US. RDS databases are region-specific.

---

## Checklist — new whitelabel site

- [ ] `CREATE DATABASE` + app user on RDS (Part 1)
- [ ] `pg_dump` from Neon to `/tmp/neon-SITE.dump` (Part 2)
- [ ] RDS engine **PostgreSQL 17** if Neon is 17 (Part 3.1)
- [ ] `pg_restore` with **pg_restore 18** (Part 3.2)
- [ ] `GRANT` on tables/sequences to app user (Part 3.3)
- [ ] Row counts match Neon (Part 3.4)
- [ ] Update site `.env` — AWS URL, Neon commented (Part 5)
- [ ] Run index migration (Part 6)
- [ ] `pm2 restart SITE_APP --update-env` (Part 7)
- [ ] Browser test (Part 8)
- [ ] Disable Neon branch after stable

---

## Security reminders

- Restrict security group to **VPS IP only** — never `0.0.0.0/0` on port 5432
- Use a **unique app user + password** per database
- Do not commit `.env` or passwords to git
- Rotate passwords if exposed in chat or logs
- Phase 2 (apps on AWS EC2): set RDS **Public access: No**, allow only VPC security groups

---

## Related docs

- [MULTI_DOMAIN_DEPLOYMENT.md](./MULTI_DOMAIN_DEPLOYMENT.md) — multiple sites on one VPS
- [CI_CD_SETUP.md](../CI_CD_SETUP.md) — deploy targets and PM2 per site
