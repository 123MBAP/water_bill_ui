/**
 * Simple in-memory API cache.
 * Stores responses per key for `ttl` milliseconds (default 60s).
 * Prevents re-fetching the same data when switching between tabs.
 */
const store = new Map();
const DEFAULT_TTL = 60_000; // 60 seconds

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
  return entry.value;
}

export function cacheSet(key, value, ttl = DEFAULT_TTL) {
  store.set(key, { value, expiresAt: Date.now() + ttl });
}

export function cacheDelete(key) {
  store.delete(key);
}

/** Invalidate all entries matching a prefix (e.g. 'admin-') */
export function cacheInvalidate(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Cached fetch helper.
 * If the cache holds a fresh value, returns it instantly.
 * Otherwise calls `fetchFn()`, stores the result, and returns it.
 */
export async function cached(key, fetchFn, ttl = DEFAULT_TTL) {
  const hit = cacheGet(key);
  if (hit !== null) return hit;
  const value = await fetchFn();
  cacheSet(key, value, ttl);
  return value;
}
