import { generateWallet, getGaiaAddress } from '@stacks/wallet-sdk';
import dotenv from 'dotenv';

dotenv.config();

const PASSWORD = process.env.MASTER_PASSWORD || 'changeme';

async function main() {
  const wallet = await generateWallet({
    secretKey: process.env.MASTER_SEED!,
    password: PASSWORD,
  });

  const account = wallet.accounts[0];
  console.log('STX address:', getGaiaAddress(account));
  console.log('STX private key:', account.stxPrivateKey);
  console.log('Set MASTER_PASSWORD=%s in .env for repeatable derives', PASSWORD);
}

main().catch(console.error);
