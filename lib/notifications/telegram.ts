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

function bulletList(reasons: GateReason[]) {
  return reasons.map((r) => `• ${r.criterion}: ${r.explanation}`).join('\n');
}

function buildBaseMessage(token: {
  symbol: string;
  dexUrl: string;
  liquidityUSD: number;
  priceUsd: number;
  priceNative: number;
  volume5m: number;
  txns5m: number;
  ageMinutes: number;
  gateReasons?: GateReason[];
}) {
  const parts = [
    `*${token.symbol}* — [View on DexScreener](${token.dexUrl})`,
    `Liquidity: $${formatNumber(token.liquidityUSD, 0)}`,
    `Price: $${formatNumber(token.priceUsd)} (${formatNumber(token.priceNative, 6)} SOL)`,
    `Volume (5m): $${formatNumber(token.volume5m)} · Txns: ${token.txns5m}`,
    `Age: ${token.ageMinutes}m`,
  ];
  if (token.gateReasons && token.gateReasons.length) {
    parts.push(`\n_Why snapshot:_\n${bulletList(token.gateReasons)}`);
  }
  return parts.join('\n');
}

export async function alertNewPool(token: {
  symbol: string;
  dexUrl: string;
  liquidityUSD: number;
  priceUsd: number;
  priceNative: number;
  volume5m: number;
  txns5m: number;
  ageMinutes: number;
  gateReasons?: GateReason[];
}) {
  if (!NEW_POOL_CHANNEL) return;
  const body = [
    '⚡ *New Pool Detected*',
    buildBaseMessage(token),
  ].join('\n\n');
  await sendTelegramMessage(NEW_POOL_CHANNEL, body);
}

export async function alertCleanGem(token: {
  symbol: string;
  dexUrl: string;
  liquidityUSD: number;
  priceUsd: number;
  priceNative: number;
  volume5m: number;
  txns5m: number;
  ageMinutes: number;
  riskScore: number;
  alphaScore: number;
  gateReasons?: GateReason[];
}) {
  if (!CLEAN_GEM_CHANNEL) return;
  const body = [
    '🔥 *Clean Gem Alert*',
    buildBaseMessage(token),
    `Risk: ${token.riskScore} · Alpha: ${token.alphaScore}`,
  ].join('\n\n');
  await sendTelegramMessage(CLEAN_GEM_CHANNEL, body);
}
