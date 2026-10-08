import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, LayoutTemplate } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  getPanelTemplateDescription,
  getPanelTemplateDisplayName,
  type PanelTemplateId,
} from "@shared/panel-templates";
import { cn } from "@/lib/utils";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { usePanelTemplate } from "@/panel-templates/PanelTemplateProvider";
import { PanelTemplateDashboardPreview } from "./panel-template-dashboard-preview";

type TemplateCatalogItem = {
  id: PanelTemplateId;
  name: string;
  description: string;
  enabled: boolean;
  thumbnail?: string;
};

type PanelTemplatesResponse = {
  templates: TemplateCatalogItem[];
  activePanelTemplateId: PanelTemplateId;
};

export default function AdminPanelTemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const skin = useRatehonkPageSkin();
  const { templateId } = usePanelTemplate();
  const isAtlas = templateId === "helicoptic-v1";

  const { data, isLoading } = useQuery<PanelTemplatesResponse>({
    queryKey: ["/api/admin/panel-templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/panel-templates");
      return await res.json();
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (panelTemplateId: PanelTemplateId) => {
      const res = await apiRequest("PUT", "/api/admin/panel-templates/active", {
        panelTemplateId,
      });
      return await res.json();
    },
    onSuccess: (_data, panelTemplateId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/panel-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/panel-template/active"] });
      toast({
        title: "Panel template activated",
        description: `${getPanelTemplateDisplayName(panelTemplateId)} is now live for all organizations on this domain.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to activate template",
        variant: "destructive",
      });
    },
  });

  const templates = (data?.templates ?? []).map((t) => ({
    ...t,
    name: getPanelTemplateDisplayName(t.id),
    description: getPanelTemplateDescription(t.id) || t.description,
  }));
  const activeId = data?.activePanelTemplateId ?? "default";
  const activeName = getPanelTemplateDisplayName(activeId);

  const primaryBtn = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white border-transparent"
    : "";

  return (
    <div
      className={cn(
        "admin-panel-templates-page mx-auto max-w-7xl space-y-8 p-6 md:p-8",
        skin && "admin-panel-templates-page--rh",
        isAtlas && "admin-panel-templates-page--atlas",
      )}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div
            className={cn(
              "mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl",
              skin
                ? "bg-[var(--rh-brand-soft,#ecfdf5)] text-[var(--rh-brand,#047857)]"
                : "bg-muted text-muted-foreground",
            )}
          >
            <LayoutTemplate className="h-5 w-5" />
          </div>
          <h1
            className={cn(
              "mb-2 text-3xl font-semibold tracking-tight",
              skin && "text-[#111c2d]",
            )}
          >
            Panel templates
          </h1>
          <p className={cn("max-w-2xl text-sm leading-6", skin ? "text-[#717786]" : "text-muted-foreground")}>
            One template is active for every organization on this domain. Pick a layout below — all
            customers see the same panel shell.
            {activeName ? (
              <>
                {" "}
                Currently active:{" "}
                <span
                  className={cn(
                    "font-semibold",
                    skin ? "text-[var(--rh-brand)]" : "text-foreground",
                  )}
                >
                  {activeName}
                </span>
                .
              </>
            ) : null}
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2
            className={cn(
              "h-8 w-8 animate-spin",
              skin ? "text-[var(--rh-brand)]" : "text-muted-foreground",
            )}
          />
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const isActive = t.id === activeId;
            return (
              <Card
                key={t.id}
                className={cn(
                  "admin-panel-template-card overflow-hidden transition-all duration-200",
                  skin &&
                    "rounded-2xl border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
                  skin &&
                    !isActive &&
                    "hover:border-[color-mix(in_srgb,var(--rh-brand)_35%,#e5e7eb)] hover:shadow-[0_8px_24px_rgba(16,24,40,0.08)]",
                  isActive &&
                    (skin
                      ? "border-[var(--rh-brand)] shadow-[0_0_0_1px_var(--rh-brand),0_8px_24px_color-mix(in_srgb,var(--rh-brand)_18%,transparent)]"
                      : "ring-2 ring-primary shadow-md"),
                )}
              >
                <div
                  className={cn(
                    "relative aspect-[16/10] overflow-hidden border-b",
                    skin ? "border-[#eef2f1] bg-[#f8faf9]" : "border-b bg-muted",
                  )}
                >
                  <PanelTemplateDashboardPreview templateId={t.id} />
                  {isActive && (
                    <Badge
                      className={cn(
                        "absolute right-3 top-3 z-10 gap-1 shadow-sm",
                        skin
                          ? "border-transparent bg-[var(--rh-brand)] text-white hover:bg-[var(--rh-brand)]"
                          : "bg-primary",
                      )}
                    >
                      <Check className="h-3 w-3" />
                      Active
                    </Badge>
                  )}
                </div>
                <CardHeader className="space-y-1.5 pb-2 pt-5">
                  <CardTitle className={cn("text-lg", skin && "text-[#111c2d]")}>{t.name}</CardTitle>
                  <CardDescription className={cn("text-sm leading-relaxed", skin && "text-[#717786]")}>
                    {t.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-5">
                  <Button
                    className={cn(
                      "w-full rounded-xl",
                      isActive
                        ? skin
                          ? "border border-[#e5e7eb] bg-[#f3f4f6] text-[#414754] hover:bg-[#f3f4f6]"
                          : ""
                        : primaryBtn,
                    )}
                    variant={isActive ? "secondary" : "default"}
                    disabled={isActive || activateMutation.isPending}
                    onClick={() => activateMutation.mutate(t.id)}
                  >
                    {activateMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {isActive ? "Currently active" : "Activate for all"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
