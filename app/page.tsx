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

const NEW_GEMS_REQUEST_FILTERS: FilterOptions = {
  minLiquidity: 0,
  minRisk: 0,
  minAlpha: 0,
  maxAge: 9999,
  showOnlyGems: false,
};

const NEW_GEM_HIGHLIGHT_TTL_MS = 30 * 1000;
const NEW_GEM_DISPLAY_LIMIT = 4;

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
  const [viewMode, setViewMode] = useState<'clean' | 'new'>('clean');
  const [liveNewGems, setLiveNewGems] = useState<ScoredToken[]>([]);
  const [newPools, setNewPools] = useState<ScoredToken[]>([]);

  const fetchTokens = useCallback(async () => {
    try {
      const effectiveFilters = viewMode === 'clean' ? filters : NEW_GEMS_REQUEST_FILTERS;
      const params = new URLSearchParams({
        minLiquidity: effectiveFilters.minLiquidity.toString(),
        minRisk: effectiveFilters.minRisk.toString(),
        minAlpha: effectiveFilters.minAlpha.toString(),
        maxAge: effectiveFilters.maxAge.toString(),
        showOnlyGems: effectiveFilters.showOnlyGems.toString(),
      });

      const response = await fetch(`/api/tokens?${params}`);
      if (!response.ok) throw new Error('Failed to fetch tokens');

      const data: TokensResponse = await response.json();
      const highlightGems = (data.newCleanGems || []).slice(0, NEW_GEM_DISPLAY_LIMIT);
      setLiveNewGems(highlightGems);
      const pools = data.newPools || [];
      console.log(`[UI] Received ${pools.length} new pools, viewMode: ${viewMode}`, pools.length > 0 ? pools.slice(0, 3).map(p => p.symbol) : 'none');
      if (pools.length > 0) {
        setNewPools(pools);
      }

      // In "new" mode, combine regular tokens with new pools (pre-gate)
      const responseTokens =
        viewMode === 'new'
          ? [...(data.tokens || []), ...(pools || [])]
              .filter((token, index, self) => 
                // Dedupe by pairAddress
                index === self.findIndex(t => t.pairAddress === token.pairAddress)
              )
              .sort((a, b) => a.ageMinutes - b.ageMinutes)
          : data.tokens;

      setTokens(responseTokens);
      console.log(
        `[UI] Token prices / liquidity (SOL):`,
        responseTokens.slice(0, 3).map((t) => ({
          symbol: t.symbol,
          priceSol: t.priceNative,
          liquiditySol: t.liquiditySol,
        }))
      );
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
  }, [filters, viewMode]);

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
    return new Date(timestamp).toUTCString();
  };

  const formatTimeUTC = (timestamp: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toUTCString();
  };

const formatSolValue = (value: number) => {
  if (value === 0 || Number.isNaN(value)) return '-';
  return value.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 8 });
};

const formatUsdValue = (value: number) => {
  if (!Number.isFinite(value)) return '-';
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatSolDelta = (current: number, baseline: number) => {
  if (baseline <= 0) return '';
  const delta = ((current - baseline) / baseline) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`;
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

  useEffect(() => {
    if (liveNewGems.length === 0) return undefined;
    const timer = setTimeout(() => setLiveNewGems([]), NEW_GEM_HIGHLIGHT_TTL_MS);
    return () => clearTimeout(timer);
  }, [liveNewGems]);

  useEffect(() => {
    if (newPools.length === 0) return undefined;
    // Only clear new pools after TTL, but keep them longer if in "new" mode
    const ttl = viewMode === 'new' ? NEW_GEM_HIGHLIGHT_TTL_MS * 2 : NEW_GEM_HIGHLIGHT_TTL_MS;
    const timer = setTimeout(() => {
      if (viewMode !== 'new') {
        setNewPools([]);
      }
    }, ttl);
    return () => clearTimeout(timer);
  }, [newPools, viewMode]);

  const isCleanView = viewMode === 'clean';
  const modeButtonClass = (mode: 'clean' | 'new') =>
    `px-4 py-2 rounded-full text-sm font-semibold transition ${
      viewMode === mode
        ? 'bg-gem-blue/80 text-white'
        : 'bg-gem-card border border-gem-border text-gray-400 hover:text-white hover:border-gem-blue'
    }`;

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

        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex gap-2">
            <button onClick={() => setViewMode('new')} className={modeButtonClass('new')}>
              New Gems
            </button>
            <button onClick={() => setViewMode('clean')} className={modeButtonClass('clean')}>
              Clean Gems
            </button>
          </div>

          {isCleanView && (
            <div className="flex items-center gap-4">
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
          )}
        </div>

        {isCleanView && showFilters && (
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

        {!isCleanView && (
          <div className="bg-gem-card border border-gem-border rounded-xl p-4 mb-4 text-sm text-gray-400">
            Showing newly discovered tokens without gate filters applied.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 mb-4">
          <div className="bg-gem-card border border-gem-border rounded-xl p-4">
            <h3 className="text-xs uppercase tracking-[0.4em] text-gray-500 mb-3">Clean Gem Gate</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>Age ≤ 120 min</li>
              <li>Liquidity ≥ $20k</li>
              <li>Volume (5m) ≥ $10k OR Txns (5m) ≥ 80</li>
              <li>Risk Score ≥ 75 · Alpha Score ≥ 65</li>
            </ul>
          </div>
          <div className="bg-gem-card border border-gem-border rounded-xl p-4 text-sm text-gray-300">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500 mb-3">Dual scoring</p>
            <p className="mb-2">Risk Score: penalizes low liquidity, wash trading, imbalance.</p>
            <p className="mb-2">Alpha Score: rewards momentum (volume, txns, liquidity growth).</p>
            <p className="text-xs text-gray-500">Auto-refreshes every 60 seconds.</p>
          </div>
        </div>

        {viewMode === 'new' && liveNewGems.length > 0 && (
          <div className="bg-gem-blue/10 border border-gem-blue/50 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-gem-green mb-3">
              <span>Live clean gems</span>
              <span>{liveNewGems.length} new</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {liveNewGems.map((token) => (
                <a
                  key={token.pairAddress}
                  href={token.dexUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group block rounded-xl border border-white/5 bg-[#0b0d18] px-4 py-3 transition hover:border-gem-blue"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold text-white">{token.symbol}</div>
                    <span className="text-[11px] text-gray-400">{token.ageMinutes}m</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{token.name}</p>
                  <div className="mt-2 flex items-center gap-4 text-[11px] text-gray-300">
                    <span className="flex items-center gap-1">
                      <Shield size={12} />
                      Risk {token.riskScore}
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp size={12} />
                      Alpha {token.alphaScore}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Just-listed pools (pre-gate) */}
        {viewMode === 'new' && newPools.length > 0 && (
          <div className="bg-[#0b0f1c] border border-white/5 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-gem-green mb-3">
              <span>Newly listed pools</span>
              <span className="text-gray-300">{newPools.length} just listed</span>
            </div>
            <div className="grid gap-3">
              {newPools.map((token) => (
                <a
                  key={token.pairAddress}
                  href={token.dexUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-4 py-3 transition hover:border-gem-blue"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{token.symbol}</span>
                      <span className="text-[10px] uppercase tracking-[0.5em] text-gem-green">Just listed</span>
                    </div>
                    <p className="text-xs text-gray-400">{new Date(token.pairCreatedAt).toLocaleTimeString()}</p>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <div>{Math.ceil((Date.now() - token.pairCreatedAt) / 1000)}s ago</div>
                    <div>Liquidity ${token.liquidity.toLocaleString()}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

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
                  <th className="text-right uppercase tracking-[0.3em] text-gray-400">
                    FDV
                  </th>
                  <th className="min-w-[140px] text-right text-xs uppercase tracking-[0.3em] text-gray-400">
                    Price (SOL)
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
                  <th>Updated (UTC)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedTokens.map((token) => {
                  const priceDeltaText = formatSolDelta(token.priceNative, token.detectFirstPrice);
                  const deltaClass = priceDeltaText.startsWith('+')
                    ? 'text-gem-green'
                    : priceDeltaText.startsWith('-')
                      ? 'text-gem-red'
                      : 'text-gray-500';

                  return (
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
                      <div className="text-[10px] text-gray-500 mt-1">
                        ≈ {formatSolValue(token.liquiditySol)} SOL
                      </div>
                    </td>
                    <td className="text-right font-semibold text-xs text-gray-200">
                      {formatUsdValue(token.fdv)}
                    </td>
                    <td>
                      <span className="text-right text-sm text-gray-200 block">
                        {formatSolValue(token.priceNative)} SOL
                      </span>
                      {priceDeltaText && (
                        <span className={`text-[10px] ${deltaClass}`}>{priceDeltaText}</span>
                      )}
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
                      <span className="text-xs text-gray-400">{formatTimeUTC(lastRefresh)}</span>
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
                  );
                })}
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
