import crypto from "crypto";

type AdminLoginToken = {
  expiresAt: number;
  redirect: string;
};

/** Short-lived one-time tokens so SaaS can open the panel origin and set the session cookie there. */
const tokens = new Map<string, AdminLoginToken>();

const TTL_MS = 2 * 60 * 1000;

function prune() {
  const now = Date.now();
  for (const [k, v] of tokens) {
    if (v.expiresAt <= now) tokens.delete(k);
  }
}

export function mintRemoteAdminLoginToken(redirectPath: string): string {
  prune();
  const redirect =
    typeof redirectPath === "string" && redirectPath.startsWith("/") && !redirectPath.startsWith("//")
      ? redirectPath
      : "/admin";
  const token = crypto.randomBytes(32).toString("hex");
  tokens.set(token, { expiresAt: Date.now() + TTL_MS, redirect });
  return token;
}

export function consumeRemoteAdminLoginToken(token: string): { redirect: string } | null {
  prune();
  if (!token || typeof token !== "string") return null;
  const entry = tokens.get(token);
  tokens.delete(token);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return { redirect: entry.redirect };
}
