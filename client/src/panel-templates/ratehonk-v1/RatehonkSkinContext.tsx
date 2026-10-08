import { createContext, useContext, type ReactNode } from "react";
import { useSyncExternalStore } from "react";

const RatehonkSkinContext = createContext(false);

function subscribePanelTemplate(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-panel-template", "data-rh-shell"],
  });
  return () => observer.disconnect();
}

function isRhShellTemplate(id: string | undefined) {
  return id === "ratehonk-v1" || id === "helicoptic-v1";
}

function getIsRatehonkTemplateActive() {
  const root = document.documentElement;
  return (
    root.dataset.rhShell === "1" || isRhShellTemplate(root.dataset.panelTemplate)
  );
}

export function RatehonkSkinProvider({ children }: { children: ReactNode }) {
  return (
    <RatehonkSkinContext.Provider value={true}>{children}</RatehonkSkinContext.Provider>
  );
}

/** True inside RateHonk/Atlas layout or when Nova/Atlas panel template is active. */
export function useRatehonkPageSkin(): boolean {
  const fromProvider = useContext(RatehonkSkinContext);
  const fromDocument = useSyncExternalStore(
    subscribePanelTemplate,
    getIsRatehonkTemplateActive,
    () => false,
  );
  return fromProvider || fromDocument;
}
