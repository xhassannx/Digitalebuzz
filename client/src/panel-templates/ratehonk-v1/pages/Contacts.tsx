/** RateHonk Contacts — full-height, table scrolls; compact chrome for more table rows */
import ContactsPage from "@/pages/contacts-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageLayout } from "../components/rh";

export default function RatehonkContactsPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout
        fullBleed
        className="ratehonk-contacts flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-4"
        data-ratehonk-page="Contacts"
      >
        <div className="ratehonk-contacts-content flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ContactsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
