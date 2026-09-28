import { prisma, isPostgresConfigured } from "./db";
import { readStore, writeStore } from "./storage";

interface CacheRecord<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

const memCache = new Map<string, CacheRecord<unknown>>();

export const CACHE_TTL = {
  CURRENT_WEATHER: 300,
  FORECAST: 900,
  AIR_QUALITY: 600,
  GEOCODING: 86400,
  HISTORICAL: 86400 * 7,
};

export async function getCached<T>(key: string): Promise<T | null> {
  const now = Date.now();

  const inMem = memCache.get(key);
  if (inMem) {
    if (inMem.expiresAt > now) {
      return inMem.data as T;
    }
    memCache.delete(key);
  }

  if (isPostgresConfigured) {
    try {
      const dbEntry = await prisma.apiCacheEntry.findUnique({ where: { key } });
      if (dbEntry) {
        if (dbEntry.expiresAt.getTime() > now) {
          const parsed = JSON.parse(dbEntry.data) as T;
          memCache.set(key, { data: parsed, expiresAt: dbEntry.expiresAt.getTime(), createdAt: dbEntry.createdAt.getTime() });
          return parsed;
        }
        prisma.apiCacheEntry.delete({ where: { key } }).catch(() => {});
      }
    } catch {
    }
  }

  const store = readStore<Record<string, CacheRecord<T>>>("api-cache", {});
  const entry = store[key];
  if (entry) {
    if (entry.expiresAt > now) {
      memCache.set(key, entry);
      return entry.data;
    }
    delete store[key];
    writeStore("api-cache", store);
  }

  return null;
}

export async function setCached<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;
  const record: CacheRecord<T> = { data, expiresAt, createdAt: now };

  memCache.set(key, record);

  if (isPostgresConfigured) {
    try {
      await prisma.apiCacheEntry.upsert({
        where: { key },
        update: {
          data: JSON.stringify(data),
          expiresAt: new Date(expiresAt),
        },
        create: {
          key,
          data: JSON.stringify(data),
          expiresAt: new Date(expiresAt),
        },
      });
      return;
    } catch {
    }
  }

  try {
    const store = readStore<Record<string, CacheRecord<T>>>("api-cache", {});
    store[key] = record;
    // Cleanup expired keys if size > 100
    const keys = Object.keys(store);
    if (keys.length > 100) {
      for (const k of keys) {
        if (store[k].expiresAt < now) delete store[k];
      }
    }
    writeStore("api-cache", store);
  } catch {
  }
}
