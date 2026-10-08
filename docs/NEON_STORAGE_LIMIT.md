# Neon DB: "Project size limit exceeded" when running `db:push`

## What the error means

If you see:

```text
error: could not extend file because project size limit (3072 MB) has been exceeded
hint: This limit is defined by neon.max_cluster_size GUC
```

your Neon **branch** has hit its **physical storage limit** (3 GB). Any write to the database—including schema changes from `npm run db:push`—will fail until you free space or get the limit increased.

## Fixes (you're on a paid plan)

### 1. Request a storage limit increase (recommended)

1. Open [Neon Console](https://console.neon.tech) → your project.
2. Go to **Settings** (project or organization).
3. Use the **Feedback** / support form.
4. Request a **"Storage limit increase"** or **"Increase project/branch size limit"** for this project.

On Launch/Scale plans, Neon can raise `neon.max_cluster_size` for your branch. After they increase it, **restart the branch’s compute** in the console so the new limit takes effect.

### 2. Free space so `db:push` works now

1. In Neon Console → **Branches** → your branch → check **Storage**.
2. In **SQL Editor** or via `psql`:
   - Run `VACUUM FULL;` to reclaim space (can lock tables).
   - Drop unused tables, indexes, or old data, then run `VACUUM;`.
3. Retry `npm run db:push` once usage is below the limit.

### 3. SSL warning in the terminal

If you see a security warning about SSL modes (`prefer` / `require` / `verify-ca`), add this to your connection string so it stays correct in future Node/pg versions:

- In `DATABASE_URL`, use: `?sslmode=verify-full` (or append it if you already have query params).

Example:

```text
postgresql://user:pass@host/db?sslmode=verify-full
```

This does not fix the size limit; it only avoids the SSL deprecation warning.
