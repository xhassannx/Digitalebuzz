import type { ManagedContact } from "@shared/schema";

export type ManagedContactWriteOptions = {
  /**
   * When true, never run canvas flows for this write.
   * Use for: chat sync, WhatsApp auto-CRM, bulk assign-only, campaign upserts, chatbot columns, payment side-effects.
   *
   * Omit (default) for: manual Contacts UI, CSV import, social lead create/update, Project API contact writes,
   * WhatsApp inbound auto-create (fires new-contact / contact-updated flows).
   * Each run still targets only that one contact id/phone — never all contacts in the org.
   */
  skipAutomation?: boolean;
};

const DISPATCH_DEBOUNCE_MS = 5000;
const lastDispatchAt = new Map<string, number>();

export function shouldDispatchContactAutomation(
  kind: "new-contact" | "contact-updated",
  contactId: string
): boolean {
  const key = `${kind}:${contactId}`;
  const now = Date.now();
  const prev = lastDispatchAt.get(key);
  if (prev != null && now - prev < DISPATCH_DEBOUNCE_MS) {
    console.log(
      `[Automation] ${kind} debounced for contact ${contactId} (${DISPATCH_DEBOUNCE_MS}ms window)`
    );
    return false;
  }
  lastDispatchAt.set(key, now);
  return true;
}

const MEANINGFUL_SCALAR_KEYS = ["name", "phoneNumber", "email", "notes", "source"] as const;

/** True when a user-facing field actually changed (not no-op or assignment-only metadata). */
export function isMeaningfulManagedContactUpdate(
  before: ManagedContact,
  patch: Record<string, unknown>
): boolean {
  for (const key of MEANINGFUL_SCALAR_KEYS) {
    if (patch[key] === undefined) continue;
    const next = patch[key] == null ? "" : String(patch[key]);
    const prev =
      key === "phoneNumber"
        ? String(before.phoneNumber ?? "").replace(/\D/g, "")
        : String((before as Record<string, unknown>)[key] ?? "");
    const nextNorm = key === "phoneNumber" ? next.replace(/\D/g, "") : next;
    if (nextNorm !== prev) return true;
  }

  if (patch.customFields !== undefined && typeof patch.customFields === "object" && patch.customFields) {
    const patchCf = patch.customFields as Record<string, unknown>;
    const keys = Object.keys(patchCf);
    const assignmentOnly =
      keys.length > 0 && keys.every((k) => ["assignedTo", "assignedAt", "assignedBy"].includes(k));
    if (assignmentOnly) return false;

    const merged = { ...(before.customFields as Record<string, unknown> | null), ...patchCf };
    if (JSON.stringify(before.customFields ?? {}) !== JSON.stringify(merged)) {
      return true;
    }
  }

  return false;
}
