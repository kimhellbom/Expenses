import { useState } from "react";
import { StoreProvider, useStore } from "./store";
import { TabBar, type Tab } from "./components/TabBar";
import { AddExpense } from "./screens/AddExpense";
import { History } from "./screens/History";
import { Stats } from "./screens/Stats";
import { Settings } from "./screens/Settings";

function Shell() {
  const [tab, setTab] = useState<Tab>("add");
  const { ready } = useStore();

  if (!ready) {
    return (
      <div className="loading">
        <span className="loading-mark">£</span>
      </div>
    );
  }

  return (
    <div className="app">
      <main className="screen">
        {tab === "add" && <AddExpense onSaved={() => setTab("history")} />}
        {tab === "history" && <History />}
        {tab === "stats" && <Stats />}
        {tab === "settings" && <Settings />}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
