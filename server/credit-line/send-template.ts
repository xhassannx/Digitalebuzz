import type { WalletMetaCategory } from "@shared/schema";
import { resolveOrganizationIdForSession } from "../wallet/service";
import { storage } from "../storage";
import { getOrgWhatsappBilling } from "./org-billing";
import { getCreditLineProviderConfig } from "./provider-config";
import { getCreditLineProvider } from "./providers/registry";
import type { CreditLineSendTemplateResult } from "./providers/types";

export type TemplateSendRoute =
  | { via: "graph" }
  | {
      via: "credit_line";
      providerId: string;
      wabaId: string;
      useMmLite: boolean;
    };

/**
 * Template sends for credit_line orgs go through the supplier middleware.
 * Template CRUD and session/custom messages stay on Meta Graph.
 */
export async function resolveTemplateSendRoute(sessionId: string): Promise<TemplateSendRoute> {
  const session = await storage.getSession(sessionId);
  if (!session || session.connectionType !== "official") return { via: "graph" };

  const organizationId = await resolveOrganizationIdForSession(session, session.userId, null);
  if (!organizationId) return { via: "graph" };

  const billing = await getOrgWhatsappBilling(organizationId);
  if (billing.billingMode !== "credit_line") return { via: "graph" };

  const providerId = (billing.creditLineProvider || "interakt").trim();
  const cfg = await getCreditLineProviderConfig(providerId);
  if (!cfg) {
    console.warn(
      `[CreditLine] Org ${organizationId} is credit_line/${providerId} but provider is disabled or missing token — falling back to Graph`
    );
    return { via: "graph" };
  }
  if (!getCreditLineProvider(providerId)) {
    console.warn(`[CreditLine] No adapter registered for provider ${providerId}`);
    return { via: "graph" };
  }

  const wabaId =
    billing.creditLineWabaId ||
    session.deviceInfo?.businessAccountId ||
    (session.deviceInfo as any)?.apiBusinessAccountId ||
    "";
  // Credentials on Business API manager store businessAccountId — also try settings
  let resolvedWaba = String(wabaId || "").trim();
  if (!resolvedWaba) {
    try {
      const settings = await storage.getUserSettings(session.userId);
      resolvedWaba = String(settings?.whatsappBusinessCredentials?.businessAccountId || "").trim();
    } catch {
      /* ignore */
    }
  }
  if (!resolvedWaba) {
    console.warn(`[CreditLine] No WABA id for session ${sessionId} — falling back to Graph`);
    return { via: "graph" };
  }

  return {
    via: "credit_line",
    providerId,
    wabaId: resolvedWaba,
    useMmLite: cfg.mmLiteEnabled !== false,
  };
}

export async function sendTemplateViaCreditLine(params: {
  providerId: string;
  phoneNumberId: string;
  wabaId: string;
  body: Record<string, unknown>;
  metaCategory?: WalletMetaCategory;
  forceMmLite?: boolean;
}): Promise<CreditLineSendTemplateResult> {
  const cfg = await getCreditLineProviderConfig(params.providerId);
  const provider = getCreditLineProvider(params.providerId);
  if (!cfg || !provider) {
    return {
      ok: false,
      status: 0,
      responseText: `Credit-line provider "${params.providerId}" is not available`,
    };
  }

  const useMmLite =
    params.forceMmLite === true ||
    (params.forceMmLite !== false &&
      (params.metaCategory === "marketing" || params.metaCategory === undefined) &&
      cfg.mmLiteEnabled !== false);

  // Only force MM Lite for marketing; utility/auth use CAPI /messages on supplier
  const effectiveMmLite =
    params.metaCategory === "utility" || params.metaCategory === "authentication"
      ? false
      : params.metaCategory === "marketing"
        ? cfg.mmLiteEnabled !== false
        : useMmLite && cfg.mmLiteEnabled !== false;

  return provider.sendTemplate(cfg, {
    phoneNumberId: params.phoneNumberId,
    wabaId: params.wabaId,
    body: params.body,
    useMmLite: effectiveMmLite,
  });
}
