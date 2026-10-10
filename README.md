# SecStock · Weekend Guard

**Will your tokenized-stock collateral survive Monday's opening gap?**

Tokenized stocks on BNB Chain trade 24/7. The underlying US market does not. If you borrow against a bStock on a lending
market such as Venus, the token can keep moving all weekend, while the price discovery that matters happens when the
US market reopens. A position that looks safe on Friday can be liquidated by the first Monday print.

Weekend Guard is a small agent for that window. It scores the gap risk of a bStock from Binance's public tokenized-securities
data, reads your Venus position through the Binance Agentic Wallet, sizes a stablecoin top-up that keeps your health factor
above a target through a stress gap, previews it, and **only executes after you type `YES`**.

Built for *BNB Hack: Tokenized Stocks Edition*.

## What is real, and what is not

| Part | Status |
|---|---|
| Gap Risk Score, stress-gap model, health-factor simulation | Implemented, covered by unit tests (`npm test`) |
| Binance public tokenized-securities client (`lib/binance.ts`) | Implemented from the official skill docs. **Verify on your machine with `npm run probe`** |
| Agent loop with `baw` (`scripts/guard.mjs`) | Implemented against the response shapes documented in `binance-agentic-wallet/references/defi.md`; tested end-to-end with a stub `baw`. Not yet run against a real signed-in wallet unless noted in `DX_NOTES.md` |
| Web dashboard | Works with live data, or with clearly labelled **DEMO DATA** when Binance is unreachable |
| Telegram alert | Optional, off unless env vars are set |

Demo data is illustrative. The UI shows a `DEMO DATA` badge and a banner whenever it is used, and the API tags every
response with `source: "demo"`.

## Quick start

```bash
rm -rf node_modules .next        # if this folder was created on another OS
npm install
npm run probe                    # checks which Binance endpoints work for bStock vs Ondo tokens
npm run dev                      # http://localhost:3000
npm test
```

Agent (needs the Agentic Wallet CLI, `npm i -g @binance/agentic-wallet`, then `baw auth signin`):

```bash
npm run guard -- --symbol=TSLAB --dry-run     # sizes and previews, never executes
npm run guard -- --symbol=TSLAB               # asks you to type YES before depositing
npm run guard -- --symbol=TSLAB --demo        # demo data instead of Binance
```

Every run appends a line to `guard-log.jsonl` (score, gap, top-up, action, tx hash). That is the decision log.

## How it works

```
Binance public API (no key)              Binance Agentic Wallet (baw)
  market status · asset status             defi position  -> Venus health rate, collateral, debt
  dynamic data · k-line                    defi preview   -> dry run, fees, warnings
        |                                  defi deposit   -> executes only after you type YES
        v                                         ^
  lib/risk.ts  --- score, stress gap --->  scripts/guard.mjs  (agent)
        |                                         |
        v                                         v
  lib/sim.ts   --- health factor, top-up   app/  (Next.js dashboard + /api routes)
```

### Gap Risk Score (0-100)

| Signal | Max | Source |
|---|---|---|
| Closed-market exposure (hours until the underlying reopens, full weight at 48h) | 35 | asset / market status |
| Earnings or corporate action flagged right now | 25 | `reasonCode` / `reasonMsg` (`ASSET_LIMITED` + `earnings`, `ASSET_PAUSED` + dividend/split/...) |
| Recent volatility (stdev of 1h log returns, last 48 candles) | 25 | k-line |
| Token price vs stock feed price (token price / multiplier) | 15 | dynamic data |

Signals that are not available are **left out and the score is renormalised**, and the UI shows the coverage. Example: the
stock feed has no price while the market is closed, so the divergence signal is `n/a` exactly on weekends.

### Stress gap

`gap = max(3%, 2 x hourlyVol x sqrt(hours closed))`, raised to at least 8% when earnings are flagged. This is a stress
scenario for sizing, **not a forecast**. You can override it with a slider (UI) or `--gap` (agent).

### Top-up

Stablecoin collateral is not exposed to the stock gap, so the amount needed to keep `healthFactor >= target` after a gap `g` is:

```
topUp = target x debt / LT - collateral x (1 - g)
```

## Binance integration

Public, no API key (`lib/binance.ts`, shapes from `binance/binance-skills-hub`, skill `binance-tokenized-securities-info`):
- `.../market/token/rwa/stock/detail/list/ai` (`type=1` Ondo, `type=2` xStocks-style, `type=3` bStock)
- `.../market/token/rwa/market/status/ai`
- `.../market/token/rwa/asset/market/status/ai`
- `.../market/token/rwa/dynamic/ai` (v2)
- `.../dex/market/token/kline/ai`

Agentic Wallet CLI (`baw`): `defi position`, `defi investment-list`, `defi preview`, `defi deposit`.

Tokenized stocks touched: bStocks on BSC (for example TSLAB, NVDAB, SPCXB, which Venus Core Pool lists as collateral).
Ondo tokens are covered by the same endpoints.

## Safety

- The agent has no withdraw path and no borrow path. It can only supply a stablecoin you already hold.
- Nothing executes without a typed `YES`. A preview runs first and its warnings are printed.
- No private keys, seed phrases or API keys are read or stored by this project. `.env` is git-ignored.
- `/api/alert` validates its payload and throttles to one message per 30s per server instance. If you deploy publicly with
  Telegram configured, put it behind auth first.

## Known limitations

- Liquidation threshold is an input (or implied by the health rate that `baw` reports). It is not read from Venus parameters.
- Supplied USDT only counts as collateral if it is enabled as collateral on Venus.
- `baw` documents deposit and redeem for DeFi positions, not borrow or repay, so repaying debt is shown for comparison only.
- The status endpoints expose the *current* state, not an earnings calendar. The guard cannot see an earnings date days ahead.
- The Binance docs describe the tokenized-securities endpoints for Ondo tokens. Whether status, price and k-line work for bStock
  tokens is exactly what `npm run probe` tells you. See `DX_NOTES.md`.
- Not financial advice. Do your own research.
