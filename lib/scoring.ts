/**
 * Scoring Logic for Solana Clean Early Gems
 *
 * This file contains all scoring and gate logic.
 * Tune the constants below to adjust sensitivity.
 */

import {
  ScoredToken,
  TokenSnapshot,
  GateReason,
  RiskBreakdown,
  AlphaBreakdown,
  DexScreenerPair,
  DexLiquidity,
} from './types';

// ============================================================================
// CONFIGURATION - Tune these values to adjust scoring
// ============================================================================

export const CONFIG = {
  // Clean Gem Gate thresholds
  gate: {
    maxAgeMinutes: 120,        // Token must be ≤ 2 hours old
    minLiquidity: 20000,       // Minimum $20k liquidity
    minVolume5m: 10000,        // Minimum $10k volume in 5 min
    minTxns5m: 80,             // OR minimum 80 transactions in 5 min
    minRiskScore: 75,          // Minimum risk score to pass
    minAlphaScore: 65,         // Minimum alpha score to pass
  },

  // Risk score penalties (subtracted from 100)
  risk: {
    // Liquidity penalties
    liquidityVeryLow: { threshold: 5000, penalty: 50 },      // < $5k = -50
    liquidityLow: { threshold: 15000, penalty: 25 },         // < $15k = -25
    liquidityMedium: { threshold: 30000, penalty: 10 },      // < $30k = -10

    // Volume/Liquidity ratio (suspicious if too high)
    volumeRatioExtreme: { threshold: 5, penalty: 40 },       // vol/liq > 5x = -40
    volumeRatioHigh: { threshold: 3, penalty: 20 },          // vol/liq > 3x = -20
    volumeRatioSuspicious: { threshold: 2, penalty: 10 },    // vol/liq > 2x = -10

    // Buy/Sell imbalance (wash trading indicator)
    buySellImbalanceExtreme: { threshold: 0.9, penalty: 35 }, // >90% one-sided = -35
    buySellImbalanceHigh: { threshold: 0.8, penalty: 20 },    // >80% one-sided = -20
    buySellImbalanceMedium: { threshold: 0.7, penalty: 10 },  // >70% one-sided = -10

    // Price volatility on low liquidity
    priceVolatilityExtreme: { threshold: 50, penalty: 25 },   // >50% change = -25
    priceVolatilityHigh: { threshold: 30, penalty: 15 },      // >30% change = -15

    // Age penalties (brand new = riskier)
    ageVeryNew: { threshold: 10, penalty: 20 },               // < 10 min = -20
    ageNew: { threshold: 30, penalty: 10 },                   // < 30 min = -10

    // Low transaction count (easier to manipulate)
    txnsVeryLow: { threshold: 20, penalty: 25 },              // < 20 txns = -25
    txnsLow: { threshold: 50, penalty: 15 },                  // < 50 txns = -15
  },

  // Alpha score bonuses (added to base of 0)
  alpha: {
    // Volume momentum
    volumeGrowthStrong: { threshold: 2, bonus: 25 },          // 2x growth = +25
    volumeGrowthModerate: { threshold: 1.5, bonus: 15 },      // 1.5x growth = +15
    volumeGrowthSlight: { threshold: 1.2, bonus: 8 },         // 1.2x growth = +8

    // Transaction momentum
    txnsGrowthStrong: { threshold: 2, bonus: 20 },            // 2x growth = +20
    txnsGrowthModerate: { threshold: 1.5, bonus: 12 },        // 1.5x growth = +12
    txnsGrowthSlight: { threshold: 1.2, bonus: 6 },           // 1.2x growth = +6

    // Liquidity growth
    liquidityGrowthStrong: { threshold: 1.5, bonus: 20 },     // 50% growth = +20
    liquidityGrowthModerate: { threshold: 1.2, bonus: 12 },   // 20% growth = +12
    liquidityGrowthSlight: { threshold: 1.1, bonus: 6 },      // 10% growth = +6

    // Healthy buy/sell balance
    healthyBalance: { threshold: 0.4, bonus: 15 },            // 40-60% balance = +15
    okBalance: { threshold: 0.3, bonus: 8 },                  // 30-70% balance = +8

    // Sustained activity (not just one spike)
    sustainedActivity: { minSnapshots: 3, bonus: 15 },        // Multiple active periods = +15

    // Raw volume/txns bonuses
    highVolume5m: { threshold: 50000, bonus: 15 },            // >$50k vol 5m = +15
    mediumVolume5m: { threshold: 25000, bonus: 8 },           // >$25k vol 5m = +8
    highTxns5m: { threshold: 150, bonus: 12 },                // >150 txns 5m = +12
    mediumTxns5m: { threshold: 80, bonus: 6 },                // >80 txns 5m = +6
  },
};

// ============================================================================
// RISK SCORE CALCULATION
// ============================================================================

export function calculateRiskScore(token: {
  liquidity: number;
  volume5m: number;
  volume1h: number;
  buys5m: number;
  sells5m: number;
  priceChange5m: number;
  priceChange1h: number;
  ageMinutes: number;
  txns5m: number;
  txns1h: number;
}): RiskBreakdown {
  let score = 100; // Start at maximum safety
  const factors: RiskBreakdown['factors'] = [];
  const cfg = CONFIG.risk;

  // 1. Liquidity penalties
  if (token.liquidity < cfg.liquidityVeryLow.threshold) {
    score -= cfg.liquidityVeryLow.penalty;
    factors.push({
      name: 'Very Low Liquidity',
      impact: -cfg.liquidityVeryLow.penalty,
      reason: `Liquidity $${token.liquidity.toLocaleString()} < $${cfg.liquidityVeryLow.threshold.toLocaleString()}`,
    });
  } else if (token.liquidity < cfg.liquidityLow.threshold) {
    score -= cfg.liquidityLow.penalty;
    factors.push({
      name: 'Low Liquidity',
      impact: -cfg.liquidityLow.penalty,
      reason: `Liquidity $${token.liquidity.toLocaleString()} < $${cfg.liquidityLow.threshold.toLocaleString()}`,
    });
  } else if (token.liquidity < cfg.liquidityMedium.threshold) {
    score -= cfg.liquidityMedium.penalty;
    factors.push({
      name: 'Medium Liquidity',
      impact: -cfg.liquidityMedium.penalty,
      reason: `Liquidity $${token.liquidity.toLocaleString()} < $${cfg.liquidityMedium.threshold.toLocaleString()}`,
    });
  }

  // 2. Volume/Liquidity ratio (suspicious if too high - could be wash trading)
  const volumeRatio = token.liquidity > 0 ? token.volume1h / token.liquidity : 0;
  if (volumeRatio > cfg.volumeRatioExtreme.threshold) {
    score -= cfg.volumeRatioExtreme.penalty;
    factors.push({
      name: 'Extreme Volume/Liquidity',
      impact: -cfg.volumeRatioExtreme.penalty,
      reason: `Vol/Liq ratio ${volumeRatio.toFixed(1)}x suggests wash trading`,
    });
  } else if (volumeRatio > cfg.volumeRatioHigh.threshold) {
    score -= cfg.volumeRatioHigh.penalty;
    factors.push({
      name: 'High Volume/Liquidity',
      impact: -cfg.volumeRatioHigh.penalty,
      reason: `Vol/Liq ratio ${volumeRatio.toFixed(1)}x is suspiciously high`,
    });
  } else if (volumeRatio > cfg.volumeRatioSuspicious.threshold) {
    score -= cfg.volumeRatioSuspicious.penalty;
    factors.push({
      name: 'Suspicious Volume/Liquidity',
      impact: -cfg.volumeRatioSuspicious.penalty,
      reason: `Vol/Liq ratio ${volumeRatio.toFixed(1)}x is elevated`,
    });
  }

  // 3. Buy/Sell imbalance
  const totalTxns = token.buys5m + token.sells5m;
  if (totalTxns > 0) {
    const buyRatio = token.buys5m / totalTxns;
    const imbalance = Math.abs(buyRatio - 0.5) * 2; // 0 = balanced, 1 = fully one-sided

    if (imbalance > cfg.buySellImbalanceExtreme.threshold) {
      score -= cfg.buySellImbalanceExtreme.penalty;
      factors.push({
        name: 'Extreme Buy/Sell Imbalance',
        impact: -cfg.buySellImbalanceExtreme.penalty,
        reason: `${(imbalance * 100).toFixed(0)}% one-sided (${token.buys5m} buys / ${token.sells5m} sells)`,
      });
    } else if (imbalance > cfg.buySellImbalanceHigh.threshold) {
      score -= cfg.buySellImbalanceHigh.penalty;
      factors.push({
        name: 'High Buy/Sell Imbalance',
        impact: -cfg.buySellImbalanceHigh.penalty,
        reason: `${(imbalance * 100).toFixed(0)}% one-sided trading activity`,
      });
    } else if (imbalance > cfg.buySellImbalanceMedium.threshold) {
      score -= cfg.buySellImbalanceMedium.penalty;
      factors.push({
        name: 'Moderate Buy/Sell Imbalance',
        impact: -cfg.buySellImbalanceMedium.penalty,
        reason: `${(imbalance * 100).toFixed(0)}% one-sided trading activity`,
      });
    }
  }

  // 4. Price volatility on low liquidity (easy to manipulate)
  if (token.liquidity < 50000) {
    const absChange = Math.abs(token.priceChange1h);
    if (absChange > cfg.priceVolatilityExtreme.threshold) {
      score -= cfg.priceVolatilityExtreme.penalty;
      factors.push({
        name: 'Extreme Price Volatility',
        impact: -cfg.priceVolatilityExtreme.penalty,
        reason: `${absChange.toFixed(0)}% price change on low liquidity`,
      });
    } else if (absChange > cfg.priceVolatilityHigh.threshold) {
      score -= cfg.priceVolatilityHigh.penalty;
      factors.push({
        name: 'High Price Volatility',
        impact: -cfg.priceVolatilityHigh.penalty,
        reason: `${absChange.toFixed(0)}% price change on low liquidity`,
      });
    }
  }

  // 5. Age penalties (brand new tokens are riskier)
  if (token.ageMinutes < cfg.ageVeryNew.threshold) {
    score -= cfg.ageVeryNew.penalty;
    factors.push({
      name: 'Very New Token',
      impact: -cfg.ageVeryNew.penalty,
      reason: `Only ${token.ageMinutes} minutes old`,
    });
  } else if (token.ageMinutes < cfg.ageNew.threshold) {
    score -= cfg.ageNew.penalty;
    factors.push({
      name: 'New Token',
      impact: -cfg.ageNew.penalty,
      reason: `Only ${token.ageMinutes} minutes old`,
    });
  }

  // 6. Low transaction count (easier to manipulate)
  if (token.txns1h < cfg.txnsVeryLow.threshold) {
    score -= cfg.txnsVeryLow.penalty;
    factors.push({
      name: 'Very Low Transaction Count',
      impact: -cfg.txnsVeryLow.penalty,
      reason: `Only ${token.txns1h} transactions in 1h`,
    });
  } else if (token.txns1h < cfg.txnsLow.threshold) {
    score -= cfg.txnsLow.penalty;
    factors.push({
      name: 'Low Transaction Count',
      impact: -cfg.txnsLow.penalty,
      reason: `Only ${token.txns1h} transactions in 1h`,
    });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    factors,
  };
}

// ============================================================================
// ALPHA SCORE CALCULATION
// ============================================================================

export function calculateAlphaScore(
  token: {
    volume5m: number;
    txns5m: number;
    liquidity: number;
    buys5m: number;
    sells5m: number;
  },
  history: TokenSnapshot[]
): AlphaBreakdown {
  let score = 0; // Start at 0 and add bonuses
  const factors: AlphaBreakdown['factors'] = [];
  const cfg = CONFIG.alpha;

  // Get historical data for momentum calculations
  const recentSnapshots = history.filter(
    (s) => Date.now() - s.timestamp < 30 * 60 * 1000 // Last 30 minutes
  );
  const oldSnapshots = history.filter(
    (s) => Date.now() - s.timestamp >= 30 * 60 * 1000 &&
           Date.now() - s.timestamp < 60 * 60 * 1000 // 30-60 minutes ago
  );

  // 1. Volume momentum (compare recent to older)
  if (recentSnapshots.length > 0 && oldSnapshots.length > 0) {
    const recentAvgVol = recentSnapshots.reduce((sum, s) => sum + s.volume5m, 0) / recentSnapshots.length;
    const oldAvgVol = oldSnapshots.reduce((sum, s) => sum + s.volume5m, 0) / oldSnapshots.length;

    if (oldAvgVol > 0) {
      const volumeGrowth = recentAvgVol / oldAvgVol;

      if (volumeGrowth >= cfg.volumeGrowthStrong.threshold) {
        score += cfg.volumeGrowthStrong.bonus;
        factors.push({
          name: 'Strong Volume Growth',
          impact: cfg.volumeGrowthStrong.bonus,
          reason: `${volumeGrowth.toFixed(1)}x volume increase over 30min`,
        });
      } else if (volumeGrowth >= cfg.volumeGrowthModerate.threshold) {
        score += cfg.volumeGrowthModerate.bonus;
        factors.push({
          name: 'Moderate Volume Growth',
          impact: cfg.volumeGrowthModerate.bonus,
          reason: `${volumeGrowth.toFixed(1)}x volume increase`,
        });
      } else if (volumeGrowth >= cfg.volumeGrowthSlight.threshold) {
        score += cfg.volumeGrowthSlight.bonus;
        factors.push({
          name: 'Slight Volume Growth',
          impact: cfg.volumeGrowthSlight.bonus,
          reason: `${volumeGrowth.toFixed(1)}x volume increase`,
        });
      }
    }
  }

  // 2. Transaction momentum
  if (recentSnapshots.length > 0 && oldSnapshots.length > 0) {
    const recentAvgTxns = recentSnapshots.reduce((sum, s) => sum + s.txns5m, 0) / recentSnapshots.length;
    const oldAvgTxns = oldSnapshots.reduce((sum, s) => sum + s.txns5m, 0) / oldSnapshots.length;

    if (oldAvgTxns > 0) {
      const txnsGrowth = recentAvgTxns / oldAvgTxns;

      if (txnsGrowth >= cfg.txnsGrowthStrong.threshold) {
        score += cfg.txnsGrowthStrong.bonus;
        factors.push({
          name: 'Strong Transaction Growth',
          impact: cfg.txnsGrowthStrong.bonus,
          reason: `${txnsGrowth.toFixed(1)}x more transactions`,
        });
      } else if (txnsGrowth >= cfg.txnsGrowthModerate.threshold) {
        score += cfg.txnsGrowthModerate.bonus;
        factors.push({
          name: 'Moderate Transaction Growth',
          impact: cfg.txnsGrowthModerate.bonus,
          reason: `${txnsGrowth.toFixed(1)}x more transactions`,
        });
      } else if (txnsGrowth >= cfg.txnsGrowthSlight.threshold) {
        score += cfg.txnsGrowthSlight.bonus;
        factors.push({
          name: 'Slight Transaction Growth',
          impact: cfg.txnsGrowthSlight.bonus,
          reason: `${txnsGrowth.toFixed(1)}x more transactions`,
        });
      }
    }
  }

  // 3. Liquidity growth
  if (recentSnapshots.length > 0 && oldSnapshots.length > 0) {
    const recentLiq = recentSnapshots[recentSnapshots.length - 1]?.liquidity || token.liquidity;
    const oldLiq = oldSnapshots[0]?.liquidity || recentLiq;

    if (oldLiq > 0) {
      const liqGrowth = recentLiq / oldLiq;

      if (liqGrowth >= cfg.liquidityGrowthStrong.threshold) {
        score += cfg.liquidityGrowthStrong.bonus;
        factors.push({
          name: 'Strong Liquidity Growth',
          impact: cfg.liquidityGrowthStrong.bonus,
          reason: `Liquidity grew ${((liqGrowth - 1) * 100).toFixed(0)}%`,
        });
      } else if (liqGrowth >= cfg.liquidityGrowthModerate.threshold) {
        score += cfg.liquidityGrowthModerate.bonus;
        factors.push({
          name: 'Moderate Liquidity Growth',
          impact: cfg.liquidityGrowthModerate.bonus,
          reason: `Liquidity grew ${((liqGrowth - 1) * 100).toFixed(0)}%`,
        });
      } else if (liqGrowth >= cfg.liquidityGrowthSlight.threshold) {
        score += cfg.liquidityGrowthSlight.bonus;
        factors.push({
          name: 'Slight Liquidity Growth',
          impact: cfg.liquidityGrowthSlight.bonus,
          reason: `Liquidity grew ${((liqGrowth - 1) * 100).toFixed(0)}%`,
        });
      }
    }
  }

  // 4. Healthy buy/sell balance
  const totalTxns = token.buys5m + token.sells5m;
  if (totalTxns > 0) {
    const buyRatio = token.buys5m / totalTxns;
    const balance = 1 - Math.abs(buyRatio - 0.5) * 2; // 1 = perfect balance, 0 = one-sided

    if (balance >= cfg.healthyBalance.threshold * 2) {
      score += cfg.healthyBalance.bonus;
      factors.push({
        name: 'Healthy Buy/Sell Balance',
        impact: cfg.healthyBalance.bonus,
        reason: `${(buyRatio * 100).toFixed(0)}% buys / ${((1 - buyRatio) * 100).toFixed(0)}% sells`,
      });
    } else if (balance >= cfg.okBalance.threshold * 2) {
      score += cfg.okBalance.bonus;
      factors.push({
        name: 'OK Buy/Sell Balance',
        impact: cfg.okBalance.bonus,
        reason: `${(buyRatio * 100).toFixed(0)}% buys / ${((1 - buyRatio) * 100).toFixed(0)}% sells`,
      });
    }
  }

  // 5. Sustained activity (not just one spike)
  const activeSnapshots = history.filter((s) => s.volume5m > 1000 || s.txns5m > 10);
  if (activeSnapshots.length >= cfg.sustainedActivity.minSnapshots) {
    score += cfg.sustainedActivity.bonus;
    factors.push({
      name: 'Sustained Activity',
      impact: cfg.sustainedActivity.bonus,
      reason: `${activeSnapshots.length} periods of active trading`,
    });
  }

  // 6. Raw volume bonuses
  if (token.volume5m >= cfg.highVolume5m.threshold) {
    score += cfg.highVolume5m.bonus;
    factors.push({
      name: 'High Volume (5m)',
      impact: cfg.highVolume5m.bonus,
      reason: `$${token.volume5m.toLocaleString()} volume in 5 minutes`,
    });
  } else if (token.volume5m >= cfg.mediumVolume5m.threshold) {
    score += cfg.mediumVolume5m.bonus;
    factors.push({
      name: 'Medium Volume (5m)',
      impact: cfg.mediumVolume5m.bonus,
      reason: `$${token.volume5m.toLocaleString()} volume in 5 minutes`,
    });
  }

  // 7. Raw transaction bonuses
  if (token.txns5m >= cfg.highTxns5m.threshold) {
    score += cfg.highTxns5m.bonus;
    factors.push({
      name: 'High Transaction Count (5m)',
      impact: cfg.highTxns5m.bonus,
      reason: `${token.txns5m} transactions in 5 minutes`,
    });
  } else if (token.txns5m >= cfg.mediumTxns5m.threshold) {
    score += cfg.mediumTxns5m.bonus;
    factors.push({
      name: 'Medium Transaction Count (5m)',
      impact: cfg.mediumTxns5m.bonus,
      reason: `${token.txns5m} transactions in 5 minutes`,
    });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    factors,
  };
}

// ============================================================================
// CLEAN GEM GATE
// ============================================================================

export function evaluateCleanGemGate(token: {
  ageMinutes: number;
  liquidity: number;
  volume5m: number;
  txns5m: number;
  riskScore: number;
  alphaScore: number;
}): { isCleanGem: boolean; reasons: GateReason[] } {
  const cfg = CONFIG.gate;
  const reasons: GateReason[] = [];

  // 1. Age check
  const agePassed = token.ageMinutes <= cfg.maxAgeMinutes;
  reasons.push({
    criterion: 'Age',
    passed: agePassed,
    value: `${token.ageMinutes} min`,
    threshold: `≤ ${cfg.maxAgeMinutes} min`,
    explanation: agePassed
      ? `Token is ${token.ageMinutes} minutes old, within the early window`
      : `Token is ${token.ageMinutes} minutes old, too old for early gem status`,
  });

  // 2. Liquidity check
  const liquidityPassed = token.liquidity >= cfg.minLiquidity;
  reasons.push({
    criterion: 'Liquidity',
    passed: liquidityPassed,
    value: `$${token.liquidity.toLocaleString()}`,
    threshold: `≥ $${cfg.minLiquidity.toLocaleString()}`,
    explanation: liquidityPassed
      ? `Sufficient liquidity of $${token.liquidity.toLocaleString()}`
      : `Liquidity of $${token.liquidity.toLocaleString()} is below minimum`,
  });

  // 3. Activity check (volume OR txns)
  const volumePassed = token.volume5m >= cfg.minVolume5m;
  const txnsPassed = token.txns5m >= cfg.minTxns5m;
  const activityPassed = volumePassed || txnsPassed;
  reasons.push({
    criterion: 'Activity (5m)',
    passed: activityPassed,
    value: `$${token.volume5m.toLocaleString()} vol / ${token.txns5m} txns`,
    threshold: `≥ $${cfg.minVolume5m.toLocaleString()} vol OR ≥ ${cfg.minTxns5m} txns`,
    explanation: activityPassed
      ? `Active trading with $${token.volume5m.toLocaleString()} volume and ${token.txns5m} transactions`
      : `Insufficient activity: need $${cfg.minVolume5m.toLocaleString()} volume or ${cfg.minTxns5m} transactions`,
  });

  // 4. Risk score check
  const riskPassed = token.riskScore >= cfg.minRiskScore;
  reasons.push({
    criterion: 'Risk Score',
    passed: riskPassed,
    value: token.riskScore,
    threshold: `≥ ${cfg.minRiskScore}`,
    explanation: riskPassed
      ? `Risk score of ${token.riskScore} indicates low rug probability`
      : `Risk score of ${token.riskScore} is below safety threshold`,
  });

  // 5. Alpha score check
  const alphaPassed = token.alphaScore >= cfg.minAlphaScore;
  reasons.push({
    criterion: 'Alpha Score',
    passed: alphaPassed,
    value: token.alphaScore,
    threshold: `≥ ${cfg.minAlphaScore}`,
    explanation: alphaPassed
      ? `Alpha score of ${token.alphaScore} shows strong early momentum`
      : `Alpha score of ${token.alphaScore} indicates weak momentum`,
  });

  const isCleanGem = agePassed && liquidityPassed && activityPassed && riskPassed && alphaPassed;

  return { isCleanGem, reasons };
}

// ============================================================================
// PROCESS DEXSCREENER PAIR
// ============================================================================

const resolveLiquidityUsd = (liquidity?: DexLiquidity): number => {
  if (!liquidity) return 0;
  if (typeof liquidity === 'number') return liquidity;
  return liquidity.usd || 0;
};

export function processPair(
  pair: DexScreenerPair,
  existingHistory: TokenSnapshot[] = [],
  existingToken?: ScoredToken
): ScoredToken {
  const now = Date.now();
  const ageMs = Math.max(0, now - (pair.pairCreatedAt || now));
  // Cap ageMinutes at reasonable max (1 year) to avoid issues with bad data
  const maxReasonableAgeMinutes = 365 * 24 * 60; // 1 year
  const ageMinutes = Math.min(Math.floor(ageMs / (60 * 1000)), maxReasonableAgeMinutes);

  // Create current snapshot
  const liquidityUsd = resolveLiquidityUsd(pair.liquidity);
  const currentSnapshot: TokenSnapshot = {
    timestamp: now,
    liquidity: liquidityUsd,
    volume5m: pair.volume?.m5 || 0,
    txns5m: (pair.txns?.m5?.buys || 0) + (pair.txns?.m5?.sells || 0),
    priceUsd: parseFloat(pair.priceUsd) || 0,
    buys5m: pair.txns?.m5?.buys || 0,
    sells5m: pair.txns?.m5?.sells || 0,
  };

  // Merge with existing history, keep last 2 hours, dedupe by ~5min intervals
  const twoHoursAgo = now - 2 * 60 * 60 * 1000;
  const filteredHistory = existingHistory.filter((s) => s.timestamp > twoHoursAgo);

  // Only add new snapshot if enough time has passed (5 min minimum)
  const lastSnapshot = filteredHistory[filteredHistory.length - 1];
  const shouldAddSnapshot = !lastSnapshot || now - lastSnapshot.timestamp >= 5 * 60 * 1000;

  const history = shouldAddSnapshot
    ? [...filteredHistory, currentSnapshot]
    : filteredHistory;

  // Calculate scores
  const liquidityUsd = resolveLiquidityUsd(pair.liquidity);
  if (liquidityUsd === 0 && pair.baseToken?.symbol) {
    console.warn(`[processPair] Zero liquidity for ${pair.baseToken.symbol} (${pair.pairAddress}), raw liquidity:`, pair.liquidity);
  }
  const tokenMetrics = {
    liquidity: liquidityUsd,
    volume5m: pair.volume?.m5 || 0,
    volume1h: pair.volume?.h1 || 0,
    buys5m: pair.txns?.m5?.buys || 0,
    sells5m: pair.txns?.m5?.sells || 0,
    priceChange5m: pair.priceChange?.m5 || 0,
    priceChange1h: pair.priceChange?.h1 || 0,
    ageMinutes,
    txns5m: (pair.txns?.m5?.buys || 0) + (pair.txns?.m5?.sells || 0),
    txns1h: (pair.txns?.h1?.buys || 0) + (pair.txns?.h1?.sells || 0),
    priceNative: parseFloat(pair.priceNative) || 0,
  };

  const riskBreakdown = calculateRiskScore(tokenMetrics);
  const alphaBreakdown = calculateAlphaScore(tokenMetrics, history);

  // Evaluate gate
  const gateResult = evaluateCleanGemGate({
    ageMinutes,
    liquidity: tokenMetrics.liquidity,
    volume5m: tokenMetrics.volume5m,
    txns5m: tokenMetrics.txns5m,
    riskScore: riskBreakdown.score,
    alphaScore: alphaBreakdown.score,
  });

  const highScoreFallback =
    riskBreakdown.score >= CONFIG.gate.minRiskScore ||
    alphaBreakdown.score >= CONFIG.gate.minAlphaScore;
  const gateReasons = [...gateResult.reasons];
  if (!gateResult.isCleanGem && highScoreFallback) {
    gateReasons.push({
      criterion: 'Score thresholds',
      passed: true,
      value: `Risk ${riskBreakdown.score.toFixed(0)} / Alpha ${alphaBreakdown.score.toFixed(0)}`,
      threshold: `Risk ≥ ${CONFIG.gate.minRiskScore} OR Alpha ≥ ${CONFIG.gate.minAlphaScore}`,
      explanation: 'High risk or alpha score qualifies for clean gem visibility',
    });
  }

  const detectFirstSeen = existingToken?.detectFirstSeen ?? now;
  const detectionLatencyMs = Math.max(
    0,
    detectFirstSeen - (pair.pairCreatedAt || now)
  );
  const detectFirstPrice = existingToken?.detectFirstPrice ?? (parseFloat(pair.priceNative) || 0);

  return {
    address: pair.baseToken.address,
    pairAddress: pair.pairAddress,
    name: pair.baseToken.name,
    symbol: pair.baseToken.symbol,
    dexUrl: pair.url,
    ageMinutes,
    liquidity: tokenMetrics.liquidity,
    volume5m: tokenMetrics.volume5m,
    volume1h: tokenMetrics.volume1h,
    txns5m: tokenMetrics.txns5m,
    txns1h: tokenMetrics.txns1h,
    buys5m: tokenMetrics.buys5m,
    sells5m: tokenMetrics.sells5m,
    priceUsd: parseFloat(pair.priceUsd) || 0,
    priceNative: tokenMetrics.priceNative,
    priceChange5m: tokenMetrics.priceChange5m,
    priceChange1h: tokenMetrics.priceChange1h,
    fdv: pair.fdv || 0,
    riskScore: riskBreakdown.score,
    alphaScore: alphaBreakdown.score,
    isCleanGem: gateResult.isCleanGem || highScoreFallback,
    gateReasons,
    history,
    lastUpdated: now,
    detectFirstSeen,
    detectionLatencyMs,
    pairCreatedAt: pair.pairCreatedAt || now,
    detectFirstPrice,
    liquiditySol:
      tokenMetrics.priceUsd > 0
        ? (tokenMetrics.liquidity / tokenMetrics.priceUsd) * tokenMetrics.priceNative
        : 0,
  };
}
