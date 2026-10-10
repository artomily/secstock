import { NextResponse } from "next/server";
import { fetchSnapshot, toRiskInputs } from "@/lib/binance";
import { computeRisk } from "@/lib/risk";
import { demoSnapshot, isDemoToken, type Scenario } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

const SCENARIOS: Scenario[] = ["weekend", "earnings", "open"];
const CONTRACT = /^(0x[0-9a-fA-F]{40}|demo-[A-Za-z0-9]{1,12})$/;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const chainId = u.searchParams.get("chainId") ?? "56";
  const contract = u.searchParams.get("contract") ?? "";
  const sc = u.searchParams.get("scenario") as Scenario | null;
  const scenario: Scenario = sc && SCENARIOS.includes(sc) ? sc : "weekend";

  if (!/^\d{1,6}$/.test(chainId)) return NextResponse.json({ error: "invalid chainId" }, { status: 400 });
  if (!CONTRACT.test(contract)) return NextResponse.json({ error: "invalid contract" }, { status: 400 });

  const now = Date.now();
  let source: "live" | "demo" = "live";
  let note: string | null = null;
  let snapshot;

  if (process.env.SECSTOCK_FORCE_DEMO === "1" || isDemoToken(contract)) {
    source = "demo";
    snapshot = demoSnapshot({ contractAddress: contract }, now, scenario);
  } else {
    snapshot = await fetchSnapshot({ chainId, contractAddress: contract });
    const any = snapshot.market || snapshot.asset || snapshot.dyn || snapshot.candles.length > 0;
    if (!any) {
      source = "demo";
      note = "All live Binance calls failed, so this is DEMO data.";
      snapshot = demoSnapshot({ contractAddress: contract }, now, scenario);
    }
  }

  const risk = computeRisk(toRiskInputs(snapshot, now));
  return NextResponse.json({ source, note, scenario: source === "demo" ? scenario : null, now, snapshot, risk });
}
