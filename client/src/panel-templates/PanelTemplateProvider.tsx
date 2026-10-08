import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  resolvePanelTemplateId,
  type PanelTemplateId,
} from "@shared/panel-templates";
import { loadPanelTemplate } from "./loadTemplate";
import type { LoadedPanelTemplate } from "./types";
import { atlasCssVars } from "./helicoptic-v1/tokens";
import { novaCssVars } from "./ratehonk-v1/tokens";

type ActivePanelTemplateResponse = {
  activePanelTemplateId: string;
};

type PanelTemplateContextValue = {
  templateId: PanelTemplateId;
  template: LoadedPanelTemplate | null;
  isLoading: boolean;
};

const PanelTemplateContext = createContext<PanelTemplateContextValue | undefined>(
  undefined,
);

const RH_VAR_KEYS = [
  ...new Set([...Object.keys(atlasCssVars), ...Object.keys(novaCssVars)]),
];

function applyRhCssVars(root: HTMLElement, id: PanelTemplateId) {
  const vars =
    id === "helicoptic-v1"
      ? atlasCssVars
      : id === "ratehonk-v1"
        ? novaCssVars
        : null;
  for (const key of RH_VAR_KEYS) {
    if (vars && key in vars) {
      root.style.setProperty(key, vars[key as keyof typeof vars]);
    } else {
      root.style.removeProperty(key);
    }
  }
}

/** Loads the single domain-wide active panel template (all organizations). */
export function PanelTemplateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [template, setTemplate] = useState<LoadedPanelTemplate | null>(null);
  const [isTemplateLoading, setIsTemplateLoading] = useState(true);

  const { data, isLoading: isQueryLoading } = useQuery<ActivePanelTemplateResponse>({
    queryKey: ["/api/panel-template/active"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/panel-template/active");
      return await res.json();
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const activePanelTemplateId = data?.activePanelTemplateId;

  useEffect(() => {
    if (!user) {
      setTemplate(null);
      setIsTemplateLoading(false);
      return;
    }
    if (isQueryLoading) return;

    let cancelled = false;
    setIsTemplateLoading(true);

    void loadPanelTemplate(activePanelTemplateId).then((loaded) => {
      if (cancelled) return;
      setTemplate(loaded);
      setIsTemplateLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [activePanelTemplateId, isQueryLoading, user]);

  useEffect(() => {
    // Apply as soon as the API id is known so loaders can use Atlas/Nova brand
    // colors before the lazy template module finishes loading.
    const id = template?.id ?? resolvePanelTemplateId(activePanelTemplateId);
    const root = document.documentElement;
    root.dataset.panelTemplate = id;

    const isRhShell = id === "ratehonk-v1" || id === "helicoptic-v1";
    if (isRhShell) {
      root.dataset.rhShell = "1";
      applyRhCssVars(root, id);
    } else {
      delete root.dataset.rhShell;
      applyRhCssVars(root, "default");
    }

    return () => {
      delete root.dataset.panelTemplate;
      delete root.dataset.rhShell;
      applyRhCssVars(root, "default");
    };
  }, [template?.id, activePanelTemplateId]);

  const value = useMemo<PanelTemplateContextValue>(
    () => ({
      templateId: template?.id ?? "default",
      template,
      isLoading: isQueryLoading || isTemplateLoading,
    }),
    [template, isQueryLoading, isTemplateLoading],
  );

  return (
    <PanelTemplateContext.Provider value={value}>
      {children}
    </PanelTemplateContext.Provider>
  );
}

export function usePanelTemplate() {
  const context = useContext(PanelTemplateContext);
  if (!context) {
    throw new Error("usePanelTemplate must be used within PanelTemplateProvider");
  }
  return context;
}
