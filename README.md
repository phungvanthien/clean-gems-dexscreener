# Solana Clean Early Gems

A real trading tool that automatically finds the cleanest possible early-stage memecoins on Solana — tokens that show early momentum but are unlikely to be scams or rugs.

![Dashboard](screenshot.png)

## Features

- **Auto-refresh every 60 seconds** - Continuously monitors new Solana pairs
- **Dual scoring system**:
  - **Risk Score (0-100)**: Eliminates rugs, honeypots, and fake volume
  - **Alpha Score (0-100)**: Detects real early attention and momentum
- **Clean Gem Gate**: Only shows tokens that pass strict quality criteria
- **Historical tracking**: Maintains 2 hours of token history for momentum analysis
- **Detailed "Why?" explanations**: Understand exactly why a token passed or failed

## Clean Gem Gate Criteria

A token is considered a **Clean Early Gem** only if ALL conditions are met:

| Criterion | Threshold |
|-----------|-----------|
| Age | ≤ 120 minutes |
| Liquidity | ≥ $20,000 |
| Activity (5m) | ≥ $10,000 volume OR ≥ 80 transactions |
| Risk Score | ≥ 75 |
| Alpha Score | ≥ 65 |

## Scoring System

### Risk Score (Higher = Safer)

Penalties are applied for:
- Extremely low liquidity (< $5k = -50 points)
- Suspicious volume/liquidity ratios (> 5x = -40 points)
- One-sided buy/sell activity (> 90% = -35 points)
- Extreme price volatility on low liquidity
- Brand-new tokens with no sustained activity
- Very low transaction counts

### Alpha Score (Higher = Stronger Momentum)

Bonuses are awarded for:
- Rising volume over time (2x growth = +25 points)
- Increasing transaction count
- Growing liquidity
- Healthy buy/sell balance (40-60% = +15 points)
- Sustained activity across multiple periods
- High absolute volume and transaction counts

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Project Structure

```
solana-clean-gems/
├── app/
│   ├── api/
│   │   └── tokens/
│   │       └── route.ts      # API endpoint
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Main dashboard
├── components/
│   └── WhyModal.tsx          # Gate explanation modal
├── lib/
│   ├── types.ts              # TypeScript interfaces
│   ├── scoring.ts            # ⭐ Scoring & gate logic (tune here)
│   ├── dexscreener.ts        # API client with caching
│   └── token-tracker.ts      # Historical data management
└── README.md
```

## Configuration

All scoring parameters are configurable in `lib/scoring.ts`:

```typescript
export const CONFIG = {
  // Clean Gem Gate thresholds
  gate: {
    maxAgeMinutes: 120,
    minLiquidity: 20000,
    minVolume5m: 10000,
    minTxns5m: 80,
    minRiskScore: 75,
    minAlphaScore: 65,
  },
  // Risk penalties and Alpha bonuses...
}
```

## API Endpoints

### GET /api/tokens

Returns scored tokens with optional filtering.

Query parameters:
- `minLiquidity` - Minimum liquidity in USD
- `minRisk` - Minimum risk score (0-100)
- `minAlpha` - Minimum alpha score (0-100)
- `maxAge` - Maximum age in minutes
- `showOnlyGems` - `true` (default) or `false`

### POST /api/tokens

Forces a refresh of token data.

---

# Roadmap

The dashboard follows a phased roadmap that starts with the current DexScreener-driven pipeline and progressively introduces on-chain validation. The plan below rebuilds the existing “V2 Roadmap” into a more actionable timeline.

1. **Phase 0 – Stabilize the feed (current)**  
   - Ensure polling every 60s stays within DexScreener limits  
   - Normalize responses, dedupe by `pairAddress`, and keep the “New Gems” feed responsive  
   - Track `detectFirstSeen`/`detectFirstPrice` for price deltas and store liquidity history

2. **Phase 1 – RPC integration**  
   - Add `@solana/web3.js` and create `lib/solana-rpc.ts` with connection pooling and rate limits  
   - Start caching RPC responses with a short TTL so the UI can reuse on-chain metadata without repeated hits  
   - Expose helper functions such as `getTokenSecurityInfo()` to gather mint/freeze authorities, holder concentration, and LP lock status

3. **Phase 2 – On-chain risk checks**  
   - Implement `checkMintAuthority()`, `checkFreezeAuthority()`, `checkHolderConcentration()`, and `checkLPLock()` around the Solana RPC helpers  
   - Extend `calculateRiskScore()` (and optionally a `calculateRiskScoreV2()`) to include the new deductions  
   - Surface each new factor inside the “Why?” modal so users understand the penalties and safeguards

4. **Phase 3 – Score & UI upgrades**  
   - Combine the new on-chain signals with existing DexScreener data when evaluating clean-gem thresholds  
   - Cache on-chain enrichments (5 min TTL) and show verification badges or holder charts in the dashboard  
   - Add LP lock/expiry indicators plus holder concentration visuals, keeping the UI informative without overwhelming the clean-gem gate

5. **Phase 4 – Future enhancements**  
   - Explore integrations with other Solana data providers (e.g., bags-sdk) if DexScreener data is insufficient for edge cases  
   - Ship alerting or notification hooks once a candidate passes the clean-gem gate  
   - Consider historical analytics dashboards (volume over time, price deltas vs. SOL, etc.) for advanced users

## V2 Roadmap: On-Chain Risk Analysis

# V2 Roadmap: On-Chain Risk Analysis

## Overview

V2 enhances the Risk Score by querying Solana RPC directly for on-chain token metadata. This catches additional red flags that DexScreener data alone cannot detect.

## New Risk Factors

### 1. Mint Authority Check
```typescript
// Check if mint authority is still active (can create more tokens)
const mintInfo = await connection.getParsedAccountInfo(mintAddress);
const mintAuthority = mintInfo.value?.data.parsed.info.mintAuthority;

// Risk: Active mint authority = -30 points
// Renounced (null) = Safe
```

**Why it matters**: If the mint authority is not renounced, the creator can print infinite tokens and dump on holders.

### 2. Freeze Authority Check
```typescript
// Check if freeze authority exists (can freeze your tokens)
const freezeAuthority = mintInfo.value?.data.parsed.info.freezeAuthority;

// Risk: Active freeze authority = -25 points
// Renounced (null) = Safe
```

**Why it matters**: Freeze authority allows the creator to freeze your tokens, preventing you from selling.

### 3. Top Holder Concentration
```typescript
// Get largest token holders
const holders = await connection.getTokenLargestAccounts(mintAddress);
const totalSupply = await connection.getTokenSupply(mintAddress);

// Calculate top 10 holder percentage
const top10Percent = holders.value
  .slice(0, 10)
  .reduce((sum, h) => sum + h.uiAmount, 0) / totalSupply.value.uiAmount;

// Risk thresholds:
// > 80% in top 10 = -35 points (extreme concentration)
// > 60% in top 10 = -20 points (high concentration)
// > 40% in top 10 = -10 points (moderate concentration)
```

**Why it matters**: High holder concentration means a few wallets can dump and crash the price.

### 4. LP Lock Detection
```typescript
// Check if LP tokens are locked or burned
// Method 1: Check for burned LP (sent to null address)
// Method 2: Query known locker contracts (e.g., Raydium, Jupiter LP lockers)

const lpTokenAccount = await connection.getParsedTokenAccountsByOwner(
  lpMintAddress,
  { programId: TOKEN_PROGRAM_ID }
);

// Check if LP is in a known locker contract
const isLocked = KNOWN_LOCKERS.includes(lpTokenAccount.owner);
const isBurned = lpTokenAccount.owner === NULL_ADDRESS;

// Risk:
// LP not locked/burned = -40 points
// LP locked < 30 days = -20 points
// LP locked > 30 days or burned = Safe
```

**Why it matters**: Unlocked LP means the creator can pull all liquidity (rug pull).

## V2 Implementation Plan

### Phase 1: RPC Integration
1. Add `@solana/web3.js` dependency
2. Create `lib/solana-rpc.ts` with connection pooling
3. Implement rate limiting to avoid RPC throttling

### Phase 2: New Risk Checks
1. Add `checkMintAuthority()` function
2. Add `checkFreezeAuthority()` function
3. Add `checkHolderConcentration()` function
4. Add `checkLPLock()` function

### Phase 3: Score Integration
1. Update `calculateRiskScore()` to include on-chain factors
2. Add new breakdown items to the Why modal
3. Cache on-chain data (5 min TTL) to reduce RPC load

### Phase 4: UI Updates
1. Add on-chain verification badges
2. Show holder distribution chart
3. Display LP lock status and expiry

## V2 Code Structure

```typescript
// lib/solana-rpc.ts
export async function getTokenSecurityInfo(mintAddress: string): Promise<{
  mintAuthorityActive: boolean;
  freezeAuthorityActive: boolean;
  top10HolderPercent: number;
  lpLockStatus: 'locked' | 'burned' | 'unlocked';
  lpLockExpiry?: number;
}>;

// Updated scoring.ts
export function calculateRiskScoreV2(
  token: TokenMetrics,
  onChainData: OnChainSecurityInfo
): RiskBreakdown {
  // Existing DexScreener-based checks...

  // New on-chain checks
  if (onChainData.mintAuthorityActive) {
    score -= 30;
    factors.push({ name: 'Mint Authority Active', ... });
  }

  if (onChainData.freezeAuthorityActive) {
    score -= 25;
    factors.push({ name: 'Freeze Authority Active', ... });
  }

  // ... etc
}
```

## Environment Variables (V2)

```env
# Solana RPC endpoint (use a dedicated RPC for production)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Optional: Helius/QuickNode for higher rate limits
HELIUS_API_KEY=your_api_key
```

## Known Locker Contracts (V2)

```typescript
const KNOWN_LOCKERS = [
  'TokenLockxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Raydium LP Locker
  'JUPyiwrYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Jupiter LP Locker
  // Add more as discovered
];
```

---

## Disclaimer

This tool is for informational purposes only. It does not constitute financial advice. Always do your own research before trading. Memecoins are extremely high risk and you can lose your entire investment.

## License

MIT
