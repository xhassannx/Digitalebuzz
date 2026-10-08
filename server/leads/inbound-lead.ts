/**
 * Previously auto-created an organization lead on a contact's first inbound WhatsApp message.
 * Leads are now created only when a user explicitly assigns a Lead Status from Contact Details
 * (or creates a lead manually / via import on the Leads page).
 */
export type InboundLeadParams = {
  userId: string;
  organizationId: string | undefined;
  sessionId: string;
  phoneDigits: string;
  name?: string | null;
  email?: string | null;
  source?: string;
  firstMessagePreview?: string | null;
  contactId?: string | null;
};

/** No-op: new chats/contacts do not auto-sync into Leads. */
export async function maybeCreateLeadFromInbound(_params: InboundLeadParams): Promise<void> {
  return;
}
