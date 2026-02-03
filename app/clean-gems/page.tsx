 'use client';

import { useTokens } from '@/components/hooks/useTokens';

export default function CleanGemsPage() {
  const { tokens, loading } = useTokens({ showOnlyGems: true });

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-gem-green">Clean Gem Gate</p>
        <h1 className="text-3xl font-semibold">Tokens that passed the gate</h1>
        <p className="mt-1 text-sm text-gray-400">
          These tokens met all liquidity, momentum, risk and alpha thresholds. Follow the list or enter swap mode to act.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {['Liquidity', 'Activity', 'Risk', 'Alpha'].map((metric) => (
          <div key={metric} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{metric}</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {metric === 'Liquidity' ? '$' : ''}
              {tokens.length ? tokens[0].liquidity.toLocaleString() : '—'}
            </p>
            <p className="text-gray-400">Top snapshot</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#080c17]/80 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Verified clean gems</h2>
          <span className="text-xs text-gray-400">{loading ? 'Loading…' : `${tokens.length} active`}</span>
        </div>
        {tokens.length === 0 && !loading ? (
          <p className="mt-4 text-sm text-gray-400">No clean gems currently meet the gate. Check back soon.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {tokens.map((token) => (
              <div key={token.pairAddress} className="flex flex-col gap-2 rounded-2xl border border-white/5 px-4 py-3 transition hover:border-gem-blue/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{token.symbol}</p>
                    <p className="text-xs text-gray-400">{token.name}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.4em] text-gem-green">Clean Gem</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-300 sm:grid-cols-4">
                  <div>
                    <p className="text-gray-400">Liquidity</p>
                    <p className="text-white">${token.liquidity.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Volume 5m</p>
                    <p className="text-white">${token.volume5m.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Risk</p>
                    <p className="text-white">{token.riskScore.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Alpha</p>
                    <p className="text-white">{token.alphaScore.toFixed(0)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
