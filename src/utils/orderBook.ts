import type { OrderBook, OrderEntry } from "../types/orderAndTrade_types";

export const processL2BookData = (
  data: any,
  grouping: number,
  setHighlightedBids: (fn: (prev: Record<number, boolean>) => Record<number, boolean>) => void,
  setHighlightedAsks: (fn: (prev: Record<number, boolean>) => Record<number, boolean>) => void
) => {
  if (!data || !data.levels || !Array.isArray(data.levels)) {
    console.error("Invalid L2Book data format:", data);
    return null;
  }

  const newOrderBook: OrderBook = {
    bids: {},
    asks: {},
  };

  // Process bids (first array in levels)
  if (data.levels[0] && Array.isArray(data.levels[0])) {
    data.levels[0].forEach((bid: { px: string; sz: string }) => {
      const price = Math.floor(parseFloat(bid.px) / grouping) * grouping;
      const size = parseFloat(bid.sz);

      if (newOrderBook.bids[price]) {
        const prevSize = newOrderBook.bids[price].size;
        if (prevSize !== size) {
          newOrderBook.bids[price].size = size;
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
    });
  }

  // Process asks (second array in levels)
  if (data.levels[1] && Array.isArray(data.levels[1])) {
    data.levels[1].forEach((ask: { px: string; sz: string }) => {
      const price = Math.floor(parseFloat(ask.px) / grouping) * grouping;
      const size = parseFloat(ask.sz);

      if (newOrderBook.asks[price]) {
        const prevSize = newOrderBook.asks[price].size;
        if (prevSize !== size) {
          newOrderBook.asks[price].size = size;
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
    });
  }

  return newOrderBook;
};

export const processOrderBook = (orderBook: OrderBook, numEntries: number) => {
  // Sort bids (highest first)
  const sortedBids = Object.values(orderBook.bids).sort(
    (a, b) => b.price - a.price
  );

  // Sort asks (lowest first)
  const sortedAsks = Object.values(orderBook.asks).sort(
    (a, b) => a.price - b.price
  );

  // Calculate cumulative totals for bids
  let cumulativeBidSize = 0;
  const bidsWithTotals = sortedBids.map((bid) => {
    cumulativeBidSize += bid.size;
    return { ...bid, total: cumulativeBidSize };
  });

  // Calculate cumulative totals for asks
  let cumulativeAskSize = 0;
  const asksWithTotals = sortedAsks.map((ask) => {
    cumulativeAskSize += ask.size;
    return { ...ask, total: cumulativeAskSize };
  });

  // Take only the top entries
  const topBids = bidsWithTotals.slice(0, numEntries);
  const topAsks = asksWithTotals.slice(0, numEntries);

  return {
    bids: topBids,
    asks: topAsks,
  };
};

export const fillOrdersToFixedLength = (
  orders: OrderEntry[],
  isAsk: boolean,
  numEntries: number,
  grouping: number
): OrderEntry[] => {
  if (orders.length >= numEntries) {
    return orders.slice(0, numEntries);
  }

  // Calculate the price step based on existing entries
  let priceStep = grouping;
  if (orders.length >= 2) {
    const firstPrice = orders[0].price;
    const secondPrice = orders[1].price;
    priceStep = Math.abs(secondPrice - firstPrice);
  }

  const filledOrders = [...orders];
  const lastPrice =
    filledOrders.length > 0
      ? isAsk
        ? Math.max(...filledOrders.map((o) => o.price))
        : Math.min(...filledOrders.map((o) => o.price))
      : isAsk
      ? 104205
      : 104195; // Default values if no orders

  // Add empty entries to fill the book
  while (filledOrders.length < numEntries) {
    const newPrice = isAsk
      ? lastPrice + priceStep * (filledOrders.length - orders.length + 1)
      : lastPrice - priceStep * (filledOrders.length - orders.length + 1);

    filledOrders.push({
      price: newPrice,
      size: 0,
      total:
        filledOrders.length > 0
          ? filledOrders[filledOrders.length - 1].total
          : 0,
    });
  }

  return filledOrders;
};

export const calculateSpread = (asks: OrderEntry[], bids: OrderEntry[]) => {
  if (asks.length > 0 && bids.length > 0) {
    const lowestAsk = asks[0].price;
    const highestBid = bids[0].price;
    return {
      value: Math.max(0, lowestAsk - highestBid),
      percentage: (((lowestAsk - highestBid) / lowestAsk) * 100).toFixed(3),
    };
  }
  return { value: 0, percentage: "0.000" };
}; 