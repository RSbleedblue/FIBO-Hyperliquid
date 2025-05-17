export interface TradeData {
  px: string;
  sz: string;
  side: "B" | "A";
  coin: string;
  hash: string;
  tid: number;
  time: number;
}

export interface OrderEntry {
  price: number;
  size: number;
  total: number;
}

export interface OrderBook {
  bids: Record<number, OrderEntry>;
  asks: Record<number, OrderEntry>;
}

export interface TradeEntry {
  price: string;
  size: string;
  side: "B" | "A";
  time: number;
}

export interface L2BookData {
  coin: string;
  time: number;
  levels: [
    { px: string; sz: string; n: number }[][],
    { px: string; sz: string; n: number }[][]
  ];
}

export type TabType = "orderBook" | "trades"; 