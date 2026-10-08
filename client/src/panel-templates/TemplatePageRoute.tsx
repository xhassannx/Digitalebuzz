import type { ComponentType } from "react";
import { usePanelTemplate } from "./PanelTemplateProvider";
import type { PanelTemplatePageKey } from "./types";

type TemplatePageRouteProps = {
  pageKey: PanelTemplatePageKey;
  default: ComponentType;
};

export function TemplatePageRoute({ pageKey, default: DefaultPage }: TemplatePageRouteProps) {
  const { template, isLoading } = usePanelTemplate();

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: "var(--rh-brand, hsl(var(--primary)))", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  const TemplatePage = template?.pages?.[pageKey];
  if (TemplatePage) {
    return <TemplatePage />;
  }

  return <DefaultPage />;
}
