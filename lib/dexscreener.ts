/**
 * DexScreener API Client with Caching
 */

import { DexScreenerPair, CacheEntry } from './types';

const DEXSCREENER_API = 'https://api.dexscreener.com';

// Simple in-memory cache
const cache = new Map<string, CacheEntry<unknown>>();

// Cache configuration
const CACHE_CONFIG = {
  // New pairs endpoint - cache for 30 seconds to avoid rate limiting
  newPairs: 30 * 1000,
  // Token details - cache for 60 seconds
  tokenDetails: 60 * 1000,
};

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  const now = Date.now();
  cache.set(key, {
    data,
    timestamp: now,
    expiresAt: now + ttlMs,
  });
}

/**
 * Fetch new Solana pairs from DexScreener
 * Uses the token profiles/latest endpoint for newest pairs
 */
export async function fetchNewSolanaPairs(): Promise<DexScreenerPair[]> {
  const cacheKey = 'solana-new-pairs';
  const cached = getCached<DexScreenerPair[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Fetch latest pairs from Solana
    // DexScreener's latest pairs endpoint
    const response = await fetch(
      `${DEXSCREENER_API}/latest/dex/pairs/solana`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 30 },
      }
    );

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    const data = await response.json();
    const pairs: DexScreenerPair[] = data.pairs || [];

    // Filter to only include pairs created in the last 4 hours
    // to ensure we capture early-stage tokens
    const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
    const recentPairs = pairs.filter(
      (p: DexScreenerPair) => p.pairCreatedAt && p.pairCreatedAt > fourHoursAgo
    );

    setCache(cacheKey, recentPairs, CACHE_CONFIG.newPairs);
    return recentPairs;
  } catch (error) {
    console.error('Error fetching new Solana pairs:', error);

    // Return cached data even if expired in case of error
    const staleCache = cache.get(cacheKey);
    if (staleCache) {
      return staleCache.data as DexScreenerPair[];
    }

    return [];
  }
}

/**
 * Fetch multiple token pairs by their addresses
 * Useful for refreshing specific tokens we're tracking
 */
export async function fetchPairsByAddresses(
  pairAddresses: string[]
): Promise<DexScreenerPair[]> {
  if (pairAddresses.length === 0) return [];

  // DexScreener allows fetching multiple pairs in one request
  // Max 30 pairs per request
  const chunks: string[][] = [];
  for (let i = 0; i < pairAddresses.length; i += 30) {
    chunks.push(pairAddresses.slice(i, i + 30));
  }

  const allPairs: DexScreenerPair[] = [];

  for (const chunk of chunks) {
    const cacheKey = `pairs-${chunk.sort().join(',')}`;
    const cached = getCached<DexScreenerPair[]>(cacheKey);

    if (cached) {
      allPairs.push(...cached);
      continue;
    }

    try {
      const addresses = chunk.join(',');
      const response = await fetch(
        `${DEXSCREENER_API}/latest/dex/pairs/solana/${addresses}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(`DexScreener API error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const pairs: DexScreenerPair[] = data.pairs || (data.pair ? [data.pair] : []);

      setCache(cacheKey, pairs, CACHE_CONFIG.tokenDetails);
      allPairs.push(...pairs);
    } catch (error) {
      console.error('Error fetching pairs by address:', error);
    }
  }

  return allPairs;
}

/**
 * Search for tokens by name or symbol
 */
export async function searchTokens(query: string): Promise<DexScreenerPair[]> {
  const cacheKey = `search-${query.toLowerCase()}`;
  const cached = getCached<DexScreenerPair[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(
      `${DEXSCREENER_API}/latest/dex/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    const data = await response.json();
    const pairs: DexScreenerPair[] = (data.pairs || []).filter(
      (p: DexScreenerPair) => p.chainId === 'solana'
    );

    setCache(cacheKey, pairs, CACHE_CONFIG.tokenDetails);
    return pairs;
  } catch (error) {
    console.error('Error searching tokens:', error);
    return [];
  }
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): {
  entries: number;
  keys: string[];
} {
  return {
    entries: cache.size,
    keys: Array.from(cache.keys()),
  };
}

/**
 * Clear the cache
 */
export function clearCache(): void {
  cache.clear();
}
