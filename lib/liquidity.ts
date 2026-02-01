import { DexScreenerPair } from './types';

const DEXSCREENER_API = 'https://api.dexscreener.com';
const SOLSCAN_API = 'https://public-api.solscan.io';
const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'USD', 'USDC-USDT', 'USDT-USDC']);

let cachedSolPrice: number | null = null;

type SolscanTokenAccount = {
  mint?: string;
  tokenAddress?: string;
  amount?: string;
  tokenAmount?: string;
  tokenDecimals?: number;
  decimals?: number;
  uiAmountString?: string;
};

export type LiquidityCalculationResult = {
  pairAddress: string;
  liquidityUSD: number;
  source: 'dexscreener' | 'solscan+price';
  baseReserve: number;
  quoteReserve: number;
};

async function fetchDexScreenerPair(pairAddress: string): Promise<DexScreenerPair | null> {
  try {
    const url = `${DEXSCREENER_API}/latest/dex/search?q=${encodeURIComponent(pairAddress)}&chainId=solana`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const payload = await response.json();
    const candidates: DexScreenerPair[] = Array.isArray(payload.pairs) ? payload.pairs : [];
    return candidates.find((pair) => pair.pairAddress === pairAddress) ?? null;
  } catch (error) {
    console.warn('[calculateLiquidityUSD] DexScreener lookup failed', error);
    return null;
  }
}

async function fetchSolscanTokenAccounts(pairAddress: string): Promise<SolscanTokenAccount[]> {
  try {
    const response = await fetch(`${SOLSCAN_API}/account/tokens?account=${pairAddress}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data;
  } catch (error) {
    console.warn('[calculateLiquidityUSD] Solscan token lookup failed', error);
    return [];
  }
}

function normalizeAmount(account: SolscanTokenAccount): number {
  const rawAmount = account.amount ?? account.tokenAmount ?? account.uiAmountString;
  const decimals = account.decimals ?? account.tokenDecimals ?? 0;
  if (!rawAmount) return 0;
  const numeric = parseFloat(rawAmount);
  if (Number.isNaN(numeric)) return 0;
  return numeric / Math.pow(10, decimals);
}

function isStableSymbol(symbol?: string): boolean {
  if (!symbol) return false;
  return STABLE_SYMBOLS.has(symbol.toUpperCase());
}

async function fetchSolUsdPrice(): Promise<number> {
  if (cachedSolPrice !== null) return cachedSolPrice;
  try {
    const response = await fetch(
      `${DEXSCREENER_API}/latest/dex/search?q=sol%20usdc&chainId=solana`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) return 0;
    const payload = await response.json();
    const pairs: DexScreenerPair[] = Array.isArray(payload.pairs) ? payload.pairs : [];
    const solPair = pairs.find(
      (pair) => pair.quoteToken?.symbol?.toUpperCase() === 'USDC'
    );
    cachedSolPrice = solPair ? parseFloat(solPair.priceUsd) || 0 : 0;
    return cachedSolPrice;
  } catch (error) {
    console.warn('[calculateLiquidityUSD] Unable to resolve SOL price', error);
    return 0;
  }
}

async function determineQuotePriceUsd(pair: DexScreenerPair): Promise<number> {
  const quoteSymbol = pair.quoteToken?.symbol;
  if (!quoteSymbol) return 0;
  if (isStableSymbol(quoteSymbol)) return 1;
  if (quoteSymbol.toUpperCase() === 'SOL') {
    return await fetchSolUsdPrice();
  }
  return parseFloat(pair.priceUsd) || 0;
}

async function fetchBaseAndQuoteReserves(
  pairAddress: string,
  baseMint: string,
  quoteMint: string
): Promise<{ baseReserve: number; quoteReserve: number }> {
  const accounts = await fetchSolscanTokenAccounts(pairAddress);
  let baseReserve = 0;
  let quoteReserve = 0;
  for (const account of accounts) {
    const mint = account.mint ?? account.tokenAddress;
    if (!mint) continue;
    const amount = normalizeAmount(account);
    if (mint === baseMint) {
      baseReserve += amount;
    } else if (mint === quoteMint) {
      quoteReserve += amount;
    }
  }
  return { baseReserve, quoteReserve };
}

export async function calculateLiquidityUSD(
  pairAddress: string
): Promise<LiquidityCalculationResult> {
  const fallback: LiquidityCalculationResult = {
    pairAddress,
    liquidityUSD: 0,
    source: 'dexscreener',
    baseReserve: 0,
    quoteReserve: 0,
  };

  const pair = await fetchDexScreenerPair(pairAddress);
  if (!pair) {
    return fallback;
  }

  const basePriceUsd = parseFloat(pair.priceUsd) || 0;
  const quotePriceUsd = await determineQuotePriceUsd(pair);

  const { baseReserve, quoteReserve } = await fetchBaseAndQuoteReserves(
    pairAddress,
    pair.baseToken.address,
    pair.quoteToken.address
  );

  const totalLiquidity =
    baseReserve * basePriceUsd + quoteReserve * quotePriceUsd;

  if (
    baseReserve > 0 &&
    quoteReserve > 0 &&
    basePriceUsd > 0 &&
    quotePriceUsd > 0 &&
    Number.isFinite(totalLiquidity)
  ) {
    return {
      pairAddress,
      liquidityUSD: totalLiquidity,
      source: 'solscan+price',
      baseReserve,
      quoteReserve,
    };
  }

  const fallbackLiquidity = pair.liquidity?.usd || 0;
  return {
    pairAddress,
    liquidityUSD: fallbackLiquidity,
    source: 'dexscreener',
    baseReserve,
    quoteReserve,
  };
}
