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
const MIN_FETCH_INTERVAL = 60 * 1000; // 60 seconds minimum between fetches

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

const CLEAN_GEM_NOTIFICATION_LIMIT = 8;
const NEW_POOL_NOTIFICATION_LIMIT = 64;
const cleanGemNotifications: ScoredToken[] = [];
let newPoolNotifications: ScoredToken[] = [];

/**
 * Clean up old history entries and expired tokens
 */
function cleanupStore(): void {
  const now = Date.now();
  const cutoffTime = now - CONFIG.historyRetentionMs;
  const maxAge = now - CONFIG.maxTrackingAgeMs;
  let deletedCount = 0;

  for (const [pairAddress, token] of tokenStore.entries()) {
    // Remove tokens that are too old
    // Use pairCreatedAt directly if available, otherwise calculate from ageMinutes
    // But cap ageMinutes at reasonable max (e.g., 1 year) to avoid cleanup issues with bad data
    const maxReasonableAgeMinutes = 365 * 24 * 60; // 1 year
    const cappedAgeMinutes = Math.min(token.ageMinutes, maxReasonableAgeMinutes);
    const tokenCreatedAt = token.pairCreatedAt || (now - cappedAgeMinutes * 60 * 1000);
    
    // Only delete if token is actually old (created more than maxTrackingAgeMs ago)
    // AND ageMinutes is reasonable (not a data error from DexScreener)
    if (tokenCreatedAt < maxAge && token.ageMinutes <= maxReasonableAgeMinutes) {
      console.log(`[cleanupStore] Deleting old token ${token.symbol} (age: ${token.ageMinutes}m, created: ${new Date(tokenCreatedAt).toISOString()})`);
      tokenStore.delete(pairAddress);
      deletedCount++;
      continue;
    }

    // Clean up old history
    token.history = token.history.filter((s) => s.timestamp > cutoffTime);
  }
  
  if (deletedCount > 0) {
    console.log(`[cleanupStore] Deleted ${deletedCount} old tokens`);
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
    console.log(`[refreshTokens] Fetched ${newPairs.length} new pairs from DexScreener`);

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
    let processedCount = 0;
    let newTokensCount = 0;
    const newlyDetectedCleanGems: ScoredToken[] = [];
    
    for (const pair of allPairsMap.values()) {
      const existingToken = tokenStore.get(pair.pairAddress);
      const wasTracked = Boolean(existingToken);
      const existingHistory = getExistingHistory(pair.pairAddress);
      const scoredToken = processPair(pair, existingHistory, existingToken);
      updateToken(scoredToken);
      processedCount++;
      
      if (!wasTracked) {
        newTokensCount++;
        newPoolNotifications.unshift(scoredToken);
        if (newPoolNotifications.length > NEW_POOL_NOTIFICATION_LIMIT) {
          newPoolNotifications.length = NEW_POOL_NOTIFICATION_LIMIT;
        }
        if (scoredToken.isCleanGem) {
          newlyDetectedCleanGems.push(scoredToken);
        }
      }
    }
    
    console.log(`[refreshTokens] Processed ${processedCount} pairs (${newTokensCount} new, ${newlyDetectedCleanGems.length} new clean gems)`);
    console.log(`[refreshTokens] newPoolNotifications queue size: ${newPoolNotifications.length}`);
    console.log(`[refreshTokens] tokenStore size before cleanup: ${tokenStore.size}`);

    // Add new clean gems to notifications
    for (const gem of newlyDetectedCleanGems) {
      cleanGemNotifications.push(gem);
      if (cleanGemNotifications.length > CLEAN_GEM_NOTIFICATION_LIMIT) {
        cleanGemNotifications.shift();
      }
    }

    // Cleanup old data
    cleanupStore();
    
    const finalTokens = Array.from(tokenStore.values());
    console.log(`[refreshTokens] Total tokens in store: ${finalTokens.length}`);
    console.log(`[refreshTokens] Sample token symbols: ${finalTokens.slice(0, 5).map(t => t.symbol).join(', ')}`);
    if (finalTokens[0]) {
      console.log(`[refreshTokens] Sample token priceNative: ${finalTokens[0].priceNative}`);
    }
    return finalTokens;
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

/**
 * Retrieve and clear pending clean gem notifications.
 */
export function consumeNewCleanGems(): ScoredToken[] {
  const gems = cleanGemNotifications.splice(0, cleanGemNotifications.length);
  return gems;
}

// --- NEW: consume + clear new pools (pre-gate)
export function consumeNewPools(): ScoredToken[] {
  const out = [...newPoolNotifications];
  console.log(`[consumeNewPools] Consuming ${out.length} new pools from queue`);
  newPoolNotifications = [];
  return out;
}
