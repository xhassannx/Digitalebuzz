# AWS Cost Control & EC2 Architecture (Multi-Whitelabel)

This guide explains the **$400+ / 15-day bill**, what we fixed in code, and how to run **all whitelabel sites on AWS EC2** without blowing the budget.

---

## Why the bill was ~$404 (15 days)

| Service | Cost | Root cause |
|---------|------|------------|
| **Data Transfer** | **$341** | ~4 TB egress from RDS public endpoint to Hostinger VPS |
| RDS | $50 | Normal for `db.t4g.medium`–`large` + storage |
| EC2 | $10 | Small test/instance |
| Tax (India) | $73 | 18% GST on above |

**The $80–85/month estimate assumed Phase 2:** app + DB in the **same AWS VPC** (private RDS).  
**Phase 1 (VPS → public RDS)** bills **every byte** the VPS reads from RDS at ~$0.11/GB after free tier.

Campaign webhooks were loading **entire chat histories** on every delivery/read event — multiplying egress during bulk sends.

---

## Code fixes (deploy immediately)

These changes use **indexed SQL lookups** (`idx_messages_whatsapp_id`, `idx_messages_campaign`) instead of `getMessagesByChat()` full-table scans:

| Area | Before | After |
|------|--------|-------|
| WhatsApp status webhooks | Scan all chats × all messages | `getMessageByIdOrWhatsAppId` + `getRecentOutboundMessageForSession` |
| Incoming message dedup | Load full chat history | `getMessageByWhatsAppIdInChat` |
| Reaction fallback | Full chat scan | Indexed lookup only |
| Campaign diagnostics | Scan every chat | `getMessagesByCampaignId`, `countCampaignDeliveriesSince` |
| Message status API | Nested chat loops | Single `getMessageByIdOrWhatsAppId` |

**Deploy:** push to VPS/EC2 → `pm2 restart all --update-env` on every whitelabel app.

**No UX change** — same webhook behaviour, orders of magnitude less DB traffic.

---

## Target architecture (all clients on EC2)

```
                    Internet (HTTPS)
                          │
              ┌───────────▼───────────┐
              │  EC2 (one server)      │
              │  Nginx → PM2 apps      │
              │  PORT 5001, 5002, …    │
              │  /uploads on EBS or S3 │
              └───────────┬───────────┘
                          │ private VPC (free transfer)
              ┌───────────▼───────────┐
              │  RDS PostgreSQL        │
              │  ap-south-1, no public │
              │  1 DB per whitelabel   │
              └───────────────────────┘
```

### Critical rules

1. **RDS: Public access = No** after apps move to EC2.
2. **Security group:** RDS allows port 5432 **only from EC2 security group** (not `0.0.0.0/0`).
3. **Same VPC, same AZ** as RDS (e.g. `ap-south-1a`) for lowest latency.
4. **No ALB** until you need it — Nginx on EC2 + Let's Encrypt saves ~$18–25/month.
5. **Media:** keep on EC2 EBS initially; move to **S3** when disk grows (S3 egress still costs — use same-region).

### Per-whitelabel on one EC2 (same as Hostinger today)

| Site | PM2 name | PORT | RDS database |
|------|----------|------|--------------|
| customer-a.com | helicoptic-a | 5002 | customer_a |
| customer-b.com | helicoptic-b | 5003 | customer_b |

One git deploy, many `.env` files — see `docs/MULTI_DOMAIN_DEPLOYMENT.md`.

---

## One EC2 for all whitelabel vs separate EC2 per client

| Approach | Monthly cost (50 sites) | Speed | Recommendation |
|----------|-------------------------|-------|----------------|
| **One shared EC2** | **$70–150** total | Fast if sized right | **Use this** |
| One EC2 per whitelabel | $70 × 50 = **$3,500+** | Isolated | Only for enterprise clients paying premium |
| Separate RDS per client | $50 × 50 = **$2,500+** | Same DB speed | **Never** — use one RDS, many databases |

**Answer: one EC2 for all 50 whitelabel customers.**  
Your codebase already supports this (PM2 per domain, separate `PGDATABASE` per site).

Isolate only when a single customer needs dedicated resources **and pays for it**.

---

## Realistic budget vs 50 whitelabel customers

**Honest answer:** **$80–85/month total for 50 active whitelabel sites with “high speed” is not achievable** on AWS Mumbai with RDS + EC2.

That budget fits **1–3 pilot sites** on a lean stack. For 50 sites you need either a higher budget or strict limits.

### Recommended tiers (Mumbai `ap-south-1`, USD approx.)

#### Tier A — Pilot (1–5 whitelabel) — **~$75–95/month**

| Resource | Spec | ~$/month |
|----------|------|----------|
| RDS | `db.t4g.medium`, Single-AZ, 50 GB gp3 | $55 |
| EC2 | `t4g.large` (2 vCPU, 8 GB) | $55 |
| S3 + transfer | Minimal media | $5–10 |
| **Total** | | **~$115** before optimizations |

Use **1-year no-upfront Reserved Instance** on EC2/RDS to reach **~$80–90**.

#### Tier B — Growth (10–25 whitelabel) — **~$130–180/month**

| Resource | Spec |
|----------|------|
| RDS | `db.t4g.large` or `db.m6g.large` |
| EC2 | `m6g.xlarge` (4 vCPU, 16 GB) |
| Redis | ElastiCache `cache.t4g.micro` or Upstash Mumbai |

#### Tier C — 50 whitelabel (moderate traffic) — **~$200–280/month**

| Resource | Spec |
|----------|------|
| RDS | `db.m6g.large`, 100–200 GB gp3 |
| EC2 | `m6g.2xlarge` (8 vCPU, 32 GB) — similar to your Hostinger KVM 8 |
| S3 | Media + lifecycle rules |
| Optional ALB | +$18–25 if you need multi-EC2 later |

To **approach** $85/month at scale you would need:

- Reserved Instances (1-year commit)
- No ALB, no NAT Gateway (use EC2 public IP + Nginx)
- Aggressive connection pooling (`PG_POOL_MAX=8` per app — already in `.env`)
- No public RDS (eliminates egress — biggest win)
- Archive old messages; keep inbox queries paginated (limit 200 — already default)

---

## S3 media storage (built-in)

The app stores gallery, inbox media, website-builder images, and profile avatars under `/uploads/...` URLs in the database. With S3 enabled, files go to a **private bucket** in `ap-south-1`; the app still serves the same `/uploads/...` paths (no DB migration).

### AWS setup (one-time)

1. **S3 bucket** — e.g. `helicoptic-media-prod` in **ap-south-1**
2. **Block all public access** — ON (files served through your app/Nginx)
3. **EC2 IAM role** — attach policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::helicoptic-media-prod",
        "arn:aws:s3:::helicoptic-media-prod/*"
      ]
    }
  ]
}
```

4. **Lifecycle** (optional, saves cost): move to S3 Infrequent Access after 90 days

### `.env` on each whitelabel PM2 app

```env
MEDIA_STORAGE=s3
AWS_S3_BUCKET=helicoptic-media-prod
AWS_REGION=ap-south-1
AWS_S3_PREFIX=uploads
```

No `AWS_ACCESS_KEY_ID` needed on EC2 when using IAM role.

### Migrate existing Hostinger `uploads/` folder

```bash
# On EC2 after rsync from VPS
MEDIA_STORAGE=dual AWS_S3_BUCKET=helicoptic-media-prod AWS_REGION=ap-south-1 \
  npx tsx scripts/sync-uploads-to-s3.ts

# Then switch to S3-only
MEDIA_STORAGE=s3
pm2 restart all --update-env
```

### Cost (Mumbai, approx.)

| Usage | ~$/month |
|-------|----------|
| 50 GB stored | $1.15 |
| 100 GB stored | $2.30 |
| 200 GB egress via EC2 (same region S3→EC2) | ~$2 |

S3 is much cheaper than filling EC2 EBS with media and safer for backups.

---

## Migration checklist: Hostinger VPS → EC2

### Before cutover

- [ ] Launch EC2 Ubuntu 24.04 in **same VPC/AZ as RDS**
- [ ] Install Node 20, PM2, Nginx, `postgresql-client`
- [ ] Clone repo; copy each whitelabel `.env`
- [ ] Set `PGHOST` to **RDS private endpoint** (not public)
- [ ] RDS: disable public access; SG = EC2 SG only
- [ ] Sync `uploads/` to S3: `npx tsx scripts/sync-uploads-to-s3.ts` (see S3 section above)
- [ ] DNS: point domains to EC2 Elastic IP (lower TTL 24h before)
- [ ] Deploy code with webhook fixes (this PR)
- [ ] Set AWS Budget alert at **$100/month**

### After cutover (week 1)

- [ ] Cost Explorer → filter **Data Transfer** — should drop to **<$5/month**
- [ ] Cancel Hostinger when stable
- [ ] Monitor RDS CPU; scale instance before adding second EC2

### Do NOT

- Open RDS to `0.0.0.0/0`
- Run `pg_dump`/`pg_restore` repeatedly in production hours
- Use **Create database** in RDS console for each whitelabel (creates new **server** — $$$)
- Put app on VPS and DB on AWS long-term (egress trap)

---

## Monitoring

```bash
# DB size
psql "$DATABASE_URL" -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Top tables
psql "$DATABASE_URL" -c "
  SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
  FROM pg_stat_user_tables
  ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;"
```

**AWS Console:** Billing → Cost Explorer → Group by **Usage type** + **Service** weekly.

---

## Summary

| Question | Answer |
|----------|--------|
| Why $400 in 15 days? | **4 TB RDS egress** to Hostinger + webhook full-table scans |
| Fix? | Deploy code fixes + move app to EC2 in same VPC as RDS |
| One EC2 or many? | **One EC2 for all 50 whitelabel** |
| $80 for 50 sites? | **Not realistic** — plan **~$200–280** or **~$130** with Reserved Instances + lean stack |
| Fast inbox? | Private VPC RDS + right-sized EC2 + indexed queries (done in code) |

See also: `docs/AWS_RDS_NEON_MIGRATION.md`, `Amazon_server_database_steps.txt`, `docs/MULTI_DOMAIN_DEPLOYMENT.md`.
