import React, { useEffect, useState, useMemo, useRef } from "react";
import Dropdown from "../dropdown/dropdown";

interface TradeData {
  px: string;
  sz: string;
  side: 'B' | 'A';
  coin: string;
  hash: string;
  tid: number;
  time: number;
}

interface OrderEntry {
  price: number;
  size: number;
  total: number;
}

const TradeWebSocket: React.FC = () => {
  const [, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [grouping, setGrouping] = useState<number>(1);
  const [coin, setCoin] = useState<string>('BTC');
  const prevBidSizesRef = useRef<Record<number, number>>({});
  const prevAskSizesRef = useRef<Record<number, number>>({});
  const socketRef = useRef<WebSocket | null>(null);
  const [highlightedAsks, setHighlightedAsks] = useState<Record<number, boolean>>({});
  const [highlightedBids, setHighlightedBids] = useState<Record<number, boolean>>({});
  
  const groupingOptions = [1, 10, 20, 50, 100, 1000, 10000];
  const coinOptions = ['BTC', 'ETH', 'SOL'];
  const NUM_ENTRIES = 11;

  // Process data into bids and asks
  const processOrderBookData = (data: TradeData[]) => {
    const bids: TradeData[] = [];
    const asks: TradeData[] = [];

    data.forEach(order => {
      if (order.side === 'B') bids.push(order);
      else if (order.side === 'A') asks.push(order);
    });

    // Sort in descending order for bids (highest first)
    bids.sort((a, b) => parseFloat(b.px) - parseFloat(a.px));
    // Sort in ascending order for asks (lowest first)
    asks.sort((a, b) => parseFloat(a.px) - parseFloat(b.px));

    return { bids, asks };
  };

  // Group orders by price level based on grouping
  const groupOrdersByPrice = (orders: TradeData[], grouping: number, prevSizes: Record<number, number>) => {
    const grouped: Record<number, OrderEntry> = {};

    for (const order of orders) {
      const price = parseFloat(order.px);
      const size = parseFloat(order.sz);
      const groupedPrice = Math.floor(price / grouping) * grouping;

      if (!grouped[groupedPrice]) {
        grouped[groupedPrice] = { 
          price: groupedPrice, 
          size: 0,
          total: 0,
        };
      }

      grouped[groupedPrice].size += size;
    }

    // Update reference for next comparison
    const newSizes: Record<number, number> = {};
    Object.entries(grouped).forEach(([priceStr, entry]) => {
      newSizes[parseInt(priceStr)] = entry.size;
    });

    return { 
      groupedOrders: Object.values(grouped),
      newSizes
    };
  };

  // Calculate cumulative sizes
  const calculateCumulativeSizes = (orders: OrderEntry[]) => {
    let cumulative = 0;
    return orders.map(order => {
      cumulative += order.size;
      return { ...order, total: cumulative };
    });
  };

  // Fill arrays to ensure exactly NUM_ENTRIES entries
  const fillOrdersToFixedLength = (orders: OrderEntry[], isAsk: boolean): OrderEntry[] => {
    if (orders.length >= NUM_ENTRIES) {
      return orders.slice(0, NUM_ENTRIES);
    }

    // Calculate the price step based on existing entries
    let priceStep = 1;
    if (orders.length >= 2) {
      const sortedOrders = [...orders].sort((a, b) => a.price - b.price);
      const firstPrice = sortedOrders[0].price;
      const secondPrice = sortedOrders[1].price;
      priceStep = Math.abs(secondPrice - firstPrice);
    }

    const filledOrders = [...orders];
    const lastPrice = filledOrders.length > 0 
      ? (isAsk 
         ? Math.max(...filledOrders.map(o => o.price)) 
         : Math.min(...filledOrders.map(o => o.price)))
      : (isAsk ? 104205 : 104195);  // Default values if no orders

    // Add empty entries to fill the book
    while (filledOrders.length < NUM_ENTRIES) {
      const newPrice = isAsk 
        ? lastPrice + priceStep * (filledOrders.length - orders.length + 1) 
        : lastPrice - priceStep * (filledOrders.length - orders.length + 1);
      
      filledOrders.push({
        price: newPrice,
        size: 0,
        total: filledOrders.length > 0 ? filledOrders[filledOrders.length - 1].total : 0,
      });
    }

    return filledOrders;
  };

  // Process all data and generate final order book
  const { bids, asks } = useMemo(() => processOrderBookData(trades), [trades]);
  
  const { groupedOrders: groupedBids, newSizes: newBidSizes } = useMemo(() => 
    groupOrdersByPrice(bids, grouping, prevBidSizesRef.current), 
    [bids, grouping]
  );
  
  const { groupedOrders: groupedAsks, newSizes: newAskSizes } = useMemo(() => 
    groupOrdersByPrice(asks, grouping, prevAskSizesRef.current), 
    [asks, grouping]
  );

  // Update the refs with new sizes and trigger highlights
  useEffect(() => {
    // Asks
    Object.entries(newAskSizes).forEach(([priceStr, size]) => {
      const price = Number(priceStr);
      if (
        prevAskSizesRef.current[price] !== undefined &&
        prevAskSizesRef.current[price] !== size
      ) {
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
    prevAskSizesRef.current = newAskSizes;
  }, [newAskSizes]);

  useEffect(() => {
    // Bids
    Object.entries(newBidSizes).forEach(([priceStr, size]) => {
      const price = Number(priceStr);
      if (
        prevBidSizesRef.current[price] !== undefined &&
        prevBidSizesRef.current[price] !== size
      ) {
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
    prevBidSizesRef.current = newBidSizes;
  }, [newBidSizes]);

  const bidsWithTotals = useMemo(() => calculateCumulativeSizes(groupedBids), [groupedBids]);
  const asksWithTotals = useMemo(() => calculateCumulativeSizes(groupedAsks), [groupedAsks]);

  // Fill to ensure exactly NUM_ENTRIES entries
  const filledBids = useMemo(() => 
    fillOrdersToFixedLength(bidsWithTotals, false), 
    [bidsWithTotals]
  );
  
  const filledAsks = useMemo(() => 
    fillOrdersToFixedLength(asksWithTotals, true), 
    [asksWithTotals]
  );

  // Calculate spread
  const spread = useMemo(() => {
    if (filledAsks.length > 0 && filledBids.length > 0) {
      const lowestAsk = filledAsks[0].price;
      const highestBid = filledBids[0].price;
      return {
        value: lowestAsk - highestBid,
        percentage: ((lowestAsk - highestBid) / lowestAsk * 100).toFixed(3)
      };
    }
    return { value: 0, percentage: "0.000" };
  }, [filledAsks, filledBids]);

  // Helper to merge and keep latest trades
  function mergeAndLimitTrades(newTrades: TradeData[], prevTrades: TradeData[]): TradeData[] {
    // Combine new and old, remove duplicates by hash
    const allTrades = [...newTrades, ...prevTrades];
    const uniqueMap = new Map<string, TradeData>();
    
    for (const trade of allTrades) {
      if (!uniqueMap.has(trade.hash) || trade.time > uniqueMap.get(trade.hash)!.time) {
        uniqueMap.set(trade.hash, trade);
      }
    }
    
    return Array.from(uniqueMap.values());
  }

  const connectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const socket = new WebSocket("wss://api.hyperliquid.xyz/ws");
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      setError(null);
      socket.send(
        JSON.stringify({
          method: "subscribe",
          subscription: { type: "trades", coin: coin },
        })
      );
    };

    socket.onmessage = (event: MessageEvent) => {
      try {
        const response = JSON.parse(event.data);
        if (Array.isArray(response.data)) {
          setTrades(prev => mergeAndLimitTrades(response.data, prev));
        }
        if (response.error) setError(response.error);
      } catch (err) {
        setError("WebSocket message parse error");
      }
    };

    socket.onerror = () => {
      setIsConnected(false);
      setError("WebSocket error");
    };

    socket.onclose = () => setIsConnected(false);
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [coin]);

  return (
    <div className="bg-primary text-white p-4 rounded-lg w-[20%]">
      <p className="text-lg font-normal mb-2">Order Book</p>
      <hr className="border-secondary border-1 -mx-4"></hr>
      <div className="flex justify-between items-center my-4">
        <Dropdown
          options={groupingOptions.map(String)}
          value={grouping.toString()}
          onChange={(value) => setGrouping(Number(value))}
        />
        <Dropdown
          options={coinOptions}
          value={coin}
          onChange={setCoin}
        />
      </div>

      <div className="grid grid-cols-3 text-regular text-heading mb-2">
        <span>Price</span>
        <span className="text-right">Size ({coin})</span>
        <span className="text-right">Total ({coin})</span>
      </div>

      <div className="mb-1">
        {filledAsks.slice().reverse().map((ask, i) => (
          <div
            key={`ask-${i}`}
            className={`grid grid-cols-3 items-center h-7 text-sm ${highlightedAsks[ask.price] ? 'bg-sell-100 transition-colors duration-300 ease-in' : ''}`}
          >
            <span className="text-left px-2 text-red-500">{ask.price.toFixed(0)}</span>
            <span className="text-right px-2 text-gray-300">{ask.size.toFixed(5)}</span>
            <span className="text-right px-2 text-gray-300">{ask.total.toFixed(5)}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-white bg-secondary p-2 -mx-1 my-1">
        <span>Spread</span>
        <span>{spread.value}</span>
        <span>{spread.percentage}%</span>
      </div>

      <div className="mt-1">
        {filledBids.map((bid, i) => (
          <div
            key={`bid-${i}`}
            className={`grid grid-cols-3 items-center h-7 text-sm ${highlightedBids[bid.price] ? 'bg-buy-100 transition-colors duration-300 ease-in' : ''}`}
          >
            <span className="text-left px-2 text-green-400">{bid.price.toFixed(0)}</span>
            <span className="text-right px-2 text-gray-300">{bid.size.toFixed(5)}</span>
            <span className="text-right px-2 text-gray-300">{bid.total.toFixed(5)}</span>
          </div>
        ))}
      </div>
      
      {error && <div className="mt-4 text-red-500 text-sm">{error}</div>}
    </div>
  );
};

export default TradeWebSocket;