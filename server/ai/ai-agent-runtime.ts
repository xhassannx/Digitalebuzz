import type { AiAssistant } from "@shared/schema";
import { parseAgentRules } from "@shared/ai-agent-rules";
import { isWithinWorkingHours } from "./agent-rules";
import { buildKnowledgeContext, computeKnowledgeFingerprint } from "./knowledge-search";
import {
  bookAppointment,
  extractEmail,
  formatBookingConfirmationMessage,
  formatSlotsMessage,
  getAvailableSlots,
  isBookingIntent,
  matchSlotFromUserInput,
  type BookableSlot,
} from "./calendar-booking";
import { storage } from "../storage";
import { decryptCredentials } from "../utils/encryption";

export type ChatTurn = { role: "user" | "assistant"; content: string };

type OpenAIResult = { content: string };

/** True when the message looks mostly English (Latin letters / digits / punctuation). */
function looksPrimarilyEnglish(text: string): boolean {
  const cleaned = text.replace(/https?:\/\/\S+/gi, " ").replace(/[\d\s.,!?;:'"()[\]{}<>\/\\|_+=*&^%$#@~`…।॥\-]+/g, "");
  if (!cleaned) return true;
  const latin = (cleaned.match(/[A-Za-z]/g) || []).length;
  return latin / cleaned.length >= 0.75;
}

/**
 * Rewrite a fixed English template into the language/style of the customer's latest message.
 * Skips the API call when the customer is already writing in English.
 */
export async function localizeToUserLanguage(
  apiKey: string,
  model: string,
  userMessage: string,
  englishText: string
): Promise<string> {
  if (!englishText?.trim() || !userMessage?.trim()) return englishText;
  if (looksPrimarilyEnglish(userMessage)) return englishText;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You rewrite customer-facing WhatsApp messages. Output ONLY the rewritten message. " +
              "Match the language and script of the customer's message (e.g. Hindi → Hindi, Hinglish → Hinglish, Tamil → Tamil). " +
              "Keep meaning, links, phone numbers, and emojis unchanged. Do not add extra commentary.",
          },
          {
            role: "user",
            content: `Customer message:\n${userMessage}\n\nRewrite this reply in the same language:\n${englishText}`,
          },
        ],
        max_tokens: 512,
        temperature: 0.2,
      }),
    });
    if (!res.ok) return englishText;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content.trim() : englishText;
  } catch {
    return englishText;
  }
}

const LANGUAGE_MATCHING_RULES = `
LANGUAGE RULES (mandatory):
- Always reply in the same language as the customer's LATEST message.
- If they write in Hindi (Devanagari), reply in Hindi.
- If they write in Hinglish (Hindi in English letters), reply in Hinglish.
- If they write in English, reply in English.
- Same for any other language (Tamil, Telugu, Marathi, Gujarati, Bengali, Arabic, etc.): mirror their language.
- If they mix languages, match their mix.
- Keep facts, product names, URLs, phone numbers, and email addresses accurate; translate surrounding explanation only.
- Do not switch back to English unless the customer does.`;

async function callOpenAIWithHistory(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatTurn[],
  userMessage: string
): Promise<OpenAIResult> {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage },
  ];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o",
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error?.message || res.statusText || "OpenAI request failed");
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  return { content: typeof content === "string" ? content.trim() : "" };
}

export type AiAgentTurnResult = {
  content: string;
  contextUpdates: Record<string, unknown>;
  scheduleFollowUpAt?: number;
  scheduleTimeoutAt?: number;
};

export async function runAiAgentTurn(opts: {
  assistant: AiAssistant;
  apiKey: string;
  userMessage: string;
  context: Record<string, any>;
  organizationId?: string;
  userId: string;
  senderNumber: string;
}): Promise<AiAgentTurnResult> {
  const { assistant, apiKey, userMessage, context, organizationId, userId } = opts;
  const rules = parseAgentRules((assistant as any).agentRules);
  const contextUpdates: Record<string, unknown> = {};

  if (rules.workingHours.enabled && !isWithinWorkingHours(rules.workingHours)) {
    const afterHours = await localizeToUserLanguage(
      apiKey,
      assistant.model || "gpt-4o",
      userMessage,
      rules.workingHours.afterHoursMessage
    );
    return {
      content: afterHours,
      contextUpdates,
    };
  }

  contextUpdates.aiAssistantId = assistant.id;

  const kbFiles = await storage.getAiAssistantKnowledgeFiles(assistant.id);
  const kbFilePayload = kbFiles.map((f) => ({
    fileName: f.fileName,
    content: f.content,
    mimeType: f.mimeType || undefined,
  }));
  const knowledgeFingerprint = computeKnowledgeFingerprint(kbFilePayload, assistant.customPrompt);
  contextUpdates.knowledgeFingerprint = knowledgeFingerprint;

  // If KB/prompt changed since this chat started, drop old AI memory so replies use the new content.
  const previousFingerprint =
    context.knowledgeFingerprint != null ? String(context.knowledgeFingerprint) : null;
  const kbChanged = previousFingerprint != null && previousFingerprint !== knowledgeFingerprint;
  if (kbChanged) {
    console.log(
      `[AI Agent] Knowledge base changed for assistant ${assistant.id} — resetting chat memory (${kbFiles.length} file(s))`
    );
  }

  let history: ChatTurn[] = kbChanged
    ? []
    : Array.isArray(context.aiChatHistory)
      ? [...context.aiChatHistory]
      : [];
  const trimmedHistory = history.slice(-rules.memoryTurns * 2);

  let customerEmail = kbChanged
    ? null
    : context.customerEmail
      ? String(context.customerEmail)
      : null;
  const emailFromMessage = extractEmail(userMessage);
  if (emailFromMessage) {
    customerEmail = emailFromMessage;
    contextUpdates.customerEmail = customerEmail;
  } else if (kbChanged) {
    contextUpdates.customerEmail = null;
  }

  let offeredSlots: BookableSlot[] = kbChanged
    ? []
    : Array.isArray(context.offeredSlots)
      ? context.offeredSlots
      : [];
  if (kbChanged) {
    contextUpdates.offeredSlots = [];
    contextUpdates.selectedSlot = null;
    contextUpdates.bookingFlow = false;
    contextUpdates.bookingConfirmed = false;
  }

  // Calendar booking flow:
  // 1) Booking intent → fetch & send available slots (appointment message)
  // 2) Customer picks a slot → ask email if missing
  // 3) Email + selected slot → create Google Calendar / confirm Calendly booking
  let calendarStatusHint = "";
  if (rules.calendar.enabled && organizationId) {
    const bookingFlow =
      (!kbChanged && context.bookingFlow === true) ||
      isBookingIntent(userMessage) ||
      !!context.selectedSlot ||
      (!!customerEmail && Array.isArray(context.offeredSlots) && context.offeredSlots.length > 0);

    const pendingSlot = (!kbChanged && context.selectedSlot) || null;

    // Step 2b: slot already chosen, waiting for email
    if (bookingFlow && pendingSlot && !customerEmail && !emailFromMessage) {
      const askEmail = await localizeToUserLanguage(
        apiKey,
        assistant.model || "gpt-4o",
        userMessage,
        "Great choice! Please share your email address so I can confirm the appointment and send the invite."
      );
      contextUpdates.bookingFlow = true;
      contextUpdates.selectedSlot = pendingSlot;
      contextUpdates.aiChatHistory = [
        ...trimmedHistory,
        { role: "user", content: userMessage },
        { role: "assistant", content: askEmail },
      ];
      return {
        content: askEmail,
        contextUpdates,
        scheduleFollowUpAt: rules.followUp.enabled
          ? Date.now() + rules.followUp.delayHours * 60 * 60 * 1000
          : undefined,
      };
    }

    // Step 3: confirm booking when we have email + selected slot
    if (bookingFlow && customerEmail && pendingSlot) {
      const selected = pendingSlot as BookableSlot;
      contextUpdates.selectedSlot = selected;
      try {
        const booking = await bookAppointment({
          organizationId,
          config: rules.calendar,
          slot: selected,
          attendeeEmail: customerEmail,
          title: `Demo — ${customerEmail}`,
          timezone: rules.workingHours?.timezone,
        });
        const confirm = await localizeToUserLanguage(
          apiKey,
          assistant.model || "gpt-4o",
          userMessage,
          formatBookingConfirmationMessage(selected, customerEmail, booking)
        );
        contextUpdates.aiChatHistory = [
          ...trimmedHistory,
          { role: "user", content: userMessage },
          { role: "assistant", content: confirm },
        ];
        contextUpdates.bookingConfirmed = true;
        contextUpdates.bookingFlow = false;
        contextUpdates.bookingJoinLink = booking.joinLink;
        return { content: confirm, contextUpdates };
      } catch (e: any) {
        console.warn("[AI Agent] Book failed:", e?.message);
        calendarStatusHint = `\n\nCalendar booking error: ${e?.message || "could not create event"}. Offer the knowledge-base booking link as fallback.`;
      }
    }

    // Step 2a: match slot from user reply against offered slots
    if (bookingFlow && offeredSlots.length && !pendingSlot) {
      const selected = matchSlotFromUserInput(
        userMessage,
        offeredSlots,
        rules.workingHours?.timezone
      );
      if (selected) {
        contextUpdates.selectedSlot = selected;
        contextUpdates.bookingFlow = true;
        if (!customerEmail) {
          const askEmail = await localizeToUserLanguage(
            apiKey,
            assistant.model || "gpt-4o",
            userMessage,
            `Perfect — I've locked ${selected.label}. Please share your email so I can send the calendar invite and meeting link.`
          );
          contextUpdates.aiChatHistory = [
            ...trimmedHistory,
            { role: "user", content: userMessage },
            { role: "assistant", content: askEmail },
          ];
          return {
            content: askEmail,
            contextUpdates,
            scheduleFollowUpAt: rules.followUp.enabled
              ? Date.now() + rules.followUp.delayHours * 60 * 60 * 1000
              : undefined,
          };
        }
        try {
          const booking = await bookAppointment({
            organizationId,
            config: rules.calendar,
            slot: selected,
            attendeeEmail: customerEmail,
            title: `Demo — ${customerEmail}`,
            timezone: rules.workingHours?.timezone,
          });
          const confirm = await localizeToUserLanguage(
            apiKey,
            assistant.model || "gpt-4o",
            userMessage,
            formatBookingConfirmationMessage(selected, customerEmail, booking)
          );
          contextUpdates.aiChatHistory = [
            ...trimmedHistory,
            { role: "user", content: userMessage },
            { role: "assistant", content: confirm },
          ];
          contextUpdates.bookingConfirmed = true;
          contextUpdates.bookingJoinLink = booking.joinLink;
          return { content: confirm, contextUpdates };
        } catch (e: any) {
          console.warn("[AI Agent] Book failed:", e?.message);
          calendarStatusHint = `\n\nCalendar booking error: ${e?.message || "could not create event"}.`;
        }
      }
    }

    // Step 1: booking intent (or empty offered slots) → fetch & send live slots first
    if (
      bookingFlow &&
      !pendingSlot &&
      (!offeredSlots.length || isBookingIntent(userMessage)) &&
      !context.bookingConfirmed
    ) {
      const fetchResult = await getAvailableSlots(organizationId, rules.calendar, rules.workingHours);
      if (fetchResult.slots.length > 0) {
        offeredSlots = fetchResult.slots;
        contextUpdates.offeredSlots = offeredSlots;
        contextUpdates.bookingFlow = true;
        contextUpdates.selectedSlot = null;
        const slotMsg = await localizeToUserLanguage(
          apiKey,
          assistant.model || "gpt-4o",
          userMessage,
          formatSlotsMessage(
            offeredSlots,
            "I'd be happy to help you book an appointment. Here are the available slots from our calendar:",
            rules.workingHours?.timezone
          )
        );
        contextUpdates.aiChatHistory = [
          ...trimmedHistory,
          { role: "user", content: userMessage },
          { role: "assistant", content: slotMsg },
        ];
        return {
          content: slotMsg,
          contextUpdates,
          scheduleFollowUpAt: rules.followUp.enabled
            ? Date.now() + rules.followUp.delayHours * 60 * 60 * 1000
            : undefined,
        };
      }
      // Slots unavailable — fall through to KB/LLM with clear status (booking link in KB)
      calendarStatusHint =
        `\n\nIn-chat calendar slots are unavailable (${fetchResult.error || "no open slots"}). ` +
        `Follow the knowledge base: share the booking / demo appointment message and booking link. ` +
        `Do not claim live calendar slots are available.`;
      console.warn("[AI Agent] Slot fetch empty:", fetchResult.error || "no slots");
      contextUpdates.bookingFlow = true;
    }
  } else if (rules.calendar.enabled && !organizationId) {
    calendarStatusHint =
      "\n\nCalendar booking could not run (missing organization). Share the knowledge-base booking link instead.";
  }

  const kbText = buildKnowledgeContext(kbFilePayload, userMessage, rules.useKnowledgeSearch);

  let calendarHint = "";
  if (offeredSlots.length) {
    calendarHint = `\n\nOffered slots (user may pick one):\n${offeredSlots.map((s) => `- ${s.label}`).join("\n")}`;
  }
  if (customerEmail) {
    calendarHint += `\n\nCustomer email on file: ${customerEmail}`;
  }
  if (calendarStatusHint) {
    calendarHint += calendarStatusHint;
  }

  const systemPrompt =
    (assistant.customPrompt || "You are a helpful assistant.").trim() +
    kbText +
    calendarHint +
    LANGUAGE_MATCHING_RULES +
    "\n\nIMPORTANT — The knowledge base above is your script, not just reference material. " +
    "If it defines a conversation flow, steps, or an order of questions (e.g. greet first, then ask about booking, then ask for name/email), you MUST follow that exact order on every conversation. " +
    "Do not skip steps and do not answer out of order. Ask one thing at a time as the flow specifies." +
    "\nMaintain conversation context. Be polite and professional. Guide customers to book demos/appointments when the flow says so." +
    "\nUse ONLY the knowledge base for facts. Ignore any older product/service details from prior turns if they conflict." +
    "\nWhen using knowledge base content written in English, explain it in the customer's language — do not force English replies." +
    "\nWhen the customer asks to book/schedule and live slots are listed above, present those slots. When slots are unavailable, use the booking appointment message and link from the knowledge base.";

  const result = await callOpenAIWithHistory(
    apiKey,
    assistant.model || "gpt-4o",
    systemPrompt,
    trimmedHistory,
    userMessage
  );

  const aiContent = result.content || "I could not generate a response. Please try again.";
  const newHistory = [
    ...trimmedHistory,
    { role: "user" as const, content: userMessage },
    { role: "assistant" as const, content: aiContent },
  ];
  contextUpdates.aiChatHistory = newHistory.slice(-rules.memoryTurns * 2);
  contextUpdates.aiAgentLastActivityAt = Date.now();
  if (rules.followUp.enabled) {
    contextUpdates.aiAgentFollowUpMessage = rules.followUp.message;
  }
  return {
    content: aiContent,
    contextUpdates,
    scheduleFollowUpAt:
      rules.followUp.enabled && !(kbChanged ? false : context.bookingConfirmed)
        ? Date.now() + rules.followUp.delayHours * 60 * 60 * 1000
        : undefined,
  };
}

export async function resolveAssistantApiKey(
  assistant: AiAssistant,
  userId: string
): Promise<string | null> {
  let apiKey: string | null = null;
  if (assistant.openaiIntegrationId) {
    const integration = await storage.getIntegration(assistant.openaiIntegrationId, userId);
    const creds = integration?.credentials ? decryptCredentials(integration.credentials) : null;
    apiKey = creds?.apiKey ?? null;
  }
  if (!apiKey && assistant.openaiApiKeyOverride) {
    apiKey = assistant.openaiApiKeyOverride;
  }
  return apiKey;
}
