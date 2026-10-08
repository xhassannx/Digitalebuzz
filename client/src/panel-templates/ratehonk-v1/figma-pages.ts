/**
 * Nova layout Figma catalog — Untitled file (v2 redesign)
 * https://www.figma.com/design/Ho7aZJvanQlVi88TwsSZjx/Untitled
 */
const NOVA_BASE =
  "https://www.figma.com/design/Ho7aZJvanQlVi88TwsSZjx/Untitled";

/** @deprecated Rh-whatsapp file — kept for reference */
export const LEGACY_RATEHONK_FIGMA =
  "https://www.figma.com/design/ghxCXiMgnQ5J8IGhPvTPMx/Rh-whatsapp";

export const RATEHONK_FIGMA_PAGES = [
  {
    pageKey: "Dashboard" as const,
    nodeId: "307:10931",
    frameName: "Dashboard",
    figmaUrl: `${NOVA_BASE}?node-id=307-10931`,
    route: "/dashboard",
    implemented: "custom",
  },
  {
    pageKey: "Inbox" as const,
    nodeId: "371:9851",
    frameName: "Chat",
    figmaUrl: `${NOVA_BASE}?node-id=371-9851`,
    route: "/chat",
    implemented: "custom",
  },
] as const;
