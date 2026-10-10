# Developer Experience Report: SecStock · Weekend Guard

## What did you build?
Weekend Guard is a gap-risk agent for tokenized-stock (bStock) collateral on BNB Chain. bStocks trade 24/7, but the US market
they track does not, so a Venus loan that looks safe on Friday can be liquidated by Monday's opening print. The agent scores
gap risk from Binance's tokenized-securities data (closed-market window, earnings or corporate-action flags, recent volatility,
token-vs-stock divergence), simulates the health factor through a stress gap, sizes a stablecoin top-up that keeps HF above a
target, and prepares the exact `baw defi preview` / `deposit` commands. It never acts on its own: the user confirms every step,
and the wallet has no withdraw permission. A Next.js dashboard shows the score, the simulation, and the plan. Optional Telegram alerts.

## What worked well
- The tokenized-securities skill docs are concrete: endpoints, fields, and caveats (for example, `volume24h` is the US stock volume) are written down.
- `baw defi position` exposes `healthRate`, so the liquidation threshold can be derived (`LT = healthRate × debt / collateral`) instead of hard-coded.
- `defi preview` before `deposit` fits a human-in-the-loop agent well.
- Installing the CLI was fast (`npm i -g @binance/agentic-wallet`, about 4 s).

## Friction
1. **Network block with an unclear error.** From Indonesia on Telkomsel, every Binance request and `baw auth signin` failed. The ISP filter
   answers with a certificate for `internetbaik.telkomsel.com`; `baw` only prints `[50001005] Hostname/IP does not match certificate's altnames`.
   It cost time to see that the network, not my setup, was the cause. A hint ("your network may be intercepting Binance traffic") would help.
2. **Ondo-only docs vs bStock reality.** The info skill documents `type=1` (Ondo) as the only provider, while Venus collateral is bStock (`type=3`).
   It is unclear which status, dynamic, and k-line endpoints support bStock.
3. **Stock price is `null` while the market is closed.** The divergence signal disappears exactly when gap risk matters, so the score has to be renormalised.
4. **No corporate-action calendar.** Status endpoints show only the current `reasonCode`; acting *before* earnings needs a forward-looking endpoint.
5. **No borrow/repay in the `baw` DeFi surface.** The agent can add collateral but cannot pay down debt.
6. **`investment-list` needs `--investType`.** This appears only in `references/defi.md`, not in the `SKILL.md` routing table.
7. **Expired file in the skill.** `references/campaign.md` (valid until 2026-09-01) still ships, and agents have to read and ignore it.

## What I would change
Add a network-diagnosis hint to TLS errors, document bStock support per endpoint, add a corporate-action calendar and a repay
action, put required flags in the `SKILL.md` routing table, and remove expired references.

## Status
Risk model and simulation: implemented and unit-tested (9/9). Dashboard: works with labelled demo data. The live Binance client and
the `baw` agent loop are implemented against the documented shapes, but could not be verified end-to-end because of the network block above.
