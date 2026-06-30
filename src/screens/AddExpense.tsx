import { useStore } from "../store";
import { ExpenseForm } from "../components/ExpenseForm";

export function AddExpense({ onSaved }: { onSaved: () => void }) {
  const { online, fxCache } = useStore();
  return (
    <div className="page">
      <header className="page-head">
        <h1>Add expense</h1>
        <span className={`net-dot ${online ? "net-on" : "net-off"}`}>
          {online ? "online" : "offline"}
        </span>
      </header>
      {!online && (
        <p className="banner">
          You're offline — expenses still save to this device.
          {fxCache ? ` Using cached rates from ${fxCache.date}.` : ""}
        </p>
      )}
      <ExpenseForm onDone={onSaved} />
    </div>
  );
}
