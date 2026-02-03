 'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'New Gems', href: '/' },
  { label: 'Clean Gems', href: '/clean-gems' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Chart', href: '/chart' },
  { label: 'Swap', href: '/swap' },
];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[#030611] text-white">
      <header className="border-b border-white/10 bg-gradient-to-b from-[#050b1a] to-transparent px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/icon.png" alt="G3ms logo" width={80} height={80} className="rounded-full" priority />
            <div>
              <p className="text-sm uppercase tracking-[0.5em] text-gray-400">Solana Clean Early G3ms</p>
              <p className="text-lg font-semibold">Live detection & insights</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full border px-4 py-1 text-sm transition ${
                    isActive
                      ? 'border-gem-blue/80 bg-gem-blue/20 text-white'
                      : 'border-white/10 text-gray-300 hover:border-gem-blue hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[260px,1fr] lg:gap-6">
        <aside className="order-2 rounded-2xl border border-white/5 bg-gradient-to-br from-[#0b101e] to-transparent p-4 text-sm leading-relaxed text-gray-300 lg:order-1">
          <p className="text-xs uppercase tracking-[0.4em] text-gem-green">Bot Signals</p>
          <p className="mt-2">
            Bot polls DexScreener every <strong>60s</strong> and streams newly listed pools plus Clean Gem alerts.
          </p>
          <p className="mt-4">
            Use this dashboard to monitor new pools, track the cleanest Gems and run swaps from verified tokens.
          </p>
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Latency</span>
              <span>~2s</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Source</span>
              <span>DexScreener / Solscan / Birdeye</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Alert channels</span>
              <span>Telegram</span>
            </div>
          </div>
        </aside>

        <main className="order-1 rounded-3xl border border-white/5 bg-[#050b1a]/80 p-4 shadow-xl backdrop-blur md:p-6 md:order-2">
          {children}
        </main>
      </div>

      <footer className="border-t border-white/5 bg-[#030611] py-4 text-center text-xs tracking-[0.3em] text-gray-500">
        Powered by DexScreener · Solscan · Birdeye · Not financial advice
      </footer>
    </div>
  );
}
