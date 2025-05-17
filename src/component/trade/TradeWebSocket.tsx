import React, { useEffect, useState, useMemo, useRef } from "react";
import Dropdown from "../dropdown/dropdown";
import * as hl from "@nktkas/hyperliquid";

interface TradeData {
  px: string;
  sz: string;
  side: "B" | "A";
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

interface OrderBook {
  bids: Record<number, OrderEntry>;
  asks: Record<number, OrderEntry>;
}

interface TradeEntry {
  price: string;
  size: string;
  side: "B" | "A";
  time: number;
}

type TabType = "orderBook" | "trades";

const CryptoExchange: React.FC = () => {
  const transport = new hl.HttpTransport();
  const client = new hl.PublicClient({ transport });

  const [activeTab, setActiveTab] = useState<TabType>("orderBook");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBook>({ bids: {}, asks: {} });
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [grouping, setGrouping] = useState<number>(1);
  const [coin, setCoin] = useState<string>("BTC");
  const socketRef = useRef<WebSocket | null>(null);
  const [highlightedAsks, setHighlightedAsks] = useState<
    Record<number, boolean>
  >({});
  const [highlightedBids, setHighlightedBids] = useState<
    Record<number, boolean>
  >({});

  const groupingOptions = [1, 10, 20, 50, 100, 1000, 10000];
  const coinOptions = ["BTC", "ETH", "SOL"];
  const NUM_ENTRIES = 11;

  // Process incoming trade data and update the order book
  const processTradeData = (tradeData: TradeData[]) => {
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
                total: 0, // Will calculate later
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
                total: 0, // Will calculate later
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

  // Prepare ordered bids and asks with totals
  const processedOrderBook = useMemo(() => {
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

    // Take only the top NUM_ENTRIES entries
    const topBids = bidsWithTotals.slice(0, NUM_ENTRIES);
    const topAsks = asksWithTotals.slice(0, NUM_ENTRIES);

    return {
      bids: topBids,
      asks: topAsks,
    };
  }, [orderBook]);

  // Fill arrays to ensure exactly NUM_ENTRIES entries
  const fillOrdersToFixedLength = (
    orders: OrderEntry[],
    isAsk: boolean
  ): OrderEntry[] => {
    if (orders.length >= NUM_ENTRIES) {
      return orders.slice(0, NUM_ENTRIES);
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
    while (filledOrders.length < NUM_ENTRIES) {
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

  // Ensure we have fixed size entries
  const filledBids = useMemo(
    () => fillOrdersToFixedLength(processedOrderBook.bids, false),
    [processedOrderBook.bids]
  );

  const filledAsks = useMemo(
    () => fillOrdersToFixedLength(processedOrderBook.asks, true),
    [processedOrderBook.asks]
  );

  // Calculate spread
  const spread = useMemo(() => {
    if (filledAsks.length > 0 && filledBids.length > 0) {
      const lowestAsk = filledAsks[0].price;
      const highestBid = filledBids[0].price;
      return {
        value: Math.max(0, lowestAsk - highestBid),
        percentage: (((lowestAsk - highestBid) / lowestAsk) * 100).toFixed(3),
      };
    }
    return { value: 0, percentage: "0.000" };
  }, [filledAsks, filledBids]);

  // Reset order book when grouping changes
  useEffect(() => {
    setOrderBook({ bids: {}, asks: {} });
  }, [grouping]);

  useEffect(() => {
    const fetchL2Book = async () => {
      const l2Book = await client.l2Book({ coin: coin });
      console.log(l2Book);
    };
    fetchL2Book();
  }, []);

  const connectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    // Reset data
    if (activeTab === "orderBook") {
      setOrderBook({ bids: {}, asks: {} });
    } else {
      setTrades([]);
    }

    const socket = new WebSocket("wss://api.hyperliquid.xyz/ws");
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      setError(null);

      // Determine subscription type based on active tab
      const subscriptionType = activeTab === "orderBook" ? "l2Book" : "trades";

      socket.send(
        JSON.stringify({
          method: "subscribe",
          subscription: { type: subscriptionType, coin: coin },
        })
      );
    };

    socket.onmessage = (event: MessageEvent) => {
      try {
        const response = JSON.parse(event.data);
        if (Array.isArray(response.data)) {
          console.log(response.data);
          processTradeData(response.data);
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

  // Format timestamp to HH:MM:SS
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toTimeString().split(" ")[0];
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [coin, activeTab]);

  return (
    <div className="bg-primary text-white p-4 rounded-lg w-[18%] max-w-lg">
      {/* Tabs */}
      <div className="flex border-b border-secondary mb-4">
        <button
          className={`px-4 py-2 ${
            activeTab === "orderBook"
              ? "border-b border-highlight "
              : "text-gray-400"
          }`}
          onClick={() => setActiveTab("orderBook")}
        >
          Order Book
        </button>
        <button
          className={`px-4 py-2 ${
            activeTab === "trades"
              ? "border-b border-highlight"
              : "text-gray-400"
          }`}
          onClick={() => setActiveTab("trades")}
        >
          Trades
        </button>
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center my-4 w-full">
        {activeTab === "orderBook" && (
          <>
            <Dropdown
              options={groupingOptions.map(String)}
              value={grouping.toString()}
              onChange={(value) => setGrouping(Number(value))}
            />
            <Dropdown options={coinOptions} value={coin} onChange={setCoin} />
          </>
        )}
        {activeTab === "trades" && (
          <Dropdown options={coinOptions} value={coin} onChange={setCoin} />
        )}
      </div>

      {/* Order Book View */}
      {activeTab === "orderBook" && (
        <>
          <div className="grid grid-cols-3 text-regular text-heading mb-2">
            <span>Price</span>
            <span className="text-right">Size ({coin})</span>
            <span className="text-right">Total ({coin})</span>
          </div>

          <div className="mb-1">
            {filledAsks
              .slice()
              .reverse()
              .map((ask, i) => (
                <div
                  key={`ask-${i}-${ask.price}`}
                  className={`grid grid-cols-3 items-center text-sm ${
                    highlightedAsks[ask.price]
                      ? "bg-sell-100 transition-colors duration-300 ease-in"
                      : ""
                  }`}
                >
                  <span className="text-left px-2 text-sell">
                    {ask.price.toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span className="text-right px-2 text-gray-300">
                    {ask.size.toFixed(5)}
                  </span>
                  <span className="text-right px-2 text-gray-300">
                    {ask.total.toFixed(5)}
                  </span>
                </div>
              ))}
          </div>

          <div className="flex justify-between text-white bg-secondary p-2 -mx-1 my-1">
            <span>Spread</span>
            <span>
              {spread.value.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
            </span>
            <span>{spread.percentage}%</span>
          </div>

          <div className="mt-1">
            {filledBids.map((bid, i) => (
              <div
                key={`bid-${i}-${bid.price}`}
                className={`grid grid-cols-3 items-center text-sm ${
                  highlightedBids[bid.price]
                    ? "bg-buy-100 transition-colors duration-300 ease-in"
                    : ""
                }`}
              >
                <span className="text-left px-2 text-buy">
                  {bid.price.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}
                </span>
                <span className="text-right px-2 text-gray-300">
                  {bid.size.toFixed(5)}
                </span>
                <span className="text-right px-2 text-gray-300">
                  {bid.total.toFixed(5)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Trades View */}
      {activeTab === "trades" && (
        <div>
          <div className="flex text-regular text-heading mb-2">
            <span className="w-24">Price</span>
            <span className="w-32 text-right">Size ({coin})</span>
            <span className="w-24 text-right">Time</span>
          </div>

          <div className="trade-list">
            {trades.map((trade, i) => (
              <div
                key={`trade-${i}-${trade.time}`}
                className="flex items-center text-sm py-0.5"
              >
                <span
                  className={`w-24 ${
                    trade.side === "B" ? "text-buy" : "text-sell"
                  }`}
                >
                  {parseFloat(trade.price).toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}
                </span>
                <span className="w-32 text-right text-gray-300">
                  {parseFloat(trade.size).toFixed(5)}
                </span>
                <span className="w-24 text-right text-gray-300 flex justify-end">
                  {formatTime(trade.time)}
                  {activeTab === "trades" && (
                    <svg
                      className="h-4 w-4 ml-2 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  )}
                </span>
              </div>
            ))}
            {trades.length === 0 && (
              <div className="text-center text-gray-400 py-4">
                Waiting for trades...
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="mt-4 text-red-500 text-sm">{error}</div>}
    </div>
  );
};

export default CryptoExchange;
