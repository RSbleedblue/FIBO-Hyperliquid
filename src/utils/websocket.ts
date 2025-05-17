import type { TradeData } from "../types/orderAndTrade_types";

export const connectWebSocket = (
  coin: string,
  onMessage: (data: TradeData[]) => void,
  onError: (error: string) => void,
  onConnectionChange: (isConnected: boolean) => void
): WebSocket => {
  const socket = new WebSocket("wss://api.hyperliquid.xyz/ws");

  socket.onopen = () => {
    onConnectionChange(true);

    // Subscribe to trades data
    socket.send(
      JSON.stringify({
        method: "subscribe",
        subscription: { type: "trades", coin },
      })
    );
  };

  socket.onmessage = (event: MessageEvent) => {
    try {
      const response = JSON.parse(event.data);
      if (Array.isArray(response.data)) {
        onMessage(response.data);
      }
      if (response.error) onError(response.error);
    } catch (err) {
      onError("WebSocket message parse error");
    }
  };

  socket.onerror = () => {
    onConnectionChange(false);
    onError("WebSocket error");
  };

  socket.onclose = () => onConnectionChange(false);

  return socket;
}; 