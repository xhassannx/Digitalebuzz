/**
 * Maps simple-flow catalog `appId` → canvas-style sub-actions (same ids as advanced editor).
 */

const ICONS = {
  sheets: "/icons/icon_1_spreadsheet_x32.png",
  contacts: "/icons/google-contact.png",
  calendly: "/icons/calendly.svg",
  openai: "/icons/openai.png",
  gemini: "/icons/gemini.jpg",
  whatsapp: "/icons/whatsapp.svg",
} as const;

export type SimpleFlowCanvasAction = {
  id: string;
  name: string;
  description: string;
  icon: string | null;
};

export const GOOGLE_SHEETS_SIMPLE_ACTIONS: SimpleFlowCanvasAction[] = [
  {
    id: "create-spreadsheet",
    name: "Create spreadsheet",
    description: "Create a blank spreadsheet or duplicate an existing one. Optionally, provide headers.",
    icon: ICONS.sheets,
  },
  {
    id: "create-spreadsheet-row",
    name: "Create spreadsheet row",
    description: "Creates a new row in a specified spreadsheet.",
    icon: ICONS.sheets,
  },
  {
    id: "create-worksheet",
    name: "Create worksheet",
    description: "Create a blank worksheet with a title. Optionally, provide headers.",
    icon: ICONS.sheets,
  },
  {
    id: "find-worksheet",
    name: "Find worksheet",
    description: "Finds a worksheet by title. Optionally, create a worksheet if none are found.",
    icon: ICONS.sheets,
  },
  {
    id: "find-row",
    name: "Find Row",
    description: "Find a row in a Google Sheet",
    icon: ICONS.sheets,
  },
  {
    id: "update-row",
    name: "Update Row",
    description: "Update a row in a Google Sheet.",
    icon: ICONS.sheets,
  },
];

/** Google Calendar is trigger-only in the product; no sub-actions in the simple editor. */
export const GOOGLE_CALENDAR_SIMPLE_ACTIONS: SimpleFlowCanvasAction[] = [];

export const GOOGLE_CONTACTS_SIMPLE_ACTIONS: SimpleFlowCanvasAction[] = [
  {
    id: "create-google-contact",
    name: "Create contact",
    description: "Create a new contact in Google Contacts.",
    icon: ICONS.contacts,
  },
  {
    id: "update-google-contact",
    name: "Update contact",
    description: "Update an existing Google Contact.",
    icon: ICONS.contacts,
  },
  {
    id: "custom-request-google-contacts",
    name: "Custom request",
    description: "Execute custom API requests.",
    icon: ICONS.contacts,
  },
];

export const CALENDLY_SIMPLE_ACTIONS: SimpleFlowCanvasAction[] = [
  {
    id: "cancel-event",
    name: "Cancel Event",
    description: "Cancel a scheduled event in Calendly.",
    icon: ICONS.calendly,
  },
  {
    id: "custom-request",
    name: "Custom request",
    description: "Execute custom API requests using the authorized connections.",
    icon: ICONS.calendly,
  },
];

export const OPENAI_SIMPLE_ACTIONS: SimpleFlowCanvasAction[] = [
  {
    id: "openai-chat",
    name: "Chat completion",
    description: "Generate a response using OpenAI Chat API.",
    icon: ICONS.openai,
  },
  {
    id: "openai-generate",
    name: "Generate text",
    description: "Generate text using OpenAI completions.",
    icon: ICONS.openai,
  },
  {
    id: "custom-request-openai",
    name: "Custom request",
    description: "Execute custom API requests.",
    icon: ICONS.openai,
  },
];

export const GOOGLE_GEMINI_SIMPLE_ACTIONS: SimpleFlowCanvasAction[] = [
  {
    id: "gemini-generate",
    name: "Generate content",
    description: "Generate content using Google Gemini.",
    icon: ICONS.gemini,
  },
  {
    id: "gemini-chat",
    name: "Chat",
    description: "Chat with Gemini model.",
    icon: ICONS.gemini,
  },
  {
    id: "custom-request-gemini",
    name: "Custom request",
    description: "Execute custom API requests.",
    icon: ICONS.gemini,
  },
];

/** Workspace CRM Contact app (canvas `contact-helicopticsolutions` actions). */
export const CONTACT_CRM_SIMPLE_ACTIONS: SimpleFlowCanvasAction[] = [
  {
    id: "update-contact",
    name: "Update Contact",
    description: "Update an existing workspace contact.",
    icon: null,
  },
  {
    id: "get-contact",
    name: "Get Contact",
    description: "Fetch a contact by ID or phone.",
    icon: null,
  },
  {
    id: "create-contact",
    name: "Create Contact",
    description: "Create a new contact in your workspace.",
    icon: null,
  },
  {
    id: "auto-assign-contact",
    name: "Auto Assign Contact",
    description: "Assign a contact to a team member (round-robin style).",
    icon: null,
  },
  {
    id: "add-note",
    name: "Add Note",
    description: "Add a note to a contact.",
    icon: null,
  },
  {
    id: "add-tag",
    name: "Add Tag",
    description: "Add a tag to a contact.",
    icon: null,
  },
  {
    id: "custom-request-contact",
    name: "Custom request",
    description: "Call your workspace API with a custom HTTP request.",
    icon: null,
  },
];

export const WHATSAPP_SIMPLE_ACTIONS: SimpleFlowCanvasAction[] = [
  {
    id: "send-message",
    name: "Send message",
    description: "Number from message is sent.",
    icon: ICONS.whatsapp,
  },
  {
    id: "send-template",
    name: "Send Template",
    description: "Number from template is sent.",
    icon: ICONS.whatsapp,
  },
  {
    id: "send-media",
    name: "Send Media",
    description: "Number from media message is sent.",
    icon: ICONS.whatsapp,
  },
  {
    id: "wait-for-reply",
    name: "Wait for Reply",
    description: "Wait for a reply from the user.",
    icon: ICONS.whatsapp,
  },
];

export const DELAY_SIMPLE_ACTIONS: SimpleFlowCanvasAction[] = [
  {
    id: "delay-for",
    name: "Delay for",
    description: "Delays the execution of the next action by a specified amount of time.",
    icon: null,
  },
  {
    id: "delay-until",
    name: "Delay until",
    description: "Delays the execution of the next action until a specified date and time (ISO).",
    icon: null,
  },
];

const SIMPLE_APP_ACTIONS: Record<string, SimpleFlowCanvasAction[] | undefined> = {
  delay: DELAY_SIMPLE_ACTIONS,
  contact: CONTACT_CRM_SIMPLE_ACTIONS,
  google_sheet: GOOGLE_SHEETS_SIMPLE_ACTIONS,
  google_calendar: GOOGLE_CALENDAR_SIMPLE_ACTIONS,
  google_contacts: GOOGLE_CONTACTS_SIMPLE_ACTIONS,
  calendly: CALENDLY_SIMPLE_ACTIONS,
  openai: OPENAI_SIMPLE_ACTIONS,
  google_gemini: GOOGLE_GEMINI_SIMPLE_ACTIONS,
  whatsapp: WHATSAPP_SIMPLE_ACTIONS,
};

/** Apps that open a second “Select action” sheet like the canvas editor. */
export function getCanvasActionsForSimpleApp(appId: string): SimpleFlowCanvasAction[] | null {
  const list = SIMPLE_APP_ACTIONS[appId];
  return list && list.length > 0 ? list : null;
}

export function findCanvasAction(appId: string, actionId: string): SimpleFlowCanvasAction | undefined {
  return getCanvasActionsForSimpleApp(appId)?.find((a) => a.id === actionId);
}
