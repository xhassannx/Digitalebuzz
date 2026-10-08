/**
 * High-performance in-memory TTL cache for reducing PostgreSQL database round-trips
 * on VPS deployments.
 *
 * Caches frequently queried hot data (organization memberships, roles, permissions,
 * and user plan details) that otherwise cause massive N+1 query overhead on page loads.
 */

export class MemoryCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private defaultTtlMs: number;
  private maxItems: number;

  constructor(defaultTtlMs: number = 60_000, maxItems: number = 5000) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxItems = maxItems;
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxItems) {
      const now = Date.now();
      for (const [k, v] of this.cache) {
        if (v.expiresAt <= now) this.cache.delete(k);
      }
      while (this.cache.size >= this.maxItems) {
        const firstKey = this.cache.keys().next().value;
        if (!firstKey) break;
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  deleteMatching(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// 60-second cache for organization membership list by user: key = userId
export const userOrganizationsCache = new MemoryCache<any[]>(60_000, 2000);

// 60-second cache for organization member info: key = `${organizationId}:${userId}`
export const orgMemberCache = new MemoryCache<any>(60_000, 5000);

// 60-second cache for organization profile/settings: key = organizationId
export const orgProfileCache = new MemoryCache<any>(60_000, 2000);

// 30-second cache for organization active WhatsApp sessions list: key = organizationId
export const orgSessionsCache = new MemoryCache<any[]>(30_000, 2000);

/**
 * Invalidate all cached data for a specific organization or user when an edit occurs.
 */
export function invalidateOrgCache(organizationId?: string, userId?: string): void {
  if (organizationId) {
    orgProfileCache.delete(organizationId);
    orgSessionsCache.delete(organizationId);
    orgMemberCache.deleteMatching(`${organizationId}:`);
  }
  if (userId) {
    userOrganizationsCache.delete(userId);
    orgMemberCache.deleteMatching(`*:${userId}`);
  }
}
