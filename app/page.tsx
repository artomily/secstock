"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RiskResult } from "@/lib/risk";
import { healthFactor, liquidationGapPct, repayForTarget, scenarios, topUpStableForTarget } from "@/lib/sim";
import type { TokenRef } from "@/lib/types";

type TokensResp = { source: "live" | "demo"; tokens: TokenRef[]; note?: string };
type RiskResp = {
  source: "live" | "demo";
  note: string | null;
  scenario: string | null;
  snapshot: { warnings: string[] };
  risk: RiskResult;
  error?: string;
};

const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955"; // from binance-agentic-wallet skill token table
const hf = (x: number) => (x === Infinity ? "∞" : Number.isFinite(x) ? x.toFixed(2) : "–");
const usd = (x: number) => (Number.isFinite(x) ? `$${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "–");

export default function Page() {
  const [tokens, setTokens] = useState<TokensResp | null>(null);
  const [sel, setSel] = useState("");
  const [scenario, setScenario] = useState("weekend");
  const [data, setData] = useState<RiskResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [collateral, setCollateral] = useState(1000);
  const [debt, setDebt] = useState(650);
  const [ltPct, setLtPct] = useState(80);
  const [targetHf, setTargetHf] = useState(1.3);
  const [gapOverride, setGapOverride] = useState<number | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/tokens")
      .then((r) => r.json())
      .then((j: TokensResp) => {
        setTokens(j);
        if (j.tokens.length) setSel(j.tokens[0].contractAddress);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  const token = tokens?.tokens.find((t) => t.contractAddress === sel) ?? null;

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams({ chainId: token.chainId, contract: token.contractAddress, scenario });
    fetch(`/api/risk?${q}`)
      .then((r) => r.json())
      .then((j: RiskResp) => {
        if (j.error) throw new Error(j.error);
        setData(j);
        setGapOverride(null);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [token, scenario]);

  useEffect(() => {
    load();
  }, [load]);

  const valid = collateral > 0 && debt > 0 && ltPct > 0 && ltPct <= 100;
  const gap = gapOverride ?? data?.risk.expectedGapPct ?? 10;
  const pos = useMemo(() => ({ collateralUsd: collateral, debtUsd: debt, liqThreshold: ltPct / 100 }), [collateral, debt, ltPct]);
  const hfNow = valid ? healthFactor(pos.collateralUsd, pos.debtUsd, pos.liqThreshold) : NaN;
  const liqGap = valid ? liquidationGapPct(pos) : NaN;
  const topUp = valid ? topUpStableForTarget(pos, gap, targetHf) : 0;
  const repay = valid ? repayForTarget(pos, gap, targetHf) : 0;
  const rows = useMemo(() => {
    if (!valid) return [];
    const gaps = Array.from(new Set([5, 10, 15, 20, 30, gap])).sort((a, b) => a - b);
    return scenarios(pos, gaps, topUp);
  }, [valid, pos, gap, topUp]);
  const atGap = rows.find((r) => r.gapPct === gap);

  const amount = topUp.toFixed(2);
  const cmds = [
    "baw defi position --json",
    `baw defi investment-list --investType Earn --binanceChainId 56 --contractAddresses ${USDT_BSC} --json   # find the Venus USDT supply investmentId`,
    `baw defi preview --action DEPOSIT --investmentId <INVESTMENT_ID> --tokenAddress ${USDT_BSC} --amount ${amount} --json`,
    `baw defi deposit --investmentId <INVESTMENT_ID> --tokenAddress ${USDT_BSC} --amount ${amount} --json`,
  ];

  const copy = (i: number) => {
    navigator.clipboard?.writeText(cmds[i].split("   #")[0]).then(() => {
      setCopied(i);
      setTimeout(() => setCopied(null), 1200);
    });
  };

  const sendAlert = async () => {
    if (!data || !token || !atGap) return;
    setAlertMsg("Sending…");
    const res = await fetch("/api/alert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ticker: token.ticker,
        level: data.risk.level,
        score: data.risk.score,
        gapPct: gap,
        hfNow: Number.isFinite(hfNow) ? hfNow : 0,
        hfAfterGap: Number.isFinite(atGap.hfUnprotected) ? atGap.hfUnprotected : 0,
        topUpUsd: topUp,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setAlertMsg(res.ok ? "Alert sent to Telegram." : j.error ?? `Failed (${res.status})`);
  };

  const chart = useMemo(() => {
    if (!valid) return null;
    const gaps = Array.from({ length: 81 }, (_, i) => i / 2);
    const pts = scenarios(pos, gaps, topUp);
    const top = Math.min(3, Math.max(1.2, ...pts.map((r) => (Number.isFinite(r.hfProtected) ? r.hfProtected : 0))) * 1.15);
    const cap = (x: number) => (Number.isFinite(x) ? Math.min(x, top) : top);
    const W = 600, H = 220, X = (g: number) => (g / 40) * W, Y = (h: number) => H - (cap(h) / top) * H;
    const line = (k: "hfUnprotected" | "hfProtected") => pts.map((r, i) => `${i ? "L" : "M"}${X(r.gapPct).toFixed(1)},${Y(r[k]).toFixed(1)}`).join("");
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => +(f * top).toFixed(1));
    return { W, H, X, Y, pts, ticks, u: line("hfUnprotected"), p: line("hfProtected") };
  }, [valid, pos, topUp]);

  const open = data ? data.risk.hoursToOpen === null : true;
  const nav = [
    ["Dashboard", "#top", "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"],
    ["Gap Risk", "#risk", "M12 3l9 16H3zM12 10v4M12 17v.5"],
    ["Simulation", "#sim", "M3 17l5-6 4 4 8-9M3 21h18"],
    ["Scenarios", "#scen", "M5 20V10M10 20V4M15 20v-7M20 20V8"],
    ["Protection", "#protect", "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"],
  ];

  return (
    <div className="shell">
      <aside className="side">
        <div className="logo">
          <span className="mark">✦</span> SecStock
        </div>
        <nav>
          {nav.map(([l, h, d], i) => (
            <a key={h} href={h} className={i === 0 ? "on" : ""}>
              <svg viewBox="0 0 24 24" className="ni">
                <path d={d} />
              </svg>
              {l}
            </a>
          ))}
        </nav>
        <div className="sep" />
        <div className="promo-sm">
          <b>Weekend Guard</b>
          <span>Agent proposes, you confirm every step</span>
        </div>
      </aside>

      <div className="body">
        <div className="ticker">
          <span className="mkt">
            <i className={open ? "dot ok" : "dot off"} />
            {open ? "The market is open" : `Market closed · reopens in ${data!.risk.hoursToOpen!.toFixed(1)}h`}
          </span>
          <div className="tape">
            {tokens?.tokens.map((t) => (
              <button key={t.contractAddress} className={`tk ${t.contractAddress === sel ? "on" : ""}`} onClick={() => setSel(t.contractAddress)}>
                <span className="ico">{t.ticker[0]}</span>
                {t.ticker}
                <small>{t.symbol}</small>
              </button>
            ))}
          </div>
        </div>

        <header className="bar">
          <span className="lbl">Collateral</span>
          <span className="pill mono">{usd(collateral)}</span>
          <span className="lbl">Debt</span>
          <span className="pill mono">{usd(debt)}</span>
          <div className="grow" />
          {data && <span className={`badge ${data.source}`}>{data.source === "live" ? "LIVE DATA" : "DEMO DATA"}</span>}
          <button className="icon" onClick={load} disabled={loading} title="Refresh data">
            {loading ? "…" : "↻"}
          </button>
        </header>

        <main id="top">
          <div className="head">
            <div>
              <h1>Dashboard</h1>
              <p className="sub">Will your tokenized-stock collateral survive Monday&apos;s opening gap?</p>
            </div>
            <div className="head-act">
              {data?.source === "demo" && (
                <select className="sel-sm" value={scenario} onChange={(e) => setScenario(e.target.value)}>
                  <option value="weekend">Weekend</option>
                  <option value="earnings">Earnings</option>
                  <option value="open">Market open</option>
                </select>
              )}
              <a className="btn" href="#protect">
                Protect position
              </a>
            </div>
          </div>

          {data?.source === "demo" && (
            <div className="banner">
              <b>Demo data.</b> {data.note ?? "Prices and market status below are illustrative, not from Binance."} Run on a machine that can reach Binance
              to see live data.
            </div>
          )}
          {tokens?.note && <p className="warn">{tokens.note}</p>}
          {err && <div className="banner">Error: {err}</div>}

          <div className="row1">
            <section className="card" id="risk">
              <h2>Gap Risk Score · {token?.ticker ?? "–"}</h2>
              {!data ? (
                <p className="note">Loading…</p>
              ) : (
                <>
                  <div className="big">
                    {data.risk.score}
                    <span className="dim">/100</span>
                  </div>
                  <div className="chipline">
                    <span className={`chip ${data.risk.level}`}>{data.risk.level}</span>
                    <span className="note0">
                      {Math.round(data.risk.coverage * 100)}% signal coverage
                      {data.risk.hoursToOpen !== null && ` · reopens in ${data.risk.hoursToOpen.toFixed(1)}h`}
                    </span>
                  </div>
                  <h3>Distribution</h3>
                  <div className="dist">
                    {data.risk.factors
                      .filter((f) => f.available && f.points > 0)
                      .map((f, i) => (
                        <i key={f.key} className={`c${i % 3}`} style={{ flex: f.points }} />
                      ))}
                  </div>
                  {data.risk.factors.map((f, i) => (
                    <div key={f.key} className={`li ${f.available ? "" : "na"}`} title={f.detail}>
                      <i className={`dotc c${i % 3}`} />
                      <div className="grow">
                        <div>{f.label}</div>
                        <small>{f.detail}</small>
                      </div>
                      <span className="mono">{f.available ? `${f.points.toFixed(0)} / ${f.max}` : "n/a"}</span>
                    </div>
                  ))}
                  {data.snapshot.warnings.map((w, i) => (
                    <p className="warn" key={i}>
                      {w}
                    </p>
                  ))}
                </>
              )}
            </section>

            <section className="card" id="sim">
              <h2>Monday Gap Simulation</h2>
              <div className="big">
                {hf(atGap?.hfUnprotected ?? NaN)}
                <span className="dim"> HF at -{gap.toFixed(1)}%</span>
              </div>
              <div className="chipline">
                <span className={`chip ${atGap?.liquidatedUnprotected ? "CRITICAL" : "LOW"}`}>{atGap?.liquidatedUnprotected ? "LIQUIDATED" : "SAFE"}</span>
                <span className="note0">
                  HF now {hf(hfNow)} · liquidated at a {Number.isFinite(liqGap) ? liqGap.toFixed(1) : "–"}% gap
                </span>
              </div>
              {chart && (
                <svg className="chart" viewBox={`-34 -10 ${chart.W + 44} ${chart.H + 34}`}>
                  {chart.ticks.map((h) => (
                    <text key={h} x={-8} y={chart.Y(h) + 5} textAnchor="end">
                      {h}
                    </text>
                  ))}
                  {chart.pts.map((r) => (
                    <line key={r.gapPct} x1={chart.X(r.gapPct)} x2={chart.X(r.gapPct)} y1={chart.H} y2={chart.Y(r.hfProtected)} className="vb" />
                  ))}
                  {[0, 10, 20, 30, 40].map((g) => (
                    <text key={g} x={chart.X(g)} y={chart.H + 20} textAnchor="middle">
                      -{g}%
                    </text>
                  ))}
                  <defs>
                    <linearGradient id="fg" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#7c5cff" stopOpacity=".45" />
                      <stop offset="1" stopColor="#7c5cff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${chart.p}L${chart.W},${chart.H}L0,${chart.H}Z`} fill="url(#fg)" />
                  <path d={chart.p} className="lp" />
                  <path d={chart.u} className="lu" />
                  <line x1={0} x2={chart.W} y1={chart.Y(1)} y2={chart.Y(1)} className="liq" />
                  <line x1={chart.X(gap)} x2={chart.X(gap)} y1={0} y2={chart.H} className="cur" />
                  {atGap && <circle cx={chart.X(gap)} cy={chart.Y(atGap.hfUnprotected)} r={6} className="pt" />}
                  {atGap && (
                    <g transform={`translate(${Math.min(chart.X(gap) + 12, chart.W - 170)},14)`}>
                      <rect width={160} height={74} rx={8} className="tip" />
                      <text x={12} y={22} className="tt">-{gap.toFixed(1)}% gap</text>
                      <circle cx={16} cy={41} r={4} fill="#9f8cff" />
                      <text x={26} y={46} className="tv">With top-up {hf(atGap.hfProtected)}</text>
                      <circle cx={16} cy={61} r={4} fill="#d9d4ff" />
                      <text x={26} y={66} className="tv">Without {hf(atGap.hfUnprotected)}</text>
                    </g>
                  )}
                </svg>
              )}
              <div className="legend">
                <span>
                  <i className="lg p" /> With top-up
                </span>
                <span>
                  <i className="lg u" /> Without
                </span>
                <span>
                  <i className="lg l" /> Liquidation (HF 1)
                </span>
              </div>
              <label>
                Stress gap: <b>{gap.toFixed(1)}%</b> {gapOverride === null ? "(model: 2σ over the closed window, min 3%)" : ""}
              </label>
              <input type="range" min={1} max={40} step={0.5} value={gap} onChange={(e) => setGapOverride(Number(e.target.value))} />
              {gapOverride !== null && (
                <button className="ghost sm" onClick={() => setGapOverride(null)}>
                  Reset to model
                </button>
              )}
            </section>
          </div>

          <div className="row2">
            <section className="card" id="scen">
              <div className="ch">
                <h2>Scenarios</h2>
                <div className="legend">
                  <span>
                    <i className="lg u" /> Without
                  </span>
                  <span>
                    <i className="lg p" /> With top-up
                  </span>
                </div>
              </div>
              {!valid ? (
                <p className="warn">Enter positive collateral, debt and a liquidation threshold.</p>
              ) : (
                <div className="bars">
                  {rows.map((r) => {
                    const h = (x: number) => `${(Math.min(Number.isFinite(x) ? x : 3, 3) / 3) * 300}px`;
                    return (
                      <div key={r.gapPct} className={`bcol ${r.gapPct === gap ? "on" : ""}`}>
                                                <span className="bv mono">{hf(r.hfProtected)}</span>
                        <div className="bstack">
                          <i className="bp" style={{ height: `calc(${h(r.hfProtected)} - ${h(r.hfUnprotected)})` }} />
                          <i className="bm" />
                          <i className={`bu ${r.liquidatedUnprotected ? "x" : ""}`} style={{ height: h(r.hfUnprotected) }} />
                        </div>
                        <span className="bl">-{r.gapPct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <h3>Position</h3>
              <div className="inputs">
                <label>
                  Collateral (USD)
                  <input type="number" min={0} value={collateral} onChange={(e) => setCollateral(Number(e.target.value))} />
                </label>
                <label>
                  Debt (USD)
                  <input type="number" min={0} value={debt} onChange={(e) => setDebt(Number(e.target.value))} />
                </label>
                <label>
                  Liq. threshold (%)
                  <input type="number" min={1} max={100} value={ltPct} onChange={(e) => setLtPct(Number(e.target.value))} />
                </label>
                <label>
                  Target HF
                  <input type="number" min={1} step={0.05} value={targetHf} onChange={(e) => setTargetHf(Number(e.target.value))} />
                </label>
              </div>
              <p className="note">
                Liquidation threshold is an <b>assumption you set</b>, not read from Venus. Check the live Venus parameters before relying on any number here.
              </p>
            </section>

            <section className="card promo" id="protect">
              <div className="pix">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ opacity: ((i * 37) % 7) / 10 }} />)}</div>
              <div className="bot">◉</div>
              <h4>Protect with the Agentic Wallet</h4>
              {!valid ? (
                <p className="note">Fill in the position first.</p>
              ) : topUp === 0 ? (
                <p className="pm">
                  No action needed: HF stays ≥ {targetHf} after a {gap.toFixed(1)}% gap.
                </p>
              ) : (
                <>
                  <p className="pm">
                    Add about <b className="mono">{usd(topUp)}</b> stablecoin collateral before the close (or repay ≈ <span className="mono">{usd(repay)}</span>).
                  </p>
                  {cmds.map((c, i) => (
                    <div key={i} className="cmd">
                      <pre>{c}</pre>
                      {!c.startsWith("baw defi investment-list") && (
                        <button className="ghost sm" onClick={() => copy(i)}>
                          {copied === i ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                  ))}
                  <p className="note">
                    The agent only proposes; you confirm each step. No withdraw permission. Supplied USDT counts only if enabled as collateral on Venus.
                  </p>
                  <button className="try" onClick={sendAlert} disabled={!data}>
                    Send Telegram alert
                  </button>
                  {alertMsg && <p className="note">{alertMsg}</p>}
                </>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
