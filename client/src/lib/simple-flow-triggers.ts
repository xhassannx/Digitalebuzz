import type { LinearFlowTrigger } from "@shared/linear-flow";

/**
 * Pick ids for the Contact trigger list in the simple editor (Figma parity: New + Updated only).
 * `new-contact` / `contact-updated` match the canvas `selectedTrigger` (see CONTACT_TRIGGERS).
 * `contact.tag_added` remains valid in saved `linear_flow` for existing flows; it is not offered in the picker for now.
 */
export type SimpleContactTriggerPickId = "new-contact" | "contact-updated";

export const SIMPLE_CONTACT_TRIGGER_ROWS: Array<{
  pickId: SimpleContactTriggerPickId;
  name: string;
  description: string;
}> = [
  {
    pickId: "new-contact",
    name: "New Contact",
    description: "Trigger when a new contact is created.",
  },
  {
    pickId: "contact-updated",
    name: "Contact Updated",
    description: "Trigger when a contact is updated.",
  },
];

export const SIMPLE_TRIGGER_APP_ROWS = [
  {
    id: "contact" as const,
    name: "Contact",
    description: "CRM contact events — new or updated.",
  },
  {
    id: "google_calendar" as const,
    name: "Google Calendar",
    description: "When a new calendar event is created (matches advanced editor “New event”).",
  },
  {
    id: "drip" as const,
    name: "Drip / sequence",
    description: "Start when someone enters a sequence or campaign.",
  },
];

export function linearTriggerFromContactPickId(pickId: SimpleContactTriggerPickId): LinearFlowTrigger {
  if (pickId === "new-contact") return { type: "contact.created" };
  return { type: "contact.updated" };
}

export function triggerSummary(trigger: LinearFlowTrigger): { primary: string; secondary: string } {
  switch (trigger.type) {
    case "contact.created":
      return { primary: "New Contact", secondary: "Contact" };
    case "contact.updated":
      return { primary: "Contact Updated", secondary: "Contact" };
    case "contact.tag_added":
      return { primary: "Tag added to contact", secondary: "Contact" };
    case "drip.sequence_started":
      return { primary: "Drip / sequence started", secondary: "Drip" };
    case "google_calendar.new_event":
      return { primary: "New calendar event", secondary: "Google Calendar" };
  }
}
