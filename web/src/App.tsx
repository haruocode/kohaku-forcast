import { useState } from "react";
import { AuthBar } from "./components/AuthBar";
import { PredictionsPanel } from "./features/predictions/PredictionsPanel";
import { RankingsPanel } from "./features/rankings/RankingsPanel";
import { WalletPanel } from "./features/wallet/WalletPanel";
import { AdminPanel } from "./features/admin/AdminPanel";
import { useMe } from "./hooks/useMe";

type Tab = "predict" | "ranking" | "wallet" | "admin";

export function App() {
  const { data: me = null } = useMe();
  const [tab, setTab] = useState<Tab>("predict");
  const isAdmin = me?.isAdmin ?? false;

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
        <button className={tab === "wallet" ? "active" : ""} onClick={() => setTab("wallet")}>
          ウォレット
        </button>
        {isAdmin && (
          <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}>
            管理
          </button>
        )}
      </nav>
      <main>
        {tab === "predict" && <PredictionsPanel me={me} />}
        {tab === "ranking" && <RankingsPanel />}
        {tab === "wallet" && <WalletPanel me={me} />}
        {tab === "admin" && isAdmin && <AdminPanel />}
      </main>
    </div>
  );
}
