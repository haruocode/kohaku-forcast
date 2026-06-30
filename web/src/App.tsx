import { useState } from "react";
import { AuthBar } from "./components/AuthBar";
import { PredictionsPanel } from "./features/predictions/PredictionsPanel";
import { RankingsPanel } from "./features/rankings/RankingsPanel";
import { HistoryPanel } from "./features/history/HistoryPanel";
import { useMe } from "./hooks/useMe";

type Tab = "predict" | "ranking" | "history";

export function App() {
  const { data: me = null } = useMe();
  const [tab, setTab] = useState<Tab>("predict");

  return (
    <div className="app">
      <AuthBar />
      <nav className="tabs">
        <button className={tab === "predict" ? "active" : ""} onClick={() => setTab("predict")}>
          予想
        </button>
        <button className={tab === "ranking" ? "active" : ""} onClick={() => setTab("ranking")}>
          ランキング
        </button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
          履歴
        </button>
      </nav>
      <main>
        {tab === "predict" && <PredictionsPanel me={me} />}
        {tab === "ranking" && <RankingsPanel />}
        {tab === "history" && <HistoryPanel me={me} />}
      </main>
    </div>
  );
}
