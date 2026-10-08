import { useMemo } from "react";
import { getIntegrationIconPath, useDashboardConnections } from "./useDashboardConnections";
import { NovaConnectionsListCard, type NovaConnectionListItem } from "./NovaConnectionsListCard";

function whatsappBadgeTone(
  status: "connected" | "disconnected" | "error",
): NovaConnectionListItem["badgeTone"] {
  if (status === "connected") return "success";
  if (status === "error") return "error";
  return "muted";
}

export function NovaDashboardConnectionsRow() {
  const { isLoading, whatsappNumbers, paymentGateways, otherIntegrations } =
    useDashboardConnections();

  const whatsappItems = useMemo(
    (): NovaConnectionListItem[] =>
      whatsappNumbers.map((row) => ({
        id: row.id,
        title: row.label,
        subtitle: row.type,
        badge: row.status === "connected" ? "Active" : row.status === "error" ? "Error" : "Offline",
        badgeTone: whatsappBadgeTone(row.status),
        iconKind: "whatsapp",
      })),
    [whatsappNumbers],
  );

  const paymentItems = useMemo(
    (): NovaConnectionListItem[] =>
      paymentGateways.map((row) => ({
        id: row.id,
        title: row.displayName,
        subtitle: row.subtitle,
        badge: "Connected",
        badgeTone: "success",
        iconKind: "payment",
        iconAlt: row.displayName,
      })),
    [paymentGateways],
  );

  const integrationItems = useMemo(
    (): NovaConnectionListItem[] =>
      otherIntegrations.map((row) => ({
        id: row.id,
        title: row.displayName,
        subtitle: row.subtitle,
        badge: "Connected",
        badgeTone: "success",
        iconSrc: getIntegrationIconPath(row.name),
        iconAlt: row.displayName,
        iconKind: "image",
      })),
    [otherIntegrations],
  );

  return (
    <section className="nova-fourth-row">
      <NovaConnectionsListCard
        title="Connected WhatsApp"
        items={whatsappItems}
        isLoading={isLoading}
        emptyText="No WhatsApp numbers connected yet."
        viewAllHref="/connect"
        viewAllLabel="Connect"
      />
      <NovaConnectionsListCard
        title="Payment Gateways"
        items={paymentItems}
        isLoading={isLoading}
        emptyText="No payment gateways connected yet."
        viewAllHref="/integrations"
        viewAllLabel="Set up"
      />
      <NovaConnectionsListCard
        title="Other Integrations"
        items={integrationItems}
        isLoading={isLoading}
        emptyText="No other apps connected yet."
        viewAllHref="/integrations"
        viewAllLabel="Browse apps"
      />
    </section>
  );
}
