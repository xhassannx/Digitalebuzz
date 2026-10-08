// @ts-nocheck
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { buildPublicUploadPath, saveUploadBuffer } from '../utils/media-storage';
import { storage } from '../storage';
import { decryptCredentials } from '../utils/encryption';
import { whatsappManager as unofficialManager } from '../whatsapp/client';
import { businessAPIManager, type TemplateMetaForAuth } from '../whatsapp/business-api-client';
import { fromZonedTime } from 'date-fns-tz';
import type { Chatbot, ChatbotNode } from '@shared/schema';
import { appendGoogleSheetRowWithIntegration } from '../automation/executor';
import { runAiAgentTurn, resolveAssistantApiKey, localizeToUserLanguage } from '../ai/ai-agent-runtime';
import { isWithinWorkingHours, parseWorkingHoursCondition } from '../ai/agent-rules';
import { parseAgentRules } from '@shared/ai-agent-rules';

/**
 * Managed contacts & columns are scoped by organization. Sessions are org-scoped via
 * `whatsapp_sessions.organization_id` when present; otherwise we fall back to the chatbot org
 * and then the user's first organization.
 */
async function resolveCrmOrganizationId(
  userId: string,
  chatbot: Chatbot,
  priorFromContext?: string | undefined
): Promise<string | undefined> {
  const prior = priorFromContext?.trim();
  if (prior) return prior;
  const botOrg = chatbot.organizationId?.trim();
  if (botOrg) return botOrg;
  const orgs = await storage.getOrganizationsByUser(userId);
  return orgs[0]?.id?.trim() || undefined;
}

/**
 * Resolve gallery/public URLs to bytes — same rules as Cloud API send-by-link (path or https).
 */
async function loadChatbotMediaFromUrl(url: string): Promise<{ buffer: Buffer; fileName: string }> {
  const trimmed = url.trim();
  const isFullUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://');
  const isPathOnly = trimmed.startsWith('/uploads/') && !isFullUrl;
  if (isPathOnly) {
    const fs = await import('fs');
    const path = await import('path');
    let resolvedPath = trimmed;
    try {
      resolvedPath = decodeURIComponent(resolvedPath);
    } catch {
      // keep original
    }
    const filePath = path.join(process.cwd(), resolvedPath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local file not found: ${resolvedPath}`);
    }
    return { buffer: fs.readFileSync(filePath), fileName: path.basename(filePath) };
  }
  if (isFullUrl) {
    const res = await fetch(trimmed, { redirect: 'follow' });
    if (!res.ok) {
      throw new Error(`Failed to fetch media from URL: ${res.status} ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const disp = res.headers.get('content-disposition');
    const match = disp && disp.match(/filename[*]?=(?:UTF-8'')?["']?([^"'\s]+)["']?/i);
    const fileName =
      match?.[1]?.trim() ||
      trimmed.split('/').pop()?.split('?')[0] ||
      'file';
    return { buffer, fileName };
  }
  throw new Error(
    `Invalid media URL for chatbot: ${trimmed}. Use https://... or a path starting with /uploads/`,
  );
}

/** MIME hint for sendMediaMessage — keeps audio/video/image/document aligned with manual chat sends. */
function mimeHintForChatbotKind(
  mediaKind: string,
  fileName: string
): string | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    webm: 'video/webm',
    '3gp': 'video/3gpp',
    mp3: 'audio/mpeg',
    mpeg: 'audio/mpeg',
    mpg: 'audio/mpeg',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    wav: 'audio/wav',
    aac: 'audio/aac',
    amr: 'audio/amr',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  // `.mpeg` / `.mpg` from WhatsApp exports may be MP3 or OGG — mime must come from server-side magic bytes, not the extension.
  if (ext === 'mpeg' || ext === 'mpg') return undefined;
  const fromExt = map[ext];
  if (fromExt) return fromExt;
  if (mediaKind === 'audio') return 'audio/mpeg';
  return undefined;
}

/**
 * Same as POST /api/messages/send-media: copy bytes to uploads/{org}/messages/ so the inbox
 * uses a same-origin /uploads/... URL. Storing only remote gallery URLs breaks the panel when
 * fetch returns HTML (login/SPA) or VITE_BASE_URL host mismatches.
 */
async function persistChatbotOutgoingMedia(
  sessionId: string,
  buffer: Buffer,
  fileName: string
): Promise<string | null> {
  try {
    const session = await storage.getSession(sessionId);
    const organizationId = session?.organizationId;
    if (!organizationId) {
      return null;
    }
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(fileName) || '';
    const base = path.basename(fileName, ext) || 'media';
    const filename = `${base}-${uniqueSuffix}${ext}`;
    const publicPath = buildPublicUploadPath(organizationId, "messages", filename);
    await saveUploadBuffer(publicPath, buffer);
    return publicPath;
  } catch (e: any) {
    console.warn('[Chatbot Executor] persistChatbotOutgoingMedia failed:', e?.message || e);
    return null;
  }
}

const CONFIDENCE_INSTRUCTION = `
IMPORTANT: You must start your reply with exactly one line in this format:
CONFIDENCE: high
or
CONFIDENCE: medium
or
CONFIDENCE: low
Then a newline, then your actual reply. Use "low" when you are unsure or the question is outside your knowledge; "medium" when partially sure; "high" when confident. Never omit this line.`;

type OpenAIResult = { content: string; confidence: 'high' | 'medium' | 'low' };

async function callOpenAI(apiKey: string, model: string, systemPrompt: string, userMessage: string, includeConfidence: boolean): Promise<OpenAIResult> {
  const fullSystem = includeConfidence ? systemPrompt.trim() + '\n' + CONFIDENCE_INSTRUCTION : systemPrompt;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      messages: [
        { role: 'system', content: fullSystem },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || res.statusText || 'OpenAI request failed');
  }
  const data = await res.json();
  let content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return { content: '', confidence: 'low' };
  content = content.trim();

  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (includeConfidence) {
    const match = content.match(/^CONFIDENCE:\s*(high|medium|low)\s*$/im);
    if (match) {
      confidence = match[1].toLowerCase() as 'high' | 'medium' | 'low';
      content = content.replace(/^CONFIDENCE:\s*(high|medium|low)\s*\n?/im, '').trim();
    }
  }
  return { content, confidence };
}

// Helper to normalize phone numbers for comparison
function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace('@c.us', '').replace('@g.us', '').replace(/^\+/, '').trim();
}

/** Match sender against CRM contact phones using normalized digit comparison with suffix tolerance. */
function findManagedContactBySender(
  contacts: Array<{ phoneNumber?: string | null }>,
  senderNumber: string,
): (typeof contacts)[number] | undefined {
  const normalizedSender = normalizePhoneNumber(senderNumber).replace(/\D/g, '');
  return contacts.find((c) => {
    const normalized = (c.phoneNumber || '').replace(/\D/g, '');
    if (!normalized || !normalizedSender) return false;
    return (
      normalized === normalizedSender ||
      normalized.endsWith(normalizedSender) ||
      normalizedSender.endsWith(normalized)
    );
  });
}

// In-memory FAQ welcome tracking (per session + contact)
const faqWelcomeSentKeys = new Set<string>();

function getFaqContactKey(sessionId: string, senderNumber: string): string {
  return `${sessionId}:${normalizePhoneForKey(senderNumber)}`;
}

/** Send FAQ matched reply (text or media). */
async function sendFaqMatchedAnswer(
  manager: any,
  sessionId: string,
  senderNumber: string,
  item: { answer?: string; answerType?: string; mediaUrl?: string | null; mediaFileName?: string | null }
): Promise<boolean> {
  const answerType = String(item.answerType || "text").toLowerCase();
  const caption = String(item.answer || "").trim();
  const mediaUrl = String(item.mediaUrl || "").trim();

  if (answerType === "text") {
    if (!caption) return false;
    const sendResult = await manager.sendTextMessage(sessionId, senderNumber, caption);
    await storeSentMessage(sessionId, senderNumber, caption, "text", sendResult?.id);
    return true;
  }

  if (!mediaUrl) return false;

  const mediaKind = answerType;
  if (!["image", "video", "document", "audio"].includes(mediaKind)) return false;

  let sendResult: any = null;
  let mediaUrlForDb = mediaUrl;
  const captionForMedia =
    mediaKind === "image" || mediaKind === "video" || mediaKind === "document" ? caption : undefined;

  if (typeof manager.sendMediaMessage === "function") {
    const { buffer, fileName } = await loadChatbotMediaFromUrl(mediaUrl);
    const mimeHint = mimeHintForChatbotKind(mediaKind, fileName);
    sendResult = await manager.sendMediaMessage(
      sessionId,
      senderNumber,
      buffer,
      fileName,
      captionForMedia,
      mimeHint
    );
    const persisted = await persistChatbotOutgoingMedia(sessionId, buffer, fileName);
    if (persisted) mediaUrlForDb = persisted;
    if (mediaKind === "audio" && caption) {
      try {
        const capResult = await manager.sendTextMessage(sessionId, senderNumber, caption);
        await storeSentMessage(sessionId, senderNumber, caption, "text", capResult?.id);
      } catch (capErr: any) {
        console.warn("[FAQ Bot] Audio caption text failed:", capErr?.message);
      }
    }
  } else if (mediaKind === "image" && manager.sendImageMessage) {
    sendResult = await manager.sendImageMessage(sessionId, senderNumber, mediaUrl, captionForMedia);
  } else if (mediaKind === "video" && manager.sendVideoMessage) {
    sendResult = await manager.sendVideoMessage(sessionId, senderNumber, mediaUrl, captionForMedia);
  } else if (mediaKind === "document" && manager.sendDocumentMessage) {
    sendResult = await manager.sendDocumentMessage(sessionId, senderNumber, mediaUrl, captionForMedia);
  } else if (mediaKind === "audio" && manager.sendAudioMessage) {
    sendResult = await manager.sendAudioMessage(sessionId, senderNumber, mediaUrl);
    if (caption) {
      try {
        const capResult = await manager.sendTextMessage(sessionId, senderNumber, caption);
        await storeSentMessage(sessionId, senderNumber, caption, "text", capResult?.id);
      } catch (capErr: any) {
        console.warn("[FAQ Bot] Audio caption text failed:", capErr?.message);
      }
    }
  } else {
    return false;
  }

  const bodyForDb = caption || `[${mediaKind}]`;
  await storeSentMessage(
    sessionId,
    senderNumber,
    bodyForDb,
    mediaKind as "image" | "video" | "audio" | "document",
    sendResult?.id,
    undefined,
    undefined,
    undefined,
    mediaUrlForDb
  );
  return true;
}

/** Fallback FAQ bot responder (org-scoped). Runs only when chatbot flow doesn't handle the message. */
async function tryFaqAutoReply(
  sessionId: string,
  senderNumber: string,
  messageBody: string,
  organizationId?: string
): Promise<boolean> {
  const orgId = String(organizationId || '').trim();
  const text = (messageBody || '').trim();
  if (!orgId || !text) return false;

  const settings = await storage.getFaqBotSettingsByOrganization(orgId);
  const faqEnabled = settings?.enabled === true;
  const faqAutoReply = settings?.autoReply !== false;
  if (!faqEnabled || !faqAutoReply) {
    return false;
  }

  const welcomeMessage = String(settings?.welcomeMessage || '').trim();
  const fallbackMessage = String(settings?.fallbackMessage || '').trim();

  const faqs = await storage.getFaqItemsByOrganization(orgId);
  const activeFaqs = faqs.filter((f: any) => f?.isActive !== false);
  if (activeFaqs.length === 0 && !welcomeMessage && !fallbackMessage) return false;

  const msg = text.toLowerCase();
  const findMatch = () => {
    for (const item of activeFaqs) {
      const keywords = Array.isArray(item.keywords) ? item.keywords : [];
      for (const kw of keywords) {
        const k = String(kw || '').trim().toLowerCase();
        if (!k) continue;
        if (msg === k || msg.includes(k) || k.includes(msg)) {
          return item;
        }
      }
    }
    for (const item of activeFaqs) {
      const q = String(item.question || '').trim().toLowerCase();
      if (!q) continue;
      if (msg === q || msg.includes(q) || q.includes(msg)) {
        return item;
      }
    }
    return null;
  };

  const matched = findMatch();
  const manager = await getWhatsAppManager(sessionId);
  if (!manager) return false;

  const answerType = String((matched as any).answerType || "text").toLowerCase();
  const caption = String((matched as any).caption || "").trim();
  const answerContent = String(matched.answer).trim();

  const contactKey = getFaqContactKey(sessionId, senderNumber);
  const isFirstInteraction = !faqWelcomeSentKeys.has(contactKey);
  let sentAny = false;

  try {
    if (isFirstInteraction && welcomeMessage) {
      const sendResult = await manager.sendTextMessage(sessionId, senderNumber, welcomeMessage);
      await storeSentMessage(sessionId, senderNumber, welcomeMessage, 'text', sendResult?.id);
      faqWelcomeSentKeys.add(contactKey);
      sentAny = true;
      console.log(`[FAQ Bot] Sent welcome message to ${senderNumber}`);
    }

    if (matched) {
      const sent = await sendFaqMatchedAnswer(manager, sessionId, senderNumber, matched);
      if (sent) {
        if (!faqWelcomeSentKeys.has(contactKey)) faqWelcomeSentKeys.add(contactKey);
        console.log(`[FAQ Bot] Replied with FAQ item ${matched.id} for message "${text}"`);
        return true;
      }
    }

    if (fallbackMessage) {
      const sendResult = await manager.sendTextMessage(sessionId, senderNumber, fallbackMessage);
      await storeSentMessage(sessionId, senderNumber, fallbackMessage, 'text', sendResult?.id);
      if (!faqWelcomeSentKeys.has(contactKey)) faqWelcomeSentKeys.add(contactKey);
      console.log(`[FAQ Bot] Sent fallback message for "${text}"`);
      return true;
    }

    return sentAny;
  } catch (err: any) {
    console.warn('[FAQ Bot] Failed to send FAQ reply:', err?.message);
    return sentAny;
  }
}

function normalizeLiveChatContact(phoneNumber: string): string {
  return String(phoneNumber || "").replace(/\D/g, "").slice(-15);
}

function hasActiveChatbotConversation(sessionId: string, senderNumber: string): boolean {
  const normalized = normalizePhoneNumber(senderNumber);
  for (const state of conversationStates.values()) {
    if (state.sessionId && state.sessionId !== sessionId) continue;
    if (normalizePhoneNumber(state.userId) === normalized) return true;
  }
  return false;
}

/**
 * First-query live chat greeting based on org working hours.
 * Returns "off_hours" when an after-hours reply was sent (caller should skip other automations).
 */
async function tryLiveChatAutoReply(
  sessionId: string,
  senderNumber: string,
  organizationId?: string
): Promise<"welcome" | "off_hours" | "skipped"> {
  const orgId = String(organizationId || "").trim();
  const contactNumber = normalizeLiveChatContact(senderNumber);
  if (!orgId || !contactNumber) return "skipped";
  if (hasActiveChatbotConversation(sessionId, senderNumber)) return "skipped";

  try {
    const {
      parseLiveChatWorkingHours,
      isWithinLiveChatWorkingHours,
      LIVE_CHAT_AUTO_REPLY_COOLDOWN_MS,
    } = await import("@shared/live-chat-settings");

    const settings = await storage.getOrganizationLiveChatSettings(orgId);
    if (!settings) return "skipped";

    const withinHours = isWithinLiveChatWorkingHours(parseLiveChatWorkingHours(settings.workingHours));
    const kind = withinHours ? "welcome" : "off_hours";
    const enabled = kind === "welcome" ? settings.welcomeEnabled : settings.offHoursEnabled;
    const body = String(
      kind === "welcome" ? settings.welcomeMessage : settings.offHoursMessage
    ).trim();
    if (!enabled || !body) return "skipped";

    const prior = await storage.getLiveChatAutoReplyState(orgId, sessionId, contactNumber);
    if (prior?.lastSentAt) {
      const last = prior.lastSentAt instanceof Date ? prior.lastSentAt : new Date(prior.lastSentAt);
      if (Date.now() - last.getTime() < LIVE_CHAT_AUTO_REPLY_COOLDOWN_MS) {
        return "skipped";
      }
    }

    const manager = await getWhatsAppManager(sessionId);
    if (!manager?.sendTextMessage) return "skipped";

    const sendResult = await manager.sendTextMessage(sessionId, senderNumber, body);
    await storeSentMessage(sessionId, senderNumber, body, "text", sendResult?.id);
    await storage.upsertLiveChatAutoReplyState(orgId, sessionId, contactNumber, kind);
    console.log(`[Live Chat] Sent ${kind} auto-reply to ${senderNumber}`);
    return kind;
  } catch (err: any) {
    console.warn("[Live Chat] Auto-reply failed:", err?.message || err);
    return "skipped";
  }
}

// Helper to find or create chat and return its UUID
async function findOrCreateChat(sessionId: string, contactNumber: string): Promise<string> {
  const normalizedInput = normalizePhoneNumber(contactNumber);
  
  // Check if chat exists
  const chats = await storage.getChatsBySession(sessionId);
  const existingChat = chats.find(c => {
    const normalizedChat = normalizePhoneNumber(c.contactNumber);
    return normalizedChat === normalizedInput;
  });
  
  if (existingChat) {
    return existingChat.id;
  }
  
  // Detect if this is a group
  const isGroup = contactNumber.includes('@g.us');
  
  // Generate appropriate display name
  let contactName = contactNumber;
  if (isGroup) {
    contactName = contactNumber.replace('@g.us', '').replace(/_/g, ' ');
  } else {
    contactName = contactNumber.replace('@c.us', '');
  }
  
  // Find or create the contact
  const existingContacts = await storage.getContactsBySession(sessionId);
  let contact = existingContacts.find(c => {
    const normalizedContact = normalizePhoneNumber(c.number);
    return normalizedContact === normalizedInput;
  });
  
  if (!contact) {
    let formattedNumber = contactNumber;
    if (!isGroup && !formattedNumber.includes('@c.us') && !formattedNumber.includes('@g.us')) {
      formattedNumber = `${formattedNumber}@c.us`;
    }
    
    contact = await storage.createContact({
      sessionId,
      name: contactName,
      number: formattedNumber,
      isGroup,
    });
  }
  
  // Ensure contactNumber has proper format for chat storage
  let formattedChatNumber = contactNumber;
  if (!isGroup && !formattedChatNumber.includes('@c.us') && !formattedChatNumber.includes('@g.us')) {
    formattedChatNumber = `${formattedChatNumber}@c.us`;
  }
  
  // Create new chat
  const newChat = await storage.createChat({
    sessionId,
    contactId: contact.id,
    contactName,
    contactNumber: formattedChatNumber,
    lastMessage: '',
    lastMessageTime: new Date(),
    unreadCount: 0,
    isGroup,
  });
  
  return newChat.id;
}

// Helper to store sent message in database
async function storeSentMessage(
  sessionId: string,
  senderNumber: string,
  messageBody: string,
  messageType: 'text' | 'template' | 'image' | 'video' | 'audio' | 'document' = 'text',
  whatsappMessageId?: string,
  footer?: string,
  footerButtonType?: 'NONE' | 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER',
  footerButtonText?: string,
  mediaUrl?: string
): Promise<void> {
  try {
    // Get session to find organizationId
    const session = await storage.getSession(sessionId);
    if (!session) {
      console.warn(`[Chatbot Executor] Cannot store message: Session not found: ${sessionId}`);
      return;
    }
    
    // Find or create chat
    const chatId = await findOrCreateChat(sessionId, senderNumber);
    
    // Get chat to update
    const chat = await storage.getChat(chatId);
    
    // Store message
    const storedMessage = await storage.createMessage({
      sessionId,
      chatId,
      organizationId: session.organizationId || undefined,
      body: messageBody,
      fromMe: true,
      type: messageType as any,
      status: 'sent',
      whatsappMessageId: whatsappMessageId || undefined,
      mediaUrl: mediaUrl || undefined,
      footer: footer || undefined,
      footerButtonType: footerButtonType || undefined,
      footerButtonText: footerButtonText || undefined,
      sentAt: new Date(),
    });

    if (session.connectionType === 'official' && whatsappMessageId) {
      businessAPIManager.storeMessageMapping(whatsappMessageId, storedMessage.id, sessionId);
    }

    // Update chat's last message
    const lastMessageText = messageBody.substring(0, 100);
    await storage.updateChat(chatId, {
      lastMessage: lastMessageText,
      lastMessageTime: new Date(),
    });

    // Real-time inbox update (panel sends use the same broadcaster via persistOutboundWhatsAppMessage)
    const { broadcastStoredMessage } = await import('../panel-outbound-message');
    broadcastStoredMessage(session.userId, storedMessage);
    
    console.log(`[Chatbot Executor] ✅ Stored sent message in database:`, {
      messageId: storedMessage.id,
      chatId,
      from: senderNumber,
      body: messageBody.substring(0, 50),
    });
  } catch (error: any) {
    console.error(`[Chatbot Executor] Failed to store sent message:`, error);
    // Don't throw - message was already sent, storage failure shouldn't break flow
  }
}

// Helper to get the correct WhatsApp manager based on session connection type
async function getWhatsAppManager(sessionId: string) {
  const session = await storage.getSession(sessionId);
  if (!session) {
    console.error(`[Chatbot Executor] Session not found: ${sessionId}`);
    return null;
  }
  
  if (session.status !== 'connected') {
    console.error(`[Chatbot Executor] Session not connected: ${sessionId}, status: ${session.status}`);
    return null;
  }
  
  if (session.connectionType === 'official') {
    return businessAPIManager;
  } else if (session.connectionType === 'unofficial') {
    return unofficialManager;
  } else {
    return null;
  }
}

// Conversation state: tracks which user is at which node
interface ConversationState {
  userId: string; // phone number
  chatbotId: string;
  currentNodeId: string;
  waitingForInput: boolean;
  context: Record<string, any>; // stores variables/data during flow
  lastActivity: Date;
  sessionId?: string; // needed for scheduled delay resume
  resumeAt?: number; // timestamp when to resume (for delay_until_date / delay_until_weekday)
  // Button/list reply tracking
  lastButtonNodeId?: string; // Node that sent buttons
  buttonMap?: Map<string, string>; // Maps button text/id to connection target node (current/latest)
  buttonMapsByNode?: Record<string, Record<string, string>>; // Per-node maps so buttons from earlier messages still route
  lastListNodeId?: string; // Node that sent list
  listMap?: Map<string, string>; // Maps list row id to connection target node (latest send)
  /** Per send_list node: maps WhatsApp row id + title -> target (like buttonMapsByNode) */
  listMapsByNode?: Record<string, Record<string, string>>;
}

/** Nodes that wait for free-form text — not button/list clicks. */
const TEXT_INPUT_WAIT_NODE_TYPES = new Set(['ask_question', 'ai_agent', 'ask_location']);

function nodeWaitsForTextInput(node: ChatbotNode | undefined): boolean {
  return !!node && TEXT_INPUT_WAIT_NODE_TYPES.has(node.nodeType);
}

// Helper to convert Map to/from plain object for JSON serialization
function mapToObject(map: Map<string, string> | undefined): Record<string, string> | undefined {
  if (!map) return undefined;
  return Object.fromEntries(map);
}

function objectToMap(obj: Record<string, string> | undefined): Map<string, string> | undefined {
  if (!obj) return undefined;
  return new Map(Object.entries(obj));
}

// In-memory conversation state (could be moved to DB for persistence)
const conversationStates = new Map<string, ConversationState>();

// Session timeout: 0 = never expire (active all time), or set CHATBOT_SESSION_MAX_AGE_DAYS (e.g. 30) to cleanup old sessions
const CHATBOT_SESSION_MAX_AGE_DAYS = parseInt(process.env.CHATBOT_SESSION_MAX_AGE_DAYS || '0', 10);
const CHATBOT_SESSION_MAX_AGE_MS = CHATBOT_SESSION_MAX_AGE_DAYS > 0
  ? CHATBOT_SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  : Infinity; // No time-based expiry when 0

function cleanupOldConversations() {
  if (CHATBOT_SESSION_MAX_AGE_MS === Infinity) return; // Disabled
  const now = new Date();
  for (const [key, state] of conversationStates.entries()) {
    if (now.getTime() - state.lastActivity.getTime() > CHATBOT_SESSION_MAX_AGE_MS) {
      conversationStates.delete(key);
    }
  }
}

// Get conversation state key. Include sessionId so the same phone in multiple sessions
// (e.g. same WhatsApp number linked to 2 users) has separate conversation state.
function getConversationKey(senderNumber: string, chatbotId: string, sessionId?: string): string {
  if (sessionId) return `${senderNumber}:${chatbotId}:${sessionId}`;
  return `${senderNumber}:${chatbotId}`; // legacy format for states without sessionId
}

/** Normalize phone for matching (strip @c.us, @g.us, non-digits for comparison) */
function normalizePhoneForKey(phone: string): string {
  return String(phone || '').replace(/@c\.us$|@g\.us$/i, '').replace(/\D/g, '') || phone;
}

/**
 * After knowledge base / prompt changes, drop AI chat memory so the next reply
 * uses the updated KB instead of continuing from answers based on old content.
 * Keeps the contact on the AI Agent node (they do not need to re-trigger "hi").
 */
export async function invalidateAiAgentMemoryForAssistant(assistantId: string): Promise<number> {
  if (!assistantId) return 0;
  let cleared = 0;
  const chatbotNodeCache = new Map<string, ChatbotNode[]>();

  for (const [key, state] of conversationStates.entries()) {
    const ctx = state.context || {};
    let matches = String(ctx.aiAssistantId || "").trim() === assistantId;

    if (!matches) {
      try {
        let nodes = chatbotNodeCache.get(state.chatbotId);
        if (!nodes) {
          nodes = await storage.getChatbotNodes(state.chatbotId);
          chatbotNodeCache.set(state.chatbotId, nodes);
        }
        const node = nodes.find((n) => n.id === state.currentNodeId);
        if (node?.nodeType === "ai_agent") {
          const data = (node.data || {}) as Record<string, unknown>;
          const nodeAssistantId = String(data.assistantId || data.assistant || "").trim();
          matches = nodeAssistantId === assistantId;
        }
      } catch {
        /* ignore lookup errors */
      }
    }
    if (!matches) continue;

    const nextContext = { ...ctx };
    delete nextContext.aiChatHistory;
    delete nextContext.knowledgeFingerprint;
    delete nextContext.offeredSlots;
    delete nextContext.selectedSlot;
    delete nextContext.bookingFlow;
    delete nextContext.bookingConfirmed;
    delete nextContext.customerEmail;
    delete nextContext.aiAgentFollowUpMessage;
    delete nextContext.aiAgentResumeKind;
    delete nextContext.aiAgentFollowUpSent;
    // Force welcome + fresh turn with new KB on next message
    delete nextContext.aiAgentWelcomeSent;
    conversationStates.set(key, {
      ...state,
      context: nextContext,
      resumeAt: undefined,
      lastActivity: new Date(),
    });
    cleared++;
  }
  if (cleared > 0) {
    console.log(
      `[Chatbot Executor] Invalidated AI memory for ${cleared} conversation(s) after KB/prompt change (assistant=${assistantId})`
    );
  }
  return cleared;
}

/**
 * Clear all chatbot conversation state for a contact when a human manually sends a message.
 * Call this when storing a message with fromMe=true (human/business sent to customer).
 */
export function clearChatbotConversationForContact(sessionId: string, contactNumber: string): void {
  const normalized = normalizePhoneForKey(contactNumber);
  if (!normalized) return;
  let cleared = 0;
  for (const key of conversationStates.keys()) {
    // Key format: senderNumber:chatbotId:sessionId or senderNumber:chatbotId (legacy)
    const parts = key.split(':');
    const keyPhone = normalizePhoneForKey(parts[0] || '');
    const keySessionId = parts.length >= 3 ? parts[2] : undefined;
    if (keyPhone === normalized && (keySessionId === sessionId || !keySessionId)) {
      conversationStates.delete(key);
      cleared++;
    }
  }
  if (cleared > 0) {
    console.log(`[Chatbot Executor] Cleared ${cleared} conversation(s) for human takeover: session=${sessionId}, contact=${contactNumber}`);
  }
  const faqKey = getFaqContactKey(sessionId, contactNumber);
  if (faqWelcomeSentKeys.delete(faqKey)) {
    console.log(`[Chatbot Executor] Reset FAQ welcome state for human takeover: ${contactNumber}`);
  }
}

// Fuzzy keyword matching
function matchKeywords(message: string, keywords: string[], fuzzyMatching: boolean, matchSensitivity: number): boolean {
  // Empty keywords = "On Message" matches any message (trigger on every message from selected number(s))
  if (!keywords || keywords.length === 0) return true;

  const normalizedMessage = message.toLowerCase().trim();
  
  for (const keyword of keywords) {
    const normalizedKeyword = keyword.toLowerCase().trim();
    
    if (fuzzyMatching) {
      // Calculate similarity (simple Levenshtein-like approach)
      const similarity = calculateSimilarity(normalizedMessage, normalizedKeyword);
      const threshold = (matchSensitivity || 80) / 100;
      if (similarity >= threshold) {
        return true;
      }
      
      // Also check if keyword is contained in message
      if (normalizedMessage.includes(normalizedKeyword)) {
        return true;
      }
    } else {
      // Exact match
      if (normalizedMessage === normalizedKeyword) {
        return true;
      }
    }
  }
  
  return false;
}

// Simple similarity calculation (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

// Levenshtein distance
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Determine incoming message type from interactiveData
function getIncomingMessageType(interactiveData?: {
  type?: 'button_reply' | 'list_reply';
  isTemplateButton?: boolean;
}): 'text' | 'list_reply' | 'button_reply' | 'template_button_reply' {
  if (!interactiveData) return 'text';
  if (interactiveData.type === 'list_reply') return 'list_reply';
  if (interactiveData.type === 'button_reply' && interactiveData.isTemplateButton) return 'template_button_reply';
  if (interactiveData.type === 'button_reply') return 'button_reply';
  return 'text';
}

export type IncomingWhatsAppMessageContext = {
  senderName: string;
  message: string;
  senderId: string;
  receiverId: string;
  messageType: string;
  buttonReplyTitle: string;
  buttonReplyId: string;
  listReplyTitle: string;
  listReplyId: string;
};

/** Latest customer WhatsApp reply — use {{onMessage.*}} in any chatbot step. */
async function buildIncomingMessageContext(opts: {
  sessionId: string;
  senderNumber: string;
  messageBody: string;
  interactiveData?: {
    type?: 'button_reply' | 'list_reply';
    buttonReply?: { id?: string; title?: string };
    listReply?: { id?: string; title?: string };
    isTemplateButton?: boolean;
  };
}): Promise<IncomingWhatsAppMessageContext> {
  const { sessionId, senderNumber, messageBody, interactiveData } = opts;
  let senderName = '';
  try {
    const sessionContacts = await storage.getContactsBySession(sessionId);
    const norm = (p: string) => (p || '').replace(/\D/g, '');
    const senderNorm = norm(senderNumber);
    const contact = sessionContacts.find((c) => norm(c.number) === senderNorm);
    if (contact?.name) senderName = contact.name;
  } catch {
    /* ignore */
  }
  const session = await storage.getSession(sessionId);
  const receiverId =
    (session?.deviceInfo as { phoneNumber?: string; displayPhoneNumber?: string } | undefined)
      ?.phoneNumber ||
    (session?.deviceInfo as { displayPhoneNumber?: string } | undefined)?.displayPhoneNumber ||
    '';
  const messageType = getIncomingMessageType(interactiveData);
  const buttonReplyTitle = interactiveData?.buttonReply?.title || '';
  const buttonReplyId = interactiveData?.buttonReply?.id || '';
  const listReplyTitle = interactiveData?.listReply?.title || '';
  const listReplyId = interactiveData?.listReply?.id || '';
  let message = (messageBody || '').trim();
  if (messageType === 'button_reply' || messageType === 'template_button_reply') {
    message = buttonReplyTitle || message;
  } else if (messageType === 'list_reply') {
    message = listReplyTitle || message;
  }
  return {
    senderName: senderName || senderNumber,
    message,
    senderId: senderNumber,
    receiverId: receiverId || senderNumber,
    messageType,
    buttonReplyTitle,
    buttonReplyId,
    listReplyTitle,
    listReplyId,
  };
}

async function mergeIncomingMessageIntoContext(
  context: Record<string, any>,
  opts: Parameters<typeof buildIncomingMessageContext>[0]
): Promise<Record<string, any>> {
  const onMessage = await buildIncomingMessageContext(opts);
  return {
    ...context,
    onMessage,
    lastUserInput: onMessage.message,
  };
}

const ON_MESSAGE_VARIABLE_FIELDS = [
  'senderName',
  'message',
  'senderId',
  'receiverId',
  'messageType',
  'buttonReplyTitle',
  'buttonReplyId',
  'listReplyTitle',
  'listReplyId',
] as const;

// Find trigger node that matches the message.
// Returns { node, matchedByKeywords } - matchedByKeywords=true when a keyword trigger matched (not "On Message").
// IMPORTANT: Check keyword triggers FIRST, then fall back to "On Message" (empty keywords).
// Previously empty-keyword triggers matched any message first, causing wrong flows for "Hi", "Interested", etc.
function findMatchingTrigger(
  nodes: ChatbotNode[],
  message: string,
  interactiveData?: {
    type?: 'button_reply' | 'list_reply';
    isTemplateButton?: boolean;
  }
): { node: ChatbotNode; matchedByKeywords: boolean } | null {
  const incomingType = getIncomingMessageType(interactiveData);
  const triggers = nodes.filter((n) => n.nodeType === 'trigger') as ChatbotNode[];
  const withKeywords: ChatbotNode[] = [];
  const withoutKeywords: ChatbotNode[] = [];

  for (const node of triggers) {
    const data = node.data as any;
    const triggerMessageType = (data.messageType || 'text') as string;
    const keywords = Array.isArray(data.keywords) ? data.keywords : [];

    // When "On Message" (empty keywords) OR explicit Message Type = All, match every incoming type.
    const effectiveMessageType =
      keywords.length === 0 || String(triggerMessageType).toLowerCase() === 'all'
        ? 'all'
        : triggerMessageType;
    if (effectiveMessageType !== 'all' && effectiveMessageType !== incomingType) continue;

    if (keywords.length > 0) {
      withKeywords.push(node);
    } else {
      withoutKeywords.push(node);
    }
  }

  // First pass: match specific keyword triggers (e.g. "Hi", "Interested", "New")
  for (const node of withKeywords) {
    const data = node.data as any;
    const keywords = Array.isArray(data.keywords) ? data.keywords : [];
    const fuzzyMatching = data.fuzzyMatching !== false;
    const matchSensitivity = data.matchSensitivity || 80;
    if (matchKeywords(message, keywords, fuzzyMatching, matchSensitivity)) {
      return { node, matchedByKeywords: true };
    }
  }

  // Second pass: fall back to "On Message" triggers (empty keywords = match any)
  // IMPORTANT: Only use "On Message" fallback when there are NO keyword triggers.
  // If the chatbot has keyword triggers and none matched, do NOT reply to custom/free-form messages.
  // This prevents generic welcome messages when customer sends unrelated text (e.g. "Demo account please").
  if (withoutKeywords.length > 0 && withKeywords.length === 0) {
    return { node: withoutKeywords[0], matchedByKeywords: false };
  }

  return null;
}

// Resolve {{nodeId.field}} variables in a string using context (e.g. {{triggerId.senderId}} -> phone number)
function resolveVariables(str: string, context: Record<string, any>): string {
  if (!str || typeof str !== 'string') return str;
  let result = str;
  const onMessage = context?.onMessage as Record<string, unknown> | undefined;
  if (onMessage) {
    for (const field of ON_MESSAGE_VARIABLE_FIELDS) {
      const val = onMessage[field];
      if (val != null && String(val).length > 0) {
        result = result.replace(new RegExp(`\\{\\{onMessage\\.${field}\\}\\}`, 'gi'), String(val));
        result = result.replace(new RegExp(`\\{\\{[^}]*\\.${field}\\}\\}`, 'g'), String(val));
      }
    }
  }
  // {{contact.name}}, {{contact.email}}, {{contact.phone}}, {{contact.<customColumnId>}} — requires Fetch Contact earlier in the flow
  const fetchedByNode = context?.fetchedContactsByNode;
  if (fetchedByNode && typeof fetchedByNode === 'object') {
    result = result.replace(/\{\{\s*contact\.([^}]+?)\s*\}\}/gi, (_m, rawPath: string) => {
      const path = String(rawPath).trim();
      for (const nid of Object.keys(fetchedByNode)) {
        const c = fetchedByNode[nid] as {
          id?: string;
          name?: string;
          email?: string;
          phoneNumber?: string;
          columns?: Record<string, unknown>;
        } | null;
        if (!c) continue;
        if (path === 'name' && c.name != null) return String(c.name);
        if (path === 'email' && c.email != null) return String(c.email);
        if ((path === 'phoneNumber' || path === 'phone') && c.phoneNumber != null) return String(c.phoneNumber);
        if (path === 'id' && c.id != null) return String(c.id);
        const cols = c.columns || {};
        if (Object.prototype.hasOwnProperty.call(cols, path) && cols[path] != null) return String(cols[path]);
      }
      return `{{contact.${path}}}`;
    });
  }
  // Support {{user_input}} and {{userInput}} from ask_question
  const userInput = (context?.userInput ?? context?.lastUserInput ?? '').trim();
  result = result.replace(/\{\{user_input\}\}/gi, userInput);
  result = result.replace(/\{\{userInput\}\}/gi, userInput);
  // Support {{nodeId.field}} from nodeOutputs (e.g. HTTP node body, status)
  const nodeOutputs = context?.nodeOutputs;
  if (nodeOutputs && typeof nodeOutputs === 'object') {
    const re = /\{\{([^.}]+)\.([^}]+)\}\}/g;
    result = result.replace(re, (_, nodeId, field) => {
      const out = nodeOutputs[nodeId];
      if (out && out[field] != null) return String(out[field]);
      if (
        onMessage &&
        ON_MESSAGE_VARIABLE_FIELDS.includes(field as (typeof ON_MESSAGE_VARIABLE_FIELDS)[number]) &&
        onMessage[field] != null &&
        String(onMessage[field]).length > 0
      ) {
        return String(onMessage[field]);
      }
      return `{{${nodeId}.${field}}}`;
    });
  }
  return result;
}

// Execute a single node
async function executeNode(
  node: ChatbotNode,
  sessionId: string,
  senderNumber: string,
  userInput?: string,
  context: Record<string, any> = {}
): Promise<{ nextNodeId: string | null; waitingForInput: boolean; responses: any[]; scheduleResumeAt?: number; resumeKind?: 'followup' | 'timeout' }> {
  const data = node.data as any;
  const whatsappManager = await getWhatsAppManager(sessionId);
  
  if (!whatsappManager) {
    console.error(`[Chatbot Executor] Cannot execute node: WhatsApp manager not available for session ${sessionId}`);
    return { nextNodeId: null, waitingForInput: false, responses: [] };
  }
  
  const responses: any[] = [];
  let nextNodeId: string | null = null;
  let waitingForInput = false;
  let scheduleResumeAt: number | undefined;
  let resumeKind: 'followup' | 'timeout' | undefined;
  
  try {
    switch (node.nodeType) {
      case 'send_text': {
        const messageRaw = (data.message || '').toString();
        const message = resolveVariables(messageRaw, context);
        if (message) {
          console.log(`[Chatbot Executor] Sending text message from node ${node.id}: "${message.substring(0, 50)}..."`);
          const sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, message);
          // Store message in database
          await storeSentMessage(
            sessionId,
            senderNumber,
            message,
            'text',
            sendResult?.id,
          );
          responses.push({ type: 'text', message });
          console.log(`[Chatbot Executor] ✅ Text message sent and stored`);
        }
        // Follow first connection
        const connections = node.connections || [];
        if (connections.length > 0) {
          nextNodeId = connections[0].to;
          console.log(`[Chatbot Executor] Text node ${node.id} -> next node: ${nextNodeId}`);
        } else {
          console.log(`[Chatbot Executor] Text node ${node.id} has no connections - flow ends here`);
        }
        break;
      }
      
      case 'send_button': {
        const body = resolveVariables((data.body || '').toString(), context);
        const footer = resolveVariables((data.footer || '').toString(), context);
        const buttons = Array.isArray(data.buttons) ? data.buttons : [];
        const headerType = (data.headerType || 'none').toString().toLowerCase();
        const headerText = resolveVariables((data.headerText || '').toString(), context);
        const headerUrl = resolveVariables((data.headerUrl || '').toString(), context);
        
        // Build button message payload with IDs
        // IMPORTANT: Use btn_1, btn_2, btn_3 format to match WhatsApp Business API response
        const buttonData = buttons
          .filter((b: any) => b?.text && b.text.trim())
          .map((b: any, idx: number) => ({
            id: b.id || `btn_${idx + 1}`, // Match WhatsApp format: btn_1, btn_2, btn_3
            text: resolveVariables(b.text.trim(), context),
          }))
          .slice(0, 3); // Max 3 buttons
        
        if (buttonData.length > 0) {
          const buttonTexts = buttonData.map((b: any) => b.text);
          
          // Try to send button message
          let sendResult: any = null;
          try {
            if (whatsappManager.sendButtonMessage) {
              sendResult = await whatsappManager.sendButtonMessage(sessionId, senderNumber, {
                body,
                footer,
                buttons: buttonTexts,
                headerType: headerType as any,
                headerText,
                headerUrl,
              });
            } else {
              // Fallback for unofficial client
              sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, body || 'Please select an option:');
            }
          } catch (error: any) {
            // Fallback to text message if button message fails
            console.warn(`[Chatbot Executor] Button message failed, sending text:`, error.message);
            sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, body || 'Please select an option:');
          }
          
          // Store message in database (include mediaUrl when image header so it shows in /chat)
          await storeSentMessage(
            sessionId,
            senderNumber,
            body,
            'text',
            sendResult?.id,
            footer || undefined,
            'QUICK_REPLY',
            JSON.stringify(buttonData),
            headerType === 'image' && headerUrl ? headerUrl : undefined,
          );
          
          responses.push({ type: 'button', body, footer, buttons: buttonData });
          
          // Store button mapping in context for reply handling
          // IMPORTANT: Match buttons by INDEX/POSITION, not by ID, because:
          // - Frontend uses timestamp-based IDs (btn-1234567890)
          // - WhatsApp returns sequential IDs (btn_1, btn_2, btn_3)
          // - We send buttons in order, so index is the reliable match
          const buttonMap = new Map<string, string>();
          const connections = node.connections || [];
          
          // Filter connections that have fromHandle (button connections)
          const buttonConnections = connections.filter((c: any) => c.fromHandle && c.fromHandle.startsWith('button:'));
          
          console.log(`[Chatbot Executor] Creating button map for node ${node.id}:`, {
            buttonData: buttonData.map((b: any, i: number) => ({ index: i, id: b.id, text: b.text, whatsappId: `btn_${i + 1}` })),
            allConnections: connections.map((c: any) => ({ from: c.from, to: c.to, fromHandle: c.fromHandle })),
            buttonConnections: buttonConnections.map((c: any) => ({ from: c.from, to: c.to, fromHandle: c.fromHandle })),
          });
          
          buttonData.forEach((btn: any, idx: number) => {
            // WhatsApp will return btn_1, btn_2, btn_3 for buttons sent in order
            const whatsappButtonId = `btn_${idx + 1}`;
            
            // Try to find connection by matching handle formats
            // Frontend might use: button:btn-1234567890 or button:0 or button:1
            let matchingConn: any = null;
            
            // First, try to find by button index in handle (most reliable)
            // Frontend might use button:0, button:1, etc.
            matchingConn = buttonConnections.find((c: any) => {
              const handleIdx = c.fromHandle?.replace('button:', '');
              return handleIdx === String(idx) || handleIdx === String(idx + 1);
            });
            
            // If not found, try by button ID (might match if IDs happen to align)
            if (!matchingConn && btn.id) {
              matchingConn = buttonConnections.find((c: any) => c.fromHandle === `button:${btn.id}`);
            }
            
            // If still not found, use connection by index (buttons are sent in order)
            if (!matchingConn && idx < buttonConnections.length) {
              matchingConn = buttonConnections[idx];
              console.log(`[Chatbot Executor] Using connection by index ${idx} for button "${btn.text}"`);
            } else if (!matchingConn && idx < connections.length) {
              matchingConn = connections[idx];
              console.log(`[Chatbot Executor] Using fallback connection by index ${idx} for button "${btn.text}"`);
            }
            // Fallback to default (top-right) handle when no button-specific connection
            if (!matchingConn) {
              const defaultConn = connections.find((c: any) => !c.fromHandle || c.fromHandle === 'default');
              if (defaultConn) matchingConn = defaultConn;
            }
            
            if (matchingConn) {
              // Store multiple variations for matching
              const normalizedText = btn.text.toLowerCase().trim();
              buttonMap.set(normalizedText, matchingConn.to);
              buttonMap.set(whatsappButtonId, matchingConn.to); // btn_1, btn_2, etc. (what WhatsApp returns)
              buttonMap.set(btn.id, matchingConn.to); // Original button ID (if exists)
              buttonMap.set(btn.text.trim(), matchingConn.to); // Exact text match
              console.log(`[Chatbot Executor] ✅ Mapped button "${btn.text}" (index: ${idx}, WhatsApp ID: ${whatsappButtonId}) -> node ${matchingConn.to}`);
            } else {
              console.warn(`[Chatbot Executor] ❌ No connection found for button "${btn.text}" (index: ${idx}, ID: ${btn.id})`);
            }
          });
          
          console.log(`[Chatbot Executor] Final button map:`, Object.fromEntries(buttonMap));
          
          // Store in context for flow execution (as plain object for JSON serialization)
          const mapObj = Object.fromEntries(buttonMap);
          context.buttonMap = mapObj;
          context.lastButtonNodeId = node.id;
          // Accumulate per-node maps so buttons from earlier messages (e.g. Join Community, Know How) still route
          context.buttonMapsByNode = { ...(context.buttonMapsByNode || {}), [node.id]: mapObj };
          
          const defaultConn = connections.find(
            (c: any) => !c.fromHandle || c.fromHandle === 'default'
          );
          if (defaultConn) {
            // Default handle (top-right): auto-send chained message(s) after this button message,
            // while still keeping button maps for per-button paths.
            nextNodeId = defaultConn.to;
            waitingForInput = false;
            console.log(
              `[Chatbot Executor] Button node ${node.id}: following default connection to ${defaultConn.to} (button clicks still routed via buttonMap)`
            );
          } else {
            // No default chain — wait for a button click before continuing.
            waitingForInput = true;
            nextNodeId = node.id; // Stay on this node
          }
        } else {
          // No buttons configured: send body as text only if non-empty (do not send generic fallback)
          const textToSend = (body || '').trim();
          if (textToSend) {
            const sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, textToSend);
            await storeSentMessage(sessionId, senderNumber, textToSend, 'text', sendResult?.id);
            responses.push({ type: 'text', message: textToSend });
          }
          // Follow first connection (with or without sending)
          const connections = node.connections || [];
          if (connections.length > 0) {
            nextNodeId = connections[0].to;
          }
        }
        break;
      }
      
      case 'send_list': {
        const body = (data.body || '').toString();
        const footer = (data.footer || '').toString();
        const buttonText = (data.buttonText || 'View Options').toString();
        const headerType = (data.headerType || 'none').toString();
        const headerText = (data.headerText || '').toString();
        const headerUrl = (data.headerUrl || '').toString();
        const sections = Array.isArray(data.sections) ? data.sections : [];

        // WhatsApp often will not emit a second list_reply for a row whose `id` was already used in an
        // earlier list message in the same chat. Stable builder ids (row-1, …) must therefore be sent as
        // fresh ids per outbound message; flow edges still use canonical ids (list:<canonicalId>).
        const listSendToken = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        let rowOrdinal = 0;

        type BuiltRow = { waRowId: string; canonicalId: string; title: string; description?: string };
        const builtSections: Array<{ title: string; rows: BuiltRow[] }> = [];

        // Cloud API: max 10 sections, max 10 rows total across ALL sections (not per section).
        const CLOUD_LIST_MAX_SECTIONS = 10;
        const CLOUD_LIST_MAX_ROWS_TOTAL = 10;
        let rowsAdded = 0;

        sections
          .filter((s: any) => s?.title && s.title.trim())
          .slice(0, CLOUD_LIST_MAX_SECTIONS)
          .forEach((s: any, sectionIdx: number) => {
            if (rowsAdded >= CLOUD_LIST_MAX_ROWS_TOTAL) return;
            const rawRows = (Array.isArray(s.rows) ? s.rows : []).filter((r: any) => r?.title && r.title.trim());
            const rows: BuiltRow[] = [];
            for (let idx = 0; idx < rawRows.length && rowsAdded < CLOUD_LIST_MAX_ROWS_TOTAL; idx++) {
              const r = rawRows[idx];
              const canonicalId =
                r.id && String(r.id).trim() ? String(r.id).trim() : `row-${sectionIdx}-${idx}`;
              const waRowId = `L${listSendToken}_${rowOrdinal++}`.slice(0, 200);
              const desc = (r.description || '').toString().slice(0, 72);
              rows.push({
                waRowId,
                canonicalId,
                title: r.title.trim().slice(0, 24),
                description: desc ? desc : undefined,
              });
              rowsAdded++;
            }
            if (rows.length > 0) {
              builtSections.push({ title: s.title.trim(), rows });
            }
          });

        const listSections = builtSections.map((sec) => ({
          title: sec.title,
          rows: sec.rows.map((r) => ({
            id: r.waRowId,
            title: r.title,
            description: r.description,
          })),
        }));

        if (listSections.length > 0) {
          let sendResult: any = null;
          let sentAsInteractiveList = false;
          try {
            if (whatsappManager.sendListMessage) {
              sendResult = await whatsappManager.sendListMessage(sessionId, senderNumber, {
                body,
                footer,
                buttonText,
                headerType: headerType as 'none' | 'text' | 'image' | 'video' | 'document',
                headerText: headerType === 'text' ? headerText : undefined,
                headerUrl: ['image', 'video', 'document'].includes(headerType) ? headerUrl : undefined,
                sections: listSections,
              });
              sentAsInteractiveList = true;
            } else {
              // Fallback for unofficial client
              sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, body || 'Please select an option:');
            }
          } catch (error: any) {
            console.warn(`[Chatbot Executor] List message failed, sending text:`, error.message);
            sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, body || 'Please select an option:');
          }
          
          // Store message in database
          await storeSentMessage(
            sessionId,
            senderNumber,
            body,
            'text',
            sendResult?.id,
            footer || undefined,
          );
          
          responses.push({ type: 'list', body, footer, sections: listSections });

          const connections = node.connections || [];
          const defaultConn = connections.find((c: any) => !c.fromHandle || c.fromHandle === 'default');
          if (sentAsInteractiveList) {
            // Store list mapping in context for reply handling (WhatsApp returns waRowId in list_reply.id)
            const listMap = new Map<string, string>();
            builtSections.forEach((section) => {
              section.rows.forEach((row) => {
                const handleId = `list:${row.canonicalId}`;
                const matchingConn = connections.find((c: any) => c.fromHandle === handleId);
                const targetConn = matchingConn || defaultConn;
                if (targetConn) {
                  listMap.set(row.waRowId, targetConn.to);
                  listMap.set(row.title.toLowerCase().trim(), targetConn.to);
                }
              });
            });
            
            // Store in context for flow execution (as plain object for JSON serialization)
            context.listMap = Object.fromEntries(listMap);
            context.lastListNodeId = node.id;
            context.listMapsByNode = {
              ...(context.listMapsByNode || {}),
              [node.id]: Object.fromEntries(listMap),
            };
            
            if (defaultConn) {
              nextNodeId = defaultConn.to;
              waitingForInput = false;
              console.log(
                `[Chatbot Executor] List node ${node.id}: following default connection to ${defaultConn.to} (list picks still routed via listMap)`
              );
            } else {
              // Don't advance to next node yet - wait for list selection
              waitingForInput = true;
              nextNodeId = node.id; // Stay on this node
            }
          } else {
            // Transport fallback (no interactive list): continue flow instead of waiting forever.
            const fallbackConn = defaultConn || connections[0];
            nextNodeId = fallbackConn ? fallbackConn.to : null;
            console.log(
              `[Chatbot Executor] Send List node ${node.id}: interactive list unavailable, followed ${
                fallbackConn?.fromHandle || 'first'
              } connection`
            );
          }
        } else {
          const sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, body || '');
          // Store message in database
          await storeSentMessage(
            sessionId,
            senderNumber,
            body,
            'text',
            sendResult?.id,
          );
          responses.push({ type: 'text', message: body });
          
          // Follow first connection
          const connections = node.connections || [];
          if (connections.length > 0) {
            nextNodeId = connections[0].to;
          }
        }
        break;
      }
      
      case 'send_media': {
        const url = (data.url || '').toString();
        const caption = (data.caption || '').toString();
        const mediaType = (data.mediaType || 'image').toString().toLowerCase();
        
        if (url) {
          try {
            let sendResult: any = null;
            /** WhatsApp Cloud API: audio messages cannot carry a caption — we send it as a follow-up text after the clip. */
            let audioCaptionWhatsAppId: string | undefined;
            /** Prefer persisted /uploads/... copy over remote URL for DB + inbox preview (fixes HTML/error responses). */
            let mediaUrlForDb = url;
            if (
              ['image', 'video', 'audio', 'document'].includes(mediaType) &&
              typeof (whatsappManager as any).sendMediaMessage === 'function'
            ) {
              const { buffer, fileName } = await loadChatbotMediaFromUrl(url);
              const mimeHint = mimeHintForChatbotKind(mediaType, fileName);
              const captionForMedia =
                mediaType === 'image' || mediaType === 'video' || mediaType === 'document'
                  ? caption
                  : undefined;
              sendResult = await (whatsappManager as any).sendMediaMessage(
                sessionId,
                senderNumber,
                buffer,
                fileName,
                captionForMedia,
                mimeHint
              );
              const persisted = await persistChatbotOutgoingMedia(sessionId, buffer, fileName);
              if (persisted) {
                mediaUrlForDb = persisted;
              }
              if (mediaType === 'audio' && caption.trim()) {
                try {
                  const capResult = await whatsappManager.sendTextMessage(
                    sessionId,
                    senderNumber,
                    caption.trim(),
                  );
                  audioCaptionWhatsAppId = capResult?.id;
                } catch (capErr: any) {
                  console.warn(`[Chatbot Executor] Audio caption text failed:`, capErr?.message);
                }
              }
            } else if (mediaType === 'image') {
              sendResult = await whatsappManager.sendImageMessage?.(sessionId, senderNumber, url, caption);
            } else if (mediaType === 'video') {
              sendResult = await whatsappManager.sendVideoMessage?.(sessionId, senderNumber, url, caption);
            } else if (mediaType === 'document') {
              sendResult = await whatsappManager.sendDocumentMessage?.(sessionId, senderNumber, url, caption);
            } else if (mediaType === 'audio') {
              sendResult = await whatsappManager.sendAudioMessage?.(sessionId, senderNumber, url);
              if (sendResult && caption.trim()) {
                try {
                  const capResult = await whatsappManager.sendTextMessage(
                    sessionId,
                    senderNumber,
                    caption.trim(),
                  );
                  audioCaptionWhatsAppId = capResult?.id;
                } catch (capErr: any) {
                  console.warn(`[Chatbot Executor] Audio caption text failed:`, capErr?.message);
                }
              }
            } else {
              sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, caption || `Media: ${url}`);
            }
            if (sendResult == null && url) {
              throw new Error(
                'Media was not sent (no transport). Use an official or unofficial session with sendMediaMessage support.',
              );
            }
            // Store media row first, then caption row so inbox order matches WhatsApp (voice note then text).
            const audioBodyWhenCaptionSplit =
              mediaType === 'audio' && caption.trim() ? 'Audio' : caption || `Media: ${url}`;
            await storeSentMessage(
              sessionId,
              senderNumber,
              audioBodyWhenCaptionSplit,
              mediaType as any,
              sendResult?.id,
              undefined,
              undefined,
              undefined,
              mediaUrlForDb,
            );
            if (audioCaptionWhatsAppId && caption.trim()) {
              await storeSentMessage(
                sessionId,
                senderNumber,
                caption.trim(),
                'text',
                audioCaptionWhatsAppId,
              );
            }
            responses.push({ type: 'media', mediaType, url, caption });
          } catch (error: any) {
            console.warn(`[Chatbot Executor] Media message failed:`, error.message);
            const sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, caption || `Media: ${url}`);
            await storeSentMessage(sessionId, senderNumber, caption || `Media: ${url}`, 'text', sendResult?.id);
          }
        }
        
        // Follow first connection
        const connections = node.connections || [];
        if (connections.length > 0) {
          nextNodeId = connections[0].to;
        }
        break;
      }
      
      case 'send_cta': {
        const body = resolveVariables((data.body || '').toString(), context);
        const footer = resolveVariables((data.footer || '').toString(), context);
        const displayText = resolveVariables((data.displayText || '').toString(), context);
        const ctaUrl = resolveVariables((data.url || '').toString(), context);
        const headerType = (data.headerType || 'none').toString().toLowerCase();
        const headerText = resolveVariables((data.headerText || '').toString(), context);
        const headerUrl = resolveVariables((data.headerUrl || '').toString(), context);
        
        if (body && displayText && ctaUrl) {
          try {
            // Send CTA message with URL button using WhatsApp Business API
            // For CTA buttons, we need to use the interactive message format with a URL button
            if (whatsappManager.sendCtaMessage) {
              const sendResult = await whatsappManager.sendCtaMessage(sessionId, senderNumber, {
                body,
                footer,
                buttonText: displayText,
                url: ctaUrl,
                headerType: headerType as any,
                headerText,
                headerUrl,
              });
              await storeSentMessage(
                sessionId,
                senderNumber,
                body,
                'text',
                sendResult?.id,
                footer || undefined,
                'URL', // footerButtonType
                JSON.stringify([{ type: 'URL', text: displayText, url: ctaUrl }]), // footerButtonText
                headerType === 'image' && headerUrl ? headerUrl : undefined, // mediaUrl for /chat display
              );
              responses.push({ type: 'cta', body, footer, buttonText: displayText, url: ctaUrl });
              console.log(`[Chatbot Executor] ✅ CTA message sent and stored`);
            } else {
              // Fallback: send as text message with URL
              const messageText = `${body}\n\n${displayText}: ${ctaUrl}`;
              const sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, messageText);
              await storeSentMessage(sessionId, senderNumber, messageText, 'text', sendResult?.id);
              responses.push({ type: 'text', message: messageText });
              console.log(`[Chatbot Executor] CTA message sent as text (fallback)`);
            }
          } catch (error: any) {
            console.warn(`[Chatbot Executor] CTA message failed:`, error.message);
            // Fallback to text message
            const messageText = `${body}\n\n${displayText}: ${ctaUrl}`;
            const sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, messageText);
            await storeSentMessage(sessionId, senderNumber, messageText, 'text', sendResult?.id);
            responses.push({ type: 'text', message: messageText });
          }
        } else {
          console.warn(`[Chatbot Executor] CTA node missing required fields: body, displayText, or url`);
        }
        
        // Follow first connection - optionally after a delay
        // WhatsApp CTA URL buttons do NOT send webhooks when clicked, so we cannot wait for the click.
        // Use scheduled delay (not inline await) so customer messages during wait don't re-trigger the flow.
        const connections = node.connections || [];
        if (connections.length > 0) {
          const delaySeconds = Math.min(300, Math.max(0, parseInt(String(data.delayBeforeNext ?? 30), 10) || 30));
          if (delaySeconds > 0) {
            const resumeAt = Date.now() + delaySeconds * 1000;
            responses.push({ type: 'scheduledDelay', resumeAt, nextNodeId: connections[0].to });
            nextNodeId = null;
            console.log(`[Chatbot Executor] CTA node: scheduled delay ${delaySeconds}s before next message (user can open link)`);
          } else {
            nextNodeId = connections[0].to;
          }
        }
        break;
      }
      
      case 'ask_question': {
        const question = (data.message || '').toString();
        const responseFormat = (data.responseFormat || 'any').toString();
        const timeoutValue = Number(data.timeoutValue) || 60;
        const timeoutUnit = (data.timeoutUnit || 'seconds').toString();
        const continueOnTimeout = data.continueOnTimeout === true;
        const timeoutMessage = (data.timeoutMessage || '').toString().trim();
        const validationMessage = (data.validationMessage || '').toString().trim();
        const retryCount = Math.min(10, Math.max(1, Number(data.retryCount) || 3)) as number;

        const timeoutMs = timeoutUnit === 'minutes' ? timeoutValue * 60 * 1000
          : timeoutUnit === 'hours' ? timeoutValue * 60 * 60 * 1000
          : timeoutValue * 1000;

        const defaultValidationMessages: Record<string, string> = {
          number: 'Please enter a valid number.',
          email: 'Please enter a valid email address.',
          date: 'Please enter a valid date.',
          text: 'Please enter a valid response.',
        };
        const fallbackValidationMsg = defaultValidationMessages[responseFormat] || 'Invalid input. Please try again.';
        const msgToSend = validationMessage || fallbackValidationMsg;

        const isTimedOut = (): boolean => {
          const askedAt = context.lastQuestionAskedAt;
          if (!askedAt) return false;
          const asked = askedAt instanceof Date ? askedAt.getTime() : new Date(askedAt).getTime();
          return Date.now() - asked > timeoutMs;
        };

        // Only treat inbound text as an answer after we've asked the question (lastQuestionAskedAt is set).
        // When Ask Question is the first node after a trigger, executeFlow passes the trigger/body text as
        // userInput on the first hop only — that must not be consumed as the answer (e.g. template button title).
        const answerInput =
          userInput !== undefined && context.lastQuestionAskedAt != null ? userInput : undefined;

        if (answerInput !== undefined) {
          if (isTimedOut()) {
            if (!continueOnTimeout && timeoutMessage) {
              const sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, timeoutMessage);
              await storeSentMessage(sessionId, senderNumber, timeoutMessage, 'text', sendResult?.id);
            }
            const connections = node.connections || [];
            nextNodeId = connections[0]?.to ?? null;
            break;
          }

          let isValid = true;
          if (responseFormat === 'number' && isNaN(Number(answerInput))) isValid = false;
          else if (responseFormat === 'email' && !answerInput.includes('@')) isValid = false;
          else if (responseFormat === 'date') {
            const d = new Date(answerInput);
            if (isNaN(d.getTime())) isValid = false;
          } else if (responseFormat === 'text' && !answerInput.trim()) isValid = false;

          if (isValid) {
            context.userInput = answerInput;
            context.lastQuestion = question;
            context.nodeOutputs = context.nodeOutputs || {};
            context.nodeOutputs[node.id] = { answer: answerInput };
            delete context.lastQuestionAskedAt;
            delete context.askQuestionRetryCount;
            const connections = node.connections || [];
            if (connections.length > 0) nextNodeId = connections[0].to;
          } else {
            const currentRetries = (context.askQuestionRetryCount || 0) + 1;
            context.askQuestionRetryCount = currentRetries;

            const sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, msgToSend);
            await storeSentMessage(sessionId, senderNumber, msgToSend, 'text', sendResult?.id);

            if (currentRetries >= retryCount) {
              const connections = node.connections || [];
              nextNodeId = connections[0]?.to ?? null;
              delete context.askQuestionRetryCount;
            } else {
              waitingForInput = true;
              nextNodeId = node.id;
            }
          }
        } else {
          if (question) {
            const sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, question);
            await storeSentMessage(sessionId, senderNumber, question, 'text', sendResult?.id);
            responses.push({ type: 'question', question, responseFormat });
          }
          context.lastQuestionAskedAt = new Date();
          context.askQuestionRetryCount = 0;
          waitingForInput = true;
          nextNodeId = node.id;
        }
        break;
      }
      
      case 'ai_agent': {
        const assistantId = (data.assistantId || data.assistant || '').toString();
        const welcomeMessage = (data.welcomeMessage || '').toString();
        const stopKeywords = Array.isArray(data.stopKeywords) ? data.stopKeywords.map((k: any) => String(k).toLowerCase().trim()) : [];
        const timeoutValue = Number(data.timeoutValue) || 60;
        const timeoutUnit = (data.timeoutUnit || 'minutes').toString();
        const timeoutMessage = (data.timeoutMessage || '').toString().trim();
        const timeoutMs = timeoutUnit === 'hours' ? timeoutValue * 60 * 60 * 1000
          : timeoutUnit === 'seconds' ? timeoutValue * 1000
          : timeoutValue * 60 * 1000;
        const userInputLower = (userInput || '').toLowerCase().trim();
        const isFirstEntry = !context.aiAgentWelcomeSent;

        // Scheduled follow-up / timeout resume (no new user message)
        if (context.aiAgentResumeKind && !userInput?.trim()) {
          const kind = context.aiAgentResumeKind;
          delete context.aiAgentResumeKind;
          let msg = kind === 'timeout'
            ? (timeoutMessage || 'We have not heard back from you. Reply anytime to continue.')
            : String(context.aiAgentFollowUpMessage || 'We noticed you have not replied yet. How can we help?');
          // Match language of the last customer message in this AI chat
          try {
            const history = Array.isArray(context.aiChatHistory) ? context.aiChatHistory : [];
            const lastUser = [...history].reverse().find((t: any) => t?.role === 'user' && String(t?.content || '').trim());
            const lastUserText = lastUser ? String(lastUser.content) : '';
            if (lastUserText && assistantId) {
              const session = await storage.getSession(sessionId);
              const userId = session?.userId;
              const organizationId = context.organizationId || session?.organizationId || undefined;
              if (userId) {
                const assistant = organizationId
                  ? await storage.getAiAssistantByOrganization(assistantId, organizationId)
                  : await storage.getAiAssistant(assistantId, userId, organizationId);
                if (assistant) {
                  const apiKey = await resolveAssistantApiKey(assistant, userId);
                  if (apiKey) {
                    msg = await localizeToUserLanguage(apiKey, assistant.model || 'gpt-4o', lastUserText, msg);
                  }
                }
              }
            }
          } catch (e) {
            console.warn('[Chatbot Executor] Follow-up localize failed:', (e as Error).message);
          }
          if (kind === 'followup') context.aiAgentFollowUpSent = true;
          try {
            const sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, msg);
            await storeSentMessage(sessionId, senderNumber, msg, 'text', sendResult?.id);
          } catch (e) {
            console.warn('[Chatbot Executor] AI agent scheduled message failed:', (e as Error).message);
          }
          responses.push({ type: 'ai_agent', message: msg, scheduled: kind });
          waitingForInput = true;
          nextNodeId = node.id;
          break;
        }

        // Stop keywords apply after the first turn — never block the trigger message that started the flow (e.g. "hi").
        const isStopKeyword =
          !isFirstEntry &&
          stopKeywords.length > 0 &&
          stopKeywords.some((keyword: string) => userInputLower.includes(keyword));
        if (isStopKeyword) {
          responses.push({ type: 'ai_agent', stopped: true });
          const connections = (node.connections || []) as { from: string; to: string; fromHandle?: string }[];
          const defaultConn = connections.find((c) => !c.fromHandle || c.fromHandle === 'default') || connections[0];
          nextNodeId = defaultConn?.to ?? null;
          break;
        }

        if (welcomeMessage && isFirstEntry) {
          try {
            const sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, welcomeMessage);
            await storeSentMessage(sessionId, senderNumber, welcomeMessage, 'text', sendResult?.id);
            context.aiAgentWelcomeSent = true;
          } catch (e) {
            console.warn('[Chatbot Executor] AI agent welcome message send failed:', (e as Error).message);
          }
        }

        let aiContent = '';
        if (!assistantId) {
          aiContent = 'Sorry, no AI assistant is configured. Please contact support.';
        } else if (!(userInput || '').trim()) {
          if (welcomeMessage && !context.aiAgentWelcomeSent) {
            try {
              const sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, welcomeMessage);
              await storeSentMessage(sessionId, senderNumber, welcomeMessage, 'text', sendResult?.id);
            } catch (e) {
              console.warn('[Chatbot Executor] AI agent welcome message send failed:', (e as Error).message);
            }
          }
          context.aiAgentWelcomeSent = true;
          waitingForInput = true;
          nextNodeId = node.id;
          break;
        } else {
          try {
            context.aiAssistantId = assistantId;
            const session = await storage.getSession(sessionId);
            const userId = session?.userId;
            const organizationId = context.organizationId || session?.organizationId || undefined;
            if (!userId) {
              aiContent = 'Sorry, there was an authentication error. Please try again.';
            } else {
              const assistant = organizationId
                ? await storage.getAiAssistantByOrganization(assistantId, organizationId)
                : await storage.getAiAssistant(assistantId, userId, organizationId);
              if (!assistant) {
                aiContent = 'Sorry, the assistant is not configured. Please try again later.';
              } else {
                const apiKey = await resolveAssistantApiKey(assistant, userId);
                if (!apiKey) {
                  aiContent = 'Sorry, the assistant is not configured with an API key. Please contact support.';
                } else {
                  const turn = await runAiAgentTurn({
                    assistant,
                    apiKey,
                    userMessage: (userInput || '').trim(),
                    context,
                    organizationId,
                    userId,
                    senderNumber,
                  });
                  aiContent = turn.content;
                  Object.assign(context, turn.contextUpdates);
                  if (turn.scheduleFollowUpAt && !context.aiAgentFollowUpSent) {
                    const rules = parseAgentRules((assistant as any).agentRules);
                    context.aiAgentFollowUpMessage = rules.followUp.message;
                    const timeoutAt = Date.now() + timeoutMs;
                    if (turn.scheduleFollowUpAt <= timeoutAt) {
                      scheduleResumeAt = turn.scheduleFollowUpAt;
                      resumeKind = 'followup';
                      context.aiAgentResumeKind = 'followup';
                    } else if (timeoutMessage) {
                      scheduleResumeAt = timeoutAt;
                      resumeKind = 'timeout';
                      context.aiAgentResumeKind = 'timeout';
                    }
                  } else if (timeoutMessage && timeoutMs > 0) {
                    scheduleResumeAt = Date.now() + timeoutMs;
                    resumeKind = 'timeout';
                    context.aiAgentResumeKind = 'timeout';
                  }
                }
              }
            }
          } catch (err: any) {
            console.error('[Chatbot Executor] AI agent error:', err);
            aiContent = err?.message?.includes('rate limit') ? 'Too many requests. Please wait a moment.' : 'Sorry, something went wrong. Please try again.';
          }
        }

        if (aiContent) {
          try {
            const sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, aiContent);
            await storeSentMessage(sessionId, senderNumber, aiContent, 'text', sendResult?.id);
          } catch (e) {
            console.warn('[Chatbot Executor] AI reply send failed:', (e as Error).message);
          }
          responses.push({ type: 'ai_agent', message: aiContent });
        }

        waitingForInput = true;
        nextNodeId = node.id;
        break;
      }
      
      case 'http': {
        const urlRaw = (data.url || '').toString();
        const url = resolveVariables(urlRaw, context);
        const method = (data.method || 'GET').toString().toUpperCase();
        const headersArr = Array.isArray(data.headers) ? data.headers : [];
        const paramsArr = Array.isArray(data.params) ? data.params : [];
        const bodyRaw = (data.body || '').toString();
        const body = resolveVariables(bodyRaw, context);

        const headersObj: Record<string, string> = {};
        for (const h of headersArr) {
          const k = (h?.key || '').toString().trim();
          if (k) headersObj[k] = resolveVariables(String(h?.value ?? ''), context);
        }
        const paramsObj: Record<string, string> = {};
        for (const p of paramsArr) {
          const k = (p?.key || '').toString().trim();
          if (k) paramsObj[k] = resolveVariables(String(p?.value ?? ''), context);
        }
        const searchParams = new URLSearchParams(paramsObj);
        const fullUrl = searchParams.toString() ? `${url}${url.includes('?') ? '&' : '?'}${searchParams}` : url;

        let status = 0;
        let bodyText = '';
        let ok = false;
        try {
          const fetchRes = await fetch(fullUrl, {
            method,
            headers: headersObj,
            body: ['GET', 'HEAD'].includes(method) ? undefined : (body || undefined),
          });
          status = fetchRes.status;
          bodyText = await fetchRes.text();
          ok = fetchRes.ok;
        } catch (err: any) {
          console.warn('[Chatbot Executor] HTTP node fetch failed:', err?.message);
          bodyText = err?.message || String(err);
        }

        const httpOutput = { success: ok, status, body: bodyText };
        context.nodeOutputs = context.nodeOutputs || {};
        context.nodeOutputs[node.id] = httpOutput;
        responses.push({ type: 'http', nodeId: node.id, ...httpOutput });

        const connections = node.connections || [];
        if (connections.length > 0) {
          nextNodeId = connections[0].to;
        }
        break;
      }

      case 'delay': {
        const delayType = (data.delayType || 'delay_for').toString();
        const connections = (node.connections || []) as { from: string; to: string; fromHandle?: string }[];
        const next = connections.length > 0 ? connections[0].to : null;

        let targetMs: number | null = null;

        if (delayType === 'delay_for') {
          const delayValue = Math.max(0, parseInt(String(data.delayValue ?? 1), 10) || 1);
          const unit = (data.delayUnit || 'minutes').toString().toLowerCase();
          let ms = delayValue * 1000;
          if (unit === 'minutes') ms = delayValue * 60 * 1000;
          else if (unit === 'hours') ms = delayValue * 60 * 60 * 1000;
          else if (unit === 'days') ms = delayValue * 24 * 60 * 60 * 1000;
          targetMs = ms;
        } else if (delayType === 'delay_until_date') {
          const dateStr = (data.delayUntilDate || '').toString().trim();
          const tz = (data.delayTimezone || 'Asia/Kolkata').toString();
          if (dateStr) {
            try {
              const isoStr = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
              const targetDate = fromZonedTime(isoStr, tz);
              targetMs = Math.max(0, targetDate.getTime() - Date.now());
            } catch (e) {
              console.warn('[Chatbot Executor] Delay until date parse failed:', (e as Error).message);
            }
          }
        } else if (delayType === 'delay_until_weekday') {
          const weekday = parseInt(String(data.delayWeekday ?? 1), 10); // 0=Sun, 1=Mon, ...
          const timeStr = (data.delayUntilTime || '09:00').toString();
          const tz = (data.delayTimezone || 'Asia/Kolkata').toString();
          try {
            const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10) || 0);
            const now = new Date();
            const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
            for (let offset = 0; offset < 8; offset++) {
              const d = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
              const parts = fmt.formatToParts(d);
              const y = parts.find((p) => p.type === 'year')?.value ?? '';
              const mo = parts.find((p) => p.type === 'month')?.value ?? '';
              const day = parts.find((p) => p.type === 'day')?.value ?? '';
              const dowFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
              const dowNum = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(dowFmt.format(d).toLowerCase());
              if (dowNum !== weekday) continue;
              const dateStr = `${y}-${mo}-${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
              const targetDate = fromZonedTime(dateStr, tz);
              targetMs = Math.max(0, targetDate.getTime() - Date.now());
              break;
            }
          } catch (e) {
            console.warn('[Chatbot Executor] Delay until weekday parse failed:', (e as Error).message);
          }
        }

        if (targetMs != null && targetMs > 0) {
          const resumeAt = Date.now() + targetMs;
          responses.push({ type: 'scheduledDelay', resumeAt, nextNodeId: next });
          nextNodeId = null;
          console.log(
            `[Chatbot Executor] Delay node ${node.id}: scheduled resume in ${Math.round(targetMs / 1000)}s → ${next ?? 'end'}`
          );
        } else {
          nextNodeId = next;
        }
        break;
      }

      case 'send_product': {
        const catalogId = (data.catalogId || '').toString().trim();
        const productId = (data.productId || data.productRetailerId || '').toString().trim();
        const body = (data.body || '').toString();
        const footer = (data.footer || '').toString();
        const sessionRow = await storage.getSession(sessionId);
        if (catalogId && productId && sessionRow?.connectionType === 'official') {
          try {
            const sendResult = await businessAPIManager.sendProductMessage(sessionId, senderNumber, {
              catalogId,
              productRetailerId: productId,
              body: body || undefined,
              footer: footer || undefined,
            });
            await storeSentMessage(sessionId, senderNumber, body || `[Product: ${productId}]`, 'text', sendResult?.id);
            responses.push({ type: 'product', catalogId, productId });
            console.log(`[Chatbot Executor] Product message sent`);
          } catch (err: any) {
            console.warn('[Chatbot Executor] Send product failed:', err?.message);
            if (body) {
              const sendResult = await businessAPIManager.sendTextMessage(sessionId, senderNumber, body + (footer ? `\n${footer}` : ''));
              await storeSentMessage(sessionId, senderNumber, body, 'text', sendResult?.id);
            }
          }
        } else if (body) {
          const sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, body + (footer ? `\n${footer}` : ''));
          await storeSentMessage(sessionId, senderNumber, body, 'text', sendResult?.id);
          responses.push({ type: 'text', message: body });
        }
        const connections = (node.connections || []) as { from: string; to: string }[];
        if (connections.length > 0) nextNodeId = connections[0].to;
        break;
      }

      case 'ask_location': {
        const locationMessage = (data.message || 'Please share your location.').toString().trim();
        const isFirstEntry = !context.locationRequestSent;
        if (isFirstEntry && locationMessage) {
          try {
            let sendResult: any;
            // Official Cloud API supports native location-request interactive button.
            if (typeof (whatsappManager as any).sendLocationRequestMessage === 'function') {
              sendResult = await (whatsappManager as any).sendLocationRequestMessage(
                sessionId,
                senderNumber,
                locationMessage,
              );
            } else {
              // Fallback for transports that don't support interactive location request.
              sendResult = await whatsappManager.sendTextMessage(sessionId, senderNumber, locationMessage);
            }
            await storeSentMessage(sessionId, senderNumber, locationMessage, 'text', sendResult?.id);
            context.locationRequestSent = true;
            responses.push({ type: 'text', message: locationMessage });
          } catch (err: any) {
            console.warn('[Chatbot Executor] Ask location message failed:', err?.message);
          }
          waitingForInput = true;
          nextNodeId = node.id;
        } else {
          // User replied (with location or text) — follow connection
          const connections = (node.connections || []) as { from: string; to: string }[];
          if (connections.length > 0) nextNodeId = connections[0].to;
        }
        break;
      }

      case 'send_template': {
        const templateName = (data.templateName || '').toString().trim();
        const templateLanguage = (data.templateLanguage || 'en').toString().trim();
        const templateParamsRaw = Array.isArray(data.templateParams) ? data.templateParams.map((p: any) => String(p ?? '')) : [];
        const templateParams = templateParamsRaw.map((p) => resolveVariables(p, context));
        const recipientNumberRaw = (data.recipientNumber || '').toString().trim();
        const recipientNumber = resolveVariables(recipientNumberRaw, context).trim();
        const to = recipientNumber || senderNumber;
        const sendSessionId = (data.sessionId || sessionId).toString().trim() || sessionId;
        const sendManager = await getWhatsAppManager(sendSessionId);
        if (!templateName) {
          console.warn('[Chatbot Executor] Send Template node: no template selected');
          const connections = (node.connections || []) as { from: string; to: string }[];
          if (connections.length > 0) nextNodeId = connections[0].to;
          break;
        }
        if (sendManager && typeof (sendManager as any).sendTemplateMessage === 'function') {
          try {
            const isFormTemplate = !!(data.isFormTemplate === true || data.flowId);
            const flowButton = isFormTemplate
              ? { flowToken: typeof data.flowToken === 'string' ? data.flowToken : undefined, flowActionData: undefined }
              : undefined;

            let templateMetaForAuth: TemplateMetaForAuth | null = null;
            try {
              const sess = await storage.getSession(sendSessionId);
              if (sess?.userId) {
                const orgs = await storage.getOrganizationsByUser(sess.userId);
                const orgId = orgs[0]?.id ?? null;
                const apiPnId = sess.deviceInfo?.apiPhoneNumberId;
                const tpls = await storage.getMessageTemplatesByUser(sess.userId, orgId, apiPnId);
                const row = tpls.find(
                  (t: any) =>
                    (t.status === 'APPROVED' || String(t.status || '').toLowerCase() === 'approved') &&
                    (t.name === templateName || t.name?.toLowerCase() === templateName.toLowerCase())
                );
                if (row && String(row.category || '').toUpperCase() === 'AUTHENTICATION') {
                  templateMetaForAuth = { category: row.category, components: row.components };
                }
              }
            } catch (metaErr: any) {
              console.warn('[Chatbot Executor] Template meta for auth OTP:', metaErr?.message);
            }

            const sendResult = await (sendManager as any).sendTemplateMessage(
              sendSessionId,
              to,
              templateName,
              templateLanguage,
              templateParams.length > 0 ? templateParams : undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              flowButton,
              undefined,
              undefined,
              undefined,
              undefined,
              templateMetaForAuth
            );
            await storeSentMessage(sendSessionId, to, `[Template: ${templateName}]`, 'template', sendResult?.id);
            responses.push({ type: 'template', templateName, messageId: sendResult?.id });
            console.log(`[Chatbot Executor] Template "${templateName}" sent to ${to}`);
          } catch (err: any) {
            console.error('[Chatbot Executor] Send template failed:', err?.message);
          }
        } else {
          console.warn('[Chatbot Executor] Send Template requires Business API (official) session. Skipping.');
        }
        const connections = (node.connections || []) as { from: string; to: string }[];
        if (connections.length > 0) nextNodeId = connections[0].to;
        break;
      }

      case 'condition': {
        const matchType = (data.matchType || 'all').toString().toLowerCase();
        const matchSensitivity = Math.max(0, Math.min(100, parseInt(String(data.matchSensitivity ?? 80), 10) || 80));
        const conditionsRaw = Array.isArray(data.conditions) ? data.conditions : [];
        const conditions = conditionsRaw.map((c: any) => ({
          firstValue: String(c?.firstValue ?? '').trim(),
          operator: (c?.operator || 'equals').toString().toLowerCase(),
          secondValue: String(c?.secondValue ?? '').trim(),
        }));
        const resolvedConditions = conditions.map((c: { firstValue: string; operator: string; secondValue: string }) => ({
          ...c,
          firstValue: resolveVariables(c.firstValue, context).trim(),
          secondValue: resolveVariables(c.secondValue, context).trim(),
        }));
        function evalOne(first: string, op: string, second: string): boolean {
          const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          switch (op) {
            case 'equals':
              return first === second;
            case 'not_equals':
              return first !== second;
            case 'contains':
              return first.includes(second);
            case 'starts_with':
              return first.startsWith(second);
            case 'ends_with':
              return first.endsWith(second);
            case 'is_phone':
              return phoneRegex.test(first);
            case 'is_email':
              return emailRegex.test(first);
            case 'greater_than':
              return Number(first) > Number(second);
            case 'less_than':
              return Number(first) < Number(second);
            case 'matches_regex':
              try {
                return new RegExp(second).test(first);
              } catch {
                return false;
              }
            case 'fuzzy_match': {
              const threshold = matchSensitivity / 100;
              const similarity = calculateSimilarity(first.toLowerCase(), second.toLowerCase());
              if (similarity >= threshold) return true;
              if (first.toLowerCase().includes(second.toLowerCase()) || second.toLowerCase().includes(first.toLowerCase())) return true;
              return false;
            }
            case 'within_working_hours': {
              const wh = parseWorkingHoursCondition(second) || {
                enabled: true,
                timezone: first || 'Asia/Kolkata',
                startTime: '11:00',
                endTime: '19:00',
                weekdays: [1, 2, 3, 4, 5],
                afterHoursMessage: '',
              };
              if (first && first.includes('/')) wh.timezone = first;
              return isWithinWorkingHours(wh);
            }
            case 'outside_working_hours': {
              const wh = parseWorkingHoursCondition(second) || {
                enabled: true,
                timezone: first || 'Asia/Kolkata',
                startTime: '11:00',
                endTime: '19:00',
                weekdays: [1, 2, 3, 4, 5],
                afterHoursMessage: '',
              };
              if (first && first.includes('/')) wh.timezone = first;
              return !isWithinWorkingHours(wh);
            }
            default:
              return first === second;
          }
        }
        const results = resolvedConditions.map((c) => evalOne(c.firstValue, c.operator, c.secondValue));
        const result = matchType === 'any' ? results.some(Boolean) : results.every(Boolean);
        const outcome = result ? 'true' : 'false';
        const connections = (node.connections || []) as { from: string; to: string; fromHandle?: string }[];
        const conn = connections.find((c) => c.fromHandle === outcome);
        if (conn) {
          nextNodeId = conn.to;
          console.log(`[Chatbot Executor] Condition node ${node.id} -> ${outcome} -> ${nextNodeId}`);
        }
        break;
      }

      case 'update_columns': {
        const columnUpdates = Array.isArray(data.columnUpdates) ? data.columnUpdates : [];
        const updates = columnUpdates.filter((u: any) => (
          (u?.columnId && typeof u.columnId === 'string' && u.columnId.trim()) ||
          (u?.columnName && typeof u.columnName === 'string' && u.columnName.trim())
        ));
        if (updates.length > 0) {
          const session = await storage.getSession(sessionId);
          if (session) {
            const userId = session.userId;
            const organizationId = String(context.organizationId || '').trim();
            if (!organizationId) {
              console.warn(
                `[Chatbot Executor] Update Columns node ${node.id}: missing organizationId (WhatsApp sessions have no org — link chatbot to org or ensure user has an organization)`
              );
            } else {
            const availableColumns = await storage.getContactColumnsByOrganization(organizationId);
            const byId = new Map(availableColumns.map((c) => [String(c.id).trim(), c.id]));
            const byLabel = new Map(
              availableColumns.map((c) => [String(c.label || '').trim().toLowerCase(), c.id])
            );
            const contacts = await storage.getManagedContactsByOrganization(organizationId);
            let contact = findManagedContactBySender(contacts, senderNumber);
            if (!contact) {
              try {
                contact = await storage.createManagedContact(
                  {
                    userId,
                    organizationId,
                    name: normalizePhoneNumber(senderNumber) || 'WhatsApp Contact',
                    phoneNumber: normalizePhoneNumber(senderNumber),
                    source: 'whatsapp',
                    customFields: {},
                  },
                  { skipAutomation: true }
                );
                console.log(`[Chatbot Executor] Update Columns: created contact ${contact.id} for ${senderNumber}`);
              } catch (createErr: any) {
                console.warn(`[Chatbot Executor] Update Columns: could not create contact:`, createErr?.message);
              }
            }
            if (contact) {
              const customFields = { ...(contact.customFields || {}) };
              for (const u of updates) {
                const rawColumnId = String(u.columnId || '').trim();
                const rawColumnName = String(u.columnName || '').trim();
                const resolvedColumnId =
                  byId.get(rawColumnId) ||
                  byLabel.get(rawColumnId.toLowerCase()) ||
                  byLabel.get(rawColumnName.toLowerCase()) ||
                  rawColumnId;
                if (!resolvedColumnId) continue;
                const valRaw = u.value != null ? String(u.value) : '';
                customFields[resolvedColumnId] = resolveVariables(valRaw, context);
              }
              await storage.updateManagedContact(contact.id, contact.userId, organizationId, { customFields }, {
                skipAutomation: true,
              });
              console.log(`[Chatbot Executor] Update Columns node ${node.id}: updated ${updates.length} field(s) for contact ${contact.id} (org=${organizationId})`);
            } else {
              console.warn(`[Chatbot Executor] Update Columns node ${node.id}: no managed contact found for sender ${senderNumber}, skipping column updates`);
            }
            }
          } else {
            console.warn(`[Chatbot Executor] Update Columns node ${node.id}: session not found, skipping column updates`);
          }
        }
        const connections = node.connections || [];
        nextNodeId = connections.length > 0 ? connections[0].to : null;
        break;
      }

      case 'update_tag': {
        const tagIds = Array.isArray(data.tagIds) ? data.tagIds : [];
        const action = data.action === 'remove' ? 'remove' : 'add';
        if (tagIds.length > 0) {
          const session = await storage.getSession(sessionId);
          if (session) {
            const organizationId = String(context.organizationId || '').trim();
            if (!organizationId) {
              console.warn(`[Chatbot Executor] Update Tag node ${node.id}: missing organizationId — skipping`);
            } else {
            const contacts = await storage.getManagedContactsByOrganization(organizationId);
            const contact = findManagedContactBySender(contacts, senderNumber);
            if (contact) {
              for (const tagId of tagIds) {
                try {
                  if (action === 'add') {
                    await storage.assignTagToContact(contact.id, tagId, contact.userId, organizationId);
                  } else {
                    await storage.removeTagFromContact(contact.id, tagId, contact.userId, organizationId);
                  }
                } catch (err: any) {
                  console.warn(`[Chatbot Executor] Update Tag node ${node.id}: could not ${action} tag ${tagId}:`, err.message);
                }
              }
              console.log(`[Chatbot Executor] Update Tag node ${node.id}: ${action}ed ${tagIds.length} tag(s) for contact ${contact.id}`);
            } else {
              console.warn(`[Chatbot Executor] Update Tag node ${node.id}: no managed contact found for sender ${senderNumber}`);
            }
            }
          }
        }
        const connections = node.connections || [];
        nextNodeId = connections.length > 0 ? connections[0].to : null;
        break;
      }

      case 'fetch_contact': {
        const session = await storage.getSession(sessionId);
        if (session) {
          const userId = session.userId;
          const organizationId = String(context.organizationId || '').trim();
          if (!organizationId) {
            console.warn(`[Chatbot Executor] Fetch Contact node ${node.id}: missing organizationId — skipping`);
            responses.push({ type: 'fetchedContact', nodeId: node.id, contact: null });
          } else {
            const normalizedSender = normalizePhoneNumber(senderNumber).replace(/\D/g, '');
            const contacts = await storage.getManagedContactsByUser(userId, organizationId);
            const contact = contacts.find((c) => {
              const normalized = (c.phoneNumber || '').replace(/\D/g, '');
              return normalized === normalizedSender || normalized.endsWith(normalizedSender) || normalizedSender.endsWith(normalized);
            });
            if (contact) {
              const payload = {
                id: contact.id,
                name: contact.name,
                email: contact.email,
                phoneNumber: contact.phoneNumber,
                columns: contact.customFields || {},
              };
              responses.push({ type: 'fetchedContact', nodeId: node.id, contact: payload });
              context.nodeOutputs = context.nodeOutputs || {};
              const colMap =
                typeof payload.columns === "object" && payload.columns ? (payload.columns as Record<string, unknown>) : {};
              context.nodeOutputs[node.id] = {
                ...colMap,
                id: payload.id,
                name: payload.name,
                email: payload.email,
                phoneNumber: payload.phoneNumber,
              };
              console.log(`[Chatbot Executor] Fetch Contact node ${node.id}: loaded contact ${contact.id}`);
            } else {
              responses.push({ type: 'fetchedContact', nodeId: node.id, contact: null });
            }
          }
        } else {
          responses.push({ type: 'fetchedContact', nodeId: node.id, contact: null });
        }
        const connections = node.connections || [];
        nextNodeId = connections.length > 0 ? connections[0].to : null;
        break;
      }

      case 'stop_chatbot':
        // No outgoing connection; flow ends. Conversation state is cleared in executeFlow when no next node.
        console.log(`[Chatbot Executor] Stop Chatbot node ${node.id}: ending session`);
        nextNodeId = null;
        break;

      case 'append_google_sheet': {
        const connectionId = String(data.connectionId || '').trim();
        const spreadsheetId = resolveVariables(String(data.spreadsheetId || '').trim(), context);
        const worksheetId = resolveVariables(String(data.worksheetId || '').trim(), context);
        const rowRaw =
          data.row && typeof data.row === 'object' && !Array.isArray(data.row) ? (data.row as Record<string, unknown>) : {};
        const row: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rowRaw)) {
          row[k] = resolveVariables(String(v ?? ''), context);
        }
        let ok = false;
        let errMsg = '';
        if (!connectionId || !spreadsheetId || !worksheetId) {
          errMsg = 'append_google_sheet: connection, spreadsheet, and worksheet are required';
          console.warn(`[Chatbot Executor] ${errMsg}`);
        } else {
          try {
            const session = await storage.getSession(sessionId);
            if (!session) throw new Error('Session not found');
            const integ = await storage.getIntegrationById(connectionId);
            if (!integ || integ.name !== 'google-sheets' || integ.status !== 'connected') {
              throw new Error('Google Sheets integration not found or not connected');
            }
            const sessionOrg = (session as { organizationId?: string | null }).organizationId ?? null;
            if (sessionOrg) {
              if (integ.organizationId && integ.organizationId !== sessionOrg) {
                throw new Error('Integration organization does not match session');
              }
              if (!integ.organizationId && integ.userId !== session.userId) {
                throw new Error('Integration owner does not match session');
              }
            } else if (integ.userId !== session.userId) {
              throw new Error('Integration owner does not match session');
            }
            await appendGoogleSheetRowWithIntegration(integ, spreadsheetId, worksheetId, row);
            ok = true;
          } catch (e: unknown) {
            errMsg = e instanceof Error ? e.message : String(e);
            console.warn(`[Chatbot Executor] append_google_sheet failed:`, errMsg);
          }
        }
        context.nodeOutputs = context.nodeOutputs || {};
        context.nodeOutputs[node.id] = { success: ok, error: errMsg || undefined };
        responses.push({ type: 'append_google_sheet', nodeId: node.id, success: ok, error: errMsg || undefined });
        {
          const connections = node.connections || [];
          if (connections.length > 0) nextNodeId = connections[0].to;
        }
        break;
      }

      default:
        console.warn(`[Chatbot Executor] Unknown node type: ${node.nodeType}`);
        // Follow first connection anyway
        const connections = node.connections || [];
        if (connections.length > 0) {
          nextNodeId = connections[0].to;
        }
    }
  } catch (error: any) {
    console.error(`[Chatbot Executor] Error executing node ${node.id}:`, error);
    // Try to continue to next node on error
    const connections = node.connections || [];
    if (connections.length > 0) {
      nextNodeId = connections[0].to;
    }
  }
  
  return { nextNodeId, waitingForInput, responses, scheduleResumeAt, resumeKind };
}

// Execute chatbot flow
async function executeFlow(
  chatbot: Chatbot,
  nodes: ChatbotNode[],
  startNodeId: string,
  sessionId: string,
  senderNumber: string,
  userInput?: string,
  existingContext: Record<string, any> = {},
  targetNodeId?: string | null // Optional: route to specific node (for button/list replies)
): Promise<void> {
  const nodeMap = new Map<string, ChatbotNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const sessionForCrm = await storage.getSession(sessionId);
  const priorOrg =
    typeof existingContext.organizationId === 'string' && existingContext.organizationId.trim()
      ? existingContext.organizationId.trim()
      : undefined;
  const crmOrgResolved =
    sessionForCrm &&
    (await resolveCrmOrganizationId(sessionForCrm.userId, chatbot, priorOrg));

  let currentNodeId: string | null = startNodeId;
  let context: Record<string, any> = {
    ...existingContext,
    organizationId: crmOrgResolved ?? existingContext.organizationId,
  };
  let waitingForInput = false;
  let pendingAiAgentResumeAt: number | undefined;
  
  // Execute nodes in sequence until we hit a terminal node or need user input
  // If targetNodeId is set (from button/list reply), start from there instead
  if (targetNodeId) {
    currentNodeId = targetNodeId;
    console.log(`[Chatbot Executor] Starting flow from target node: ${targetNodeId} (original start: ${startNodeId})`);
  } else {
    console.log(`[Chatbot Executor] Starting flow from node: ${startNodeId}`);
  }
  
  let iterationCount = 0;
  const maxIterations = 50; // Prevent infinite loops
  
  while (currentNodeId && iterationCount < maxIterations) {
    iterationCount++;
    const node = nodeMap.get(currentNodeId);
    if (!node) {
      console.error(`[Chatbot Executor] Node not found: ${currentNodeId} (flow may have been republished). Clearing conversation state.`);
      conversationStates.delete(getConversationKey(senderNumber, chatbot.id, sessionId));
      break;
    }
    
    console.log(`[Chatbot Executor] Executing node ${currentNodeId} (${node.nodeType}), iteration ${iterationCount}`);
    
    const result = await executeNode(node, sessionId, senderNumber, userInput, context);
    
    console.log(`[Chatbot Executor] Node ${currentNodeId} executed:`, {
      nodeType: node.nodeType,
      nextNodeId: result.nextNodeId,
      waitingForInput: result.waitingForInput,
      responsesCount: result.responses.length,
    });
    
    // Update context with any new data (preserve button/list maps)
    const newContext = { ...context, ...result.responses.reduce((acc, r) => ({ ...acc, [r.type]: r }), {}) };
    // Merge fetched contact(s) by node id so later steps can use e.g. context.fetchedContactsByNode[nodeId].columns.email
    const fetchedContactResponses = result.responses.filter((r: any) => r.type === 'fetchedContact' && r.nodeId);
    if (fetchedContactResponses.length > 0) {
      const byNode = { ...(context.fetchedContactsByNode || {}) };
      for (const r of fetchedContactResponses) {
        byNode[r.nodeId] = r.contact;
      }
      newContext.fetchedContactsByNode = byNode;
    }
    // Preserve button/list mappings and node outputs if they exist
    if (context.buttonMap) newContext.buttonMap = context.buttonMap;
    if (context.listMap) newContext.listMap = context.listMap;
    if (context.lastButtonNodeId) newContext.lastButtonNodeId = context.lastButtonNodeId;
    if (context.lastListNodeId) newContext.lastListNodeId = context.lastListNodeId;
    if (context.buttonMapsByNode) newContext.buttonMapsByNode = { ...(newContext.buttonMapsByNode || {}), ...context.buttonMapsByNode };
    if (context.listMapsByNode) newContext.listMapsByNode = { ...(newContext.listMapsByNode || {}), ...context.listMapsByNode };
    if (context.nodeOutputs) newContext.nodeOutputs = context.nodeOutputs;
    // Preserve AI agent memory and booking state from in-place context mutations
    if (context.aiChatHistory) newContext.aiChatHistory = context.aiChatHistory;
    if (context.customerEmail) newContext.customerEmail = context.customerEmail;
    if (context.offeredSlots) newContext.offeredSlots = context.offeredSlots;
    if (context.bookingFlow) newContext.bookingFlow = context.bookingFlow;
    if (context.bookingConfirmed) newContext.bookingConfirmed = context.bookingConfirmed;
    if (context.aiAgentWelcomeSent) newContext.aiAgentWelcomeSent = context.aiAgentWelcomeSent;
    if (context.aiAgentFollowUpSent) newContext.aiAgentFollowUpSent = context.aiAgentFollowUpSent;
    if (context.aiAgentFollowUpMessage) newContext.aiAgentFollowUpMessage = context.aiAgentFollowUpMessage;
    if (context.aiAgentResumeKind) newContext.aiAgentResumeKind = context.aiAgentResumeKind;
    context = newContext;

    if (result.scheduleResumeAt) {
      pendingAiAgentResumeAt = result.scheduleResumeAt;
    }
    
    // If scheduled delay (beyond 5 min), save state and stop - scheduler will resume
    const scheduledDelay = result.responses.find((r: any) => r.type === 'scheduledDelay');
    if (scheduledDelay && scheduledDelay.resumeAt && scheduledDelay.nextNodeId) {
      const conversationKey = getConversationKey(senderNumber, chatbot.id, sessionId);
      const existingStateForDelay = conversationStates.get(conversationKey);
      const preservedButtonMap = context.buttonMap ? new Map(Object.entries(context.buttonMap)) : existingStateForDelay?.buttonMap;
      const preservedListMap = context.listMap ? new Map(Object.entries(context.listMap)) : existingStateForDelay?.listMap;
      const preservedButtonMapsByNode = context.buttonMapsByNode || existingStateForDelay?.buttonMapsByNode;
      const preservedListMapsByNode =
        context.listMapsByNode || existingStateForDelay?.listMapsByNode;
      conversationStates.set(conversationKey, {
        userId: senderNumber,
        chatbotId: chatbot.id,
        currentNodeId: scheduledDelay.nextNodeId,
        waitingForInput: false,
        context,
        lastActivity: new Date(),
        sessionId,
        resumeAt: scheduledDelay.resumeAt,
        lastButtonNodeId: context.lastButtonNodeId || existingStateForDelay?.lastButtonNodeId,
        buttonMap: preservedButtonMap,
        buttonMapsByNode: preservedButtonMapsByNode,
        lastListNodeId: context.lastListNodeId || existingStateForDelay?.lastListNodeId,
        listMap: preservedListMap,
        listMapsByNode: preservedListMapsByNode,
      });
      console.log(`[Chatbot Executor] Delay scheduled - will resume at ${new Date(scheduledDelay.resumeAt).toISOString()}`);
      return;
    }
    
    // If waiting for input, stop execution
    if (result.waitingForInput) {
      waitingForInput = true;
      if (nodeWaitsForTextInput(node)) {
        // Stale button/list maps must not block free-form answers on resume (e.g. Ask Question after Send Button).
        delete context.buttonMap;
        delete context.listMap;
      }
      console.log(`[Chatbot Executor] Flow paused - waiting for user input at node ${currentNodeId}`);
      break;
    }

    currentNodeId = result.nextNodeId;
    userInput = undefined;

    if (!currentNodeId) {
      console.log(`[Chatbot Executor] Flow completed - no more nodes to execute`);
    }
  }
  
  if (iterationCount >= maxIterations) {
    console.warn(`[Chatbot Executor] Flow stopped - reached max iterations (${maxIterations})`);
  }
  
  // Update conversation state
  const conversationKey = getConversationKey(senderNumber, chatbot.id, sessionId);
  const existingState = conversationStates.get(conversationKey);
  
  // Check if we should restore to button/list node after flow completion
  const shouldRestoreToButtonNode = !waitingForInput && !currentNodeId && 
    (existingState?.lastButtonNodeId || existingState?.lastListNodeId) &&
    (existingState?.buttonMap?.size || existingState?.listMap?.size);
  
  if (waitingForInput || currentNodeId || shouldRestoreToButtonNode) {
    if (shouldRestoreToButtonNode) {
      // Flow completed, but restore to button/list node so other buttons can still be clicked
      const restoreNodeId = existingState?.lastButtonNodeId || existingState?.lastListNodeId;
      console.log(`[Chatbot Executor] Flow completed, restoring to button/list node ${restoreNodeId} to allow other button clicks`);
      conversationStates.set(conversationKey, {
        userId: senderNumber,
        chatbotId: chatbot.id,
        currentNodeId: restoreNodeId!,
        waitingForInput: true, // Keep waiting for other button clicks
        context: existingState?.context || {},
        lastActivity: new Date(),
        sessionId,
        // Preserve button/list mappings so other buttons can be clicked
        lastButtonNodeId: existingState?.lastButtonNodeId,
        buttonMap: existingState?.buttonMap,
        buttonMapsByNode: existingState?.buttonMapsByNode,
        lastListNodeId: existingState?.lastListNodeId,
        listMap: existingState?.listMap,
        listMapsByNode: existingState?.listMapsByNode,
      });
    } else {
      // Preserve button/list mappings from context or existing state
      // This ensures button maps persist even when context is cleared
      const preservedButtonMapsByNode = context.buttonMapsByNode
        ? { ...(existingState?.buttonMapsByNode || {}), ...context.buttonMapsByNode }
        : existingState?.buttonMapsByNode;
      const preservedListMapsByNode = context.listMapsByNode
        ? { ...(existingState?.listMapsByNode || {}), ...context.listMapsByNode }
        : existingState?.listMapsByNode;

      const waitNode = currentNodeId ? nodeMap.get(currentNodeId) : undefined;
      const waitsForTextInput = waitingForInput && nodeWaitsForTextInput(waitNode);
      const preservedButtonMap = waitsForTextInput
        ? undefined
        : context.buttonMap
          ? new Map(Object.entries(context.buttonMap))
          : existingState?.buttonMap;
      const preservedListMap = waitsForTextInput
        ? undefined
        : context.listMap
          ? new Map(Object.entries(context.listMap))
          : existingState?.listMap;

      conversationStates.set(conversationKey, {
        userId: senderNumber,
        chatbotId: chatbot.id,
        currentNodeId: currentNodeId || startNodeId,
        waitingForInput,
        context,
        lastActivity: new Date(),
        sessionId,
        resumeAt: pendingAiAgentResumeAt ?? existingState?.resumeAt,
        // Preserve button/list mappings from context or existing state
        lastButtonNodeId: context.lastButtonNodeId || existingState?.lastButtonNodeId,
        buttonMap: preservedButtonMap,
        buttonMapsByNode: preservedButtonMapsByNode,
        lastListNodeId: context.lastListNodeId || existingState?.lastListNodeId,
        listMap: preservedListMap,
        listMapsByNode: preservedListMapsByNode,
      });
    }
  } else {
    // Flow completed, remove conversation state
    conversationStates.delete(conversationKey);
  }
}

/** Session IDs from the trigger node (supports multi-select triggerSessionIds). */
function getTriggerSessionIdsFromNodes(nodes: ChatbotNode[]): string[] {
  const triggerNode = nodes.find((n) => n.nodeType === 'trigger');
  if (!triggerNode) return [];
  const triggerData = triggerNode.data as any;
  if (Array.isArray(triggerData?.triggerSessionIds) && triggerData.triggerSessionIds.length > 0) {
    return triggerData.triggerSessionIds.filter(Boolean);
  }
  if (triggerData?.triggerSessionId) {
    return [triggerData.triggerSessionId];
  }
  return [];
}

/** Exact session match or same WhatsApp phone number ID (wb_<phoneNumberId>_...). */
function sessionMatchesTriggerSessionIds(sessionId: string, triggerSessionIds: string[]): boolean {
  if (triggerSessionIds.includes(sessionId)) return true;
  const currentPhoneId = sessionId.startsWith('wb_') ? sessionId.split('_')[1] : null;
  if (!currentPhoneId) return false;
  return triggerSessionIds.some(
    (tid: string) => tid.startsWith('wb_') && tid.split('_')[1] === currentPhoneId
  );
}

/**
 * Whether a chatbot should run for this WhatsApp session.
 * Multi-number bots store all IDs on the trigger node but only the first on chatbot.sessionId.
 */
function chatbotAppliesToSession(
  chatbot: { sessionId?: string | null },
  sessionId: string,
  nodes: ChatbotNode[]
): boolean {
  const triggerSessionIds = getTriggerSessionIdsFromNodes(nodes);
  if (triggerSessionIds.length > 0) {
    return sessionMatchesTriggerSessionIds(sessionId, triggerSessionIds);
  }
  if (chatbot.sessionId) {
    return sessionMatchesTriggerSessionIds(sessionId, [chatbot.sessionId]);
  }
  // No numbers selected = apply to every number (On Message / All catch-all).
  return true;
}

/** Check for scheduled delays that are due and resume those flows */
export async function checkAndResumeScheduledDelays(): Promise<void> {
  const now = Date.now();
  const toResume: { key: string; state: ConversationState }[] = [];
  for (const [key, state] of conversationStates.entries()) {
    if (state.resumeAt != null && state.resumeAt <= now && state.sessionId) {
      toResume.push({ key, state });
    }
  }
  for (const { key, state } of toResume) {
    try {
      const session = await storage.getSession(state.sessionId!);
      if (!session) {
        conversationStates.delete(key);
        continue;
      }
      const userId = session.userId;
      const organizationId = (session as any).organizationId || undefined;
      const { isOrganizationPlanActive, isUserPlanActive } = await import("../utils/org-subscription-gate");
      const planOk = organizationId
        ? await isOrganizationPlanActive(organizationId)
        : await isUserPlanActive(userId);
      if (!planOk) {
        conversationStates.delete(key);
        console.log(`[Chatbot Delay Scheduler] Dropped delayed flow — subscription expired`);
        continue;
      }
      const chatbot = organizationId
        ? await storage.getChatbotByOrganization(state.chatbotId, organizationId)
        : await storage.getChatbot(state.chatbotId, userId, organizationId);
      const nodes = await storage.getChatbotNodes(state.chatbotId);
      if (!chatbot || chatbot.status !== 'published' || !chatbotAppliesToSession(chatbot, state.sessionId!, nodes)) {
        conversationStates.delete(key);
        continue;
      }
      const nodeIds = new Set(nodes.map((n) => n.id));
      if (!nodeIds.has(state.currentNodeId)) {
        conversationStates.delete(key);
        continue;
      }
      // Clear resumeAt before resuming so we don't re-trigger
      const { resumeAt: _, ...stateWithoutResume } = state;
      conversationStates.set(key, { ...stateWithoutResume, resumeAt: undefined });
      await executeFlow(chatbot, nodes, state.currentNodeId, state.sessionId!, state.userId, undefined, state.context);
    } catch (err: any) {
      console.error('[Chatbot Delay Scheduler] Error resuming flow:', err?.message);
    }
  }
}

// Main entry point: process incoming message for chatbots
export async function processMessageForChatbots(
  sessionId: string,
  senderNumber: string,
  messageBody: string,
  userId?: string,
  organizationId?: string,
  interactiveData?: {
    type?: 'button_reply' | 'list_reply';
    buttonReply?: { id?: string; title?: string };
    listReply?: { id?: string; title?: string };
    isTemplateButton?: boolean; // true when message.type === 'button' (template Quick Reply)
  }
): Promise<void> {
  try {
    // Clean up old conversations periodically
    if (Math.random() < 0.01) { // 1% chance per message
      cleanupOldConversations();
    }
    
    // Get session to find userId/organizationId if not provided
    const session = await storage.getSession(sessionId);
    if (!session) {
      console.warn(`[Chatbot Executor] Session not found: ${sessionId}`);
      return;
    }
    
    const effectiveUserId = userId || session.userId;
    let effectiveOrgId = organizationId || (session as { organizationId?: string | null }).organizationId || undefined;
    if (!effectiveOrgId) {
      const orgs = await storage.getOrganizationsByUser(effectiveUserId);
      effectiveOrgId = orgs[0]?.id;
    }

    // Stop chatbots / FAQ when the org owner's subscription period has ended
    const { isOrganizationPlanActive, isUserPlanActive } = await import("../utils/org-subscription-gate");
    const planOk = effectiveOrgId
      ? await isOrganizationPlanActive(effectiveOrgId)
      : await isUserPlanActive(effectiveUserId);
    if (!planOk) {
      console.log(
        `[Chatbot Executor] Skipping chatbots/FAQ — subscription expired (org=${effectiveOrgId || "none"} user=${effectiveUserId})`
      );
      return;
    }

    const { optedOut, keywordAction } = await import("../opt-keyword-service").then((m) =>
      m.handleIncomingMessageOptStatus({
        organizationId: effectiveOrgId,
        userId: effectiveUserId,
        phoneNumber: senderNumber,
        messageBody,
        interactive: interactiveData
          ? {
              buttonReply: interactiveData.buttonReply,
              listReply: interactiveData.listReply,
            }
          : undefined,
      })
    );
    if (keywordAction) {
      console.log(`[Chatbot Executor] Opt keyword processed: ${keywordAction} for ${senderNumber}`);
    }
    if (optedOut) {
      console.log(`[Chatbot Executor] Contact opted out — skipping chatbot/FAQ responses for ${senderNumber}`);
      return;
    }

    if (!interactiveData) {
      const liveChatKind = await tryLiveChatAutoReply(sessionId, senderNumber, effectiveOrgId);
      if (liveChatKind === "off_hours") {
        console.log(`[Live Chat] Off-hours auto-reply sent — skipping chatbot/FAQ for ${senderNumber}`);
        return;
      }
    }
    
    console.log(`[Chatbot Executor] Processing message for chatbots:`, {
      sessionId,
      senderNumber,
      messageBody,
      userId: effectiveUserId,
      organizationId: effectiveOrgId,
    });
    
    // Get all published chatbots that apply to this session (row sessionId and/or trigger multi-select)
    const chatbots = effectiveOrgId
      ? await storage.getChatbotsByOrganization(effectiveOrgId)
      : await storage.getChatbots(effectiveUserId, effectiveOrgId);
    const allPublishedSorted = chatbots
      .filter((cb) => cb.status === 'published')
      // Prefer most recently updated (e.g. newly published) so updated flows take precedence over older ones
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });

    const nodesByChatbotId = new Map<string, ChatbotNode[]>();
    const publishedChatbots: typeof chatbots = [];
    for (const cb of allPublishedSorted) {
      // Fast path: chatbot row still stores the first selected session
      if (cb.sessionId === sessionId) {
        publishedChatbots.push(cb);
        continue;
      }
      // Multi-number: full list lives on the trigger node as triggerSessionIds
      const nodes = await storage.getChatbotNodes(cb.id);
      nodesByChatbotId.set(cb.id, nodes);
      if (chatbotAppliesToSession(cb, sessionId, nodes)) {
        publishedChatbots.push(cb);
      }
    }
    
    console.log(`[Chatbot Executor] Found ${chatbots.length} total chatbots, ${publishedChatbots.length} published for session ${sessionId}`);
    
    if (publishedChatbots.length === 0) {
      // No published chatbots for this session - no auto-reply (AI assistant never used without chatbot)
      const activeConversations = Array.from(conversationStates.values()).filter(
        (state) => state.userId === senderNumber && state.sessionId === sessionId
      );
      
      if (activeConversations.length > 0) {
        for (const state of activeConversations) {
          if (state.resumeAt != null) {
            console.log(`[Chatbot Executor] Ignoring message (no published chatbots) - waiting for scheduled delay`);
            return;
          }
          const chatbot = effectiveOrgId
            ? await storage.getChatbotByOrganization(state.chatbotId, effectiveOrgId)
            : await storage.getChatbot(state.chatbotId, effectiveUserId, effectiveOrgId);
          const nodes =
            nodesByChatbotId.get(state.chatbotId) ??
            (await storage.getChatbotNodes(state.chatbotId));
          nodesByChatbotId.set(state.chatbotId, nodes);
          if (chatbot && chatbot.status === 'published' && chatbotAppliesToSession(chatbot, sessionId, nodes)) {
            const nodeIds = new Set(nodes.map((n) => n.id));
            if (!nodeIds.has(state.currentNodeId)) {
              console.log(`[Chatbot Executor] Conversation state is stale (node ${state.currentNodeId} not in flow). Clearing state.`);
              conversationStates.delete(getConversationKey(senderNumber, state.chatbotId, state.sessionId));
              continue;
            }
            await executeFlow(
              chatbot,
              nodes,
              state.currentNodeId,
              sessionId,
              senderNumber,
              messageBody,
              await mergeIncomingMessageIntoContext(state.context, {
                sessionId,
                senderNumber,
                messageBody,
                interactiveData,
              })
            );
            return;
          } else if (chatbot && chatbot.status !== 'published') {
            // Chatbot was unpublished - clear conversation state
            console.log(`[Chatbot Executor] Chatbot ${state.chatbotId} is no longer published, clearing conversation state`);
            conversationStates.delete(getConversationKey(senderNumber, state.chatbotId, state.sessionId));
          }
        }
      }
      // No chatbot flow handled this message — try FAQ bot fallback.
      if (!interactiveData) {
        await tryFaqAutoReply(sessionId, senderNumber, messageBody, effectiveOrgId);
      }
      return; // No chatbots to process
    }
    
    // Check for active conversation first (prioritize continuing flow over new trigger)
    // IMPORTANT: Check ALL active conversations, not just waitingForInput ones
    // This ensures we catch button replies even if waitingForInput was cleared
    // Filter by sessionId - only resume conversations for this session (no global/sessionId=null)
    const allActiveConversations = Array.from(conversationStates.values()).filter(
      (state) => state.userId === senderNumber && state.sessionId === sessionId
    );
    
    // Prioritize conversations that are waiting for input (button/list replies)
    const waitingConversations = allActiveConversations.filter(s => s.waitingForInput);
    const activeConversations = waitingConversations.length > 0 ? waitingConversations : allActiveConversations;
    
    console.log(`[Chatbot Executor] Found ${allActiveConversations.length} total active conversations for ${senderNumber} (${waitingConversations.length} waiting for input)`);
    
    activeConversationBlock: if (activeConversations.length > 0) {
      let state = activeConversations[0];
      // When waiting for scheduled delay (resumeAt), ignore free-form text (would re-trigger flow).
      // BUT: allow button/list replies - user may click a different button (e.g. "Join Community")
      // to take a different path; honor that immediately instead of waiting for the delay.
      if (state.resumeAt != null && !interactiveData && !state.context?.aiAgentResumeKind) {
        console.log(`[Chatbot Executor] Ignoring message - waiting for scheduled delay until ${new Date(state.resumeAt).toISOString()}`);
        return;
      }
      if (state.resumeAt != null && messageBody?.trim()) {
        const cleared = { ...state.context };
        delete cleared.aiAgentResumeKind;
        state = { ...state, resumeAt: undefined, context: cleared };
        conversationStates.set(getConversationKey(senderNumber, state.chatbotId, state.sessionId), state);
      }
      if (state.resumeAt != null && interactiveData) {
        console.log(`[Chatbot Executor] Button/list reply during delay - canceling delay, processing immediately`);
        conversationStates.set(getConversationKey(senderNumber, state.chatbotId, state.sessionId), { ...state, resumeAt: undefined });
      }
      // Resume active conversation - ONLY if chatbot is still published
      console.log(`[Chatbot Executor] Resuming conversation:`, {
        chatbotId: state.chatbotId,
        currentNodeId: state.currentNodeId,
        waitingForInput: state.waitingForInput,
        hasButtonMap: !!state.buttonMap,
        buttonMapSize: state.buttonMap?.size || 0,
        buttonMapKeys: state.buttonMap ? Array.from(state.buttonMap.keys()) : [],
        hasListMap: !!state.listMap,
        interactiveDataProvided: !!interactiveData,
      });
      
      const chatbot = effectiveOrgId
        ? await storage.getChatbotByOrganization(state.chatbotId, effectiveOrgId)
        : await storage.getChatbot(state.chatbotId, effectiveUserId, effectiveOrgId);
      const nodes =
        nodesByChatbotId.get(state.chatbotId) ??
        (await storage.getChatbotNodes(state.chatbotId));
      nodesByChatbotId.set(state.chatbotId, nodes);
      if (chatbot && chatbot.status === 'published' && chatbotAppliesToSession(chatbot, sessionId, nodes)) {
        const nodeIds = new Set(nodes.map((n) => n.id));
        // If the saved conversation position (currentNodeId) no longer exists in the flow,
        // the flow was republished with a different structure (e.g. AI agent removed). Clear
        // state so we treat this as a new conversation and run the new flow from the trigger.
        if (!nodeIds.has(state.currentNodeId)) {
          console.log(`[Chatbot Executor] Conversation state is stale: node ${state.currentNodeId} not in current flow (flow was republished). Clearing state to run new flow.`);
          conversationStates.delete(getConversationKey(senderNumber, state.chatbotId, state.sessionId));
          // Fall through to trigger matching below so the new flow runs
        } else {
        
        // Check if this is a button/list reply
        let processedInput = messageBody;
        let targetNodeId: string | null = null;
        
        // Use interactive data if available (from Business API)
        if (interactiveData) {
          if (interactiveData.type === 'button_reply' && interactiveData.buttonReply) {
            const buttonText = interactiveData.buttonReply.title || messageBody;
            const buttonId = interactiveData.buttonReply.id;
            
            console.log(`[Chatbot Executor] Processing button reply:`, {
              buttonText,
              buttonId,
              messageBody,
              hasButtonMap: !!state.buttonMap,
              buttonMapSize: state.buttonMap?.size || 0,
            });
            
            // IMPORTANT: Match by button TEXT first, not buttonId. WhatsApp reuses btn_1/btn_2/btn_3
            // across ALL messages - every single-button message uses btn_1. So btn_1 from "Book Your Slot"
            // and btn_1 from "Booked" are different buttons; we must use the actual text to disambiguate.
            const lookupInMap = (map: Map<string, string> | Record<string, string>): string | null => {
              const m = map instanceof Map ? map : new Map(Object.entries(map));
              const normalizedText = (buttonText || '').toLowerCase().trim();
              const exactText = (buttonText || '').trim();
              // 1. Prefer text match (unique per button) - avoids btn_1 collision across messages
              if (normalizedText && m.has(normalizedText)) return m.get(normalizedText)!;
              if (exactText && m.has(exactText)) return m.get(exactText)!;
              // 2. Fallback to buttonId only when text doesn't match (e.g. same message, different client)
              if (buttonId && m.has(buttonId)) return m.get(buttonId)!;
              return null;
            };

            // CRITICAL: Check the CURRENT node's map FIRST. We're waiting for input from lastButtonNodeId/currentNodeId.
            // If we search all nodes, btn_1 from an earlier message (e.g. "Book Your Slot") can wrongly match
            // before the current message's "Booked" btn_1, routing to the wrong node (previous message).
            const currentNodeForButtons = state.lastButtonNodeId || state.currentNodeId;
            if (currentNodeForButtons && state.buttonMapsByNode?.[currentNodeForButtons]) {
              const found = lookupInMap(state.buttonMapsByNode[currentNodeForButtons]);
              if (found) {
                targetNodeId = found;
                console.log(`[Chatbot Executor] ✅ Button reply matched in current node ${currentNodeForButtons} map: "${buttonText}" (${buttonId}) -> node ${targetNodeId}`);
              }
            }
            if (!targetNodeId && state.buttonMap) {
              targetNodeId = lookupInMap(state.buttonMap) ?? null;
              if (targetNodeId) {
                console.log(`[Chatbot Executor] ✅ Button reply matched in current map: "${buttonText}" (${buttonId}) -> node ${targetNodeId}`);
              }
            }
            if (!targetNodeId && state.buttonMapsByNode) {
              for (const [nodeId, map] of Object.entries(state.buttonMapsByNode)) {
                if (nodeId === currentNodeForButtons) continue; // already checked
                const found = lookupInMap(map);
                if (found) {
                  targetNodeId = found;
                  console.log(`[Chatbot Executor] ✅ Button reply matched in earlier node ${nodeId} map: "${buttonText}" (${buttonId}) -> node ${targetNodeId}`);
                  break;
                }
              }
            }
            if (!targetNodeId) {
              console.warn(`[Chatbot Executor] ❌ Button reply NOT matched:`, {
                buttonText,
                buttonId,
                normalizedText: buttonText.toLowerCase().trim(),
                availableKeys: state.buttonMap ? Array.from(state.buttonMap.keys()) : [],
                buttonMapsByNodeKeys: state.buttonMapsByNode ? Object.keys(state.buttonMapsByNode) : [],
              });
            }
            processedInput = buttonText;
          } else if (interactiveData.type === 'list_reply' && interactiveData.listReply) {
            const listTitle = interactiveData.listReply.title || messageBody;
            const listId = interactiveData.listReply.id;

            const resolveFromListMap = (
              raw: Map<string, string> | Record<string, string> | undefined
            ): string | null => {
              if (!raw) return null;
              const listMap = raw instanceof Map ? raw : new Map(Object.entries(raw));
              if (listId && listMap.has(listId)) return listMap.get(listId)!;
              const normalizedTitle = listTitle.toLowerCase().trim();
              if (normalizedTitle && listMap.has(normalizedTitle)) return listMap.get(normalizedTitle)!;
              return null;
            };

            const currentListNodeId = state.lastListNodeId;
            if (currentListNodeId && state.listMapsByNode?.[currentListNodeId]) {
              targetNodeId = resolveFromListMap(state.listMapsByNode[currentListNodeId]);
              if (targetNodeId) {
                console.log(
                  `[Chatbot Executor] List reply matched listMapsByNode[${currentListNodeId}]: "${listId}" -> node ${targetNodeId}`
                );
              }
            }
            if (!targetNodeId && state.listMap) {
              targetNodeId = resolveFromListMap(state.listMap);
              if (targetNodeId) {
                console.log(`[Chatbot Executor] List reply matched state.listMap -> node ${targetNodeId}`);
              }
            }
            if (!targetNodeId && state.listMapsByNode) {
              for (const [nid, cmap] of Object.entries(state.listMapsByNode)) {
                if (nid === currentListNodeId) continue;
                targetNodeId = resolveFromListMap(cmap);
                if (targetNodeId) {
                  console.log(`[Chatbot Executor] List reply matched fallback listMapsByNode[${nid}] -> node ${targetNodeId}`);
                  break;
                }
              }
            }
            processedInput = listTitle;
          }
        }
        
        // Fallback: check button/list maps by message text (for unofficial client or if interactive data not available)
        if (!targetNodeId) {
          const fallbackLookup = (map: Map<string, string> | Record<string, string>): string | null => {
            const m = map instanceof Map ? map : new Map(Object.entries(map));
            const normalizedInput = messageBody.toLowerCase().trim();
            return m.get(normalizedInput) ?? m.get(messageBody) ?? null;
          };
          if (state.buttonMap) {
            const found = fallbackLookup(state.buttonMap);
            if (found) {
              targetNodeId = found;
              console.log(`[Chatbot Executor] Button reply detected (fallback): "${messageBody}" -> node ${targetNodeId}`);
            }
          }
          if (!targetNodeId && state.buttonMapsByNode) {
            for (const [nodeId, map] of Object.entries(state.buttonMapsByNode)) {
              const found = fallbackLookup(map);
              if (found) {
                targetNodeId = found;
                console.log(`[Chatbot Executor] Button reply detected (fallback, earlier node ${nodeId}): "${messageBody}" -> node ${targetNodeId}`);
                break;
              }
            }
          }
          
          // Check list map
          if (!targetNodeId && state.listMap) {
            const listMap = state.listMap;
            const normalizedInput = messageBody.toLowerCase().trim();
            if (listMap.has(normalizedInput)) {
              targetNodeId = listMap.get(normalizedInput)!;
              console.log(`[Chatbot Executor] List reply detected (fallback normalized): "${messageBody}" -> node ${targetNodeId}`);
            } else if (listMap.has(messageBody)) {
              // Also check by exact ID
              targetNodeId = listMap.get(messageBody)!;
              console.log(`[Chatbot Executor] List reply detected (by exact ID): "${messageBody}" -> node ${targetNodeId}`);
            }
          }
        }
        
        // If button/list reply pointed to a node that no longer exists (flow republished), clear state and fall through to triggers
        if (targetNodeId && !nodeIds.has(targetNodeId)) {
          console.log(`[Chatbot Executor] Button/list target node ${targetNodeId} not in current flow (flow republished). Clearing state.`);
          conversationStates.delete(getConversationKey(senderNumber, state.chatbotId, state.sessionId));
        } else {
        // When waiting for button/list input, if customer sends free-form text (no button match):
        // Clear conversation state and fall through to trigger matching. This lets "On Message"
        // and keyword triggers (e.g. "Hi", "Hello") work as configured - no hardcoded list needed.
        // Do NOT apply when paused on Ask Question / AI agent / Ask Location — those need free-form text.
        const currentWaitNode = nodes.find((n) => n.id === state.currentNodeId);
        const waitingForButtonOrList =
          currentWaitNode != null &&
          (currentWaitNode.nodeType === 'send_button' || currentWaitNode.nodeType === 'send_list');
        if (state.waitingForInput && waitingForButtonOrList && !targetNodeId && !interactiveData) {
          console.log(`[Chatbot Executor] Free-form text while waiting for button - clearing conversation, re-running trigger match. Message: "${messageBody.substring(0, 50)}..."`);
          conversationStates.delete(getConversationKey(senderNumber, state.chatbotId, state.sessionId));
          break activeConversationBlock;
        }
        
        // If button/list reply found, route to that node; otherwise continue with current node
        const startNodeId = targetNodeId || state.currentNodeId;
        
        console.log(`[Chatbot Executor] Routing button reply:`, {
          targetNodeId,
          startNodeId,
          currentStateNodeId: state.currentNodeId,
          processedInput,
        });
        
        // Clear button/list maps from context (but preserve in conversation state for other buttons)
        // This allows other buttons from the same message to still be clicked
        // The conversation state will be restored to the button node after flow completion
        const clearedContext = { ...state.context };
        if (targetNodeId) {
          delete clearedContext.buttonMap;
          delete clearedContext.listMap;
          delete clearedContext.lastButtonNodeId;
          delete clearedContext.lastListNodeId;
          delete clearedContext.listMapsByNode;
        }
        
        // Execute flow from the target node (or current node if no match)
        console.log(`[Chatbot Executor] About to execute flow:`, {
          chatbotId: chatbot.id,
          chatbotName: chatbot.name,
          startNodeId,
          targetNodeId,
          processedInput,
          hasClearedContext: Object.keys(clearedContext).length > 0,
        });
        
        if (!targetNodeId) {
          console.warn(`[Chatbot Executor] ⚠️ No target node found for button reply, continuing from current node ${state.currentNodeId}`);
        }
        
        // When routing to a new node from button/list click, pass undefined as userInput.
        // The button/list text was only for matching - it must NOT be treated as the answer to Ask Question
        // or other input nodes. The target node (e.g. Ask Question) should run fresh: send its message and wait.
        const flowUserInput = targetNodeId ? undefined : processedInput;
        await executeFlow(
          chatbot,
          nodes,
          startNodeId,
          sessionId,
          senderNumber,
          flowUserInput,
          await mergeIncomingMessageIntoContext(clearedContext, {
            sessionId,
            senderNumber,
            messageBody,
            interactiveData,
          }),
          targetNodeId || null
        );
        console.log(`[Chatbot Executor] ✅ Flow execution completed for button reply`);
        return;
        }
        }
      }
    }
    
    // No active conversation, check triggers
    // Note: If this is a button/list reply with no active conversation, it means the conversation state
    // was cleared (possibly due to timeout or error). The main fix should prevent this by restoring
    // to the button node after flow completion, but if it still happens, we log a warning.
    if (interactiveData && (interactiveData.type === 'button_reply' || interactiveData.type === 'list_reply')) {
      console.warn(`[Chatbot Executor] ⚠️ Button/list reply received but no active conversation found. This may indicate the conversation state was cleared unexpectedly.`);
    }
    
    // Two-pass: prefer chatbots with KEYWORD matches over "On Message" (empty-keyword) matches.
    // This fixes wrong flows when multiple chatbots exist - e.g. "Hi"/"Interested"/"New" should match
    // the chatbot with those keywords, not a generic catch-all chatbot.
    type MatchResult = { chatbot: any; nodes: ChatbotNode[]; triggerNode: ChatbotNode; matchedByKeywords: boolean };
    const keywordMatches: MatchResult[] = [];
    const fallbackMatches: MatchResult[] = [];

    for (const chatbot of publishedChatbots) {
      if (chatbot.status !== 'published') {
        console.warn(`[Chatbot Executor] Skipping chatbot ${chatbot.id} - status is ${chatbot.status}, not published`);
        continue;
      }
      console.log(`[Chatbot Executor] Checking chatbot ${chatbot.id} (${chatbot.name}) for trigger match`);
      const nodes =
        nodesByChatbotId.get(chatbot.id) ??
        (await storage.getChatbotNodes(chatbot.id));
      nodesByChatbotId.set(chatbot.id, nodes);
      const match = findMatchingTrigger(nodes, messageBody, interactiveData);
      if (!match) {
        const triggerNodes = nodes.filter((n) => n.nodeType === 'trigger');
        const triggerDebug = triggerNodes.map((n) => {
          const d = n.data as any;
          return {
            id: n.id,
            messageType: d?.messageType ?? '(default)',
            keywords: Array.isArray(d?.keywords) ? d.keywords : [],
            triggerSessionIds: Array.isArray(d?.triggerSessionIds) ? d.triggerSessionIds : (d?.triggerSessionId ? [d.triggerSessionId] : []),
          };
        });
        console.log(`[Chatbot Executor] No trigger match for chatbot ${chatbot.id} with message: "${messageBody}". Trigger config:`, JSON.stringify(triggerDebug));
        continue;
      }
      const { node: triggerNode, matchedByKeywords } = match;

      if (!chatbotAppliesToSession(chatbot, sessionId, nodes)) {
        console.log(`[Chatbot Executor] Trigger sessionId mismatch for chatbot ${chatbot.id}: does not apply to ${sessionId}`);
        continue;
      }

      const result: MatchResult = { chatbot, nodes, triggerNode, matchedByKeywords };
      if (matchedByKeywords) {
        keywordMatches.push(result);
      } else {
        fallbackMatches.push(result);
      }
    }

    // Priority rule:
    // 1) keyword-based chatbot triggers
    // 2) generic "On Message" / Message Type = All chatbot fallbacks
    // 3) FAQ keyword auto-reply (only when no chatbot catch-all is waiting)
    if (keywordMatches.length === 0 && fallbackMatches.length === 0 && !interactiveData) {
      const faqHandled = await tryFaqAutoReply(sessionId, senderNumber, messageBody, effectiveOrgId);
      if (faqHandled) {
        return;
      }
    }

    const toUse = keywordMatches.length > 0 ? keywordMatches[0] : fallbackMatches[0];
    if (toUse) {
      const { chatbot, nodes, triggerNode } = toUse;
      console.log(`[Chatbot Executor] ✅ Trigger matched for chatbot ${chatbot.id} (${chatbot.name}), starting flow (keyword match: ${toUse.matchedByKeywords})`);
      const connections = triggerNode.connections || [];
      if (connections.length > 0) {
        const targetNodeIds = connections.map((c) => c.to).filter(Boolean);
        console.log(
          `[Chatbot Executor] Starting flow from trigger node ${triggerNode.id} -> ${targetNodeIds.length} connected node(s):`,
          targetNodeIds,
        );
        const initialContext = await mergeIncomingMessageIntoContext({}, {
          sessionId,
          senderNumber,
          messageBody,
          interactiveData,
        });
        /**
         * Trigger nodes can fan out to multiple actions in the builder.
         * Execute each connected branch in order so users can chain e.g. media + button on one trigger.
         */
        for (const nodeId of targetNodeIds) {
          await executeFlow(
            chatbot,
            nodes,
            nodeId,
            sessionId,
            senderNumber,
            messageBody,
            initialContext
          );
        }
      } else {
        console.warn(`[Chatbot Executor] Trigger node ${triggerNode.id} has no connections`);
      }
    } else {
      // No chatbot trigger matched — try FAQ fallback reply.
      if (!interactiveData) {
        await tryFaqAutoReply(sessionId, senderNumber, messageBody, effectiveOrgId);
      }
    }
  } catch (error: any) {
    console.error(`[Chatbot Executor] Error processing message for chatbots:`, error);
  }
}

/**
 * Manually start a published chatbot for a contact from the inbox (no keyword/trigger matching).
 * Does not change inbound trigger behavior — only used by the agent "Send chatbot" action.
 */
export async function startChatbotForContact(params: {
  chatbotId: string;
  sessionId: string;
  contactNumber: string;
  userId?: string;
  organizationId?: string;
}): Promise<{ ok: true; chatbotName: string } | { ok: false; error: string; status: number }> {
  const { chatbotId, sessionId, contactNumber } = params;
  const senderNumber = String(contactNumber || "").trim();
  if (!senderNumber) {
    return { ok: false, error: "Contact number is required", status: 400 };
  }

  const session = await storage.getSession(sessionId);
  if (!session) {
    return { ok: false, error: "Session not found", status: 404 };
  }

  const effectiveUserId = params.userId || session.userId;
  let effectiveOrgId =
    params.organizationId ||
    (session as { organizationId?: string | null }).organizationId ||
    undefined;
  if (!effectiveOrgId) {
    const orgs = await storage.getOrganizationsByUser(effectiveUserId);
    effectiveOrgId = orgs[0]?.id;
  }

  const { isOrganizationPlanActive, isUserPlanActive } = await import("../utils/org-subscription-gate");
  const planOk = effectiveOrgId
    ? await isOrganizationPlanActive(effectiveOrgId)
    : await isUserPlanActive(effectiveUserId);
  if (!planOk) {
    return { ok: false, error: "Subscription expired — chatbot cannot be sent", status: 403 };
  }

  if (effectiveOrgId) {
    const { isRecipientOptedOut } = await import("../opt-keyword-service");
    if (await isRecipientOptedOut(effectiveOrgId, senderNumber)) {
      return { ok: false, error: "Contact has opted out", status: 403 };
    }
  }

  const chatbot = effectiveOrgId
    ? await storage.getChatbotByOrganization(chatbotId, effectiveOrgId)
    : await storage.getChatbot(chatbotId, effectiveUserId, effectiveOrgId);
  if (!chatbot) {
    return { ok: false, error: "Chatbot not found", status: 404 };
  }
  if (chatbot.status !== "published") {
    return { ok: false, error: "Only published chatbots can be sent", status: 400 };
  }

  const nodes = await storage.getChatbotNodes(chatbotId);
  const triggerNodes = nodes.filter((n) => n.nodeType === "trigger");
  const triggerNode =
    triggerNodes.find((n) => (n.connections || []).length > 0) || triggerNodes[0];
  if (!triggerNode) {
    return { ok: false, error: "Chatbot has no trigger node", status: 400 };
  }

  const targetNodeIds = (triggerNode.connections || []).map((c) => c.to).filter(Boolean);
  if (targetNodeIds.length === 0) {
    return { ok: false, error: "Chatbot trigger has no connected flow", status: 400 };
  }

  // Stop any in-progress bot on this contact so the selected flow starts cleanly
  clearChatbotConversationForContact(sessionId, senderNumber);

  const messageBody = "";
  const initialContext = await mergeIncomingMessageIntoContext(
    {},
    {
      sessionId,
      senderNumber,
      messageBody,
    },
  );

  console.log(
    `[Chatbot Executor] Manual inbox start: chatbot=${chatbot.id} (${chatbot.name}) session=${sessionId} contact=${senderNumber}`,
  );

  for (const nodeId of targetNodeIds) {
    await executeFlow(
      chatbot,
      nodes,
      nodeId,
      sessionId,
      senderNumber,
      undefined,
      initialContext,
    );
  }

  return { ok: true, chatbotName: chatbot.name };
}
