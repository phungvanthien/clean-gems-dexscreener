import { alertNewPool, alertCleanGem } from '../lib/notifications/telegram';
import { GateReason } from '../lib/types';

const gateReasons: GateReason[] = [
  {
    criterion: 'Age',
    passed: true,
    value: '2 min',
    threshold: '≤ 120 min',
    explanation: 'Token is very new',
  },
  {
    criterion: 'Liquidity',
    passed: false,
    value: '$0',
    threshold: '≥ $20k',
    explanation: 'Liquidity missing from DexScreener/Solscan',
  },
  {
    criterion: 'Risk Score',
    passed: false,
    value: '35',
    threshold: '≥ 75',
    explanation: 'Low risk score',
  },
];

const sampleToken = {
  symbol: 'TEST',
  name: 'Test Token',
  pairAddress: 'TESTPAIR1234567890ABC',
  baseMint: 'TestMint11111111111111111111111111111111',
  liquidityUSD: 9800,
  priceUsd: 0.32,
  priceNative: 0.000014,
  volume5m: 4200,
  txns5m: 12,
  buys5m: 8,
  sells5m: 4,
  priceChange1h: 2.7,
  fdv: 43000,
  baseReserve: 1300,
  quoteReserve: 2150,
  liquiditySource: 'birdeye',
  ageMinutes: 2,
  gateReasons,
  riskScore: 35,
  alphaScore: 50,
};

async function main() {
  await alertNewPool(sampleToken);
  await alertCleanGem({
    ...sampleToken,
    gateReasons: [
      {
        criterion: 'Liquidity',
        passed: true,
        value: '$60k',
        threshold: '≥ $20k',
        explanation: 'Sufficient on-chain liquidity',
      },
      ...gateReasons,
    ],
    riskScore: 82,
    alphaScore: 78,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
