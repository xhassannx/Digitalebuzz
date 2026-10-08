import InvoiceListPage from "@/pages/invoice-list-page";

/** Invoice → Recurring payment: outstanding invoices with due amounts. */
export default function InvoiceRecurringPage() {
  return <InvoiceListPage mode="recurring" />;
}
