import { useState } from "react";
import { StoreProvider, useStore } from "./store";
import { TabBar, type Tab } from "./components/TabBar";
import { AddExpense } from "./screens/AddExpense";
import { History } from "./screens/History";
import { Stats } from "./screens/Stats";
import { Settings } from "./screens/Settings";
import { ReviewCaptures } from "./screens/ReviewCaptures";

function Shell() {
  const [tab, setTab] = useState<Tab>("add");
  const [reviewing, setReviewing] = useState(false);
  const { ready } = useStore();

  if (!ready) {
    return (
      <div className="loading">
        <span className="loading-mark">£</span>
      </div>
    );
  }

  const openReview = () => setReviewing(true);

  return (
    <div className="app">
      <main className="screen">
        {reviewing ? (
          <ReviewCaptures onDone={() => setReviewing(false)} />
        ) : (
          <>
            {tab === "add" && <AddExpense onSaved={() => setTab("history")} />}
            {tab === "history" && <History onReview={openReview} />}
            {tab === "stats" && <Stats />}
            {tab === "settings" && <Settings onReview={openReview} />}
          </>
        )}
      </main>
      <TabBar active={tab} onChange={(t) => { setReviewing(false); setTab(t); }} />
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
