// @ts-nocheck
import type { AutomationFlow, ManagedContact } from "@shared/schema";
import { storage } from "../storage";
import { contactContextPayload } from "./context-builders";

function orgId(flow: AutomationFlow): string {
  return String(flow.organizationId || "");
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Resolve contact from step config or flow context (trigger/contact). */
export async function resolveManagedContactForFlow(
  cfg: Record<string, unknown>,
  flow: AutomationFlow,
  runContext: Record<string, unknown>
): Promise<ManagedContact | undefined> {
  const organizationId = orgId(flow);
  const userId = flow.userId;
  const searchBy = String(cfg.searchByIdOrPhone || "").trim();
  const idOrPhone = String(cfg.contactIdOrPhone || "").trim();

  if (idOrPhone) {
    if (searchBy === "id") {
      if (organizationId) {
        return storage.getManagedContactByOrganization(idOrPhone, organizationId);
      }
      return storage.getManagedContact(idOrPhone, userId, organizationId);
    }
    const digits = normalizePhoneDigits(idOrPhone);
    if (organizationId && digits) {
      return storage.findManagedContactByOrganizationAndPhoneDigits(organizationId, digits);
    }
  }

  const ctxContact = runContext.contact as Record<string, unknown> | undefined;
  const trigger = runContext.trigger as Record<string, unknown> | undefined;
  if (ctxContact?.id && organizationId) {
    const byId = await storage.getManagedContactByOrganization(String(ctxContact.id), organizationId);
    if (byId) return byId;
  }
  const phone = String(
    ctxContact?.phone || ctxContact?.phoneNumber || trigger?.phone || trigger?.from || ""
  );
  const digits = normalizePhoneDigits(phone);
  if (organizationId && digits) {
    return storage.findManagedContactByOrganizationAndPhoneDigits(organizationId, digits);
  }
  return undefined;
}

function mergeCustomFields(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> {
  return { ...(existing || {}), ...patch };
}

function parseTagNamesFromConfig(cfg: Record<string, unknown>): string[] {
  const raw = cfg.tags ?? cfg.tag ?? cfg.tagName ?? cfg.value;
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

async function applyContactTagsFromConfig(
  contactId: string,
  cfg: Record<string, unknown>,
  flow: AutomationFlow
): Promise<string[]> {
  const names = parseTagNamesFromConfig(cfg);
  if (!names.length) return [];

  const organizationId = orgId(flow);
  const userId = flow.userId;
  const allTags = await storage.getContactTagsByUser(userId, organizationId);
  const existing = await storage.getContactTags(contactId, userId, organizationId);
  const existingIds = new Set(existing.map((t) => t.id));
  const applied: string[] = [];

  for (const tagName of names) {
    let tag = allTags.find((t) => (t.name || "").toLowerCase() === tagName.toLowerCase());
    if (!tag) {
      tag = await storage.createContactTag({ userId, organizationId, name: tagName });
    }
    if (!existingIds.has(tag.id)) {
      try {
        await storage.assignTagToContact(contactId, tag.id, userId, organizationId);
        existingIds.add(tag.id);
      } catch {
        // Ignore duplicate assignment races.
      }
    }
    applied.push(String(tag.name || tagName));
  }
  return applied;
}

async function syncContactContext(
  contact: ManagedContact,
  flow: AutomationFlow,
  runContext: Record<string, unknown>
): Promise<void> {
  const organizationId = orgId(flow);
  const tags = organizationId
    ? await storage.getContactTags(contact.id, flow.userId, organizationId)
    : [];
  Object.assign(
    runContext,
    contactContextPayload(contact as unknown as Record<string, unknown>, tags)
  );
}

export async function executeContactCreate(
  cfg: Record<string, unknown>,
  flow: AutomationFlow,
  runContext: Record<string, unknown>
): Promise<ManagedContact> {
  const organizationId = orgId(flow);
  if (!organizationId) throw new Error("Create contact requires an organization-scoped flow");

  const firstName = String(cfg.firstName || "").trim();
  const lastName = String(cfg.lastName || "").trim();
  const name =
    String(cfg.name || "").trim() || `${firstName} ${lastName}`.trim() || "Contact";
  const phone = String(cfg.phone || cfg.phoneNumber || "").trim();
  if (!phone) {
    const fromCtx = runContext.trigger as Record<string, unknown> | undefined;
    const fallback = String(fromCtx?.phone || fromCtx?.from || "");
    if (!fallback) throw new Error("Create contact: phone is required");
    cfg.phone = fallback;
  }
  const phoneNumber = normalizePhoneDigits(String(cfg.phone || cfg.phoneNumber));

  const customFields: Record<string, unknown> = {};
  if (cfg.assignTo) customFields.assignedTo = String(cfg.assignTo);
  if (cfg.company) customFields.company = String(cfg.company);
  if (cfg.jobTitle) customFields.jobTitle = String(cfg.jobTitle);
  if (cfg.status) customFields.status = String(cfg.status);

  const created = await storage.createManagedContact(
    {
      userId: flow.userId,
      organizationId,
      name,
      phoneNumber,
      email: cfg.email ? String(cfg.email) : undefined,
      source: cfg.source ? String(cfg.source) : "flow",
      notes: cfg.notes ? String(cfg.notes) : undefined,
      customFields: Object.keys(customFields).length ? customFields : undefined,
    },
    { skipAutomation: true }
  );

  await applyContactTagsFromConfig(created.id, cfg, flow);
  await syncContactContext(created, flow, runContext);
  return created;
}

export async function executeContactUpdate(
  cfg: Record<string, unknown>,
  flow: AutomationFlow,
  runContext: Record<string, unknown>
): Promise<ManagedContact | undefined> {
  const organizationId = orgId(flow);
  if (!organizationId) throw new Error("Update contact requires organization");

  const contact = await resolveManagedContactForFlow(cfg, flow, runContext);
  if (!contact) throw new Error("Update contact: contact not found");

  const patch: Record<string, unknown> = {};
  if (cfg.name) patch.name = String(cfg.name);
  if (cfg.email) patch.email = String(cfg.email);
  if (cfg.source) patch.source = String(cfg.source);
  if (cfg.notes) patch.notes = String(cfg.notes);

  const cf = mergeCustomFields(contact.customFields as Record<string, unknown>, {});
  if (cfg.assignTo) cf.assignedTo = String(cfg.assignTo);
  if (cfg.status) cf.status = String(cfg.status);
  if (cfg.assignTo || cfg.status) patch.customFields = cf;

  const updated = await storage.updateManagedContact(
    contact.id,
    flow.userId,
    organizationId,
    patch as Parameters<typeof storage.updateManagedContact>[3],
    { skipAutomation: true }
  );
  if (updated) {
    await applyContactTagsFromConfig(updated.id, cfg, flow);
    await syncContactContext(updated, flow, runContext);
  }
  return updated;
}

export async function executeContactGet(
  cfg: Record<string, unknown>,
  flow: AutomationFlow,
  runContext: Record<string, unknown>
): Promise<ManagedContact | undefined> {
  const contact = await resolveManagedContactForFlow(cfg, flow, runContext);
  if (!contact) throw new Error("Get contact: contact not found");
  await syncContactContext(contact, flow, runContext);
  return contact;
}

export async function executeContactAddNote(
  cfg: Record<string, unknown>,
  flow: AutomationFlow,
  runContext: Record<string, unknown>
): Promise<void> {
  const organizationId = orgId(flow);
  const note = String(cfg.note || "").trim();
  if (!note) throw new Error("Add note: note text is required");

  const contact = await resolveManagedContactForFlow(cfg, flow, runContext);
  if (!contact) throw new Error("Add note: contact not found");

  await storage.createContactNote({
    contactId: contact.id,
    userId: flow.userId,
    organizationId,
    message: note,
  });
}

export async function executeContactAddTag(
  cfg: Record<string, unknown>,
  flow: AutomationFlow,
  runContext: Record<string, unknown>
): Promise<{ tagNames: string[] }> {
  const organizationId = orgId(flow);
  if (!organizationId) throw new Error("Add tag requires organization");

  const contact = await resolveManagedContactForFlow(cfg, flow, runContext);
  if (!contact) throw new Error("Add tag: contact not found");

  const tagNames = await applyContactTagsFromConfig(contact.id, cfg, flow);
  if (!tagNames.length) throw new Error("Add tag: tag name is required");

  await syncContactContext(contact, flow, runContext);
  return { tagNames };
}

export async function executeContactAutoAssign(
  cfg: Record<string, unknown>,
  flow: AutomationFlow,
  runContext: Record<string, unknown>
): Promise<ManagedContact | undefined> {
  const organizationId = orgId(flow);
  if (!organizationId) throw new Error("Auto assign requires organization");

  const contact = await resolveManagedContactForFlow(cfg, flow, runContext);
  if (!contact) throw new Error("Auto assign: contact not found");

  let assignTo = String(cfg.assignTo || "").trim();
  if (!assignTo) {
    const members = await storage.getOrganizationMembers(organizationId);
    const userIds = members.map((m) => m.userId).filter(Boolean);
    if (userIds.length === 0) throw new Error("Auto assign: no organization members");
    const idx =
      Math.abs(normalizePhoneDigits(contact.phoneNumber).length) % userIds.length;
    assignTo = userIds[idx];
  }

  const cf = mergeCustomFields(contact.customFields as Record<string, unknown>, {
    assignedTo: assignTo,
  });
  const updated = await storage.updateManagedContact(
    contact.id,
    flow.userId,
    organizationId,
    { customFields: cf },
    { skipAutomation: true }
  );
  if (updated) {
    await syncContactContext(updated, flow, runContext);
  }
  return updated;
}

export async function executeHttpCustomRequest(
  cfg: Record<string, unknown>
): Promise<{ success: boolean; status: number; body: unknown }> {
  const method = String(cfg.method || "GET").toUpperCase();
  const url = String(cfg.url || "").trim();
  if (!url) throw new Error("Custom request: URL is required");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.headers && typeof cfg.headers === "object") {
    for (const [k, v] of Object.entries(cfg.headers as Record<string, unknown>)) {
      if (v != null) headers[k] = String(v);
    }
  }

  let body: string | undefined;
  const dataRaw = cfg.data ?? cfg.body;
  if (dataRaw != null && method !== "GET") {
    body = typeof dataRaw === "string" ? dataRaw : JSON.stringify(dataRaw);
  }

  const res = await fetch(url, { method, headers, body });
  let parsed: unknown = null;
  const text = await res.text();
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { success: res.ok, status: res.status, body: parsed };
}
