// Run on your own machine:  npm run probe
// Answers the #1 open question: do the status / price / k-line endpoints work for
// bStock tokens (type=3, what Venus accepts) or only for Ondo (type=1, what the docs show)?
import { assetStatus, dynamicData, klines, listTokens, marketStatus } from "../lib/binance.ts";

const line = (ok, name, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
const msg = (e) => (e instanceof Error ? e.message : String(e));

async function tryOne(name, fn, show) {
  try {
    const v = await fn();
    line(true, name, show ? show(v) : "");
    return v;
  } catch (e) {
    line(false, name, msg(e));
    return null;
  }
}

console.log("== Binance tokenized-securities probe ==\n");
await tryOne("market status", marketStatus, (v) => `open=${v.openState} reason=${v.reasonCode} nextOpen=${v.nextOpenTime ? new Date(v.nextOpenTime).toISOString() : "n/a"}`);

const results = {};
for (const type of [1, 2, 3]) {
  const label = { 1: "Ondo", 2: "xStocks-style", 3: "bStock" }[type];
  console.log(`\n-- list type=${type} (${label})`);
  const list = await tryOne(`list tokens type=${type}`, () => listTokens(type), (v) => `${v.length} tokens, ${v.filter((t) => t.chainId === "56").length} on BSC`);
  const t = list?.find((x) => x.chainId === "56") ?? list?.[0];
  if (!t) { results[label] = "no tokens"; continue; }
  console.log(`   sample: ${t.symbol} (${t.ticker}) chain ${t.chainId} ${t.contractAddress}`);
  const a = await tryOne("  asset status", () => assetStatus(t.chainId, t.contractAddress), (v) => `${v.marketStatus}/${v.reasonCode}${v.reasonMsg ? "/" + v.reasonMsg : ""}`);
  const d = await tryOne("  dynamic data", () => dynamicData(t.chainId, t.contractAddress), (v) => `token=${v.tokenPrice} mult=${v.sharesMultiplier} stock=${v.stockPrice}`);
  const k = await tryOne("  k-line 1h", () => klines(t.chainId, t.contractAddress), (v) => `${v.length} candles`);
  results[label] = { assetStatus: !!a, dynamic: !!d, kline: !!k && k.length > 0 };
}

console.log("\n== Summary (paste into DX_NOTES.md) ==");
console.log(JSON.stringify(results, null, 2));
console.log("\nIf bStock shows false for any endpoint, say so in the Developer Experience Report:");
console.log("docs describe Ondo only, while Venus collateral is bStock.");
