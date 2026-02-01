/**
 * Core types for Solana Clean Early Gems
 */

// DexScreener API response types
export type DexLiquidity =
  | number
  | {
      usd: number;
      base: number;
      quote: number;
    };

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: DexLiquidity;
  fdv: number;
  pairCreatedAt: number;
}

// Historical data point for tracking momentum
export interface TokenSnapshot {
  timestamp: number;
  liquidity: number;
  volume5m: number;
  txns5m: number;
  priceUsd: number;
  buys5m: number;
  sells5m: number;
}

// Token with computed scores and history
export interface ScoredToken {
  // Identity
  address: string;
  pairAddress: string;
  name: string;
  symbol: string;
  dexUrl: string;

  // Current metrics
  ageMinutes: number;
  liquidity: number;
  liquiditySol: number;
  volume5m: number;
  volume1h: number;
  txns5m: number;
  txns1h: number;
  buys5m: number;
  sells5m: number;
  priceUsd: number;
  priceChange5m: number;
  priceChange1h: number;
  priceNative: number;
  fdv: number;
  liquidityUSD: number;
  liquiditySource: 'dexscreener' | 'solscan+price';
  baseReserve: number;
  quoteReserve: number;

  // Computed scores
  riskScore: number;
  alphaScore: number;

  // Gate status
  isCleanGem: boolean;
  gateReasons: GateReason[];

  // Historical snapshots (last 2 hours)
  history: TokenSnapshot[];

  // Timestamp
  lastUpdated: number;
  detectFirstSeen: number;
  detectionLatencyMs: number;
  detectFirstPrice: number;
  pairCreatedAt: number;
}

// Explanation for gate pass/fail
export interface GateReason {
  criterion: string;
  passed: boolean;
  value: string | number;
  threshold: string | number;
  explanation: string;
}

// Risk score breakdown
export interface RiskBreakdown {
  score: number;
  factors: {
    name: string;
    impact: number; // negative = penalty
    reason: string;
  }[];
}

// Alpha score breakdown
export interface AlphaBreakdown {
  score: number;
  factors: {
    name: string;
    impact: number;
    reason: string;
  }[];
}

// Filter options for UI
export interface FilterOptions {
  minLiquidity: number;
  minRisk: number;
  minAlpha: number;
  maxAge: number;
  showOnlyGems: boolean;
}

// API response
export interface TokensResponse {
  tokens: ScoredToken[];
  lastRefresh: number;
  nextRefresh: number;
  totalPairs: number;
  gemsCount: number;
  newCleanGems?: ScoredToken[];
  newPools?: ScoredToken[];
}

// Cache entry
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}
