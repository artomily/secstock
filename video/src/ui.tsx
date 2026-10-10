import type { CSSProperties, ReactNode } from "react";
import timing from "./timing.json";
import script from "../vo/script.json";
import { Audio, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const C = {
  bg: "#0b0b10", panel: "#14141c", panel2: "#1b1b25", line: "#262633", text: "#f2f2f7", muted: "#8c8c9e",
  accent: "#6d4aff", a2: "#9f8cff", a3: "#d9d4ff", ok: "#3ddc84", warn: "#f5b041", bad: "#ff5470",
};
export const FONT = "Inter, system-ui, -apple-system, Helvetica, sans-serif";
export const MONO = "SFMono-Regular, Menlo, ui-monospace, monospace";
export const SFX_VOLUME = 0.25;

// Demo position used throughout (same numbers the dashboard shows in demo mode)
export const POS = { collateral: 1000, debt: 650, lt: 0.8, topUp: 116.25 };
export const hfAt = (gap: number, extra = 0) => ((POS.collateral * (1 - gap / 100) + extra) * POS.lt) / POS.debt;

export const useSpring = (delay: number, damping = 16) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping, mass: 0.7 } });
};

export const ease = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.22, 1, 0.36, 1) });

/** Element entrance: rise + fade + un-blur. */
export const Rise = ({ at, children, style, dist = 40 }: { at: number; children: ReactNode; style?: CSSProperties; dist?: number }) => {
  const s = useSpring(at);
  return (
    <div style={{ ...style, opacity: s, transform: `translateY(${(1 - s) * dist}px) scale(${0.96 + s * 0.04})`, filter: `blur(${(1 - s) * 8}px)` }}>
      {children}
    </div>
  );
};

/** On-screen caption: the script line, one sentence at a time. */
const Caption = ({ id, dur }: { id: string; dur: number }) => {
  const f = useCurrentFrame();
  const text = (script as { id: string; text: string }[]).find((s) => s.id === id)?.text ?? "";
  const parts = text.match(/[^.?!]+[.?!]*/g)?.map((x) => x.trim()) ?? [];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const start = 14, end = dur - 16;
  let t = start;
  const spans = parts.map((p) => {
    const len = ((end - start) * p.length) / total;
    const r = { p, a: t, b: t + len };
    t += len;
    return r;
  });
  const cur = spans.find((s) => f >= s.a && f < s.b);
  if (!cur) return null;
  const o = Math.min(ease(f, cur.a, cur.a + 8), ease(f, cur.b - 8, cur.b, 1, 0));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, display: "flex", justifyContent: "center", opacity: o }}>
      <div style={{ maxWidth: 1500, textAlign: "center", font: `500 38px/1.35 ${FONT}`, color: C.text, background: "#0b0b10d9", border: `1px solid ${C.line}`, padding: "14px 30px", borderRadius: 18, transform: `translateY(${(1 - o) * 14}px)` }}>
        {cur.p}
      </div>
    </div>
  );
};

/** Scene wrapper: fades in and out at the edges, adds the caption and (if recorded) the voice-over. */
export const Scene = ({ dur, vo, children }: { dur: number; vo: string; children: ReactNode }) => {
  const f = useCurrentFrame();
  const o = Math.min(ease(f, 0, 12), ease(f, dur - 12, dur, 1, 0));
  const hasVo = (timing as Record<string, { vo: boolean }>)[vo]?.vo;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o, fontFamily: FONT, color: C.text }}>
      {children}
      <Caption id={vo} dur={dur} />
      {hasVo && (
        <Sequence from={18}>
          <Audio src={staticFile(`vo/${vo}.wav`)} />
        </Sequence>
      )}
    </div>
  );
};

export const Sfx = ({ at, name, vol = 1 }: { at: number; name: string; vol?: number }) => (
  <Sequence from={Math.max(0, Math.round(at))} durationInFrames={60}>
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={SFX_VOLUME * vol} />
  </Sequence>
);

export const Card = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 28, padding: 40, ...style }}>{children}</div>
);

export const Chip = ({ children, color }: { children: ReactNode; color: string }) => (
  <span style={{ font: `700 22px ${FONT}`, padding: "6px 14px", borderRadius: 10, color, background: `${color}22` }}>{children}</span>
);

export const Kicker = ({ children }: { children: ReactNode }) => (
  <div style={{ font: `600 26px ${FONT}`, color: C.a2, letterSpacing: 4, textTransform: "uppercase" }}>{children}</div>
);

export const Background = () => {
  const f = useCurrentFrame();
  const x = 50 + Math.sin(f / 90) * 18, y = 40 + Math.cos(f / 120) * 14;
  return (
    <div style={{ position: "absolute", inset: 0, background: C.bg, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(50% 45% at ${x}% ${y}%, #3b2a9e55, transparent 70%)` }} />
      <div
        style={{
          position: "absolute", inset: -80, opacity: 0.35, transform: `translateY(${(f * 0.3) % 80}px)`,
          backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
          backgroundSize: "80px 80px", maskImage: "radial-gradient(70% 60% at 50% 50%, black, transparent)",
        }}
      />
    </div>
  );
};

export const Logo = ({ size = 56 }: { size?: number }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.3, font: `700 ${size}px ${FONT}` }}>
    <span style={{ color: C.a2 }}>✦</span> SecStock
  </div>
);

export const usd = (x: number) => `$${x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
