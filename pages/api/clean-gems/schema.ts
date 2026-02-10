import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_: NextApiRequest, res: NextApiResponse) {
  const schema = {
    x402Version: 2,
    name: 'Solana Clean Gems premium feed',
    description: 'Clean Gems that pass the scoring gate, refreshed every 60 seconds.',
    image: 'https://example.com/logo.png',
    resource: {
      url: 'https://yourdomain.com/api/clean-gems',
      description: 'Receive the latest Clean Gems after paying 1 STX.',
    },
    accepts: [
      {
        scheme: 'exact',
        network: 'stacks:2147483648',
        amount: '1000000', // 1 STX
        asset: 'STX',
        payTo: process.env.SERVER_ADDRESS,
        facilitatorUrl: process.env.FACILITATOR_URL,
        description: 'Unlock Clean Gems for 120 minutes',
        maxTimeoutSeconds: 300,
        outputSchema: {
          input: {
            type: 'request',
            method: 'GET',
            queryParams: {},
          },
          output: {
            cleanGems: {
              type: 'array',
              items: {
                symbol: { type: 'string' },
                priceUsd: { type: 'number' },
                liquidity: { type: 'number' },
                riskScore: { type: 'number' },
                alphaScore: { type: 'number' },
              },
            },
            payment: {
              transaction: { type: 'string' },
              payer: { type: 'string' },
              network: { type: 'string' },
            },
          },
        },
      },
    ],
  };

  res.status(200).json(schema);
}
