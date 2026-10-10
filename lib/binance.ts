// Client for Binance Web3 public tokenized-securities endpoints.
// Source of truth for shapes: binance/binance-skills-hub -> binance-tokenized-securities-info/SKILL.md
// No API key is needed. Only `import type` from local files so scripts can run this
// file directly with node --experimental-strip-types.
import type { AssetStatus, Candle, DynamicData, MarketStatus, TokenRef } from "./types";
import type { RiskInputs } from "./risk";

const ROOT = "https://www.binance.com/bapi/defi";
const W = "wallet-direct/buw/wallet";
const HEADERS = { "Accept-Encoding": "identity", "User-Agent": "binance-web3/1.1 (Skill)" };

type Envelope<T> = { code?: string; data?: T | null; success?: boolean; message?: string };

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}, timeoutMs = 8000): Promise<T> {
  const url = new URL(ROOT + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  const body = (await res.json()) as Envelope<T>;
  if (body.success === false || (body.code && body.code !== "000000")) {
    throw new Error(`API error ${body.code ?? "?"} ${body.message ?? ""} on ${path}`.trim());
  }
  if (body.data === undefined || body.data === null) throw new Error(`Empty data on ${path}`);
  return body.data;
}

/** type: 1 = Ondo, 2 = xStocks-style, 3 = bStock (per binance-agentic-wallet skill). */
export async function listTokens(type?: number): Promise<TokenRef[]> {
  const rows = await get<Record<string, unknown>[]>(`/v1/public/${W}/market/token/rwa/stock/detail/list/ai`, { type });
  return rows
    .map((r) => ({
      chainId: String(r.chainId ?? ""),
      contractAddress: String(r.contractAddress ?? ""),
      symbol: String(r.symbol ?? ""),
      ticker: String(r.ticker ?? ""),
      type: num(r.type) ?? 0,
      multiplier: num(r.multiplier) ?? 1,
    }))
    .filter((t) => t.contractAddress && t.symbol);
}

export async function marketStatus(): Promise<MarketStatus> {
  const d = await get<Record<string, unknown>>(`/v1/public/${W}/market/token/rwa/market/status/ai`);
  return {
    openState: d.openState === true,
    reasonCode: str(d.reasonCode),
    reasonMsg: str(d.reasonMsg),
    nextOpenTime: num(d.nextOpenTime),
    nextCloseTime: num(d.nextCloseTime),
  };
}

export async function assetStatus(chainId: string, contractAddress: string): Promise<AssetStatus> {
  const d = await get<Record<string, unknown>>(`/v1/public/${W}/market/token/rwa/asset/market/status/ai`, { chainId, contractAddress });
  return {
    openState: d.openState === true,
    marketStatus: str(d.marketStatus),
    reasonCode: str(d.reasonCode),
    reasonMsg: str(d.reasonMsg),
    nextOpenTime: num(d.nextOpenTime),
    nextCloseTime: num(d.nextCloseTime),
  };
}

export async function dynamicData(chainId: string, contractAddress: string): Promise<DynamicData> {
  const d = await get<{ tokenInfo?: Record<string, unknown>; stockInfo?: Record<string, unknown> }>(
    `/v2/public/${W}/market/token/rwa/dynamic/ai`,
    { chainId, contractAddress },
  );
  return {
    tokenPrice: num(d.tokenInfo?.price),
    sharesMultiplier: num(d.tokenInfo?.sharesMultiplier),
    stockPrice: num(d.stockInfo?.price),
    dividendYieldPct: num(d.stockInfo?.dividendYield),
    totalHolders: num(d.tokenInfo?.totalHolders),
  };
}

export async function klines(chainId: string, contractAddress: string, interval = "1h", limit = 49): Promise<Candle[]> {
  const d = await get<{ klineInfos?: unknown[][] }>(`/v1/public/${W}/dex/market/token/kline/ai`, { chainId, contractAddress, interval, limit });
  return (d.klineInfos ?? [])
    .map((k) => ({ openTime: num(k[0]) ?? 0, close: num(k[4]) ?? NaN, closeTime: num(k[6]) ?? 0 }))
    .filter((c) => Number.isFinite(c.close) && c.close > 0)
    .sort((a, b) => a.openTime - b.openTime);
}

export type Snapshot = {
  market: MarketStatus | null;
  asset: AssetStatus | null;
  dyn: DynamicData | null;
  candles: Candle[];
  warnings: string[];
};

/** Fetch every signal in parallel; individual failures become warnings, not exceptions. */
export async function fetchSnapshot(t: Pick<TokenRef, "chainId" | "contractAddress">): Promise<Snapshot> {
  const [m, a, d, k] = await Promise.allSettled([
    marketStatus(),
    assetStatus(t.chainId, t.contractAddress),
    dynamicData(t.chainId, t.contractAddress),
    klines(t.chainId, t.contractAddress),
  ]);
  const warnings: string[] = [];
  const pick = <T,>(r: PromiseSettledResult<T>, name: string): T | null => {
    if (r.status === "fulfilled") return r.value;
    warnings.push(`${name}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    return null;
  };
  return {
    market: pick(m, "market status"),
    asset: pick(a, "asset status"),
    dyn: pick(d, "dynamic data"),
    candles: pick(k, "k-line") ?? [],
    warnings,
  };
}

export function toRiskInputs(s: Snapshot, now: number): RiskInputs {
  return {
    now,
    marketOpen: s.market ? s.market.openState : null,
    assetOpen: s.asset ? s.asset.openState : null,
    nextOpenTime: s.asset?.nextOpenTime ?? s.market?.nextOpenTime ?? null,
    reasonCode: s.asset?.reasonCode ?? s.market?.reasonCode ?? null,
    reasonMsg: s.asset?.reasonMsg ?? s.market?.reasonMsg ?? null,
    tokenPrice: s.dyn?.tokenPrice ?? null,
    sharesMultiplier: s.dyn?.sharesMultiplier ?? null,
    stockPrice: s.dyn?.stockPrice ?? null,
    closes: s.candles.map((c) => ({ closeTime: c.closeTime, close: c.close })),
  };
}
