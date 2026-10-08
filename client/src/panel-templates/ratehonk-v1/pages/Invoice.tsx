/**
 * Nova (ratehonk-v1) — Invoice settings with Figma-aligned chrome.
 */
import InvoiceSettingsPage from "@/pages/invoice-settings-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkInvoicePage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout className="ratehonk-invoice px-6 sm:px-8 md:px-12 lg:px-16" data-ratehonk-page="Invoice">
        <RhPageHeader
          title="Invoice Settings"
          description="Manage your GST and Non-GST invoice templates, payment details, and automations."
        />
        <div className="ratehonk-invoice-content">
          <InvoiceSettingsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
