import { GateReason } from '../types';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const BOT_TOKEN = process.env.BOT_TOKEN;
const NEW_POOL_CHANNEL = process.env.CHANNEL_ID;
const CLEAN_GEM_CHANNEL = process.env.Smart_money_channel_id;

type ParseMode = 'Markdown' | 'HTML';

async function sendTelegramMessage(
  chatId: string,
  text: string,
  parseMode: ParseMode = 'Markdown'
) {
  if (!BOT_TOKEN || !chatId) return;
  try {
    const url = `${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
    });
  } catch (error) {
    console.warn('[telegram] failed to send message', error);
  }
}

function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function gateReasonsList(reasons?: GateReason[]) {
  if (!reasons || reasons.length === 0) return ['• Waiting for data'];
  return reasons.map((reason) => `• ${reason.criterion}: ${reason.explanation}`);
}

function categorizeGateReasons(reasons?: GateReason[]) {
  const sniper: string[] = [];
  const buyNotes: string[] = [];
  const safety: string[] = [];
  const sniperKeys = ['Age', 'Activity', 'Liquidity', 'Volume', 'Txns'];
  const buyKeys = ['Risk', 'Alpha', 'Momentum', 'Balance'];
  if (!reasons) return { sniper, buyNotes, safety };
  for (const reason of reasons) {
    const entry = `• ${reason.criterion}: ${reason.explanation}`;
    if (sniperKeys.some((key) => reason.criterion.includes(key))) {
      sniper.push(entry);
    } else if (buyKeys.some((key) => reason.criterion.includes(key))) {
      buyNotes.push(entry);
    } else {
      safety.push(entry);
    }
  }
  return { sniper, buyNotes, safety };
}

function shortPair(pairAddress: string) {
  return `${pairAddress.slice(0, 6)}…${pairAddress.slice(-4)}`;
}

function ruleEmoji(liquidity: number) {
  if (liquidity >= 50000) return '🟢';
  if (liquidity >= 10000) return '🟡';
  return '🔴';
}

function buildMessage(token: {
  symbol: string;
  name: string;
  pairAddress: string;
  baseMint: string;
  liquidityUSD: number;
  priceUsd: number;
  priceNative: number;
  volume5m: number;
  txns5m: number;
  buys5m: number;
  sells5m: number;
  priceChange1h?: number;
  fdv: number;
  baseReserve: number;
  quoteReserve: number;
  liquiditySource: string;
  ageMinutes: number;
  gateReasons?: GateReason[];
  isCleanGem?: boolean;
  riskScore?: number;
  alphaScore?: number;
}) {
  const liquidityTag = ruleEmoji(token.liquidityUSD);
  const { sniper, buyNotes, safety } = categorizeGateReasons(token.gateReasons);
  const rows = [
    '🚨 NEW SOLANA POOL DETECTED',
    '',
    '🆕 Just Listed • Ungated',
    '',
    `🪙 ${token.symbol} — ${token.name}`,
    `⏱ Age: ${token.ageMinutes} min`,
    `🔗 Pair: ${shortPair(token.pairAddress)}`,
    '',
    '💧 Liquidity',
    '',
    `${liquidityTag} $${formatNumber(token.liquidityUSD, 0)}`,
    `${token.baseReserve.toFixed(2)} ${token.symbol}`,
    `${token.quoteReserve.toFixed(2)} QUOTE`,
    `📌 Source: ${token.liquiditySource}`,
    '',
    `${liquidityTag} RULE`,
    '',
    '🟢 > $50k',
    '🟡 $10k – $50k',
    '🔴 < $10k',
    '',
    '📊 Market',
    '',
    `💵 Price: $${formatNumber(token.priceUsd)}`,
    `🏦 FDV: $${formatNumber(token.fdv, 0)}`,
    `📈 1h: ${token.priceChange1h ?? 0}%`,
    '',
    '🔄 Momentum (5m)',
    '',
    `📦 Vol: $${formatNumber(token.volume5m)}`,
    `🔁 Txns: ${token.txns5m}`,
    `🟢 Buys: ${token.buys5m} | 🔴 Sells: ${token.sells5m}`,
    '',
    '🧠 Signal Scores',
    '',
    `⚠️ Risk: ${token.riskScore ?? '0'} / 100`,
    `🚀 Alpha: ${token.alphaScore ?? '0'} / 100`,
    '',
    '⏱️ SNIPER WINDOW',
    sniper.length ? sniper.join('\n') : '• Waiting for sniper clues',
    '',
    '🧠 BUY NOTES',
    buyNotes.length ? buyNotes.join('\n') : '• Waiting for buy notes',
    '',
    '🛡️ SAFETY FLAGS',
    safety.length ? safety.join('\n') : '• Waiting for additional flags',
    '',
  ];
  if (token.isCleanGem) {
    rows.push('✅ CLEAN GEM CONFIRMED', '🔥 Passed all gates — Sniper-ready');
  } else {
    rows.push('❌ NOT CLEAN (YET)', '⛔ Failed gates:', gateReasonsList(token.gateReasons).join('\n'));
  }
  rows.push(
    '',
    '📌 Quick Actions',
    '',
    '📊 DexScreener',
    `👉 https://dexscreener.com/solana/${token.pairAddress}`,
    '',
    '🦅 Birdeye',
    `👉 https://birdeye.so/token/${token.baseMint}?chain=solana`,
    '',
    '📋 Copy Mint',
    token.baseMint,
    '',
    `⏰ ${new Date().toUTCString()}`,
    '⚠️ Auto alert • Not financial advice'
  );
  return rows.join('\n');
}

export async function alertNewPool(token: {
  symbol: string;
  name: string;
  pairAddress: string;
  baseMint: string;
  liquidityUSD: number;
  priceUsd: number;
  priceNative: number;
  volume5m: number;
  txns5m: number;
  buys5m: number;
  sells5m: number;
  priceChange1h?: number;
  fdv: number;
  baseReserve: number;
  quoteReserve: number;
  liquiditySource: string;
  ageMinutes: number;
  gateReasons?: GateReason[];
  isCleanGem?: boolean;
  riskScore?: number;
  alphaScore?: number;
}) {
  if (!NEW_POOL_CHANNEL) return;
  const message = buildMessage(token);
  await sendTelegramMessage(NEW_POOL_CHANNEL, message);
}

export async function alertCleanGem(token: {
  symbol: string;
  name: string;
  pairAddress: string;
  baseMint: string;
  liquidityUSD: number;
  priceUsd: number;
  priceNative: number;
  volume5m: number;
  txns5m: number;
  buys5m: number;
  sells5m: number;
  priceChange1h?: number;
  fdv: number;
  baseReserve: number;
  quoteReserve: number;
  liquiditySource: string;
  ageMinutes: number;
  gateReasons?: GateReason[];
  riskScore: number;
  alphaScore: number;
}) {
  if (!CLEAN_GEM_CHANNEL) return;
  const message = buildMessage({
    ...token,
    isCleanGem: true,
  });
  await sendTelegramMessage(CLEAN_GEM_CHANNEL, message);
}
