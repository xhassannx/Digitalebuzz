/**
 * RateHonk Settings — Figma node 1:2910
 * https://www.figma.com/design/ghxCXiMgnQ5J8IGhPvTPMx/Rh-whatsapp?node-id=1-2910
 * Atlas (Emerald) uses the same page with helicoptic-v1 scoped chrome.
 */
import { useEffect, useState } from "react";
import SettingsPage from "@/pages/settings-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkSettingsPage() {
  const [isAtlas, setIsAtlas] = useState(false);

  useEffect(() => {
    setIsAtlas(document.documentElement.dataset.panelTemplate === "helicoptic-v1");
  }, []);

  return (
    <RatehonkSkinProvider>
      <RhPageLayout className="ratehonk-settings" data-ratehonk-page="Settings">
        <RhPageHeader
          title="Settings"
          description={
            isAtlas
              ? "Manage your account preferences and system configurations."
              : "Set up your profile, billing, team access, and organisation details."
          }
        />
        <div className="ratehonk-settings-content">
          <SettingsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
