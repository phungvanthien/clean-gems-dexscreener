/**
 * Token History Tracker
 *
 * Maintains in-memory history of token snapshots for momentum calculations.
 * Keeps the last 2 hours of data for each tracked token.
 */

import { ScoredToken, TokenSnapshot, DexScreenerPair } from './types';
import { fetchNewSolanaPairs, fetchPairsByAddresses } from './dexscreener';
import { processPair } from './scoring';

// In-memory storage for token data
// Key: pairAddress, Value: ScoredToken with history
const tokenStore = new Map<string, ScoredToken>();

// Track when we last fetched new pairs
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL = 30 * 1000; // 30 seconds minimum between fetches

// Configuration
const CONFIG = {
  // How long to keep history
  historyRetentionMs: 2 * 60 * 60 * 1000, // 2 hours
  // Minimum interval between snapshots
  snapshotIntervalMs: 5 * 60 * 1000, // 5 minutes
  // Maximum tokens to track (memory limit)
  maxTrackedTokens: 500,
  // Age after which to stop tracking a token
  maxTrackingAgeMs: 4 * 60 * 60 * 1000, // 4 hours
};

/**
 * Clean up old history entries and expired tokens
 */
function cleanupStore(): void {
  const now = Date.now();
  const cutoffTime = now - CONFIG.historyRetentionMs;
  const maxAge = now - CONFIG.maxTrackingAgeMs;

  for (const [pairAddress, token] of tokenStore.entries()) {
    // Remove tokens that are too old
    const tokenCreatedAt = now - token.ageMinutes * 60 * 1000;
    if (tokenCreatedAt < maxAge) {
      tokenStore.delete(pairAddress);
      continue;
    }

    // Clean up old history
    token.history = token.history.filter((s) => s.timestamp > cutoffTime);
  }

  // If we have too many tokens, remove the oldest ones
  if (tokenStore.size > CONFIG.maxTrackedTokens) {
    const tokens = Array.from(tokenStore.entries());
    tokens.sort((a, b) => b[1].lastUpdated - a[1].lastUpdated);

    const toRemove = tokens.slice(CONFIG.maxTrackedTokens);
    for (const [pairAddress] of toRemove) {
      tokenStore.delete(pairAddress);
    }
  }
}

/**
 * Get existing history for a token
 */
function getExistingHistory(pairAddress: string): TokenSnapshot[] {
  const existing = tokenStore.get(pairAddress);
  return existing?.history || [];
}

/**
 * Update the token store with new data
 */
function updateToken(token: ScoredToken): void {
  tokenStore.set(token.pairAddress, token);
}

/**
 * Refresh all tracked tokens and discover new ones
 */
export async function refreshTokens(): Promise<ScoredToken[]> {
  const now = Date.now();

  // Rate limit fetches
  if (now - lastFetchTime < MIN_FETCH_INTERVAL) {
    // Return current data if we fetched recently
    return Array.from(tokenStore.values());
  }

  lastFetchTime = now;

  try {
    // Fetch new pairs from DexScreener
    const newPairs = await fetchNewSolanaPairs();

    // Also refresh existing tracked tokens that are still relevant
    const existingPairAddresses = Array.from(tokenStore.keys()).filter(
      (addr) => {
        const token = tokenStore.get(addr);
        if (!token) return false;
        // Only refresh tokens that are still young enough
        return token.ageMinutes < CONFIG.maxTrackingAgeMs / (60 * 1000);
      }
    );

    // Fetch updates for existing tokens (in batches to avoid rate limiting)
    let existingPairs: DexScreenerPair[] = [];
    if (existingPairAddresses.length > 0) {
      existingPairs = await fetchPairsByAddresses(existingPairAddresses);
    }

    // Combine new and existing pairs, dedupe by pairAddress
    const allPairsMap = new Map<string, DexScreenerPair>();

    for (const pair of existingPairs) {
      allPairsMap.set(pair.pairAddress, pair);
    }

    for (const pair of newPairs) {
      allPairsMap.set(pair.pairAddress, pair);
    }

    // Process all pairs
    for (const pair of allPairsMap.values()) {
      const existingHistory = getExistingHistory(pair.pairAddress);
      const scoredToken = processPair(pair, existingHistory);
      updateToken(scoredToken);
    }

    // Cleanup old data
    cleanupStore();

    return Array.from(tokenStore.values());
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    // Return current data on error
    return Array.from(tokenStore.values());
  }
}

/**
 * Get all currently tracked tokens
 */
export function getAllTokens(): ScoredToken[] {
  return Array.from(tokenStore.values());
}

/**
 * Get only tokens that pass the Clean Gem gate
 */
export function getCleanGems(): ScoredToken[] {
  return Array.from(tokenStore.values()).filter((t) => t.isCleanGem);
}

/**
 * Get a specific token by pair address
 */
export function getToken(pairAddress: string): ScoredToken | undefined {
  return tokenStore.get(pairAddress);
}

/**
 * Get store statistics
 */
export function getStoreStats(): {
  totalTokens: number;
  cleanGems: number;
  lastFetchTime: number;
  oldestToken: number | null;
  newestToken: number | null;
} {
  const tokens = Array.from(tokenStore.values());
  const cleanGems = tokens.filter((t) => t.isCleanGem);

  let oldestAge: number | null = null;
  let newestAge: number | null = null;

  for (const token of tokens) {
    if (oldestAge === null || token.ageMinutes > oldestAge) {
      oldestAge = token.ageMinutes;
    }
    if (newestAge === null || token.ageMinutes < newestAge) {
      newestAge = token.ageMinutes;
    }
  }

  return {
    totalTokens: tokens.length,
    cleanGems: cleanGems.length,
    lastFetchTime,
    oldestToken: oldestAge,
    newestToken: newestAge,
  };
}

/**
 * Force clear the store (useful for testing)
 */
export function clearStore(): void {
  tokenStore.clear();
  lastFetchTime = 0;
}
