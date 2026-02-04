'use client';

import { ScoredToken } from '@/lib/types';
import { useTokens } from '@/components/hooks/useTokens';

const TRADE_THRESHOLDS = [
  { multiplier: 2, fraction: 0.5 },
  { multiplier: 4, fraction: 0.5 },
  { multiplier: 20, fraction: 0.5 },
  { multiplier: 100, fraction: 1 },
];

interface TradeSimulation {
  symbol: string;
  entryPrice: number;
  holding: number;
  remaining: number;
  realized: number;
  roi: number;
  nextTarget: number | null;
  status: string;
}

const simulateTrade = (token: ScoredToken): TradeSimulation => {
  const capital = 0.1;
  const entryPrice = token.detectFirstPrice || token.priceNative || 0;
  if (entryPrice <= 0) {
    return {
      symbol: token.symbol,
      entryPrice,
      holding: 0,
      remaining: 0,
      realized: 0,
      roi: 0,
      nextTarget: null,
      status: 'Waiting for price data',
    };
  }

  const holding = capital / entryPrice;
  let remaining = holding;
  let realized = 0;
  let nextTarget: number | null = null;

  for (const threshold of TRADE_THRESHOLDS) {
    const targetPrice = entryPrice * threshold.multiplier;
    if (token.priceNative >= targetPrice) {
      const sellAmount = threshold.fraction === 1 ? remaining : remaining * threshold.fraction;
      const amountToSell = Math.min(remaining, sellAmount);
      realized += amountToSell * targetPrice;
      remaining -= amountToSell;
      continue;
    }
    nextTarget = targetPrice;
    break;
  }

  if (remaining > 0 && !nextTarget) {
    nextTarget = entryPrice * TRADE_THRESHOLDS[TRADE_THRESHOLDS.length - 1].multiplier;
  }

  return {
    symbol: token.symbol,
    entryPrice,
    holding,
    remaining,
    realized,
    roi: realized - capital,
    nextTarget,
    status: remaining <= 0 ? 'All sold' : `Target ${(nextTarget ?? 0) / entryPrice}x`,
  };
};

export default function DashboardPage() {
  const { tokens, newPools, lastRefresh } = useTokens({ showOnlyGems: true });

  const totalLiquidity = tokens.reduce((sum, token) => sum + token.liquidity, 0);
  const avgRisk =
    tokens.length === 0 ? 0 : tokens.reduce((sum, token) => sum + token.riskScore, 0) / tokens.length;
  const tradingSimulations = tokens.map(simulateTrade);

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-gem-green">Dashboard</p>
        <h1 className="text-3xl font-semibold">Clean Gem portfolio insights</h1>
        <p className="mt-1 text-sm text-gray-400">
          Simulated trades trigger when tokens enter Clean Gem list. Capital = 0.1 SOL, sells execute at 2×, 4×, 20× and 100×.
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
            <h2 className="text-lg font-semibold">Active clean gems</h2>
            <span className="text-xs text-gem-green">demo</span>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Bot tracks each gem from first detection and feeds simulated sells at layered multipliers.
          </p>
          <div className="mt-4 space-y-4">
            {tokens.slice(0, 3).map((token) => (
              <div key={token.pairAddress} className="rounded-2xl border border-white/5 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{token.symbol}</p>
                  <span className="text-xs text-gray-400">{token.ageMinutes}m old</span>
                </div>
                <p className="text-sm text-gray-400">
                  Price ${token.priceUsd.toFixed(6)} · Liquidity ${token.liquidity.toLocaleString()}
                </p>
                <p className="mt-2 text-lg font-semibold text-gem-green">
                  Trace target: {token.detectFirstPrice ? `${(token.priceNative / token.detectFirstPrice).toFixed(2)}x` : 'n/a'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/5 bg-[#080c17]/80 p-5">
          <h2 className="text-lg font-semibold">Market pulse</h2>
          <p className="mt-2 text-sm text-gray-400">
            Latest bot refresh: {new Date(lastRefresh).toUTCString()}
          </p>
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
            <h2 className="text-xl font-semibold text-white">Simulated laddering</h2>
          </div>
          <span className="rounded-full border border-gem-blue/50 px-3 py-1 text-xs text-gem-blue">DEMO MODE</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {tradingSimulations.slice(0, 4).map((trade, index) => (
            <div key={trade.symbol} className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{trade.symbol}</p>
                <span className="text-[10px] uppercase tracking-[0.3em] text-gray-400">#{index + 1}</span>
              </div>
              <p className="text-xs text-gray-500">Entry {trade.entryPrice.toFixed(6)} SOL</p>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Realized</p>
                  <p className="text-lg font-semibold text-gem-green">{trade.realized.toFixed(4)} SOL</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">Status</p>
                  <p className="text-white">{trade.status}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Remaining {trade.remaining.toFixed(4)} SOL · Next target {trade.nextTarget ? `${trade.nextTarget.toFixed(6)} SOL` : 'Complete'}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-[#070b16]/80 p-5">
        <h2 className="text-lg font-semibold">Trade simulator log</h2>
        <p className="text-xs text-gray-400">Represents layered sells at 2×, 4×, 20×, 100× multipliers.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] tracking-[0.4em] text-gray-500">
                <th className="pb-2">Token</th>
                <th className="pb-2">Entry</th>
                <th className="pb-2">Remaining</th>
                <th className="pb-2">Realized</th>
                <th className="pb-2">ROI</th>
                <th className="pb-2">Next target</th>
              </tr>
            </thead>
            <tbody>
              {tradingSimulations.map((trade) => (
                <tr key={trade.symbol} className="border-t border-white/5">
                  <td className="py-2">{trade.symbol}</td>
                  <td className="py-2 text-gray-300">{trade.entryPrice.toFixed(6)}</td>
                  <td className="py-2">{trade.remaining === 0 ? 'Sold' : `${trade.remaining.toFixed(4)} SOL`}</td>
                  <td className="py-2 text-gem-green">{trade.realized.toFixed(4)}</td>
                  <td className="py-2 text-gray-300">{trade.roi.toFixed(4)}</td>
                  <td className="py-2 text-gray-400">
                    {trade.nextTarget ? `${trade.nextTarget.toFixed(6)} SOL` : 'Complete'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
