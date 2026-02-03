 'use client';

import { useMemo } from 'react';
import { useTokens } from '@/components/hooks/useTokens';

export default function ChartPage() {
  const { tokens } = useTokens({ showOnlyGems: true });

  const chartData = useMemo(
    () =>
      tokens.slice(0, 5).map((token) => ({
        symbol: token.symbol,
        value: token.priceNative,
      })),
    [tokens]
  );

  const maxValue = Math.max(...chartData.map((item) => item.value), 1);

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-gem-green">Clean Gem Chart</p>
        <h1 className="text-3xl font-semibold">Real-time price trend (SOL denominator)</h1>
        <p className="mt-1 text-sm text-gray-400">
          Precious stones, visualized. Hover or tap a bar to see the native price in SOL for each Clean Gem.
        </p>
      </header>

      <div className="rounded-3xl border border-white/5 bg-[#080c17]/80 p-6">
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-400">Waiting for clean gems to appear…</p>
        ) : (
          <div className="flex items-end gap-4">
            {chartData.map((item) => (
              <div key={item.symbol} className="group flex flex-col items-center gap-2">
                <div className="relative flex h-48 w-12 items-end justify-center overflow-hidden">
                  <div
                    className="h-full w-full rounded-2xl bg-gradient-to-t from-gem-green/90 to-transparent"
                    style={{ height: `${Math.max((item.value / maxValue) * 100, 4)}%` }}
                  />
                  <span className="absolute bottom-2 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {item.value.toFixed(4)} SOL
                  </span>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-gray-400">{item.symbol}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
