import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Minimal in-memory throttle: one alert per 30s per server instance.
let lastSent = 0;

const n = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    return NextResponse.json({ error: "Telegram is not configured on this server (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)." }, { status: 503 });
  }
  if (Date.now() - lastSent < 30_000) {
    return NextResponse.json({ error: "Alert throttled, try again in a few seconds." }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const ticker = typeof body.ticker === "string" && /^[A-Za-z0-9]{1,10}$/.test(body.ticker) ? body.ticker : null;
  const level = typeof body.level === "string" && ["LOW", "ELEVATED", "HIGH", "CRITICAL"].includes(body.level) ? body.level : null;
  const score = n(body.score, 0, 100);
  const gap = n(body.gapPct, 0, 100);
  const hfBefore = n(body.hfNow, 0, 1000);
  const hfAfter = n(body.hfAfterGap, 0, 1000);
  const topUp = n(body.topUpUsd, 0, 1e9);
  if (!ticker || !level || score === null || gap === null || hfBefore === null || hfAfter === null || topUp === null) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const text = [
    `SecStock Weekend Guard: ${ticker} risk ${level} (${score}/100)`,
    `Stress gap ${gap.toFixed(1)}% -> health factor ${hfBefore.toFixed(2)} -> ${hfAfter.toFixed(2)}${hfAfter < 1 ? " (LIQUIDATION)" : ""}`,
    `Proposed: add ~$${topUp.toFixed(2)} stable collateral. Needs your confirmation in baw.`,
  ].join("\n");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text }),
  });
  if (!res.ok) return NextResponse.json({ error: `Telegram responded ${res.status}` }, { status: 502 });
  lastSent = Date.now();
  return NextResponse.json({ ok: true });
}
