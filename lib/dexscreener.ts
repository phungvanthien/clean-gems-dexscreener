/**
 * DexScreener API Client with Caching
 */

import { DexScreenerPair, CacheEntry } from '@/lib/types';

const DEXSCREENER_API = 'https://api.dexscreener.com';

// Simple in-memory cache
const cache = new Map<string, CacheEntry<unknown>>();

// Cache configuration
const CACHE_CONFIG = {
  // New pairs endpoint - cache for 60 seconds to avoid rate limiting
  newPairs: 60 * 1000,
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
async function fetchPairMetadata(pair: DexScreenerPair): Promise<number | undefined> {
  try {
    const response = await fetch(
      `${DEXSCREENER_API}/token-pairs/v1/${pair.chainId}/${pair.pairAddress}`,
      { headers: { Accept: 'application/json' } },
    );

    if (!response.ok) {
      console.warn(`Failed to fetch metadata for ${pair.pairAddress}: ${response.status}`);
      return undefined;
    }

    const data = await response.json();
    return data.pairCreatedAt;
  } catch (error) {
    console.error(`Error fetching metadata for ${pair.pairAddress}:`, error);
    return undefined;
  }
}

async function fetchPairsBySearchTerms(): Promise<DexScreenerPair[]> {
  const searchTerms = [
    'new',
    'token',
    'meme',
    'coin',
    'gem',
    'launcher',
    'fresh',
    'pump',
    'sol',
    'solana',
    'launch',
    'airdrop',
    'nft',
    'gaming',
    'rapid',
    'viral',
    'mint',
    'dex',
    'rug',
    'y00ts',
    'ape',
    'squad',
    'mochi',
    'expo',
    'go',
    'rise',
    'sizzle',
  ];
  const seen = new Map<string, DexScreenerPair>();

  for (const term of searchTerms) {
    try {
      const url = `${DEXSCREENER_API}/latest/dex/search?q=${encodeURIComponent(term)}&chainId=solana`;
      console.log(`[fetchNewSolanaPairs] Searching "${term}" on Solana...`);
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 },
      });
      if (!res.ok) {
        console.warn(`[fetchNewSolanaPairs] Search "${term}" failed: ${res.status}`);
        continue;
      }
      const data = await res.json();
      const candidates: DexScreenerPair[] = data.pairs || [];
      for (const pair of candidates) {
        if (
          pair?.pairAddress &&
          pair?.chainId === 'solana' &&
          pair?.baseToken?.symbol?.toUpperCase() !== 'SOL' &&
          pair?.baseToken?.address &&
          !seen.has(pair.pairAddress)
        ) {
          seen.set(pair.pairAddress, pair);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`[fetchNewSolanaPairs] Search "${term}" error:`, error);
    }
  }

  console.log(`[fetchNewSolanaPairs] Search gathered ${seen.size} unique pairs`);
  return Array.from(seen.values());
}

async function fetchPairsFromProfiles(): Promise<DexScreenerPair[]> {
  try {
    const profilesUrl = `${DEXSCREENER_API}/token-profiles/latest/v1?chainId=solana`;
    console.log(`[fetchNewSolanaPairs] Fetching token profiles from: ${profilesUrl}`);
    const response = await fetch(profilesUrl, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      console.warn('[fetchNewSolanaPairs] Token profiles request failed: ', response.status);
      return [];
    }

    const data = await response.json();
    const rawProfiles = Array.isArray(data) ? data : Object.values(data || {});
    const pairs: DexScreenerPair[] = [];
    for (const profile of rawProfiles) {
      if (!profile?.pairs || !Array.isArray(profile.pairs)) continue;
      for (const pair of profile.pairs) {
        if (
          pair?.pairAddress &&
          pair?.chainId === 'solana' &&
          pair?.baseToken?.symbol?.toUpperCase() !== 'SOL' &&
          pair?.baseToken?.address
        ) {
          pairs.push(pair);
        }
      }
    }

    console.log(`[fetchNewSolanaPairs] Token profiles yielded ${pairs.length} pairs`);
    return pairs;
  } catch (error) {
    console.error('[fetchNewSolanaPairs] token profiles error:', error);
    return [];
  }
}

const resolveLiquidityUsd = (pair: DexScreenerPair): number => {
  const liquidity = pair.liquidity;
  if (!liquidity) return 0;
  if (typeof liquidity === 'number') return liquidity;
  return liquidity.usd || 0;
};

export async function fetchNewSolanaPairs(): Promise<DexScreenerPair[]> {
  const cacheKey = 'solana-new-pairs';
  const cached = getCached<DexScreenerPair[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const searchPairs = await fetchPairsBySearchTerms();
    let allPairsRaw = searchPairs;

    if (allPairsRaw.length === 0) {
      console.log('[fetchNewSolanaPairs] Search returned zero pairs, falling back to token profiles');
      const profilesPairs = await fetchPairsFromProfiles();
      allPairsRaw = profilesPairs;
    }

    console.log(`[fetchNewSolanaPairs] Normalizing ${allPairsRaw.length} candidate pairs`);
    const normalisedPairs: DexScreenerPair[] = [];
    for (const pair of allPairsRaw) {
      if (!pair.chainId) {
        pair.chainId = 'solana';
      }
      if (pair.chainId !== 'solana') continue;
      if (pair.baseToken?.symbol?.toUpperCase() === 'SOL') continue;

      let createdAt: number | undefined = pair.pairCreatedAt;
      if (!createdAt) {
        createdAt = await fetchPairMetadata(pair);
      }

      if (pair.pairAddress && pair.baseToken?.address && pair.baseToken?.symbol) {
        normalisedPairs.push({ ...pair, pairCreatedAt: createdAt ?? Date.now() });
      }
    }

    console.log(`[fetchNewSolanaPairs] Normalized ${normalisedPairs.length} total pairs (after filtering)`);

    let enrichedPairs = normalisedPairs;
    if (normalisedPairs.length > 0) {
      const pairAddresses = normalisedPairs.map((pair) => pair.pairAddress);
      try {
        const detailedPairs = await fetchPairsByAddresses(pairAddresses);
        const detailMap = new Map<string, DexScreenerPair>();
        for (const pair of detailedPairs) {
          if (pair?.pairAddress) {
            detailMap.set(pair.pairAddress, pair);
          }
        }
        enrichedPairs = normalisedPairs.map((pair) => detailMap.get(pair.pairAddress) ?? pair);
        console.log(
          `[fetchNewSolanaPairs] Enriched ${enrichedPairs.length} pairs with detailed metadata (liquidity, liquiditySol)`
        );
      } catch (error) {
        console.error('[fetchNewSolanaPairs] Error fetching detailed pair metadata:', error);
      }
    }

    if (enrichedPairs.length > 0) {
      const sample = enrichedPairs[0];
      console.log(
        `[fetchNewSolanaPairs] Sample pair: ${sample.baseToken?.symbol}/${sample.quoteToken?.symbol} | Liquidity: $${resolveLiquidityUsd(
          sample
        )}`
      );
    }

    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const recentPairs = enrichedPairs.filter((p) => (p.pairCreatedAt || Date.now()) >= tenMinutesAgo);
    console.log(`[fetchNewSolanaPairs] Filtered to ${recentPairs.length} pairs created within the last 10 minutes`);

    
    setCache(cacheKey, recentPairs, CACHE_CONFIG.newPairs);
    return recentPairs;
  } catch (error) {
    console.error('Error fetching new Solana pairs:', error);

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
