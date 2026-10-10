import { describe, expect, it } from "vitest";
import { healthFactor, liquidationGapPct, repayForTarget, scenarios, topUpStableForTarget } from "./sim";
import { computeRisk, corporatePoints, hourlyVolatility } from "./risk";

const P = { collateralUsd: 1000, debtUsd: 500, liqThreshold: 0.8 };

describe("sim", () => {
  it("health factor", () => {
    expect(healthFactor(1000, 500, 0.8)).toBeCloseTo(1.6, 6);
    expect(healthFactor(1000, 0, 0.8)).toBe(Infinity);
  });
  it("liquidation gap", () => {
    expect(liquidationGapPct(P)).toBeCloseTo(37.5, 6);
  });
  it("top-up reaches target after gap", () => {
    const t = topUpStableForTarget(P, 40, 1.5);
    expect(t).toBeCloseTo(337.5, 2);
    const row = scenarios(P, [40], t)[0];
    expect(row.hfProtected).toBeGreaterThanOrEqual(1.5 - 1e-9);
    expect(row.liquidatedUnprotected).toBe(true);
    expect(row.liquidatedProtected).toBe(false);
  });
  it("no top-up needed when already safe", () => {
    expect(topUpStableForTarget({ ...P, debtUsd: 100 }, 10, 1.2)).toBe(0);
  });
  it("repay reaches target after gap", () => {
    const r = repayForTarget(P, 40, 1.5);
    const hf = healthFactor(600, 500 - r, 0.8);
    expect(hf).toBeGreaterThanOrEqual(1.5 - 0.01);
  });
});

describe("risk", () => {
  const base = {
    now: Date.UTC(2026, 9, 10, 18, 0),
    marketOpen: false,
    assetOpen: false,
    nextOpenTime: Date.UTC(2026, 9, 12, 8, 0),
    reasonCode: "MARKET_CLOSED",
    reasonMsg: null,
    tokenPrice: 300,
    sharesMultiplier: 1,
    stockPrice: null,
    closes: Array.from({ length: 49 }, (_, i) => ({ closeTime: i, close: 300 * (1 + 0.004 * Math.sin(i))})),
  };
  it("weekend closure raises the score; earnings raises it more", () => {
    const a = computeRisk(base);
    const b = computeRisk({ ...base, reasonCode: "ASSET_LIMITED", reasonMsg: "earnings" });
    expect(a.score).toBeGreaterThan(20);
    expect(b.score).toBeGreaterThan(a.score);
    expect(b.expectedGapPct).toBeGreaterThanOrEqual(8);
  });
  it("open market with calm prices is LOW", () => {
    const r = computeRisk({
      ...base,
      marketOpen: true,
      assetOpen: true,
      reasonCode: "TRADING",
      stockPrice: 300,
      closes: Array.from({ length: 49 }, () => ({ closeTime: 0, close: 300 })),
    });
    expect(r.level).toBe("LOW");
  });
  it("score is normalised over available signals", () => {
    const r = computeRisk(base);
    expect(r.coverage).toBeCloseTo(0.85, 6); // divergence unavailable
  });
  it("helpers", () => {
    expect(hourlyVolatility([{ close: 1 }])).toBeNull();
    expect(corporatePoints("ASSET_LIMITED", "earnings").points).toBe(25);
    expect(corporatePoints("TRADING", null).points).toBe(0);
  });
});
