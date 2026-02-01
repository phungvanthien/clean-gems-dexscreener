/**
 * API Route: /api/tokens
 *
 * Returns scored tokens with optional filtering
 */

import { NextResponse } from 'next/server';
import { refreshTokens, getStoreStats, consumeNewCleanGems, consumeNewPools } from '@/lib/token-tracker';
import { TokensResponse, FilterOptions } from '@/lib/types';

// Refresh interval in ms
const REFRESH_INTERVAL = 60 * 1000; // 60 seconds

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filter options from query params
    const filters: FilterOptions = {
      minLiquidity: parseFloat(searchParams.get('minLiquidity') || '0'),
      minRisk: parseFloat(searchParams.get('minRisk') || '0'),
      minAlpha: parseFloat(searchParams.get('minAlpha') || '0'),
      maxAge: parseFloat(searchParams.get('maxAge') || '999999'),
      showOnlyGems: searchParams.get('showOnlyGems') !== 'false',
    };

    // Refresh token data
    const allTokens = await refreshTokens();
    const newCleanGems = consumeNewCleanGems();
    const newPools = consumeNewPools();
    console.log(`[API] Returning ${allTokens.length} tokens, ${newCleanGems.length} new clean gems, ${newPools.length} new pools`);

    // Apply filters
    let filteredTokens = allTokens.filter((token) => {
      if (token.liquidity < filters.minLiquidity) return false;
      if (token.riskScore < filters.minRisk) return false;
      if (token.alphaScore < filters.minAlpha) return false;
      if (token.ageMinutes > filters.maxAge) return false;
      if (filters.showOnlyGems && !token.isCleanGem) return false;
      return true;
    });

    // Sort by alpha score (highest first), then by risk score
    filteredTokens.sort((a, b) => {
      // Clean gems first
      if (a.isCleanGem && !b.isCleanGem) return -1;
      if (!a.isCleanGem && b.isCleanGem) return 1;

      // Then by combined score
      const scoreA = a.alphaScore * 0.6 + a.riskScore * 0.4;
      const scoreB = b.alphaScore * 0.6 + b.riskScore * 0.4;
      return scoreB - scoreA;
    });

    // Get stats
    const stats = getStoreStats();

    const response: TokensResponse = {
      tokens: filteredTokens,
      lastRefresh: stats.lastFetchTime,
      nextRefresh: stats.lastFetchTime + REFRESH_INTERVAL,
      totalPairs: stats.totalTokens,
      gemsCount: stats.cleanGems,
      newCleanGems,
      newPools,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in /api/tokens:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support POST for manual refresh
export async function POST() {
  try {
    const tokens = await refreshTokens();
    const stats = getStoreStats();

    return NextResponse.json({
      success: true,
      totalTokens: tokens.length,
      cleanGems: stats.cleanGems,
      lastRefresh: stats.lastFetchTime,
    });
  } catch (error) {
    console.error('Error in POST /api/tokens:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
