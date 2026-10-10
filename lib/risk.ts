// Gap Risk Score: how exposed is a tokenized-stock collateral position to a
// price gap when the underlying US market reopens?
// Pure functions, no I/O. Keep this file free of value imports so that
// scripts/guard.mjs can load it directly with node --experimental-strip-types.

export type RiskInputs = {
  now: number; // ms epoch
  marketOpen: boolean | null;
  assetOpen: boolean | null;
  nextOpenTime: number | null; // ms epoch, from asset status (fallback: market status)
  reasonCode: string | null;
  reasonMsg: string | null;
  tokenPrice: number | null;
  sharesMultiplier: number | null;
  stockPrice: number | null;
  closes: { closeTime: number; close: number }[]; // 1h candles, ascending
};

export type Factor = {
  key: "exposure" | "corporate" | "volatility" | "divergence";
  label: string;
  points: number;
  max: number;
  available: boolean;
  detail: string;
};

export type RiskLevel = "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";

export type RiskResult = {
  score: number; // 0-100, normalised over the signals that were available
  level: RiskLevel;
  coverage: number; // 0-1, share of the full 100-point scale that had data
  factors: Factor[];
  hoursToOpen: number | null;
  hourlyVol: number | null; // stdev of 1h log returns (fraction)
  expectedGapPct: number | null; // heuristic 2-sigma stress gap, see below
};

export const STRESS_FLOOR_PCT = 3;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function hourlyVolatility(closes: { close: number }[]): number | null {
  if (closes.length < 8) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1].close;
    const b = closes[i].close;
    if (a > 0 && b > 0) rets.push(Math.log(b / a));
  }
  if (rets.length < 6) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance);
}

export function corporatePoints(reasonCode: string | null, reasonMsg: string | null): { points: number; detail: string } {
  const code = reasonCode ?? "";
  const msg = (reasonMsg ?? "").toLowerCase();
  if (code === "ASSET_LIMITED" && msg === "earnings") {
    return { points: 25, detail: "Earnings window: trading restricted, large gap risk at reopen" };
  }
  if (code === "ASSET_PAUSED") {
    if (msg === "cash_dividend" || msg === "stock_dividend") {
      return { points: 10, detail: "Dividend processing: multiplier changes, price discontinuity possible" };
    }
    if (["stock_split", "merger", "acquisition", "spinoff", "corporate action"].includes(msg)) {
      return { points: 20, detail: `Corporate action (${msg}): token economics may change` };
    }
    return { points: 5, detail: `Asset paused (${msg || "maintenance"})` };
  }
  if (code === "MARKET_PAUSED") return { points: 10, detail: "Market-wide halt" };
  if (code === "MARKET_MAINTENANCE") return { points: 5, detail: "Market maintenance" };
  if (code === "UNSUPPORTED") return { points: 15, detail: "Asset reported as unsupported" };
  return { points: 0, detail: "No corporate action flagged right now" };
}

export function computeRisk(i: RiskInputs): RiskResult {
  // 1) Exposure: hours the underlying market stays closed. Max at 48h (a weekend).
  let hoursToOpen: number | null = null;
  const closed = i.assetOpen === false || (i.assetOpen === null && i.marketOpen === false);
  if (i.nextOpenTime !== null) hoursToOpen = Math.max(0, (i.nextOpenTime - i.now) / 3_600_000);
  const exposure: Factor = (() => {
    if (i.assetOpen === null && i.marketOpen === null) {
      return { key: "exposure", label: "Closed-market exposure", points: 0, max: 35, available: false, detail: "Market status unavailable" };
    }
    if (!closed) {
      return { key: "exposure", label: "Closed-market exposure", points: 0, max: 35, available: true, detail: "Underlying market is open" };
    }
    const h = hoursToOpen ?? 0;
    return {
      key: "exposure",
      label: "Closed-market exposure",
      points: clamp((h / 48) * 35, 0, 35),
      max: 35,
      available: true,
      detail: hoursToOpen === null ? "Closed, reopen time unknown" : `Closed for ${h.toFixed(1)}h more`,
    };
  })();

  // 2) Corporate action / earnings state.
  const corp = corporatePoints(i.reasonCode, i.reasonMsg);
  const corporate: Factor = {
    key: "corporate",
    label: "Earnings / corporate action",
    points: corp.points,
    max: 25,
    available: i.reasonCode !== null || i.assetOpen !== null,
    detail: corp.detail,
  };

  // 3) Recent volatility from 1h candles (up to last 48).
  const recent = i.closes.slice(-49);
  const vol = hourlyVolatility(recent);
  const volatility: Factor = {
    key: "volatility",
    label: "Recent volatility (1h)",
    points: vol === null ? 0 : clamp((vol / 0.01) * 25, 0, 25),
    max: 25,
    available: vol !== null,
    detail: vol === null ? "Not enough candles" : `1h stdev ${(vol * 100).toFixed(2)}%`,
  };

  // 4) Oracle/stock divergence. Only measurable while the stock feed has a price.
  let divergence: Factor;
  if (i.tokenPrice !== null && i.sharesMultiplier && i.stockPrice !== null && i.stockPrice > 0) {
    const ref = i.tokenPrice / i.sharesMultiplier;
    const pct = Math.abs(ref - i.stockPrice) / i.stockPrice;
    divergence = {
      key: "divergence",
      label: "Token vs stock price",
      points: clamp((pct / 0.01) * 15, 0, 15),
      max: 15,
      available: true,
      detail: `${(pct * 100).toFixed(3)}% apart (token price / multiplier vs stock feed)`,
    };
  } else {
    divergence = {
      key: "divergence",
      label: "Token vs stock price",
      points: 0,
      max: 15,
      available: false,
      detail: "Stock feed has no price (normal while the market is closed)",
    };
  }

  const factors = [exposure, corporate, volatility, divergence];
  const availMax = factors.filter((f) => f.available).reduce((s, f) => s + f.max, 0);
  const pts = factors.filter((f) => f.available).reduce((s, f) => s + f.points, 0);
  const score = availMax === 0 ? 0 : Math.round((pts / availMax) * 100);
  const level: RiskLevel = score < 25 ? "LOW" : score < 50 ? "ELEVATED" : score < 75 ? "HIGH" : "CRITICAL";

  // Heuristic stress gap: 2 sigma over the closed window, never below the floor.
  // This is a stress scenario for demo/sizing, not a forecast.
  let expectedGapPct: number | null = null;
  if (vol !== null) {
    const h = Math.max(hoursToOpen ?? 1, 1);
    expectedGapPct = Math.max(STRESS_FLOOR_PCT, 2 * vol * Math.sqrt(h) * 100);
    if (i.reasonCode === "ASSET_LIMITED" && (i.reasonMsg ?? "").toLowerCase() === "earnings") {
      expectedGapPct = Math.max(expectedGapPct, 8);
    }
    expectedGapPct = Math.round(expectedGapPct * 10) / 10;
  }

  return { score, level, coverage: availMax / 100, factors, hoursToOpen, hourlyVol: vol, expectedGapPct };
}
