/**
 * Persist the exact GET /api/customer JSON shape: deep-clone the body, replace known secret values
 * with "[REDACTED]", leave every other key/value as returned (including nulls).
 * Sync timing is not duplicated here — use platform_master_settings.last_sync_at / last_sync_status.
 * Live flows (git pull, etc.) use fetchCustomerFromApi() in memory and are not limited to this shape.
 */
export function cloneJsonRecord<T extends Record<string, unknown>>(data: T): T {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(data) as T;
    } catch {
      /* BigInt or non-cloneable values — fall back */
    }
  }
  return JSON.parse(JSON.stringify(data)) as T;
}

export function redactCustomerPortalPayloadForStorage(data: Record<string, unknown>): Record<string, unknown> {
  const clone = cloneJsonRecord(data);

  const redact = (val: unknown) => (val == null ? val : "[REDACTED]");

  const topSecretKeys = [
    "production_key",
    "github_token",
    "github_password",
    "razorpay_key_secret",
    "cashfree_secret_key",
    "cashfree_webhook_secret",
  ];
  for (const k of topSecretKeys) {
    if (k in clone && clone[k] != null) clone[k] = redact(clone[k]);
  }

  const pgc = clone.payment_gateway_credentials;
  if (pgc && typeof pgc === "object" && !Array.isArray(pgc)) {
    const o = pgc as Record<string, unknown>;
    if (o.key_secret != null) o.key_secret = redact(o.key_secret);
    if (o.secret_key != null) o.secret_key = redact(o.secret_key);
    if (o.webhook_secret != null) o.webhook_secret = redact(o.webhook_secret);
  }

  const payment = clone.payment;
  if (payment && typeof payment === "object" && !Array.isArray(payment)) {
    const pay = payment as Record<string, unknown>;
    const creds = pay.credentials;
    if (creds && typeof creds === "object" && !Array.isArray(creds)) {
      const c = creds as Record<string, unknown>;
      if (c.key_secret != null) c.key_secret = redact(c.key_secret);
      if (c.secret_key != null) c.secret_key = redact(c.secret_key);
      if (c.webhook_secret != null) c.webhook_secret = redact(c.webhook_secret);
    }
  }

  const providers = clone.credit_line_providers;
  if (providers && typeof providers === "object" && !Array.isArray(providers)) {
    for (const val of Object.values(providers as Record<string, unknown>)) {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const p = val as Record<string, unknown>;
        if (p.accessToken != null) p.accessToken = redact(p.accessToken);
        if (p.access_token != null) p.access_token = redact(p.access_token);
      }
    }
  }

  return clone;
}
