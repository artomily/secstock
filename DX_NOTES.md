# Developer Experience notes (raw material for the DX Report)

Write what happened to you, in your own words. Below are facts found while building, and blanks to fill after running things yourself.

## Found while reading the docs and building

1. **Ondo-only docs vs bStock reality.** The `binance-tokenized-securities-info` skill documents the list endpoint as
   "`type=1` Ondo (currently the only supported provider)". The `binance-agentic-wallet` skill says `type=2` is xStocks-style and
   `type=3` is bStock. Venus accepts bStocks as collateral. Nothing says whether market status, asset status, dynamic data and
   k-line work for bStock tokens. -> `npm run probe` answers this. Result: ______
2. **Misleading field name.** `tokenInfo.volume24h` in the RWA dynamic response is the US stock volume in USD, not on-chain volume.
   The docs warn about it, but the name invites mistakes.
3. **Stock price is `null` when the market is closed.** The token-vs-stock divergence signal disappears exactly when gap risk
   matters most. We had to renormalise the score over available signals.
4. **No forward-looking corporate actions.** Status endpoints return only the current `reasonCode` (for example
   `ASSET_LIMITED` + `earnings`). A guard that wants to act *before* earnings needs an earnings or corporate-action calendar endpoint.
5. **`baw` DeFi surface.** `defi deposit` and `defi redeem` exist; there is no borrow or repay for Lending positions. A protection agent
   can add collateral but cannot repay debt through the CLI.
6. **`investment-list` requires `--investType`.** The command routing table in `SKILL.md` does not show it; it is only in `references/defi.md`.
7. **Stale file shipped in the skill.** `references/campaign.md` is valid only until 2026-09-01 but is still in the repo, with an
   expiry switch the agent has to honour. Small thing, but it is context an agent has to read and ignore.
8. **Health-rate based calibration.** `defi position` returns `healthRate`, which let us back out the liquidation threshold
   (`LT = healthRate x debt / collateral`) instead of hard-coding it. Good surface, worth documenting as a pattern.

## To fill after running on your machine

- `npm run probe` output for bStock (type 3): assetStatus ___  dynamic ___  kline ___
- Time from `npm i -g @binance/agentic-wallet` to first successful `baw defi position`: ______
- Anything in `baw auth signin` that was unclear: ______
- Was a test mode or small-funds path available? ______
- Real `baw defi position` JSON vs the shape in `defi.md` (does `scripts/guard.mjs` parse it?): ______
- What you would change in the docs: ______
