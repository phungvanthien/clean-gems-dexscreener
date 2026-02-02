const TELEGRAM_API_BASE = 'https://api.telegram.org';
const BOT_TOKEN = process.env.BOT_TOKEN;

const NEW_POOL_CHANNEL = process.env.CHANNEL_ID;
const CLEAN_GEM_CHANNEL = process.env.Smart_money_channel_id;

type ParseMode = 'Markdown' | 'HTML';

async function sendTelegramMessage(chatId: string, text: string, parseMode: ParseMode = 'Markdown') {
  if (!BOT_TOKEN || !chatId) return;
  try {
    const url = `${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
    });
  } catch (error) {
    console.warn('[telegram] failed to send message', error);
  }
}

export async function alertNewPool(token: {
  symbol: string;
  dexUrl: string;
  liquidityUSD: number;
  priceUsd: number;
  priceNative: number;
  ageMinutes: number;
}) {
  if (!NEW_POOL_CHANNEL) return;
  const lines = [
    `*New pool detected*: [${token.symbol}](${token.dexUrl})`,
    `Liquidity ≈ $${token.liquidityUSD.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    `Price ≈ $${token.priceUsd.toFixed(4)} | ${token.priceNative.toFixed(6)} SOL`,
    `Age: ${token.ageMinutes} min`,
  ];
  await sendTelegramMessage(NEW_POOL_CHANNEL, lines.join('\n'));
}

export async function alertCleanGem(token: {
  symbol: string;
  dexUrl: string;
  liquidityUSD: number;
  priceUsd: number;
  priceNative: number;
  ageMinutes: number;
  riskScore: number;
  alphaScore: number;
}) {
  if (!CLEAN_GEM_CHANNEL) return;
  const lines = [
    `🔥 *Clean Gem unlocked*: [${token.symbol}](${token.dexUrl})`,
    `Liquidity ≈ $${token.liquidityUSD.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    `Price ≈ $${token.priceUsd.toFixed(4)} | ${token.priceNative.toFixed(6)} SOL`,
    `Risk ${token.riskScore} · Alpha ${token.alphaScore}`,
    `Age: ${token.ageMinutes} min`,
  ];
  await sendTelegramMessage(CLEAN_GEM_CHANNEL, lines.join('\n'));
}
