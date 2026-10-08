function iso(d: unknown): string {
  if (d == null) return "";
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

type ContactTagLike = { id?: string; name?: string | null };

/** Flatten managed contact + aliases used in flow templates and router conditions. */
export function contactContextPayload(
  contact: Record<string, unknown>,
  tags: ContactTagLike[] = []
): Record<string, unknown> {
  const phone = String(contact.phoneNumber ?? contact.phone ?? "");
  const digits = phone.replace(/\D/g, "");
  const e164 = digits ? (digits.length >= 10 ? `+${digits}` : phone) : phone;
  const fullName = String(contact.name ?? "").trim();
  const spaceIdx = fullName.indexOf(" ");
  const firstName = spaceIdx === -1 ? fullName : fullName.slice(0, spaceIdx);
  const lastName = spaceIdx === -1 ? "" : fullName.slice(spaceIdx + 1).trim();
  const customFields = (contact.customFields ?? {}) as Record<string, unknown>;
  const tagNames = tags.map((t) => String(t.name ?? "").trim()).filter(Boolean);
  const base = {
    id: contact.id,
    name: fullName,
    firstName,
    lastName,
    phone,
    phoneNumber: phone,
    phoneE164: e164,
    email: contact.email ?? "",
    source: contact.source ?? "",
    notes: contact.notes ?? "",
    status: String(customFields.status ?? ""),
    tags: tagNames,
    tagNames: tagNames.join(", "),
    customFields,
    createdAt: iso(contact.createdAt),
    updatedAt: iso(contact.updatedAt),
  };
  return { contact: base, trigger: base };
}
