require('dotenv/config');
require('ts-node/register');

const { alertNewPool, alertCleanGem } = require('../lib/notifications/telegram');

const sampleGateReasons = [
  {
    criterion: 'Age',
    passed: true,
    value: '3 min',
    threshold: '≤ 120 min',
    explanation: 'Freshly minted token',
  },
  {
    criterion: 'Liquidity',
    passed: false,
    value: '$0',
    threshold: '≥ $20k',
    explanation: 'Liquidity falling short',
  },
];

const sampleToken = {
  symbol: 'TEST',
  name: 'Test Token',
  pairAddress: 'TESTPAIR1234567890',
  baseMint: 'TestMint11111111111111111111111111111111',
  liquidityUSD: 9800,
  priceUsd: 0.53,
  priceNative: 0.000017,
  volume5m: 5400,
  txns5m: 18,
  buys5m: 12,
  sells5m: 6,
  priceChange1h: 1.5,
  fdv: 42000,
  baseReserve: 1500,
  quoteReserve: 2100,
  liquiditySource: 'birdeye',
  ageMinutes: 3,
  gateReasons: sampleGateReasons,
  riskScore: 40,
  alphaScore: 50,
};

async function run() {
  await alertNewPool(sampleToken);
  await alertCleanGem({ ...sampleToken, isCleanGem: true });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
