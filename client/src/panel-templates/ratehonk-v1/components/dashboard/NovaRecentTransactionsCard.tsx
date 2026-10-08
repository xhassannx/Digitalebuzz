import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useContactPaymentRequests } from "@/features/transactions/useContactPaymentRequests";
import {
  formatTransactionAmount,
  formatTransactionId,
  getTransactionDisplayStatus,
} from "@/features/transactions/contact-payment-types";

export function NovaRecentTransactionsCard() {
  const { data: rows = [], isLoading } = useContactPaymentRequests(8);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayRows = useMemo(() => rows.slice(0, 8), [rows]);

  return (
    <div className="nova-panel-card nova-recent-txn flex h-full min-h-[280px] flex-col p-4 sm:p-5">
      <div className="nova-recent-txn__header">
        <h2 className="nova-recent-txn__title">Recent Transaction</h2>
        <button
          type="button"
          className="nova-recent-txn__filter"
          aria-label="Filter transactions by period"
        >
          Today
          <ChevronDown className="h-3.5 w-3.5 text-[#9ca3af]" />
        </button>
      </div>

      {isLoading ? (
        <div className="nova-recent-txn__loading">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--rh-brand)]" />
        </div>
      ) : displayRows.length === 0 ? (
        <p className="nova-recent-txn__empty">No transactions yet.</p>
      ) : (
        <ul className="nova-recent-txn__list">
          {displayRows.map((row) => {
            const status = getTransactionDisplayStatus(row.status);
            const when = row.paidAt || row.createdAt;
            const timeLabel = when ? format(new Date(when), "MMM dd, h:mm a") : "—";
            const checked = selected.has(row.id);

            return (
              <li key={row.id} className="nova-recent-txn__row">
                <label className="nova-recent-txn__check">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(row.id)}
                    className="nova-recent-txn__checkbox"
                  />
                </label>
                <span className="nova-recent-txn__id">{formatTransactionId(row)}</span>
                <span className="nova-recent-txn__amount">{formatTransactionAmount(row)}</span>
                <span className={`nova-recent-txn__status nova-recent-txn__status--${status}`}>
                  <span className="nova-recent-txn__status-dot" aria-hidden />
                  {status === "paid" ? "Paid" : status === "failed" ? "Failed" : "Pending"}
                </span>
                <span className="nova-recent-txn__time">{timeLabel}</span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="nova-recent-txn__footer">
        <Link href="/transactions" className="nova-recent-txn__view-all">
          View all transactions
        </Link>
      </div>
    </div>
  );
}
