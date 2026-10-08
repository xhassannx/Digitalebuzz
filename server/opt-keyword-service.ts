import type { WhatsappSession, ManagedContact } from "@shared/schema";
import { storage } from "./storage";

type BroadcastFn = (userId: string, event: string, data: unknown) => void;

let broadcastToUserRef: BroadcastFn | null = null;

/** Called from registerRoutes after WebSocket broadcast helper is created. */
export function setOptKeywordBroadcaster(fn: BroadcastFn | null): void {
  broadcastToUserRef = fn;
}

function broadcastContactOptInUpdated(
  userId: string,
  payload: { contactId?: string; phoneNumber: string; optIn: boolean }
): void {
  broadcastToUserRef?.(userId, "contact_optin_updated", payload);
}

export class RecipientOptedOutError extends Error {
  constructor() {
    super("Recipient has opted out. Messages cannot be sent to this contact.");
    this.name = "RecipientOptedOutError";
  }
}

export function normalizePhoneDigits(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

function normalizeKeywordText(text: string): string {
  return String(text || "").trim().toLowerCase();
}

export function matchesOptKeyword(messageBody: string, keyword: string): boolean {
  return normalizeKeywordText(messageBody) === normalizeKeywordText(keyword);
}

export function isOptedInCustomFields(customFields?: Record<string, string> | null): boolean {
  return (customFields as Record<string, string> | null | undefined)?.optIn !== "false";
}

export function extractOptKeywordText(
  messageBody: string,
  interactive?: {
    buttonReply?: { title?: string; id?: string };
    listReply?: { title?: string; id?: string };
  }
): string {
  const body = String(messageBody || "").trim();
  if (body) return body;
  return String(
    interactive?.buttonReply?.title ||
      interactive?.listReply?.title ||
      ""
  ).trim();
}

export async function resolveOrganizationIdForSession(
  session: WhatsappSession
): Promise<string | undefined> {
  const directOrgId = (session as { organizationId?: string | null }).organizationId;
  if (directOrgId) return directOrgId;

  const integrationId = session.deviceInfo?.integrationId;
  if (integrationId) {
    const integration = await storage.getIntegration(integrationId, session.userId);
    if (integration?.organizationId) return integration.organizationId;
  }

  const orgs = await storage.getOrganizationsByUser(session.userId);
  return orgs[0]?.id;
}

export async function resolveOrganizationIdForSessionId(
  sessionId: string
): Promise<string | undefined> {
  const session = await storage.getSession(sessionId);
  if (!session) return undefined;
  return resolveOrganizationIdForSession(session);
}

function phonesMatch(storedPhone: string, incomingPhone: string): boolean {
  const normalized = normalizePhoneDigits(storedPhone);
  const incoming = normalizePhoneDigits(incomingPhone);
  if (!normalized || !incoming) return false;
  return (
    normalized === incoming ||
    normalized.endsWith(incoming) ||
    incoming.endsWith(normalized)
  );
}

export async function findManagedContactForPhone(
  organizationId: string,
  phoneNumber: string
): Promise<ManagedContact | undefined> {
  const digits = normalizePhoneDigits(phoneNumber);
  if (!digits) return undefined;

  const exact = await storage.findManagedContactByOrganizationAndPhoneDigits(organizationId, digits);
  if (exact) return exact;

  const contacts = await storage.getManagedContactsByOrganization(organizationId);
  return contacts.find((c) => phonesMatch(c.phoneNumber, phoneNumber));
}

export async function isRecipientOptedOut(
  organizationId: string | undefined,
  phoneNumber: string
): Promise<boolean> {
  if (!organizationId) return false;
  const contact = await findManagedContactForPhone(organizationId, phoneNumber);
  if (!contact) return false;
  return !isOptedInCustomFields(contact.customFields as Record<string, string> | null);
}

export async function processIncomingOptKeywords(params: {
  organizationId: string | undefined;
  userId: string;
  phoneNumber: string;
  messageBody: string;
}): Promise<"opt_in" | "opt_out" | null> {
  const { organizationId, userId, phoneNumber, messageBody } = params;
  if (!organizationId) return null;

  const text = String(messageBody || "").trim();
  if (!text) return null;

  const [optOutKeywords, optInKeywords] = await Promise.all([
    storage.getOptKeywordsByOrganization(organizationId, "opt_out"),
    storage.getOptKeywordsByOrganization(organizationId, "opt_in"),
  ]);

  const matchedOptOut = optOutKeywords.some((k) => matchesOptKeyword(text, k.keyword));
  const matchedOptIn = !matchedOptOut && optInKeywords.some((k) => matchesOptKeyword(text, k.keyword));

  let newStatus: boolean | null = null;
  if (matchedOptOut) newStatus = false;
  else if (matchedOptIn) newStatus = true;
  else return null;

  const digits = normalizePhoneDigits(phoneNumber);
  if (!digits) return null;

  let contact = await findManagedContactForPhone(organizationId, phoneNumber);
  const nextOptIn = newStatus ? "true" : "false";
  let savedContact: ManagedContact | undefined;

  if (!contact) {
    savedContact = await storage.createManagedContact(
      {
        userId,
        organizationId,
        name: digits,
        phoneNumber: digits,
        source: "whatsapp",
        customFields: { optIn: nextOptIn },
      },
      { skipAutomation: true }
    );
  } else {
    const existingFields = (contact.customFields as Record<string, string> | null) || {};
    if (existingFields.optIn !== nextOptIn) {
      savedContact =
        (await storage.updateManagedContact(
          contact.id,
          contact.userId,
          organizationId,
          { customFields: { ...existingFields, optIn: nextOptIn } },
          { skipAutomation: true }
        )) ?? contact;
    } else {
      savedContact = contact;
    }
  }

  broadcastContactOptInUpdated(userId, {
    contactId: savedContact?.id,
    phoneNumber: digits,
    optIn: newStatus,
  });

  return matchedOptOut ? "opt_out" : "opt_in";
}

/** Process opt keywords and return whether automated/outbound responses should be blocked. */
export async function handleIncomingMessageOptStatus(params: {
  organizationId?: string;
  userId: string;
  phoneNumber: string;
  messageBody: string;
  interactive?: {
    buttonReply?: { title?: string; id?: string };
    listReply?: { title?: string; id?: string };
  };
}): Promise<{ optedOut: boolean; keywordAction: "opt_in" | "opt_out" | null }> {
  const text = extractOptKeywordText(params.messageBody, params.interactive);
  const keywordAction = await processIncomingOptKeywords({
    organizationId: params.organizationId,
    userId: params.userId,
    phoneNumber: params.phoneNumber,
    messageBody: text,
  });

  if (keywordAction === "opt_out") {
    return { optedOut: true, keywordAction };
  }
  if (keywordAction === "opt_in") {
    return { optedOut: false, keywordAction };
  }

  const optedOut = await isRecipientOptedOut(params.organizationId, params.phoneNumber);
  return { optedOut, keywordAction: null };
}

export async function guardOutboundSend(sessionId: string, to: string): Promise<void> {
  if (!to || to.includes("@g.us")) return;

  const organizationId = await resolveOrganizationIdForSessionId(sessionId);
  if (!organizationId) return;

  if (await isRecipientOptedOut(organizationId, to)) {
    throw new RecipientOptedOutError();
  }
}
