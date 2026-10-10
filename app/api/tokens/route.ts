import { NextResponse } from "next/server";
import { listTokens } from "@/lib/binance";
import { DEMO_TOKENS } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.SECSTOCK_FORCE_DEMO === "1") {
    return NextResponse.json({ source: "demo", tokens: DEMO_TOKENS, note: "SECSTOCK_FORCE_DEMO=1" });
  }
  try {
    // type=3 = bStock, the tokens Venus accepts as collateral
    const all = await listTokens(3);
    const bsc = all.filter((t) => t.chainId === "56");
    if (bsc.length === 0) throw new Error("Binance returned no BSC bStock tokens");
    return NextResponse.json({ source: "live", tokens: bsc });
  } catch (e) {
    const note = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ source: "demo", tokens: DEMO_TOKENS, note: `Live token list failed (${note}). Showing demo tokens.` });
  }
}
