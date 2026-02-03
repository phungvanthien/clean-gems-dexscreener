 'use client';

import { useMemo, useState } from 'react';
import { useTokens } from '@/components/hooks/useTokens';

export default function SwapPage() {
  const { tokens, loading } = useTokens({ showOnlyGems: true });
  const [query, setQuery] = useState('');

  const searched = useMemo(() => {
    const terms = query.trim().toLowerCase();
    if (!terms) return tokens;
    return tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(terms) ||
        token.name.toLowerCase().includes(terms) ||
        token.address.toLowerCase().includes(terms)
    );
  }, [query, tokens]);

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-gem-green">Swap</p>
        <h1 className="text-3xl font-semibold">Swap clean gems securely</h1>
        <p className="mt-1 text-sm text-gray-400">
          Search by symbol or paste a mint address to preview liquidity stats before executing on-chain.
        </p>
      </header>

      <div className="rounded-3xl border border-white/5 bg-[#080c17]/80 p-5">
        <label className="text-xs uppercase tracking-[0.3em] text-gray-500">Search gems</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Symbol or mint address"
            className="w-full rounded-2xl border border-white/10 bg-[#02060f] px-4 py-3 text-sm text-white focus:border-gem-blue focus:outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="rounded-2xl bg-gem-blue px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-gem-blue/30">
            Find gem
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Smart search uses on-chain mint and symbol data. Bot refreshes every 60s to keep liquidity accurate.
        </p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-gray-400">Loading gems…</p>
        ) : searched.length === 0 ? (
          <p className="text-sm text-gray-400">No matching tokens. Try a different symbol or mint address.</p>
        ) : (
          searched.map((token) => (
            <div key={token.pairAddress} className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{token.symbol}</p>
                  <p className="text-[11px] text-gray-400">{token.name}</p>
                </div>
                <button className="rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-[0.3em] text-gem-green hover:border-gem-green">
                  Swap
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-400 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Liquidity</p>
                  <p className="text-white">${token.liquidity.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Volume 5m</p>
                  <p className="text-white">${token.volume5m.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Price (SOL)</p>
                  <p className="text-white">{token.priceNative.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Pair</p>
                  <p className="text-white">{token.pairAddress.slice(0, 6)}…{token.pairAddress.slice(-4)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
