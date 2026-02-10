import type { NextApiRequest, NextApiResponse } from 'next';
import { paymentMiddleware, getPayment, STXtoMicroSTX } from 'x402-stacks';
import { refreshTokens } from '@/lib/token-tracker';

const NETWORK = (process.env.NETWORK as 'mainnet' | 'testnet') || 'testnet';
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://facilitator.stacksx402.com';
const PAY_TO = process.env.SERVER_ADDRESS;
const FEE_STX = parseFloat(process.env.CLEAN_GEM_FEE_STX || '0.0001');

if (!PAY_TO) {
  console.warn('[api/clean-gems] SERVER_ADDRESS not configured; payments will fail.');
}

const middleware = paymentMiddleware({
  amount: STXtoMicroSTX(FEE_STX),
  payTo: PAY_TO,
  network: NETWORK,
  facilitatorUrl: FACILITATOR_URL,
});

function runMiddleware(req: NextApiRequest, res: NextApiResponse, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await runMiddleware(req, res, middleware);
  } catch (error) {
    return;
  }

  const tokens = await refreshTokens();
  const cleanGems = tokens.filter((token) => token.isCleanGem);
  const payment = getPayment(req);

  res.setHeader('Cache-Control', 'private, max-age=0, no-cache');
  return res.status(200).json({
    cleanGems,
    paidAt: Date.now(),
    payment: {
      payer: payment?.payer,
      transaction: payment?.transaction,
      network: payment?.network,
    },
  });
}
