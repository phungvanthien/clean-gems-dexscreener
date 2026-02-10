'use client';

import { useState } from 'react';
import { usePremiumCleanGems } from '@/components/hooks/usePremiumCleanGems';

const DEFAULT_PRIVATE_KEY = process.env.NEXT_PUBLIC_CLIENT_PRIVATE_KEY || '';

export default function CleanGemsPage() {
  const [privateKey, setPrivateKey] = useState(DEFAULT_PRIVATE_KEY);
  const {
    cleanGems,
    status,
    paymentInfo,
    nextPaymentAt,
    errorMessage,
    refresh,
  } = usePremiumCleanGems(privateKey);

  const isReady = status === 'ready';
  const ttlLabel = nextPaymentAt ? new Date(nextPaymentAt).toLocaleTimeString() : '—';

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-gem-green">Clean Gem Gate</p>
        <h1 className="text-3xl font-semibold">Tokens behind payment</h1>
        <p className="mt-1 text-sm text-gray-400">
          Enter your STX wallet (private key) to sign the x402 payment flow. Unlock clean gems for 120 minutes each payment.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] uppercase tracking-[0.5em] text-gray-400">Access window</p>
          <p className="text-2xl font-semibold text-white">{isReady ? 'Unlocked' : 'Locked'}</p>
          <p className="text-xs text-gray-400">Next payment due: {ttlLabel} (UTC)</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] uppercase tracking-[0.5em] text-gray-400">Status</p>
          <p className="text-lg font-semibold">{status}</p>
          {errorMessage && <p className="text-xs text-red-400">{errorMessage}</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#040816] p-4">
        <label className="text-xs uppercase tracking-[0.4em] text-gray-400">STX private key (server wallet)</label>
        <div className="mt-3 flex gap-3">
          <input
            type="password"
            value={privateKey}
            onChange={(event) => setPrivateKey(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-[#020412] px-3 py-2 text-sm text-white focus:border-gem-blue focus:outline-none"
            placeholder="ENTER PRIVATE KEY"
          />
          <button
            className="rounded-2xl bg-gem-blue px-5 py-2 text-sm font-semibold text-white"
            onClick={refresh}
          >
            {status === 'paying' ? 'Paying…' : 'Pay 1 STX'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Payment of 1 STX unlocks Clean Gems for 120 minutes (per session).
        </p>
        {paymentInfo && (
          <p className="mt-1 text-xs text-gray-500">
            Last tx: {paymentInfo.transaction} · payer {paymentInfo.payer}
          </p>
        )}
      </div>

      <div className="rounded-3xl border border-white/5 bg-[#080c17]/80 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Clean Gems</h2>
          <span className="text-xs text-gray-400">{cleanGems.length} tokens</span>
        </div>
        {!isReady ? (
          <p className="mt-4 text-sm text-gray-500">Clear gems are locked until payment completes.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {cleanGems.map((token: any) => (
              <div
                key={token.pairAddress}
                className="flex flex-col gap-2 rounded-2xl border border-white/5 px-4 py-3 transition hover:border-gem-blue/50"
              >
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
                    <p className="text-white">${token.liquidity?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Volume 5m</p>
                    <p className="text-white">${token.volume5m?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Risk</p>
                    <p className="text-white">{token.riskScore?.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Alpha</p>
                    <p className="text-white">{token.alphaScore?.toFixed(0)}</p>
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
