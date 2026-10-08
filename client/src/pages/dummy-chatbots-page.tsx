import { useMemo, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhSearchField } from "@/panel-templates/ratehonk-v1/components/rh";
import {
  DUMMY_CHATBOT_MORE_REGIONS,
  DUMMY_CHATBOT_PRIMARY_REGIONS,
  DUMMY_CHATBOT_TEMPLATES,
  DummyChatbotTemplatesGrid,
  type DummyChatbotRegionId,
  type DummyChatbotTemplate,
} from "@/components/dummy-chatbot-templates";
import { DummyChatbotFlowPreviewDialog } from "@/components/dummy-chatbot-flow-preview";
import {
  cloneDummyChatbotFlow,
  getDummyChatbotFlow,
} from "@/components/dummy-chatbot-flows";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { toastPlanLimitOrError } from "@/lib/plan-limit-toast";
import { cn } from "@/lib/utils";

type DummyWhatsappSession = {
  sessionId: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  connectionType?: string;
};

async function resolveWhatsappSessionForDummyChatbot(): Promise<DummyWhatsappSession | null> {
  try {
    const phonesRes = await apiRequest("GET", "/api/integrations/whatsapp-business/added-phones");
    const phonesData = await phonesRes.json();
    const phones = Array.isArray(phonesData?.phoneNumbers) ? phonesData.phoneNumbers : [];
    const phone = phones.find((item: { sessionId?: string; status?: string }) => item.sessionId && item.status !== "disconnected");
    if (phone?.sessionId) {
      return {
        sessionId: phone.sessionId,
        phoneNumberId: phone.phoneNumberId,
        displayPhoneNumber: phone.displayPhoneNumber,
        connectionType: "official",
      };
    }
  } catch {
    // Fall through to sessions API.
  }

  try {
    const sessionsRes = await apiRequest("GET", "/api/sessions");
    const sessions = await sessionsRes.json();
    const list = Array.isArray(sessions) ? sessions : [];
    const session = list.find(
      (item: { sessionId?: string; status?: string; deletedAt?: string | Date | null }) =>
        item.sessionId && item.status === "connected" && !item.deletedAt,
    );
    if (session?.sessionId) {
      return {
        sessionId: session.sessionId,
        phoneNumberId: session.deviceInfo?.apiPhoneNumberId,
        displayPhoneNumber: session.deviceInfo?.displayPhoneNumber || session.deviceInfo?.phoneNumber,
        connectionType: session.connectionType || "official",
      };
    }
  } catch {
    return null;
  }

  return null;
}

export default function DummyChatbotsPage() {
  const skin = useRatehonkPageSkin();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRegion, setActiveRegion] = useState<"all" | DummyChatbotRegionId>("all");
  const [showMoreRegions, setShowMoreRegions] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<DummyChatbotTemplate | null>(null);
  const [createTemplate, setCreateTemplate] = useState<DummyChatbotTemplate | null>(null);
  const [chatbotName, setChatbotName] = useState("");

  const primaryBtnClass = skin
    ? "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white"
    : "";
  const outlineBtnClass = skin ? "rounded-xl border-[#e5e7eb]" : "";

  const visibleRegions = [
    ...DUMMY_CHATBOT_PRIMARY_REGIONS,
    ...(showMoreRegions ? DUMMY_CHATBOT_MORE_REGIONS : []),
  ];

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return DUMMY_CHATBOT_TEMPLATES.filter((template) => {
      if (activeRegion !== "all" && template.region !== activeRegion) return false;
      if (!query) return true;
      const haystack = [
        template.title,
        template.subtitle,
        template.description,
        template.badge,
        template.region,
        ...template.tags,
        ...template.features.map((feature) => feature.label),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [searchQuery, activeRegion]);

  const previewFlow = previewTemplate ? getDummyChatbotFlow(previewTemplate.id) : null;

  const openCreateDialog = (template: DummyChatbotTemplate) => {
    setPreviewTemplate(null);
    setCreateTemplate(template);
    setChatbotName(template.title);
  };

  const createFromTemplateMutation = useMutation({
    mutationFn: async ({ template, name }: { template: DummyChatbotTemplate; name: string }) => {
      const flow = getDummyChatbotFlow(template.id);
      if (!flow) {
        throw new Error("This dummy chatbot template is not available yet.");
      }

      const whatsapp = await resolveWhatsappSessionForDummyChatbot();
      const createRes = await apiRequest("POST", "/api/chatbots", {
        name: name.trim() || flow.name,
        status: whatsapp ? "published" : "draft",
        ...(whatsapp ? { sessionId: whatsapp.sessionId } : {}),
      });
      const created = await createRes.json();
      if (!created?.id) {
        throw new Error("Chatbot created but no ID was returned.");
      }

      const clonedNodes = cloneDummyChatbotFlow(flow.nodes).map((node) => {
        if (node.nodeType !== "trigger" || !whatsapp) return node;
        return {
          ...node,
          data: {
            ...node.data,
            triggerSessionIds: [whatsapp.sessionId],
            triggerSessionId: whatsapp.sessionId,
            triggerPhoneNumberId: whatsapp.phoneNumberId || "",
            triggerDisplayPhoneNumber: whatsapp.displayPhoneNumber || "",
            triggerConnectionType: whatsapp.connectionType || "",
          },
        };
      });
      await apiRequest("POST", `/api/chatbots/${created.id}/nodes`, {
        nodes: clonedNodes.map((node) => ({
          id: node.id,
          chatbotId: created.id,
          nodeType: node.nodeType,
          position: node.position,
          data: node.data,
          connections: node.connections,
        })),
      });

      return { chatbot: created as { id: string; name?: string }, hasWhatsapp: !!whatsapp };
    },
    onSuccess: ({ chatbot, hasWhatsapp }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chatbots"] });
      setCreateTemplate(null);
      setPreviewTemplate(null);
      toast({
        title: "Chatbot created",
        description: hasWhatsapp
          ? `${chatbot.name || "Dummy chatbot"} is published with your WhatsApp number. Message that number to test the flow.`
          : "Flow loaded as draft. Connect WhatsApp, select a phone on On Message, then publish to test.",
      });
      if (chatbot?.id) {
        setLocation(`/chatbots/${chatbot.id}`);
      }
    },
    onError: (error: unknown) => {
      toastPlanLimitOrError(toast, error, "Failed to create chatbot");
    },
  });

  const handleCreateSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!createTemplate) return;
    const name = chatbotName.trim();
    if (!name) {
      toast({
        title: "Chatbot name is required",
        description: "Please enter a name for this chatbot.",
        variant: "destructive",
      });
      return;
    }
    createFromTemplateMutation.mutate({ template: createTemplate, name });
  };

  return (
    <div className={cn("flex flex-1 flex-col space-y-6", skin ? "" : "p-6")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="chatbots-page-chrome min-w-0 space-y-4">
          <div className="text-sm text-muted-foreground">Dashboard &gt; Chatbots &gt; Dummy Chatbots</div>
          <div>
            <h1 className="text-3xl font-bold">Dummy Chatbots</h1>
            <p className="mt-1 text-muted-foreground">
              Preview dummy chatbot templates and use them in your flows.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(skin && "ml-auto", outlineBtnClass)}
          onClick={() => setLocation("/chatbots")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Chatbots
        </Button>
      </div>

      {skin ? (
        <RhSearchField
          className="max-w-sm"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search dummy chatbots…"
        />
      ) : (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search dummy chatbots..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {visibleRegions.map((region) => {
          const isActive = activeRegion === region.id;
          return (
            <button
              key={region.id}
              type="button"
              onClick={() => setActiveRegion(region.id)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-[var(--rh-brand,#047857)] bg-[var(--rh-brand,#047857)] text-white"
                  : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[var(--rh-brand,#047857)] hover:text-[var(--rh-brand,#047857)]",
              )}
            >
              {region.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setShowMoreRegions((open) => {
              const next = !open;
              if (!next && DUMMY_CHATBOT_MORE_REGIONS.some((region) => region.id === activeRegion)) {
                setActiveRegion("all");
              }
              return next;
            });
          }}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            showMoreRegions
              ? "border-[var(--rh-brand,#047857)] bg-[color-mix(in_srgb,var(--rh-brand,#047857)_12%,white)] text-[var(--rh-brand,#047857)]"
              : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[var(--rh-brand,#047857)] hover:text-[var(--rh-brand,#047857)]",
          )}
        >
          {showMoreRegions ? "Less" : "+ More"}
        </button>
      </div>

      <DummyChatbotTemplatesGrid
        templates={filteredTemplates}
        primaryBtnClass={primaryBtnClass}
        outlineBtnClass={outlineBtnClass}
        onFlowPreview={setPreviewTemplate}
        onUseTemplate={openCreateDialog}
      />

      <DummyChatbotFlowPreviewDialog
        open={!!previewTemplate}
        flow={previewFlow}
        onOpenChange={(open) => {
          if (!open) setPreviewTemplate(null);
        }}
        onUseTemplate={() => {
          if (previewTemplate) openCreateDialog(previewTemplate);
        }}
        usingTemplate={createFromTemplateMutation.isPending}
        primaryBtnClass={primaryBtnClass}
      />

      <Dialog
        open={!!createTemplate}
        onOpenChange={(open) => {
          if (!open && !createFromTemplateMutation.isPending) {
            setCreateTemplate(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Chatbot</DialogTitle>
            <DialogDescription>
              Create this dummy template as a new chatbot. The selected flow will be loaded in the builder.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Chatbot Name</label>
                <Input
                  value={chatbotName}
                  onChange={(e) => setChatbotName(e.target.value)}
                  placeholder="Enter chatbot name"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateTemplate(null)}
                disabled={createFromTemplateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createFromTemplateMutation.isPending} className={primaryBtnClass}>
                {createFromTemplateMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
