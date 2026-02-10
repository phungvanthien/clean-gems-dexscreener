# Full Stack Premium Data Platform

This project now implements a full stack premium analytics platform built on top of DexScreener + x402 payments. The five pillars are:

1. **Data ingestion**  
   - `lib/token-tracker.ts` polls DexScreener and Solscan/Birdeye, normalizes liquidity, and tracks history (price, volume, transactions).  
   - `newPoolNotifications` and `cleanGemNotifications` streams keep the UI reactive.  
   - Automation scripts under `scripts/` (e.g. `refresh-gems.ts`) can be added to dump the latest feed for downstream consumers.

2. **Payment gating (x402)**  
   - The Next API route `/api/clean-gems` uses `paymentMiddleware` (x402-stacks V2) to enforce 1 STX per 120 minutes.  
   - Clients wrap Axios with `wrapAxiosWithPayment`, so 402 responses trigger automatic payment signing via `privateKeyToAccount`.
   - There is also a schema endpoint (`/api/clean-gems/schema`) exposing the x402 description for registration or agent discovery.

3. **Premium analytics/trading dashboard**  
   - `app/dashboard/page.tsx` visualizes clean gems, trade simulations, and a ledger of realized ROIs from ladder sells (2×, 4×, 20×, 100×).  
   - Clean Gems tab hides data until payment, showing the unlock timer, STX fee, and payment status, ensuring clarity for judges.

4. **Alerts / Telegram**  
   - `lib/notifications/telegram.ts` sends rich alerts for both new pools and clean gems.  
   - The Telegram message includes liquidity, reserves, scores, gate reasons, and quick links (DexScreener, Birdeye).  
   - Logs from `scripts/test-alert.ts` validate formatting before deploying.

5. **Docs + automation scripts**  
   - `.env.example` + README detail how to configure server/wallet/facilitator.  
   - `scripts/generate-wallet.ts` creates a testnet wallet and prints private keys for quick onboarding.  
   - README now contains a dedicated “Premium Data Platform” section linking to this doc, outlining flows and environment variables.
