import React, { useEffect, useState, useMemo, useRef } from "react";
import Dropdown from "../dropdown/dropdown";
import * as hl from "@nktkas/hyperliquid";
import Skeleton from "react-loading-skeleton";
import type {
  TabType,
  OrderBook,
  TradeEntry,
} from "../../types/orderAndTrade_types";
import {
  processL2BookData,
  processOrderBook,
  fillOrdersToFixedLength,
  calculateSpread,
} from "../../utils/orderBook";
import { processTradeData, formatTime } from "../../utils/trades";
import { connectWebSocket } from "../../utils/websocket";

const CryptoExchange: React.FC = () => {
  const transport = new hl.HttpTransport();
  const client = new hl.PublicClient({ transport });

  const [activeTab, setActiveTab] = useState<TabType>("orderBook");
  const [, setIsConnected] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBook>({ bids: {}, asks: {} });
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [grouping, setGrouping] = useState<number>(1);
  const [coin, setCoin] = useState<string>("BTC");
  const socketRef = useRef<WebSocket | null>(null);
  const orderBookIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [highlightedAsks, setHighlightedAsks] = useState<
    Record<number, boolean>
  >({});
  const [highlightedBids, setHighlightedBids] = useState<
    Record<number, boolean>
  >({});

  const groupingOptions = [1, 10, 20, 50, 100, 1000, 10000];
  const coinOptions = ["BTC", "ETH", "SOL"];
  const NUM_ENTRIES = 11;
  const POLLING_INTERVAL = 1000;

  const handleTabChange = (tab: TabType) => {
    if (activeTab !== tab) {
      setActiveTab(tab);
    }
  };

  const processedOrderBook = useMemo(
    () => processOrderBook(orderBook, NUM_ENTRIES),
    [orderBook]
  );

  const filledBids = useMemo(
    () =>
      fillOrdersToFixedLength(
        processedOrderBook.bids,
        false,
        NUM_ENTRIES,
        grouping
      ),
    [processedOrderBook.bids, grouping]
  );

  const filledAsks = useMemo(
    () =>
      fillOrdersToFixedLength(
        processedOrderBook.asks,
        true,
        NUM_ENTRIES,
        grouping
      ),
    [processedOrderBook.asks, grouping]
  );

  const totalAskSize = useMemo(() => {
    const total = filledAsks.reduce((acc, ask) => acc + ask.size, 0);
    return total > 0 ? total : 1;
  }, [filledAsks]);

  const totalBidSize = useMemo(() => {
    const total = filledBids.reduce((acc, bid) => acc + bid.size, 0);
    return total > 0 ? total : 1;
  }, [filledBids]);

  const spread = useMemo(
    () => calculateSpread(filledAsks, filledBids),
    [filledAsks, filledBids]
  );

  const startOrderBookPolling = () => {
    if (orderBookIntervalRef.current) {
      clearInterval(orderBookIntervalRef.current);
    }

    setOrderBook({ bids: {}, asks: {} });
    fetchL2Book();
    orderBookIntervalRef.current = setInterval(fetchL2Book, POLLING_INTERVAL);
  };

  const fetchL2Book = async () => {
    try {
      const l2Book = await client.l2Book({ coin });

      const newOrderBook = processL2BookData(
        l2Book,
        grouping,
        setHighlightedBids,
        setHighlightedAsks
      );
      if (newOrderBook) {
        setOrderBook(newOrderBook);
      }
    } catch (err) {
      console.error("Error fetching L2 book:", err);
      setError("Error fetching order book data");
    }
  };

  useEffect(() => {
    setOrderBook({ bids: {}, asks: {} });
  }, [grouping]);

  useEffect(() => {
    const socket = connectWebSocket(
      coin,
      (data) =>
        processTradeData(
          data,
          grouping,
          activeTab,
          setTrades,
          setOrderBook,
          setHighlightedBids,
          setHighlightedAsks
        ),
      setError,
      setIsConnected
    );
    socketRef.current = socket;

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [coin, grouping, activeTab]);

  useEffect(() => {
    if (activeTab === "orderBook") {
      startOrderBookPolling();
    } else {
      if (orderBookIntervalRef.current) {
        clearInterval(orderBookIntervalRef.current);
      }
    }

    return () => {
      if (orderBookIntervalRef.current) {
        clearInterval(orderBookIntervalRef.current);
      }
    };
  }, [activeTab, coin, grouping]);

  return (
    <div className="bg-primary text-white rounded-lg w-full overflow-hidden">
      <div className="flex border-b border-secondary justify-between">
        <button
          className={`relative cursor-pointer ${
            activeTab === "orderBook" ? "text-white" : "text-gray-400"
          }`}
          onClick={() => handleTabChange("orderBook")}
        >
          Order Book
          {activeTab === "orderBook" && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-highlight"></div>
          )}
        </button>
        <button
          className={`px-4 py-2 relative cursor-pointer ${
            activeTab === "trades" ? "text-white" : "text-gray-400"
          }`}
          onClick={() => handleTabChange("trades")}
        >
          Trades
          {activeTab === "trades" && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-highlight"></div>
          )}
        </button>
      </div>

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
      </div>

      <div className="h-[calc(100vh-200px)] overflow-y-auto scrollbar-hide">
        {activeTab === "orderBook" && (
          <div className="flex flex-col">
            <div className="grid grid-cols-12 text-xs text-gray-300 mb-2">
              <span className="col-span-4 text-left pl-2">Price</span>
              <span className="col-span-4 text-right pr-2">Size ({coin})</span>
              <span className="col-span-4 text-right pr-2">Total ({coin})</span>
            </div>

            <div>
              {filledAsks
                .slice()
                .reverse()
                .map((ask, i) => (
                  <div
                    key={`ask-${i}-${ask.price}`}
                    className={`grid grid-cols-12 items-center text-sm h-8 relative
                    }`}
                  >
                    <div
                      className="absolute h-full bg-sell opacity-20 z-0"
                      style={{
                        width:
                          ask.size > 0
                            ? `${(ask.size / totalAskSize) * 100}%`
                            : "0%",
                      }}
                    ></div>
                    <span className="col-span-4 text-left pl-2 text-sell relative z-10">
                      {ask.price.toLocaleString("en-US", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                    <span className="col-span-4 text-right pr-2 text-gray-300 relative z-10">
                      {ask.size.toFixed(5)}
                    </span>
                    <span className="col-span-4 text-right pr-2 text-gray-300 relative z-10">
                      {ask.total.toFixed(5)}
                    </span>
                  </div>
                ))}
            </div>

            <div className="flex justify-around text-white bg-secondary p-1 text-regular">
              <span>Spread</span>
              <span>
                {spread.value.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
              </span>
              <span>{spread.percentage}%</span>
            </div>

            <div>
              {filledBids.map((bid, i) => (
                <div
                  key={`bid-${i}-${bid.price}`}
                  className={`grid grid-cols-12 items-center text-sm h-8 relative
                  }`}
                >
                  <div
                    className="absolute left-0 top-0 h-full bg-buy opacity-20 z-0"
                    style={{
                      width:
                        bid.size > 0
                          ? `${(bid.size / totalBidSize) * 100}%`
                          : "0%",
                    }}
                  ></div>
                  <span className="col-span-4 text-left pl-2 text-buy relative z-10">
                    {bid.price.toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span className="col-span-4 text-right pr-2 text-gray-300 relative z-10">
                    {bid.size.toFixed(5)}
                  </span>
                  <span className="col-span-4 text-right pr-2 text-gray-300 relative z-10">
                    {bid.total.toFixed(5)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "trades" && (
          <div className="flex flex-col">
            <div className="grid grid-cols-12 text-xs text-gray-300 mb-2">
              <span className="col-span-4 text-left pl-2">Price</span>
              <span className="col-span-4 text-right pr-2">Size ({coin})</span>
              <span className="col-span-4 text-right pr-2">Time</span>
            </div>

            <div className="overflow-y-auto scrollbar-hide h-[calc(100vh-200px)]">
              {trades.length === 0 ? (
                <div className="text-center text-gray-400 py-4">
                  <Skeleton count={5} className="w-full h-4 mb-2" />
                </div>
              ) : (
                trades.map((trade, i) => (
                  <div
                    key={`trade-${i}-${trade.time}`}
                    className="grid grid-cols-12 items-center text-sm h-8"
                  >
                    <span
                      className={`col-span-4 text-left pl-2 ${
                        trade.side === "B" ? "text-buy" : "text-sell"
                      }`}
                    >
                      {parseFloat(trade.price).toLocaleString("en-US", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                    <span className="col-span-4 text-right pr-2 text-gray-300">
                      {parseFloat(trade.size).toFixed(5)}
                    </span>
                    <span className="col-span-4 text-right pr-2 text-gray-300 flex items-center justify-end">
                      {formatTime(trade.time)}
                      <svg
                        className="h-4 w-4 ml-1 text-tertiary"
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
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CryptoExchange;
