import type { TradeData, TradeEntry, OrderBook } from "../types/orderAndTrade_types";

export const processTradeData = (
  tradeData: TradeData[],
  grouping: number,
  activeTab: string,
  setTrades: (fn: (prev: TradeEntry[]) => TradeEntry[]) => void,
  setOrderBook: (fn: (prev: OrderBook) => OrderBook) => void,
  setHighlightedBids: (fn: (prev: Record<number, boolean>) => Record<number, boolean>) => void,
  setHighlightedAsks: (fn: (prev: Record<number, boolean>) => Record<number, boolean>) => void
) => {
  // Update trades list
  const newTrades = tradeData.map((trade) => ({
    price: trade.px,
    size: trade.sz,
    side: trade.side,
    time: trade.time,
  }));

  setTrades((prev) => {
    const combined = [...newTrades, ...prev];
    return combined.slice(0, 30); // Limit to 30 trades for display
  });

  // Update order book if we're on that tab
  if (activeTab === "orderBook") {
    setOrderBook((prevOrderBook) => {
      const newOrderBook = {
        bids: { ...prevOrderBook.bids },
        asks: { ...prevOrderBook.asks },
      };

      tradeData.forEach((trade) => {
        const price = Math.floor(parseFloat(trade.px) / grouping) * grouping;
        const size = parseFloat(trade.sz);

        if (trade.side === "B") {
          // Handle bids
          if (newOrderBook.bids[price]) {
            // Price level exists, update it and highlight
            const prevSize = newOrderBook.bids[price].size;
            newOrderBook.bids[price].size = size;

            if (prevSize !== size) {
              setHighlightedBids((prev) => ({ ...prev, [price]: true }));
              setTimeout(() => {
                setHighlightedBids((prev) => {
                  const copy = { ...prev };
                  delete copy[price];
                  return copy;
                });
              }, 700);
            }
          } else {
            // New price level
            newOrderBook.bids[price] = {
              price,
              size,
              total: 0,
            };
            setHighlightedBids((prev) => ({ ...prev, [price]: true }));
            setTimeout(() => {
              setHighlightedBids((prev) => {
                const copy = { ...prev };
                delete copy[price];
                return copy;
              });
            }, 700);
          }
        } else if (trade.side === "A") {
          // Handle asks
          if (newOrderBook.asks[price]) {
            // Price level exists, update it and highlight
            const prevSize = newOrderBook.asks[price].size;
            newOrderBook.asks[price].size = size;

            if (prevSize !== size) {
              setHighlightedAsks((prev) => ({ ...prev, [price]: true }));
              setTimeout(() => {
                setHighlightedAsks((prev) => {
                  const copy = { ...prev };
                  delete copy[price];
                  return copy;
                });
              }, 700);
            }
          } else {
            // New price level
            newOrderBook.asks[price] = {
              price,
              size,
              total: 0,
            };
            setHighlightedAsks((prev) => ({ ...prev, [price]: true }));
            setTimeout(() => {
              setHighlightedAsks((prev) => {
                const copy = { ...prev };
                delete copy[price];
                return copy;
              });
            }, 700);
          }
        }
      });

      return newOrderBook;
    });
  }
};

export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toTimeString().split(" ")[0];
}; 