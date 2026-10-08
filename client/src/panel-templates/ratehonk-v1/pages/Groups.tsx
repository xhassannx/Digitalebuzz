/** RateHonk Groups — Figma node 1:1401 */
import GroupsPage from "@/pages/groups-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";
import { RhPageHeader, RhPageLayout } from "../components/rh";

export default function RatehonkGroupsPage() {
  return (
    <RatehonkSkinProvider>
      <RhPageLayout className="ratehonk-groups" data-ratehonk-page="Groups">
        <RhPageHeader
          title="Groups"
          description="Manage your contact groups for organized messaging."
        />
        <div className="ratehonk-groups-content">
          <GroupsPage />
        </div>
      </RhPageLayout>
    </RatehonkSkinProvider>
  );
}
