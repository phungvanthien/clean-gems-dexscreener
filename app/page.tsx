'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScoredToken, TokensResponse, FilterOptions } from '@/lib/types';
import WhyModal from '@/components/WhyModal';
import {
  RefreshCw,
  Filter,
  Gem,
  TrendingUp,
  Shield,
  Clock,
  DollarSign,
  Activity,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const DEFAULT_FILTERS: FilterOptions = {
  minLiquidity: 0,
  minRisk: 0,
  minAlpha: 0,
  maxAge: 9999,
  showOnlyGems: true,
};

export default function Home() {
  const [tokens, setTokens] = useState<ScoredToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const [nextRefresh, setNextRefresh] = useState<number>(0);
  const [totalPairs, setTotalPairs] = useState<number>(0);
  const [gemsCount, setGemsCount] = useState<number>(0);
  const [filters, setFilters] = useState<FilterOptions>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedToken, setSelectedToken] = useState<ScoredToken | null>(null);
  const [sortField, setSortField] = useState<'alpha' | 'risk' | 'age' | 'liquidity' | 'volume'>('alpha');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchTokens = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        minLiquidity: filters.minLiquidity.toString(),
        minRisk: filters.minRisk.toString(),
        minAlpha: filters.minAlpha.toString(),
        maxAge: filters.maxAge.toString(),
        showOnlyGems: filters.showOnlyGems.toString(),
      });

      const response = await fetch(`/api/tokens?${params}`);
      if (!response.ok) throw new Error('Failed to fetch tokens');

      const data: TokensResponse = await response.json();

      setTokens(data.tokens);
      setLastRefresh(data.lastRefresh);
      setNextRefresh(data.nextRefresh);
      setTotalPairs(data.totalPairs);
      setGemsCount(data.gemsCount);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, [fetchTokens]);

  // Sort tokens
  const sortedTokens = [...tokens].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'alpha':
        comparison = a.alphaScore - b.alphaScore;
        break;
      case 'risk':
        comparison = a.riskScore - b.riskScore;
        break;
      case 'age':
        comparison = a.ageMinutes - b.ageMinutes;
        break;
      case 'liquidity':
        comparison = a.liquidity - b.liquidity;
        break;
      case 'volume':
        comparison = a.volume5m - b.volume5m;
        break;
    }
    return sortAsc ? comparison : -comparison;
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const getScoreClass = (score: number, threshold: number) => {
    if (score >= threshold) return 'score-high';
    if (score >= threshold * 0.6) return 'score-medium';
    return 'score-low';
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString();
  };

  const timeUntilRefresh = () => {
    const remaining = Math.max(0, nextRefresh - Date.now());
    return Math.ceil(remaining / 1000);
  };

  const [countdown, setCountdown] = useState(60);
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(timeUntilRefresh());
    }, 1000);
    return () => clearInterval(interval);
  }, [nextRefresh]);

  return (
    <main className="min-h-screen p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Gem className="text-gem-green" size={32} />
            <div>
              <h1 className="text-2xl font-bold">Solana Clean Early Gems</h1>
              <p className="text-sm text-gray-400">
                Auto-discovering the cleanest early-stage memecoins
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="text-gray-400">
                Tracking <span className="text-white font-medium">{totalPairs}</span> pairs
              </div>
              <div className="text-gray-400">
                <span className="text-gem-green font-medium">{gemsCount}</span> clean gems found
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gem-card px-4 py-2 rounded-lg border border-gem-border">
              <RefreshCw
                size={16}
                className={`text-gem-green ${loading ? 'animate-spin' : ''}`}
              />
              <span className="text-sm">
                {loading ? 'Refreshing...' : `${countdown}s`}
              </span>
            </div>
          </div>
        </div>

        {/* Filters Toggle */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 bg-gem-card px-4 py-2 rounded-lg border border-gem-border hover:border-gem-blue transition-colors"
          >
            <Filter size={16} />
            <span>Filters</span>
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`toggle-switch ${filters.showOnlyGems ? 'active' : ''}`}
              onClick={() => setFilters({ ...filters, showOnlyGems: !filters.showOnlyGems })}
            />
            <span className="text-sm">Show only Clean Gems</span>
          </label>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-gem-card border border-gem-border rounded-xl p-4 mb-4 grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-2">Min Liquidity ($)</label>
              <input
                type="number"
                className="filter-input"
                placeholder="0"
                value={filters.minLiquidity || ''}
                onChange={(e) =>
                  setFilters({ ...filters, minLiquidity: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2">Min Risk Score</label>
              <input
                type="number"
                className="filter-input"
                placeholder="0"
                min="0"
                max="100"
                value={filters.minRisk || ''}
                onChange={(e) =>
                  setFilters({ ...filters, minRisk: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2">Min Alpha Score</label>
              <input
                type="number"
                className="filter-input"
                placeholder="0"
                min="0"
                max="100"
                value={filters.minAlpha || ''}
                onChange={(e) =>
                  setFilters({ ...filters, minAlpha: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2">Max Age (minutes)</label>
              <input
                type="number"
                className="filter-input"
                placeholder="No limit"
                value={filters.maxAge < 9999 ? filters.maxAge : ''}
                onChange={(e) =>
                  setFilters({ ...filters, maxAge: parseFloat(e.target.value) || 9999 })
                }
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-gem-red/20 border border-gem-red/50 text-gem-red px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}
      </div>

      {/* Token Table */}
      <div className="max-w-7xl mx-auto bg-gem-card border border-gem-border rounded-xl overflow-hidden">
        {loading && tokens.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <RefreshCw className="animate-spin mx-auto mb-4" size={32} />
            <p>Loading tokens...</p>
          </div>
        ) : tokens.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Gem className="mx-auto mb-4 opacity-30" size={48} />
            <p className="text-lg mb-2">No tokens match your criteria</p>
            <p className="text-sm">Try adjusting your filters or wait for new tokens</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="token-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th
                    className="cursor-pointer hover:text-white"
                    onClick={() => handleSort('age')}
                  >
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      Age
                      <SortIcon field="age" />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer hover:text-white"
                    onClick={() => handleSort('liquidity')}
                  >
                    <div className="flex items-center gap-1">
                      <DollarSign size={14} />
                      Liquidity
                      <SortIcon field="liquidity" />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer hover:text-white"
                    onClick={() => handleSort('volume')}
                  >
                    <div className="flex items-center gap-1">
                      <Activity size={14} />
                      Vol (5m)
                      <SortIcon field="volume" />
                    </div>
                  </th>
                  <th>Txns (5m)</th>
                  <th
                    className="cursor-pointer hover:text-white"
                    onClick={() => handleSort('risk')}
                  >
                    <div className="flex items-center gap-1">
                      <Shield size={14} />
                      Risk
                      <SortIcon field="risk" />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer hover:text-white"
                    onClick={() => handleSort('alpha')}
                  >
                    <div className="flex items-center gap-1">
                      <TrendingUp size={14} />
                      Alpha
                      <SortIcon field="alpha" />
                    </div>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedTokens.map((token) => (
                  <tr key={token.pairAddress}>
                    <td>
                      <div className="flex items-center gap-3">
                        {token.isCleanGem && (
                          <Gem size={16} className="text-gem-green flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {token.symbol}
                            <a
                              href={token.dexUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-500 hover:text-gem-blue"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[150px]">
                            {token.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={token.ageMinutes <= 120 ? 'text-gem-green' : 'text-gray-400'}>
                        {token.ageMinutes}m
                      </span>
                    </td>
                    <td>
                      <span className={token.liquidity >= 20000 ? '' : 'text-gem-yellow'}>
                        ${token.liquidity.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className={token.volume5m >= 10000 ? 'text-gem-green' : ''}>
                        ${token.volume5m.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className="text-gray-300">
                        {token.txns5m}
                        <span className="text-xs text-gray-500 ml-1">
                          ({token.buys5m}B/{token.sells5m}S)
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={`score-badge ${getScoreClass(token.riskScore, 75)}`}>
                        {token.riskScore}
                      </span>
                    </td>
                    <td>
                      <span className={`score-badge ${getScoreClass(token.alphaScore, 65)}`}>
                        {token.alphaScore}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => setSelectedToken(token)}
                        className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm transition-colors"
                      >
                        Why?
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-6 text-center text-sm text-gray-500">
        <p>
          Last updated: {formatTime(lastRefresh)} | Auto-refresh every 60 seconds
        </p>
        <p className="mt-1">
          Data from DexScreener | Not financial advice
        </p>
      </div>

      {/* Why Modal */}
      {selectedToken && (
        <WhyModal
          token={selectedToken}
          onClose={() => setSelectedToken(null)}
        />
      )}
    </main>
  );
}
