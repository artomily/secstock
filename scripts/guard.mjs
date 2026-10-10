// Weekend Guard agent. Run on a machine where `baw` (Binance Agentic Wallet CLI) is installed and signed in:
//   npm run guard -- --symbol=TSLAB
// What it does: risk score from Binance public data -> reads your Venus position through `baw defi position`
// -> sizes a stablecoin top-up -> previews it with `baw defi preview` -> asks you to type YES -> `baw defi deposit`.
// It never withdraws, never borrows, and never executes without your typed confirmation.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appendFile } from "node:fs/promises";
import readline from "node:readline/promises";
import { fetchSnapshot, listTokens, toRiskInputs } from "../lib/binance.ts";
import { DEMO_TOKENS, demoSnapshot } from "../lib/fixtures.ts";
import { computeRisk } from "../lib/risk.ts";
import { healthFactor, topUpStableForTarget } from "../lib/sim.ts";

const run = promisify(execFile);
const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955"; // binance-agentic-wallet skill, BSC table

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const symbol = String(args.symbol ?? "").toUpperCase();
const targetHf = Number(args["target-hf"] ?? 1.3);
const threshold = Number(args.threshold ?? 50);
const bawBin = String(args.baw ?? "baw");
const demo = args.demo === true;
const dry = args["dry-run"] === true;
const ltArg = args.lt === undefined ? null : Number(args.lt);
const gapArg = args.gap === undefined ? null : Number(args.gap);

const die = (m, code = 1) => {
  console.error(`\n[guard] ${m}`);
  process.exit(code);
};
if (!symbol) die("Usage: npm run guard -- --symbol=TSLAB [--lt=0.8] [--target-hf=1.3] [--threshold=50] [--gap=8] [--dry-run] [--demo]", 64);
for (const [k, v] of [["target-hf", targetHf], ["threshold", threshold]]) if (!Number.isFinite(v) || v <= 0) die(`--${k} must be a positive number`, 64);
if (ltArg !== null && !(ltArg > 0 && ltArg <= 1)) die("--lt must be a fraction between 0 and 1 (e.g. 0.8)", 64);
if (gapArg !== null && !(gapArg > 0 && gapArg < 100)) die("--gap must be a percent between 0 and 100", 64);

const baw = async (...argv) => {
  const { stdout } = await run(bawBin, [...argv, "--json"], { timeout: 90_000, maxBuffer: 10 * 1024 * 1024 });
  const j = JSON.parse(stdout);
  if (j.success === false) throw new Error(JSON.stringify(j.error ?? j.message ?? j).slice(0, 400));
  return j;
};
const log = async (entry) => {
  try {
    await appendFile("guard-log.jsonl", JSON.stringify({ ts: new Date().toISOString(), symbol, ...entry }) + "\n");
  } catch {}
};

export function readVenusPosition(resp, sym) {
  const out = [];
  for (const p of resp?.data?.deFiProtocolVOList ?? []) {
    if (!/venus/i.test(p.protocolName ?? "")) continue;
    for (const pool of p.poolList ?? []) {
      if (pool.poolType !== "Lending") continue;
      for (const col of pool.positionCollectionList ?? []) {
        let stock = 0, other = 0, debt = 0;
        for (const pos of col.positionList ?? []) {
          for (const t of pos.tokenList?.supply ?? []) {
            const v = Number(t.tokenValue) || 0;
            if (String(t.tokenSymbol ?? "").toUpperCase() === sym) stock += v;
            else other += v;
          }
          for (const t of pos.tokenList?.borrow ?? []) debt += Number(t.tokenValue) || 0;
        }
        out.push({ protocol: p.protocolName, healthRate: Number(col.positionCollectionDetail?.healthRate), stock, other, debt });
      }
    }
  }
  return out.sort((a, b) => b.stock - a.stock)[0] ?? null;
}

// 1) token + risk
let tokens;
if (demo) tokens = DEMO_TOKENS;
else {
  try {
    tokens = (await listTokens(3)).filter((t) => t.chainId === "56");
  } catch (e) {
    die(`Could not reach Binance: ${e.message}`);
  }
}
const token = tokens.find((t) => t.symbol.toUpperCase() === symbol || t.ticker.toUpperCase() === symbol);
if (!token) die(`Token ${symbol} not found. Available: ${tokens.slice(0, 15).map((t) => t.symbol).join(", ")}`);

const now = Date.now();
const snap = demo ? demoSnapshot(token, now, String(args.scenario ?? "weekend")) : await fetchSnapshot(token);
const risk = computeRisk(toRiskInputs(snap, now));
console.log(`\n${token.symbol} (${token.ticker}) ${demo ? "[DEMO DATA]" : "[live]"}`);
console.log(`Gap risk ${risk.score}/100 ${risk.level}  (coverage ${Math.round(risk.coverage * 100)}%, reopens in ${risk.hoursToOpen?.toFixed(1) ?? "?"}h)`);
for (const f of risk.factors) console.log(`  ${f.label.padEnd(28)} ${f.available ? `${f.points.toFixed(0)}/${f.max}` : "n/a"}  ${f.detail}`);
for (const w of snap.warnings) console.log(`  ! ${w}`);

// 2) position through the Agentic Wallet
let pos;
try {
  pos = readVenusPosition(await baw("defi", "position"), token.symbol.toUpperCase());
} catch (e) {
  die(`\`${bawBin} defi position\` failed: ${e.stderr?.toString().slice(0, 300) || e.message}\nInstall: npm i -g @binance/agentic-wallet, then sign in with: ${bawBin} auth signin`, 2);
}
if (!pos || pos.stock <= 0 || pos.debt <= 0) {
  await log({ action: "none", reason: "no venus position with this collateral and debt" });
  die(`No Venus lending position holding ${token.symbol} as collateral with debt was found in your wallet.`, 0);
}

// 3) size the protection
const total = pos.stock + pos.other;
const impliedLt = Number.isFinite(pos.healthRate) && pos.healthRate > 0 ? (pos.healthRate * pos.debt) / total : null;
const lt = ltArg ?? impliedLt;
if (!lt || lt > 1) die("Cannot determine liquidation threshold. Pass --lt=0.8 (check Venus parameters).", 2);
const gap = gapArg ?? risk.expectedGapPct ?? 10;
const need = topUpStableForTarget({ collateralUsd: pos.stock, debtUsd: pos.debt, liqThreshold: lt }, gap, targetHf);
const topUp = Math.max(0, Math.ceil((need - pos.other) * 100) / 100);
const hfAfter = healthFactor(pos.stock * (1 - gap / 100) + pos.other, pos.debt, lt);
console.log(`\nVenus position: ${token.symbol} $${pos.stock.toFixed(2)} + other supply $${pos.other.toFixed(2)}, debt $${pos.debt.toFixed(2)}`);
console.log(`Health rate (reported by baw): ${pos.healthRate}  | liquidation threshold used: ${lt.toFixed(3)} ${ltArg === null ? "(implied by reported health rate)" : "(from --lt)"}`);
console.log(`Stress gap ${gap.toFixed(1)}% -> health factor after gap ${hfAfter.toFixed(2)}${hfAfter < 1 ? "  ** LIQUIDATION **" : ""}`);

if (risk.score < threshold || topUp <= 0) {
  const reason = risk.score < threshold ? `risk ${risk.score} < threshold ${threshold}` : `health factor stays >= ${targetHf} after the gap`;
  console.log(`\nNo action: ${reason}.`);
  await log({ action: "none", score: risk.score, gap, hfAfter, reason });
  process.exit(0);
}

// 4) find the Venus USDT supply product, preview, then ask for a typed YES
console.log(`\nProposal: supply ~$${topUp.toFixed(2)} USDT to Venus to hold health factor >= ${targetHf} through a ${gap.toFixed(1)}% gap.`);
let investmentId = typeof args["investment-id"] === "string" ? args["investment-id"] : null;
if (!investmentId) {
  try {
    const list = (await baw("defi", "investment-list", "--investType", "Earn", "--binanceChainId", "56", "--contractAddresses", USDT_BSC)).data?.list ?? [];
    investmentId = list.find((x) => /venus/i.test(x.protocolName ?? ""))?.investmentId ?? null;
  } catch (e) {
    console.log(`  ! investment lookup failed: ${e.message}`);
  }
}
if (!investmentId) {
  await log({ action: "proposed", score: risk.score, gap, hfAfter, topUp, note: "investmentId not found" });
  die(`Could not find the Venus USDT product automatically. Run:\n  ${bawBin} defi investment-list --investType Earn --binanceChainId 56 --contractAddresses ${USDT_BSC} --json\nthen re-run with --investment-id=<ID>`, 3);
}
const amount = topUp.toFixed(2);
try {
  const pv = (await baw("defi", "preview", "--action", "DEPOSIT", "--investmentId", investmentId, "--tokenAddress", USDT_BSC, "--amount", amount)).data ?? {};
  console.log("\nPreview (no broadcast):");
  for (const b of pv.balanceChange ?? []) console.log(`  ${b.tokenSymbol} ${b.amount}  ($${b.valueUsd})`);
  if (pv.feeAndContract?.estimatedNetworkFee) console.log(`  network fee ~ ${pv.feeAndContract.estimatedNetworkFee.amount} ${pv.feeAndContract.estimatedNetworkFee.tokenSymbol}`);
  if (pv.feeAndContract?.interactWith?.address) console.log(`  contract ${pv.feeAndContract.interactWith.address}`);
  for (const w of pv.warnings ?? []) console.log(`  ! ${w}`);
} catch (e) {
  die(`Preview failed, not executing: ${e.message}`, 4);
}
if (dry) {
  await log({ action: "proposed", score: risk.score, gap, hfAfter, topUp, investmentId, dryRun: true });
  console.log("\n--dry-run: stopping before execution.");
  process.exit(0);
}
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question(`\nType YES to supply $${amount} USDT to Venus now: `)).trim();
rl.close();
if (answer !== "YES") {
  await log({ action: "declined", score: risk.score, gap, hfAfter, topUp, investmentId });
  console.log("Not executed.");
  process.exit(0);
}
try {
  const r = await baw("defi", "deposit", "--investmentId", investmentId, "--tokenAddress", USDT_BSC, "--amount", amount);
  console.log(`\nExecuted. txHash: ${r.data?.txHash}`);
  await log({ action: "executed", score: risk.score, gap, hfAfter, topUp, investmentId, txHash: r.data?.txHash });
} catch (e) {
  await log({ action: "failed", score: risk.score, gap, topUp, investmentId, error: String(e.message).slice(0, 200) });
  die(`Deposit failed: ${e.message}`, 5);
}
