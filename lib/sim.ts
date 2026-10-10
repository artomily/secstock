// Collateral/debt math for the Monday-gap simulation. Pure functions.
// Liquidation threshold (LT) is an INPUT, not read from Venus: users must set it
// from the protocol's current parameters.

export type Position = {
  collateralUsd: number;
  debtUsd: number;
  liqThreshold: number; // 0..1
};

export function healthFactor(collateralUsd: number, debtUsd: number, lt: number): number {
  if (debtUsd <= 0) return Infinity;
  return (collateralUsd * lt) / debtUsd;
}

/** Gap (in %) of the collateral that brings health factor to exactly 1. */
export function liquidationGapPct(p: Position): number {
  if (p.debtUsd <= 0) return 100;
  const g = 1 - p.debtUsd / (p.collateralUsd * p.liqThreshold);
  return Math.max(0, g * 100);
}

/**
 * Stablecoin collateral to add BEFORE the gap so that, after a gap of gapPct on the
 * stock collateral, health factor is still >= targetHf. Added collateral is stable,
 * so it does not take the gap, and it is assumed to carry the same LT (assumption).
 */
export function topUpStableForTarget(p: Position, gapPct: number, targetHf: number): number {
  const afterGap = p.collateralUsd * (1 - gapPct / 100);
  const needed = (targetHf * p.debtUsd) / p.liqThreshold - afterGap;
  return Math.max(0, Math.ceil(needed * 100) / 100);
}

/** Debt repayment that would reach targetHf after the gap (shown for comparison only). */
export function repayForTarget(p: Position, gapPct: number, targetHf: number): number {
  const afterGap = p.collateralUsd * (1 - gapPct / 100);
  const maxDebt = (afterGap * p.liqThreshold) / targetHf;
  return Math.max(0, Math.ceil((p.debtUsd - maxDebt) * 100) / 100);
}

export type ScenarioRow = {
  gapPct: number;
  hfUnprotected: number;
  liquidatedUnprotected: boolean;
  hfProtected: number;
  liquidatedProtected: boolean;
};

export function scenarios(p: Position, gaps: number[], topUpStableUsd: number): ScenarioRow[] {
  return gaps.map((gapPct) => {
    const c = p.collateralUsd * (1 - gapPct / 100);
    const hfU = healthFactor(c, p.debtUsd, p.liqThreshold);
    const hfP = healthFactor(c + topUpStableUsd, p.debtUsd, p.liqThreshold);
    return {
      gapPct,
      hfUnprotected: hfU,
      liquidatedUnprotected: hfU < 1,
      hfProtected: hfP,
      liquidatedProtected: hfP < 1,
    };
  });
}
