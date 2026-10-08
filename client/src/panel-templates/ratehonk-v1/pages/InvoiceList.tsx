/**
 * Nova (ratehonk-v1) — Invoice list
 */
import InvoiceListPage from "@/pages/invoice-list-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkInvoiceListPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout className="ratehonk-invoice-list px-6 sm:px-8 md:px-12 lg:px-16" data-ratehonk-page="InvoiceList">
        <RhPageHeader
          title="Invoice"
          description="View and manage sent invoices — search, filter, resend, and export."
        />
        <div className="ratehonk-invoice-list-content">
          <InvoiceListPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
