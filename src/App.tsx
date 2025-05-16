import "./App.css";
import Logo from "./component/icons/logo";
import TradeWebSocket from "./component/trade/TradeWebSocket";

function App() {
  return (
    <div className="bg-secondary w-[full] h-screen flex flex-col gap-1">
      {/* navbar space */}
      <div className="flex justify-between items-center p-6 bg-primary">
        <Logo className="text-white" height={34} width={120} />
      </div>
      {/* Chart space */}
      <div className="w-full flex h-full gap-1">
        <div className="flex flex-col w-[50%] gap-1">
          <div className="w-full rounded-lg h-[10%] bg-primary"></div>
          <div className="w-full rounded-lg h-full bg-primary"></div>
        </div>
        <TradeWebSocket  />
        <div className="w-[30%] bg-primary rounded-lg">
        </div>
      </div>
    </div>
  );
}

export default App;
