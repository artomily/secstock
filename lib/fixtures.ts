// DEMO DATA ONLY. Used when the Binance endpoints are unreachable, or when the
// user picks a scenario for the demo video. Prices are illustrative, not market data.
// The API routes tag every response built from this file with source: "demo".
import type { Snapshot } from "./binance";
import type { TokenRef } from "./types";

export type Scenario = "weekend" | "earnings" | "open";

export const DEMO_TOKENS: TokenRef[] = [
  { chainId: "56", contractAddress: "demo-TSLAB", symbol: "TSLAB", ticker: "TSLA", type: 3, multiplier: 1 },
  { chainId: "56", contractAddress: "demo-NVDAB", symbol: "NVDAB", ticker: "NVDA", type: 3, multiplier: 1 },
  { chainId: "56", contractAddress: "demo-SPCXB", symbol: "SPCXB", ticker: "SPCX", type: 3, multiplier: 1 },
];

const PROFILE: Record<string, { price: number; hourlyVol: number }> = {
  "demo-TSLAB": { price: 300, hourlyVol: 0.0045 },
  "demo-NVDAB": { price: 180, hourlyVol: 0.0035 },
  "demo-SPCXB": { price: 120, hourlyVol: 0.0075 },
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function isDemoToken(contractAddress: string) {
  return contractAddress.startsWith("demo-");
}

export function demoSnapshot(token: Pick<TokenRef, "contractAddress">, now: number, scenario: Scenario = "weekend"): Snapshot {
  const prof = PROFILE[token.contractAddress] ?? { price: 100, hourlyVol: 0.004 };
  const rand = rng(token.contractAddress.length * 7919 + 13);
  const candles = [];
  let p = prof.price;
  const hour = 3_600_000;
  const start = now - 49 * hour;
  for (let i = 0; i < 49; i++) {
    // sum of uniforms ~ roughly normal, scaled to the profile's hourly vol
    const z = (rand() + rand() + rand() + rand() - 2) * 1.7;
    p = p * (1 + z * prof.hourlyVol);
    candles.push({ openTime: start + i * hour, close: p, closeTime: start + (i + 1) * hour - 1 });
  }
  const last = candles[candles.length - 1].close;
  const warnings = ["DEMO DATA: Binance endpoints not used. Values are illustrative."];

  if (scenario === "open") {
    return {
      market: { openState: true, reasonCode: "TRADING", reasonMsg: null, nextOpenTime: null, nextCloseTime: now + 5 * hour },
      asset: { openState: true, marketStatus: "regular", reasonCode: "TRADING", reasonMsg: null, nextOpenTime: null, nextCloseTime: now + 5 * hour },
      dyn: { tokenPrice: last, sharesMultiplier: 1, stockPrice: last * 1.0006, dividendYieldPct: 0.3, totalHolders: 1000 },
      candles,
      warnings,
    };
  }
  const hoursToOpen = scenario === "weekend" ? 56 : 18;
  const reasonCode = scenario === "earnings" ? "ASSET_LIMITED" : "MARKET_CLOSED";
  const reasonMsg = scenario === "earnings" ? "earnings" : null;
  return {
    market: { openState: false, reasonCode: "MARKET_CLOSED", reasonMsg: null, nextOpenTime: now + hoursToOpen * hour, nextCloseTime: now + (hoursToOpen + 7) * hour },
    asset: { openState: false, marketStatus: "closed", reasonCode, reasonMsg, nextOpenTime: now + hoursToOpen * hour, nextCloseTime: now + (hoursToOpen + 7) * hour },
    dyn: { tokenPrice: last, sharesMultiplier: 1, stockPrice: null, dividendYieldPct: 0.3, totalHolders: 1000 },
    candles,
    warnings,
  };
}
