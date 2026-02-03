 'use client';

import { useTokens } from '@/components/hooks/useTokens';

export default function DashboardPage() {
  const { tokens, newPools, loading, lastRefresh } = useTokens({ showOnlyGems: true });

  const totalLiquidity = tokens.reduce((sum, token) => sum + token.liquidity, 0);
  const avgRisk =
    tokens.length === 0 ? 0 : tokens.reduce((sum, token) => sum + token.riskScore, 0) / tokens.length;

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-gem-green">Dashboard</p>
        <h1 className="text-3xl font-semibold">Clean Gem portfolio insights</h1>
        <p className="mt-1 text-sm text-gray-400">
          Estimated profit assumes early entry into Clean Gems. Numbers refresh every 60 seconds with the latest bot scan.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Liquidity locked</p>
          <p className="text-3xl font-semibold">${totalLiquidity.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Across {tokens.length} clean gems</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Avg. risk</p>
          <p className="text-3xl font-semibold">{avgRisk.toFixed(1)}</p>
          <p className="text-xs text-gray-500">Higher = safer</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">New pools</p>
          <p className="text-3xl font-semibold">{newPools.length}</p>
          <p className="text-xs text-gray-500">Detected in the last minute</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/5 bg-[#080c17]/80 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Projected profit</h2>
            <span className="text-xs text-gem-green">demo</span>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Assuming early entry and 3x exit on liquidity, this is a simplistic view for idea generation. Demo mode shows mocked close prices.
          </p>
          <div className="mt-4 space-y-4">
            {tokens.slice(0, 3).map((token) => (
              <div key={token.pairAddress} className="rounded-2xl border border-white/5 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{token.symbol}</p>
                  <span className="text-xs text-gray-400">{token.ageMinutes}m old</span>
                </div>
                <p className="text-sm text-gray-400">
                  Liquidity ${token.liquidity.toLocaleString()} · Volume ${token.volume5m.toLocaleString()}
                </p>
                <p className="mt-2 text-lg font-semibold text-gem-green">
                  +${(token.liquidity * 2.5).toLocaleString()} realized (demo)
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/5 bg-[#080c17]/80 p-5">
          <h2 className="text-lg font-semibold">Market pulse</h2>
          <p className="mt-2 text-sm text-gray-400">Latest bot refresh: {new Date(lastRefresh).toLocaleTimeString()} UTC</p>
          <div className="mt-4 space-y-3 text-sm text-gray-300">
            {tokens.slice(0, 5).map((token) => (
              <div key={token.pairAddress} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-none">
                <span>{token.symbol}</span>
                <span className="text-gem-green">${token.priceUsd.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-gem-blue/30 bg-gradient-to-br from-[#051021] to-[#0b0f1f] p-5 text-sm text-gray-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-gem-green">Demo trades</p>
            <h2 className="text-xl font-semibold text-white">Simulated Auto-trades</h2>
          </div>
          <span className="rounded-full border border-gem-blue/50 px-3 py-1 text-xs text-gem-blue">DEMO MODE</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {tokens.slice(0, 4).map((token, index) => (
            <div key={token.pairAddress} className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{token.symbol}</p>
                <span className="text-[10px] uppercase tracking-[0.3em] text-gray-400">#{index + 1}</span>
              </div>
              <p className="text-xs text-gray-500">Entry: ${(token.liquidity * 0.15).toFixed(0)}</p>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Current</p>
                  <p className="text-lg font-semibold text-gem-green">+${(token.liquidity * 0.4).toFixed(0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Delta</p>
                  <p className="text-white">{(token.ageMinutes < 10 ? 'Fast' : 'Steady')}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">Demo profits update every refresh.</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
