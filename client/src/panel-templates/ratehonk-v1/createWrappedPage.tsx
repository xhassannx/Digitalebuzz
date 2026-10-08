import type { ComponentType } from "react";
import { RatehonkSkinProvider } from "./RatehonkSkinContext";
import { RhPageLayout } from "./components/rh/RhPageLayout";

type WrappedPageOptions = {
  DefaultPage: ComponentType;
  fullBleed?: boolean;
};

/**
 * Renders the default page with RateHonk typography and component skinning.
 * Business logic stays in the shared page; visual chrome matches Figma via page-skin.css.
 */
export function createRatehonkSkinPage({
  DefaultPage,
  fullBleed = false,
}: WrappedPageOptions): ComponentType {
  function RatehonkSkinPage() {
    return (
      <RatehonkSkinProvider>
        <RhPageLayout fullBleed={fullBleed} className="ratehonk-page-skin">
          <DefaultPage />
        </RhPageLayout>
      </RatehonkSkinProvider>
    );
  }
  RatehonkSkinPage.displayName = `RatehonkSkin(${DefaultPage.displayName || DefaultPage.name || "Page"})`;
  return RatehonkSkinPage;
}
