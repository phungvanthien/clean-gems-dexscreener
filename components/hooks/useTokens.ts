 'use client';

import { useEffect, useMemo, useState } from 'react';
import { FilterOptions, ScoredToken } from '@/lib/types';

type TokenFilters = Partial<Omit<FilterOptions, 'showOnlyGems' | 'maxAge'>> & {
  showOnlyGems?: boolean;
  maxAge?: number;
};

export function useTokens(filters: TokenFilters = {}, intervalMs = 60000) {
  const [tokens, setTokens] = useState<ScoredToken[]>([]);
  const [newPools, setNewPools] = useState<ScoredToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<number>(0);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      minLiquidity: (filters.minLiquidity ?? 0).toString(),
      minRisk: (filters.minRisk ?? 0).toString(),
      minAlpha: (filters.minAlpha ?? 0).toString(),
      maxAge: (filters.maxAge ?? 9999).toString(),
      showOnlyGems: filters.showOnlyGems ? 'true' : 'false',
    });
    return params.toString();
  }, [filters]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchTokens() {
      setLoading(true);
      try {
        const response = await fetch(`/api/tokens?${queryParams}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const data = await response.json();
        if (!controller.signal.aborted && isMounted) {
          setTokens(data.tokens || []);
          setNewPools(data.newPools || []);
          setLastRefresh(data.lastRefresh || Date.now());
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('[useTokens] failed to fetch tokens', error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchTokens();
    const interval = setInterval(fetchTokens, intervalMs);
    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [intervalMs, queryParams]);

  return { tokens, newPools, loading, lastRefresh };
}
