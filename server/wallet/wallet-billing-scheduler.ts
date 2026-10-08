import { runWalletLowBalanceEmailTick } from "./low-balance-alerts";
import { runMonthlyReconciliationReminderTick } from "./reconciliation";

const DAY_MS = 24 * 60 * 60 * 1000;

export function startWalletBillingScheduler(): void {
  const run = async () => {
    try {
      await runWalletLowBalanceEmailTick();
    } catch (e: any) {
      console.error("[WalletBilling] low-balance tick:", e?.message || e);
    }
    try {
      await runMonthlyReconciliationReminderTick();
    } catch (e: any) {
      console.error("[WalletBilling] reconciliation reminder:", e?.message || e);
    }
  };

  void run();
  setInterval(() => void run(), DAY_MS);
  console.log("[WalletBilling] Scheduler started (daily low-balance + reconciliation reminder)");
}
