import type React from "react";
import { AbsoluteFill, Series, interpolate, useCurrentFrame } from "remotion";
import timing from "./timing.json";
import {
  Background, C, Card, Chip, FONT, Kicker, Logo, MONO, POS, Rise, Scene, Sfx, ease, hfAt, usd, useSpring,
} from "./ui";

type Id = keyof typeof timing;
const T = timing as Record<Id, { frames: number; vo: boolean }>;
const ORDER: Id[] = ["hook", "problem", "intro", "risk", "sim", "scenarios", "protect", "outro"];
export const TOTAL = ORDER.reduce((a, id) => a + T[id].frames, 0);

const center = { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } as const;

/* 1 ─ Hook: Friday close, token keeps trading */
const Hook = ({ dur }: { dur: number }) => {
  const f = useCurrentFrame();
  const pts = Array.from({ length: 120 }, (_, i) => {
    const t = i + f * 0.6;
    return [i * 9, 160 + Math.sin(t / 7) * 30 + Math.sin(t / 2.3) * 12 + Math.sin(t / 19) * 40] as const;
  });
  const draw = ease(f, 130, 200);
  const shown = pts.slice(0, Math.max(2, Math.round(pts.length * draw)));
  return (
    <Scene dur={dur} vo="hook">
      <div style={center}>
        <Rise at={4}>
          <div style={{ font: `600 30px ${MONO}`, color: C.muted, textAlign: "center" }}>FRIDAY · 16:00 ET</div>
        </Rise>
        <Rise at={14}>
          <div style={{ font: `700 150px ${FONT}`, letterSpacing: -6, margin: "8px 0 20px" }}>Market closed.</div>
        </Rise>
        <Rise at={70}>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <Chip color={C.bad}>NASDAQ · CLOSED</Chip>
            <span style={{ font: `500 40px ${FONT}`, color: C.muted }}>but</span>
            <Chip color={C.ok}>TSLAB on BNB Chain · LIVE 24/7</Chip>
          </div>
        </Rise>
        <Rise at={125} style={{ marginTop: 50 }}>
          <svg width={1080} height={320} viewBox="0 0 1080 320">
            <polyline points={shown.map((p) => p.join(",")).join(" ")} fill="none" stroke={C.a2} strokeWidth={5} strokeLinejoin="round" />
            {shown.length > 2 && <circle cx={shown[shown.length - 1][0]} cy={shown[shown.length - 1][1]} r={11} fill="#fff" stroke={C.accent} strokeWidth={6} />}
          </svg>
        </Rise>
      </div>
      <Sfx at={2} name="hit" />
      <Sfx at={14} name="whoosh" />
      <Sfx at={70} name="pop" />
      <Sfx at={125} name="whoosh" vol={0.7} />
    </Scene>
  );
};

/* 2 ─ Problem: weekend timeline, Monday gap liquidates */
const Problem = ({ dur }: { dur: number }) => {
  const f = useCurrentFrame();
  const days = ["FRI", "SAT", "SUN", "MON 09:30"];
  const prog = ease(f, 60, 260);
  const gapHit = f > 270;
  const hf = gapHit ? interpolate(f, [270, 300], [1.23, 0.92], { extrapolateRight: "clamp" }) : 1.23 - prog * 0.02;
  const stamp = useSpring(300, 10);
  const shake = gapHit && f < 320 ? Math.sin(f * 2.2) * (320 - f) * 0.5 : 0;
  return (
    <Scene dur={dur} vo="problem">
      <div style={{ ...center, paddingBottom: 200, transform: `translateX(${shake}px)` }}>
        <Rise at={4}>
          <Kicker>The weekend gap</Kicker>
        </Rise>
        <div style={{ position: "relative", width: 1400, height: 120, marginTop: 60 }}>
          <div style={{ position: "absolute", top: 58, left: 0, right: 0, height: 4, background: C.line }} />
          <div style={{ position: "absolute", top: 58, left: 0, width: `${prog * 100}%`, height: 4, background: gapHit ? C.bad : C.accent }} />
          {days.map((d, i) => (
            <Rise key={d} at={20 + i * 10} style={{ position: "absolute", left: `${(i / 3) * 100}%`, transform: "translateX(-50%)", top: 0 }}>
              <div style={{ transform: "translateX(-50%)", textAlign: "center" }}>
                <div style={{ font: `600 26px ${MONO}`, color: i === 3 ? C.text : C.muted }}>{d}</div>
                <div style={{ width: 22, height: 22, borderRadius: 11, background: prog * 3 >= i ? (i === 3 && gapHit ? C.bad : C.accent) : C.line, margin: "16px auto 0" }} />
              </div>
            </Rise>
          ))}
        </div>
        <Rise at={40} style={{ marginTop: 70 }}>
          <Card style={{ width: 760, textAlign: "center", borderColor: gapHit ? C.bad : C.line }}>
            <div style={{ font: `500 30px ${FONT}`, color: C.muted }}>Venus health factor</div>
            <div style={{ font: `700 140px ${FONT}`, color: hf < 1 ? C.bad : C.text, letterSpacing: -4 }}>{hf.toFixed(2)}</div>
            <div style={{ font: `500 28px ${FONT}`, color: C.muted }}>{gapHit ? "Opening print: −25%" : "Looks safe on Friday"}</div>
          </Card>
        </Rise>
      </div>
      {f > 296 && (
        <div style={{ ...center, pointerEvents: "none" }}>
          <div
            style={{
              font: `800 110px ${FONT}`, color: C.bad, border: `10px solid ${C.bad}`, borderRadius: 24, padding: "4px 40px",
              transform: `rotate(-8deg) scale(${2 - stamp})`, opacity: stamp, background: "#0b0b10cc", marginTop: 420,
            }}
          >
            LIQUIDATED
          </div>
        </div>
      )}
      <Sfx at={4} name="whoosh" />
      {[0, 1, 2, 3].map((i) => <Sfx key={i} at={20 + i * 10} name="click" />)}
      <Sfx at={270} name="alarm" vol={1.2} />
      <Sfx at={298} name="hit" />
    </Scene>
  );
};

/* 3 ─ Intro: product reveal */
const Intro = ({ dur }: { dur: number }) => {
  const f = useCurrentFrame();
  const title = "Weekend Guard";
  const s = useSpring(18, 12);
  return (
    <Scene dur={dur} vo="intro">
      <div style={center}>
        <div style={{ transform: `scale(${0.6 + s * 0.4}) rotate(${(1 - s) * -40}deg)`, opacity: s }}>
          <div style={{ width: 150, height: 150, borderRadius: 75, background: C.accent, display: "grid", placeItems: "center", font: `700 80px ${FONT}`, boxShadow: `0 0 ${80 + Math.sin(f / 8) * 20}px ${C.accent}` }}>✦</div>
        </div>
        <Rise at={34} style={{ marginTop: 40 }}>
          <Logo size={44} />
        </Rise>
        <div style={{ font: `700 150px ${FONT}`, letterSpacing: -5, marginTop: 10, display: "flex" }}>
          {title.split("").map((ch, i) => {
            const o = ease(f, 44 + i * 2.5, 60 + i * 2.5);
            return (
              <span key={i} style={{ opacity: o, transform: `translateY(${(1 - o) * 50}px)`, display: "inline-block", whiteSpace: "pre" }}>
                {ch}
              </span>
            );
          })}
        </div>
        <Rise at={95}>
          <div style={{ font: `500 40px ${FONT}`, color: C.muted }}>A gap-risk agent for tokenized-stock collateral</div>
        </Rise>
      </div>
      <Sfx at={0} name="riser" />
      <Sfx at={18} name="hit" />
      <Sfx at={44} name="whoosh" vol={0.6} />
    </Scene>
  );
};

/* 4 ─ Gap risk score card */
const FACTORS = [
  { l: "Closed-market exposure", d: "Closed for 56.0h more", p: 35, m: 35 },
  { l: "Earnings / corporate action", d: "No corporate action flagged", p: 0, m: 25 },
  { l: "Recent volatility (1h)", d: "1h stdev 0.40%", p: 10, m: 25 },
  { l: "Token vs stock price", d: "Stock feed has no price, left out", p: null, m: 15 },
];
const Risk = ({ dur }: { dur: number }) => {
  const f = useCurrentFrame();
  const score = Math.round(ease(f, 30, 90) * 53);
  return (
    <Scene dur={dur} vo="risk">
      <div style={{ position: "absolute", left: 140, top: 120, width: 560 }}>
        <Rise at={0}>
          <Kicker>Step 1</Kicker>
        </Rise>
        <Rise at={8}>
          <div style={{ font: `700 92px/1.05 ${FONT}`, letterSpacing: -3, marginTop: 16 }}>Score the gap risk</div>
        </Rise>
        <Rise at={20}>
          <div style={{ font: `400 34px/1.45 ${FONT}`, color: C.muted, marginTop: 28 }}>Four signals from Binance tokenized-securities data. Missing signals are left out, never guessed.</div>
        </Rise>
      </div>
      <Rise at={14} style={{ position: "absolute", right: 140, top: 110, width: 960 }}>
        <Card>
          <div style={{ font: `500 30px ${FONT}` }}>Gap Risk Score · TSLA</div>
          <div style={{ font: `700 130px ${FONT}`, letterSpacing: -4 }}>
            {score}
            <span style={{ color: C.muted, fontSize: 64, fontWeight: 500 }}>/100</span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", opacity: ease(f, 90, 100), transform: `scale(${0.8 + ease(f, 90, 100) * 0.2})`, transformOrigin: "left" }}>
            <Chip color="#ff8a3d">HIGH</Chip>
            <span style={{ font: `400 26px ${FONT}`, color: C.muted }}>85% signal coverage · reopens in 56.0h</span>
          </div>
          <div style={{ display: "flex", gap: 8, height: 22, marginTop: 34 }}>
            <i style={{ flex: 35 * ease(f, 100, 140), background: C.accent, borderRadius: 6 }} />
            <i style={{ flex: 10 * ease(f, 115, 150), background: C.a2, borderRadius: 6 }} />
            <i style={{ flex: Math.max(0.001, 55 * (1 - ease(f, 100, 150))) }} />
          </div>
          {FACTORS.map((x, i) => {
            const at = 140 + i * 45;
            return (
              <Rise key={x.l} at={at} dist={24}>
                <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 0", borderBottom: i < 3 ? `1px solid ${C.line}` : "none", opacity: x.p === null ? 0.45 : 1 }}>
                  <i style={{ width: 14, height: 14, borderRadius: 7, background: [C.accent, C.a2, C.a3, C.a3][i] }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ font: `500 30px ${FONT}` }}>{x.l}</div>
                    <div style={{ font: `400 22px ${FONT}`, color: C.muted }}>{x.d}</div>
                  </div>
                  <span style={{ font: `600 30px ${MONO}` }}>{x.p === null ? "n/a" : `${Math.round(ease(f, at, at + 25) * x.p)} / ${x.m}`}</span>
                </div>
              </Rise>
            );
          })}
        </Card>
      </Rise>
      <Sfx at={8} name="whoosh" />
      <Sfx at={90} name="pop" />
      {FACTORS.map((_, i) => <Sfx key={i} at={140 + i * 45} name="click" />)}
    </Scene>
  );
};

/* 5 ─ Health factor simulation chart with moving slider */
const Sim = ({ dur }: { dur: number }) => {
  const f = useCurrentFrame();
  const W = 1500, H = 360, top = 1.6;
  const X = (g: number) => (g / 40) * W, Y = (h: number) => H - (Math.min(h, top) / top) * H;
  const gaps = Array.from({ length: 81 }, (_, i) => i / 2);
  const path = (extra: number) => gaps.map((g, i) => `${i ? "L" : "M"}${X(g)},${Y(hfAt(g, extra))}`).join("");
  const draw = ease(f, 40, 120);
  const gap = interpolate(f, [130, 190, 250, 300, 360], [6, 6, 22, 22, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hu = hfAt(gap), hp = hfAt(gap, POS.topUp);
  const tip = ease(f, 130, 145);
  return (
    <Scene dur={dur} vo="sim">
      <Rise at={0} style={{ position: "absolute", left: 140, top: 80 }}>
        <Kicker>Step 2</Kicker>
        <div style={{ font: `700 80px ${FONT}`, letterSpacing: -3, marginTop: 10 }}>Stress-test the loan</div>
      </Rise>
      <Rise at={14} style={{ position: "absolute", left: 140, right: 140, top: 230 }}>
        <Card style={{ padding: 44 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <span style={{ font: `700 96px ${FONT}`, letterSpacing: -3, color: hu < 1 ? C.bad : C.text }}>{hu.toFixed(2)}</span>
            <span style={{ font: `500 40px ${FONT}`, color: C.muted }}>HF at −{gap.toFixed(1)}%</span>
            <Chip color={hu < 1 ? C.bad : C.ok}>{hu < 1 ? "LIQUIDATED" : "SAFE"}</Chip>
            <span style={{ flex: 1 }} />
            <span style={{ font: `500 26px ${FONT}`, color: C.muted }}>Liquidated at an 18.8% gap</span>
          </div>
          <svg viewBox={`-50 -20 ${W + 70} ${H + 60}`} style={{ width: "100%", marginTop: 20 }}>
            <defs>
              <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={C.accent} stopOpacity=".5" />
                <stop offset="1" stopColor={C.accent} stopOpacity="0" />
              </linearGradient>
              <clipPath id="clip">
                <rect x={0} y={-20} width={W * draw} height={H + 40} />
              </clipPath>
            </defs>
            {[0, 0.4, 0.8, 1.2, 1.6].map((h) => (
              <text key={h} x={-14} y={Y(h) + 8} textAnchor="end" fill={C.muted} fontSize={22} fontFamily={FONT}>{h}</text>
            ))}
            {[0, 10, 20, 30, 40].map((g) => (
              <text key={g} x={X(g)} y={H + 36} textAnchor="middle" fill={C.muted} fontSize={22} fontFamily={FONT}>−{g}%</text>
            ))}
            <g clipPath="url(#clip)">
              {gaps.map((g) => <line key={g} x1={X(g)} x2={X(g)} y1={H} y2={Y(hfAt(g, POS.topUp))} stroke={C.accent} strokeWidth={6} opacity={0.3} />)}
              <path d={`${path(POS.topUp)}L${W},${H}L0,${H}Z`} fill="url(#g)" />
              <path d={path(POS.topUp)} fill="none" stroke={C.a2} strokeWidth={5} />
              <path d={path(0)} fill="none" stroke={C.a3} strokeWidth={4} opacity={0.7} />
            </g>
            <line x1={0} x2={W * ease(f, 110, 140)} y1={Y(1)} y2={Y(1)} stroke={C.bad} strokeWidth={3} strokeDasharray="6 10" />
            <g opacity={tip}>
              <line x1={X(gap)} x2={X(gap)} y1={0} y2={H} stroke={C.a2} strokeWidth={2} />
              <circle cx={X(gap)} cy={Y(hu)} r={13} fill="#fff" stroke={hu < 1 ? C.bad : C.accent} strokeWidth={7} />
              <g transform={`translate(${Math.min(X(gap) + 28, W - 360)},20)`}>
                <rect width={340} height={130} rx={16} fill={C.panel2} stroke="#34344a" />
                <text x={24} y={40} fill={C.muted} fontSize={24} fontFamily={FONT}>−{gap.toFixed(1)}% gap</text>
                <circle cx={30} cy={74} r={8} fill={C.a2} />
                <text x={50} y={82} fill={C.text} fontSize={26} fontWeight={600} fontFamily={FONT}>With top-up {hp.toFixed(2)}</text>
                <circle cx={30} cy={108} r={8} fill={C.a3} />
                <text x={50} y={116} fill={hu < 1 ? C.bad : C.text} fontSize={26} fontWeight={600} fontFamily={FONT}>Without {hu.toFixed(2)}</text>
              </g>
            </g>
          </svg>
          <div style={{ position: "relative", height: 14, background: C.panel2, borderRadius: 7, marginTop: 24, opacity: tip }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(gap / 40) * 100}%`, background: C.accent, borderRadius: 7 }} />
            <div style={{ position: "absolute", left: `${(gap / 40) * 100}%`, top: -11, width: 36, height: 36, borderRadius: 18, background: "#fff", transform: "translateX(-50%)", boxShadow: `0 0 0 6px ${C.accent}55` }} />
          </div>
        </Card>
      </Rise>
      <Sfx at={14} name="whoosh" />
      <Sfx at={40} name="riser" vol={0.6} />
      <Sfx at={130} name="click" />
      <Sfx at={225} name="alarm" vol={0.8} />
      <Sfx at={300} name="click" />
    </Scene>
  );
};

/* 6 ─ Scenario bars */
const Scenarios = ({ dur }: { dur: number }) => {
  const f = useCurrentFrame();
  const gaps = [5, 10, 15, 20, 30];
  const px = (h: number) => (Math.min(h, 1.6) / 1.6) * 460;
  return (
    <Scene dur={dur} vo="scenarios">
      <Rise at={0} style={{ position: "absolute", left: 140, top: 90 }}>
        <Kicker>Scenarios</Kicker>
        <div style={{ font: `700 80px ${FONT}`, letterSpacing: -3, marginTop: 10 }}>What a top-up buys you</div>
      </Rise>
      <Rise at={10} style={{ position: "absolute", left: 140, right: 140, top: 300 }}>
        <Card style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: 640, paddingBottom: 50 }}>
          {gaps.map((g, i) => {
            const at = 30 + i * 22;
            const k = ease(f, at, at + 30);
            const hu = hfAt(g), hp = hfAt(g, POS.topUp), liq = hu < 1;
            return (
              <div key={g} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <div style={{ font: `600 28px ${MONO}`, opacity: k }}>{(hp * k).toFixed(2)}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, width: 130 }}>
                  <i style={{ height: (px(hp) - px(hu)) * k, background: C.a3, borderRadius: 8 }} />
                  <i style={{ height: 10 * k, background: C.a2, borderRadius: 4 }} />
                  <i style={{ height: px(hu) * k, background: liq && f > at + 40 ? C.bad : C.accent, borderRadius: 8 }} />
                </div>
                <div style={{ font: `600 30px ${FONT}`, color: C.muted }}>−{g}%</div>
              </div>
            );
          })}
        </Card>
      </Rise>
      <Sfx at={10} name="whoosh" />
      {gaps.map((g, i) => <Sfx key={g} at={30 + i * 22} name="pop" />)}
      <Sfx at={30 + 3 * 22 + 40} name="alarm" vol={0.6} />
    </Scene>
  );
};

/* 7 ─ Protection: commands typed, user confirms YES */
const CMDS = [
  "baw defi position --json",
  "baw defi preview --action DEPOSIT --investmentId <ID> \\\n  --tokenAddress 0x55d3…7955 --amount 116.25 --json",
  "baw defi deposit --investmentId <ID> \\\n  --tokenAddress 0x55d3…7955 --amount 116.25 --json",
];
const Protect = ({ dur }: { dur: number }) => {
  const f = useCurrentFrame();
  const starts = [70, 140, 240];
  const typed = (i: number) => CMDS[i].slice(0, Math.max(0, Math.floor((f - starts[i]) * 1.6)));
  const yesAt = 390;
  const yes = "YES".slice(0, Math.max(0, Math.floor((f - yesAt) / 6)));
  const done = useSpring(yesAt + 24, 11);
  const keys: number[] = [];
  starts.forEach((s, i) => { for (let k = 0; k < CMDS[i].length / 1.6; k += 3) keys.push(s + k); });
  return (
    <Scene dur={dur} vo="protect">
      <Rise at={0} style={{ position: "absolute", left: 140, top: 110, width: 600 }}>
        <Kicker>Step 3</Kicker>
        <div style={{ font: `700 84px/1.05 ${FONT}`, letterSpacing: -3, marginTop: 14 }}>Propose. You confirm.</div>
        <Card style={{ marginTop: 50, background: "radial-gradient(120% 90% at 50% 120%, #4b2fd6 0%, #1d1640 50%, #14141c 80%)", borderColor: "#2f2766" }}>
          <div style={{ font: `500 28px ${FONT}`, color: "#c9c4e8" }}>Add stablecoin collateral</div>
          <div style={{ font: `700 104px ${FONT}`, letterSpacing: -3 }}>{usd(ease(f, 20, 70) * POS.topUp)}</div>
          <div style={{ font: `400 26px ${FONT}`, color: "#c9c4e8" }}>Keeps HF ≥ 1.30 through a 6% gap</div>
        </Card>
        <Rise at={yesAt + 40} style={{ marginTop: 30 }}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Chip color={C.ok}>No withdraw permission</Chip>
            <Chip color={C.a2}>Human in the loop</Chip>
          </div>
        </Rise>
      </Rise>
      <Rise at={30} style={{ position: "absolute", right: 140, top: 110, width: 1000 }}>
        <div style={{ background: "#08080c", border: `1px solid ${C.line}`, borderRadius: 24, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 12, padding: "20px 26px", borderBottom: `1px solid ${C.line}` }}>
            {[C.bad, C.warn, C.ok].map((c) => <i key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />)}
            <span style={{ font: `500 22px ${FONT}`, color: C.muted, marginLeft: 16 }}>weekend-guard — agent</span>
          </div>
          <div style={{ padding: 34, font: `500 26px/1.6 ${MONO}`, minHeight: 680, whiteSpace: "pre-wrap" }}>
            {CMDS.map((_, i) => f >= starts[i] && (
              <div key={i} style={{ marginBottom: 22 }}>
                <span style={{ color: C.a2 }}>$ </span>{typed(i)}
                {i === 2 && f > starts[2] + 70 && <div style={{ color: C.warn, marginTop: 12 }}>⚠ Deposit 116.25 USDT into Venus? Type YES to execute:</div>}
              </div>
            ))}
            {f >= yesAt && (
              <div>
                <span style={{ color: C.a2 }}>&gt; </span>
                <span style={{ color: C.ok, fontWeight: 700 }}>{yes}</span>
                {Math.floor(f / 15) % 2 === 0 && <span style={{ background: C.text }}> </span>}
              </div>
            )}
            {f > yesAt + 24 && (
              <div style={{ color: C.ok, marginTop: 18, opacity: done, transform: `scale(${0.9 + done * 0.1})`, transformOrigin: "left" }}>
                ✓ Confirmed by user · HF now protected to 1.30
              </div>
            )}
          </div>
        </div>
      </Rise>
      <Sfx at={0} name="whoosh" />
      <Sfx at={20} name="riser" vol={0.5} />
      {keys.map((k) => <Sfx key={k} at={k} name="key" vol={0.8} />)}
      <Sfx at={starts[2] + 70} name="alarm" vol={0.5} />
      {[0, 6, 12].map((k) => <Sfx key={k} at={yesAt + k} name="key" />)}
      <Sfx at={yesAt + 24} name="ding" />
    </Scene>
  );
};

/* 8 ─ Outro: honest status + repo */
const Outro = ({ dur }: { dur: number }) => {
  const items = [
    { t: "Risk model & simulation", s: "9/9 unit tests", c: C.ok, m: "✓" },
    { t: "Dashboard", s: "labeled demo data", c: C.a2, m: "●" },
    { t: "Live Binance data + baw", s: "blocked by ISP · not yet verified", c: C.warn, m: "!" },
  ];
  return (
    <Scene dur={dur} vo="outro">
      <div style={center}>
        {items.map((x, i) => (
          <Rise key={x.t} at={10 + i * 30} style={{ width: 1100 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 28, padding: "22px 34px", marginBottom: 18, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 22 }}>
              <span style={{ width: 52, height: 52, borderRadius: 26, display: "grid", placeItems: "center", background: `${x.c}22`, color: x.c, font: `700 28px ${FONT}` }}>{x.m}</span>
              <span style={{ font: `600 36px ${FONT}`, flex: 1 }}>{x.t}</span>
              <span style={{ font: `400 30px ${FONT}`, color: C.muted }}>{x.s}</span>
            </div>
          </Rise>
        ))}
        <Rise at={170} style={{ marginTop: 70, textAlign: "center" }}>
          <Logo size={64} />
          <div style={{ font: `700 92px ${FONT}`, letterSpacing: -3, marginTop: 12 }}>Sleep through the weekend.</div>
          <div style={{ font: `500 34px ${MONO}`, color: C.a2, marginTop: 24 }}>secstock.vercel.app</div>
        </Rise>
      </div>
      {[0, 1, 2].map((i) => <Sfx key={i} at={10 + i * 30} name="pop" />)}
      <Sfx at={165} name="riser" vol={0.6} />
      <Sfx at={190} name="hit" />
      <Sfx at={200} name="ding" vol={0.7} />
    </Scene>
  );
};

const SCENES: Record<Id, (p: { dur: number }) => React.ReactElement> = {
  hook: Hook, problem: Problem, intro: Intro, risk: Risk, sim: Sim, scenarios: Scenarios, protect: Protect, outro: Outro,
};

export const Demo = () => (
  <AbsoluteFill>
    <Background />
    <Series>
      {ORDER.map((id) => {
        const S = SCENES[id];
        return (
          <Series.Sequence key={id} durationInFrames={T[id].frames}>
            <S dur={T[id].frames} />
          </Series.Sequence>
        );
      })}
    </Series>
  </AbsoluteFill>
);
