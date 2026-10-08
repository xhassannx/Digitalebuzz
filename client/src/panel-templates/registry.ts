import {
  PANEL_TEMPLATE_CATALOG,
  type PanelTemplateId,
  resolvePanelTemplateId,
} from "@shared/panel-templates";
import type { PanelTemplateModule } from "./types";

export { PANEL_TEMPLATE_CATALOG, resolvePanelTemplateId };
export type { PanelTemplateId };

type TemplateLoader = () => Promise<{ default: PanelTemplateModule }>;

/** Lazy loaders — only the active organization's template bundle is imported. */
export const panelTemplateLoaders: Record<PanelTemplateId, TemplateLoader> = {
  default: () => import("./default"),
  "helicoptic-v1": () => import("./helicoptic-v1"),
  "ratehonk-v1": () => import("./ratehonk-v1"),
};

export function getEnabledPanelTemplates() {
  return PANEL_TEMPLATE_CATALOG.filter((t) => t.enabled);
}
