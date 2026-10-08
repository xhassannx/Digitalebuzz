import { resolvePanelTemplateId } from "@shared/panel-templates";
import { panelTemplateLoaders } from "./registry";
import type { LoadedPanelTemplate, PanelTemplateModule, PanelTemplatePages } from "./types";

let defaultModulePromise: Promise<PanelTemplateModule> | null = null;

async function loadDefaultModule(): Promise<PanelTemplateModule> {
  if (!defaultModulePromise) {
    defaultModulePromise = panelTemplateLoaders.default().then((m) => m.default);
  }
  return defaultModulePromise;
}

export async function loadPanelTemplate(
  templateId: string | null | undefined,
): Promise<LoadedPanelTemplate> {
  const resolvedId = resolvePanelTemplateId(templateId);
  const defaultModule = await loadDefaultModule();

  try {
    const loader = panelTemplateLoaders[resolvedId];
    const loaded = await loader();
    const mod = loaded.default;
    return {
      id: resolvedId,
      meta: mod.meta,
      Layout: mod.Layout,
      pages: {
        ...(defaultModule.pages ?? {}),
        ...(mod.pages ?? {}),
      } as PanelTemplatePages,
    };
  } catch (error) {
    console.error(`[panel-templates] Failed to load "${resolvedId}", using default`, error);
    return {
      id: "default",
      meta: defaultModule.meta,
      Layout: defaultModule.Layout,
      pages: defaultModule.pages,
    };
  }
}
