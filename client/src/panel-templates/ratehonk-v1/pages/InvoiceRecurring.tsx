/**
 * Nova (ratehonk-v1) — Recurring payment (due invoices)
 */
import InvoiceRecurringPage from "@/pages/invoice-recurring-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkInvoiceRecurringPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout className="ratehonk-invoice-recurring px-6 sm:px-8 md:px-12 lg:px-16" data-ratehonk-page="InvoiceRecurring">
        <RhPageHeader
          title="Recurring payment"
          description="Track invoices with outstanding due amounts — search, filter, resend, and export."
        />
        <div className="ratehonk-invoice-recurring-content">
          <InvoiceRecurringPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
