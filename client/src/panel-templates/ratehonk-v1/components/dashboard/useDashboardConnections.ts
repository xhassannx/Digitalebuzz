import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getIntegrationIconPath, isPaymentGateway } from "@/lib/integration-icons";
import type { Integration } from "@shared/schema";

export type WhatsAppConnectionItem = {
  id: string;
  label: string;
  type: "Business API" | "WhatsApp Web";
  status: "connected" | "disconnected" | "error";
};

export type IntegrationListItem = {
  id: string;
  name: string;
  displayName: string;
  status: Integration["status"];
  subtitle?: string;
};

const WHATSAPP_INTEGRATION_NAME = "whatsapp-business";

type SessionRow = {
  sessionId: string;
  status: string;
  connectionType?: string;
  deviceInfo?: {
    displayPhoneNumber?: string;
    phoneNumber?: string;
    verifiedName?: string;
    name?: string;
  };
};

function sessionPhoneLabel(session: SessionRow): string {
  const info = session.deviceInfo;
  return (
    info?.displayPhoneNumber ||
    info?.phoneNumber ||
    info?.verifiedName ||
    info?.name ||
    session.sessionId.slice(0, 8)
  );
}

export function useDashboardConnections() {
  const sessionsQuery = useQuery<SessionRow[]>({
    queryKey: ["/api/sessions", "dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sessions");
      return res.json();
    },
    staleTime: 30_000,
  });

  const integrationsQuery = useQuery<Integration[]>({
    queryKey: ["/api/integrations", "dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations");
      return res.json();
    },
    staleTime: 30_000,
  });

  const businessPhonesQuery = useQuery<{
    success?: boolean;
    phoneNumbers?: Array<{
      phoneNumberId?: string;
      displayPhoneNumber?: string;
      verifiedName?: string;
    }>;
  }>({
    queryKey: ["/api/integrations/whatsapp-business/added-phones", "dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/whatsapp-business/added-phones");
      return res.json();
    },
    staleTime: 30_000,
  });

  const whatsappNumbers = useMemo(() => {
    const items: WhatsAppConnectionItem[] = [];
    const seen = new Set<string>();

    for (const session of sessionsQuery.data ?? []) {
      const label = sessionPhoneLabel(session);
      const key = label.replace(/\D/g, "") || session.sessionId;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: session.sessionId,
        label,
        type: session.connectionType === "official" ? "Business API" : "WhatsApp Web",
        status:
          session.status === "connected"
            ? "connected"
            : session.status === "error"
              ? "error"
              : "disconnected",
      });
    }

    for (const phone of businessPhonesQuery.data?.phoneNumbers ?? []) {
      const label =
        phone.displayPhoneNumber || phone.verifiedName || phone.phoneNumberId || "Business number";
      const key = label.replace(/\D/g, "") || phone.phoneNumberId || label;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: phone.phoneNumberId || key,
        label,
        type: "Business API",
        status:
          phone.status === "connected" || phone.status === "connecting"
            ? "connected"
            : phone.status === "error"
              ? "error"
              : "disconnected",
      });
    }

    return items.sort((a, b) => {
      if (a.status === "connected" && b.status !== "connected") return -1;
      if (b.status === "connected" && a.status !== "connected") return 1;
      return a.label.localeCompare(b.label);
    });
  }, [sessionsQuery.data, businessPhonesQuery.data]);

  const connectedIntegrations = useMemo(
    () => (integrationsQuery.data ?? []).filter((i) => i.status === "connected"),
    [integrationsQuery.data],
  );

  const paymentGateways = useMemo((): IntegrationListItem[] => {
    return connectedIntegrations
      .filter((i) => isPaymentGateway(i.name))
      .map((i) => ({
        id: i.id,
        name: i.name,
        displayName: i.displayName || i.name,
        status: i.status,
        subtitle:
          typeof i.config?.connectionName === "string" && i.config.connectionName.trim()
            ? i.config.connectionName.trim()
            : undefined,
      }));
  }, [connectedIntegrations]);

  const otherIntegrations = useMemo((): IntegrationListItem[] => {
    return connectedIntegrations
      .filter((i) => !isPaymentGateway(i.name) && i.name !== WHATSAPP_INTEGRATION_NAME)
      .map((i) => ({
        id: i.id,
        name: i.name,
        displayName: i.displayName || i.name,
        status: i.status,
        subtitle: i.category === "flow" ? "Automation" : i.category === "helper" ? "Helper" : "Featured",
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [connectedIntegrations]);

  const isLoading =
    sessionsQuery.isLoading || integrationsQuery.isLoading || businessPhonesQuery.isLoading;

  return {
    isLoading,
    whatsappNumbers,
    paymentGateways,
    otherIntegrations,
  };
}

export { getIntegrationIconPath };
