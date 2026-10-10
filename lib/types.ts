export type DataSource = "live" | "demo";

export type TokenRef = {
  chainId: string;
  contractAddress: string;
  symbol: string;
  ticker: string;
  type: number;
  multiplier: number;
};

export type MarketStatus = {
  openState: boolean;
  reasonCode: string | null;
  reasonMsg: string | null;
  nextOpenTime: number | null;
  nextCloseTime: number | null;
};

export type AssetStatus = {
  openState: boolean;
  marketStatus: string | null;
  reasonCode: string | null;
  reasonMsg: string | null;
  nextOpenTime: number | null;
  nextCloseTime: number | null;
};

export type DynamicData = {
  tokenPrice: number | null;
  sharesMultiplier: number | null;
  stockPrice: number | null;
  dividendYieldPct: number | null;
  totalHolders: number | null;
};

export type Candle = { openTime: number; close: number; closeTime: number };
