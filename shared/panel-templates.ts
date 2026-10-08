/** Registered WhatsApp panel UI templates (code lives in client/src/panel-templates/). */
export const PANEL_TEMPLATE_IDS = ["default", "helicoptic-v1", "ratehonk-v1"] as const;

export type PanelTemplateId = (typeof PANEL_TEMPLATE_IDS)[number];

export const DEFAULT_PANEL_TEMPLATE_ID: PanelTemplateId = "default";

export const PANEL_TEMPLATE_CATALOG: ReadonlyArray<{
  id: PanelTemplateId;
  name: string;
  description: string;
  /** Listed in admin template gallery. */
  enabled: boolean;
  /** Preview image under /panel-templates/thumbnails/{id}.png (optional). */
  thumbnail?: string;
}> = [
  {
    id: "default",
    name: "Standard Layout",
    description: "Classic gradient sidebar and familiar navigation.",
    enabled: true,
    thumbnail: "/panel-templates/thumbnails/default.svg?v=2",
  },
  {
    id: "helicoptic-v1",
    name: "Emerald Green Layout",
    description:
      "Emerald green shell — light sidebar, card-based pages, and green accents.",
    enabled: true,
    thumbnail: "/panel-templates/thumbnails/helicoptic-v1.svg?v=2",
  },
  {
    id: "ratehonk-v1",
    name: "Nova Layout",
    description: "Light sidebar, card-based pages, and mobile-friendly inbox.",
    enabled: true,
    thumbnail: "/panel-templates/thumbnails/ratehonk-v1.svg?v=2",
  },
];

export function isPanelTemplateId(value: unknown): value is PanelTemplateId {
  return (
    typeof value === "string" &&
    (PANEL_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export function resolvePanelTemplateId(
  value: string | null | undefined,
): PanelTemplateId {
  if (value && isPanelTemplateId(value)) {
    const entry = PANEL_TEMPLATE_CATALOG.find((t) => t.id === value);
    if (entry?.enabled) return value;
  }
  return DEFAULT_PANEL_TEMPLATE_ID;
}

export function getPanelTemplateCatalogEntry(id: PanelTemplateId | string) {
  return PANEL_TEMPLATE_CATALOG.find((t) => t.id === id);
}

/** Human-readable label for admin UI (not the internal id slug). */
export function getPanelTemplateDisplayName(id: PanelTemplateId | string): string {
  return getPanelTemplateCatalogEntry(id)?.name ?? String(id);
}

export function getPanelTemplateDescription(id: PanelTemplateId | string): string {
  return getPanelTemplateCatalogEntry(id)?.description ?? "";
}

