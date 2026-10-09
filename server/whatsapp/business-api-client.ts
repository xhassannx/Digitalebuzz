import { Writable } from 'stream';
import { storage } from '../storage';
import { processMessageForChatbots, clearChatbotConversationForContact } from '../chatbots/executor';
import { triggerWebhooks } from '../webhooks/delivery';
import type { WhatsappSession, Message } from '@shared/schema';
import {
  withOutboundWalletBilling,
  type OutboundWalletBillingOverrides,
} from '../wallet/business-api-billing';
import { resolveTemplateSendRoute, sendTemplateViaCreditLine } from '../credit-line/send-template';
import { resolveOrganizationIdForSession, resolveTemplateWalletCategory } from '../wallet/service';
import { sanitizeWhatsAppTemplateParamText } from './template-send-helpers';

/**
 * WhatsApp Cloud API — interactive list messages
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-list-messages/
 * - Up to 10 sections; up to 10 rows total for all sections combined (not per section).
 * - Row id: required, unique within the message, max 200 characters (returned in list_reply webhooks).
 * - Row title max 24, description max 72, body max 1024, button max 20, footer max 60, header text max 60.
 */
const CLOUD_API_LIST_MAX_SECTIONS = 10;
const CLOUD_API_LIST_MAX_ROWS_TOTAL = 10;
const CLOUD_API_LIST_ROW_ID_MAX = 200;
const CLOUD_API_LIST_BODY_MAX = 1024;
const CLOUD_API_LIST_BUTTON_MAX = 20;
const CLOUD_API_LIST_FOOTER_MAX = 60;
const CLOUD_API_LIST_HEADER_TEXT_MAX = 60;
const CLOUD_API_LIST_SECTION_TITLE_MAX = 24;
const CLOUD_API_LIST_ROW_TITLE_MAX = 24;
const CLOUD_API_LIST_ROW_DESC_MAX = 72;

/**
 * WhatsApp shows "Untitled" for document headers when `filename` is omitted.
 * Prefer an explicit name, then derive from URL/path (stripping gallery upload suffixes).
 */
export function resolveWhatsAppDocumentFilename(
  explicit?: string | null,
  urlOrPath?: string | null,
  fallback = 'document.pdf'
): string {
  const sanitize = (name: string) =>
    name
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);

  const ensureExtension = (name: string) => {
    if (/\.[a-zA-Z0-9]{1,8}$/.test(name)) return name;
    return `${name}.pdf`;
  };

  const fromExplicit = String(explicit || '').trim();
  if (fromExplicit) return ensureExtension(sanitize(fromExplicit));

  const raw = String(urlOrPath || '').trim();
  if (!raw) return fallback;

  try {
    let pathname = raw;
    if (/^https?:\/\//i.test(raw)) {
      pathname = new URL(raw).pathname;
    }
    let base = decodeURIComponent(pathname.split('/').pop() || '').split('?')[0];
    if (!base || base === '.' || base === '..') return fallback;

    // Gallery uploads: originalName-timestamp-random.ext → originalName.ext
    const extMatch = base.match(/(\.[a-zA-Z0-9]{1,8})$/);
    const ext = extMatch?.[1] || '';
    const nameWithoutExt = ext ? base.slice(0, -ext.length) : base;
    const galleryMatch = nameWithoutExt.match(/^(.+)-(\d{10,})-(\d+)$/);
    if (galleryMatch) {
      base = `${galleryMatch[1]}${ext}`;
    }

    return ensureExtension(sanitize(base));
  } catch {
    return fallback;
  }
}

export type CloudApiListSectionInput = {
  title: string;
  rows: Array<{ id: string; title: string; description?: string }>;
};

/** Enforces Cloud API list limits: max 10 sections, max 10 rows across all sections, unique row ids. */
export function normalizeCloudApiListSections(sections: CloudApiListSectionInput[]): CloudApiListSectionInput[] {
  const usedIds = new Set<string>();
  const result: CloudApiListSectionInput[] = [];
  let totalRows = 0;

  for (const section of sections.slice(0, CLOUD_API_LIST_MAX_SECTIONS)) {
    if (totalRows >= CLOUD_API_LIST_MAX_ROWS_TOTAL) break;

    const rowsOut: Array<{ id: string; title: string; description?: string }> = [];
    const secTitle = (section.title || '').trim().slice(0, CLOUD_API_LIST_SECTION_TITLE_MAX);

    for (const row of section.rows || []) {
      if (totalRows >= CLOUD_API_LIST_MAX_ROWS_TOTAL) break;

      let id = String(row.id || '').trim().slice(0, CLOUD_API_LIST_ROW_ID_MAX);
      if (!id) continue;

      let n = 0;
      while (usedIds.has(id)) {
        n += 1;
        const suffix = `_${n}`;
        id = `${String(row.id).trim().slice(0, CLOUD_API_LIST_ROW_ID_MAX - suffix.length)}${suffix}`.slice(0, CLOUD_API_LIST_ROW_ID_MAX);
      }
      usedIds.add(id);

      const title = String(row.title || '').trim().slice(0, CLOUD_API_LIST_ROW_TITLE_MAX);
      if (!title) continue;

      const descRaw = row.description != null ? String(row.description).trim() : '';
      const description = descRaw ? descRaw.slice(0, CLOUD_API_LIST_ROW_DESC_MAX) : undefined;

      rowsOut.push({ id, title, description });
      totalRows++;
    }

    if (rowsOut.length > 0) {
      result.push({
        title: secTitle || 'Options',
        rows: rowsOut,
      });
    }
  }

  return result;
}

/** Stored template row shape — used to append Meta-required OTP button payload for AUTHENTICATION templates. */
export type TemplateMetaForAuth = { category?: string; components?: any[] };

function normalizePositionalTemplateParams(
  templateParams: string[] | Array<{ parameter_name: string; text: string }> | undefined | null
): string[] {
  if (!templateParams || !Array.isArray(templateParams)) return [];
  if (
    templateParams.length > 0 &&
    typeof templateParams[0] === 'object' &&
    templateParams[0] !== null &&
    'parameter_name' in (templateParams[0] as object)
  ) {
    return [];
  }
  return (templateParams as string[]).map((p) => String(p ?? ''));
}

/**
 * Meta AUTHENTICATION templates with an OTP (“copy code”) button require the OTP in **both** `body` and `button`
 * components. The send payload uses `sub_type: "url"` and `parameters[{ type: "text", text }]` (same OTP as body).
 */
export function resolveAuthenticationCopyCodeForSend(
  templateMeta: TemplateMetaForAuth | null | undefined,
  templateParams: string[] | Array<{ parameter_name: string; text: string }> | undefined | null
): string | undefined {
  if (!templateMeta || String(templateMeta.category || '').toUpperCase() !== 'AUTHENTICATION') {
    return undefined;
  }
  const positional = normalizePositionalTemplateParams(templateParams);
  if (positional.length === 0) return undefined;
  const headerComp = templateMeta.components?.find((c: any) => c.type === 'HEADER');
  let headerVarCount = 0;
  if (headerComp?.format === 'TEXT' && typeof headerComp.text === 'string') {
    headerVarCount = (headerComp.text.match(/\{\{\d+\}\}/g) || []).length;
  }
  const code = String(positional[headerVarCount] ?? '').trim();
  if (!code) return undefined;
  const buttonsComp = templateMeta.components?.find((c: any) => String(c.type || '').toUpperCase() === 'BUTTONS');
  const allButtons = buttonsComp?.buttons || [];
  const otpButtons = allButtons.filter((b: any) => String(b.type || '').toUpperCase() === 'OTP');
  // Meta sets authentication copy-code buttons to type URL after creation (docs: OTP → URL on GET).
  const urlButtons = allButtons.filter((b: any) => String(b.type || '').toUpperCase() === 'URL');

  const isOneTapOrZeroTap = (b: any) => {
    const t = String(b?.otp_type || '').toUpperCase();
    return t === 'ONE_TAP' || t === 'ZERO_TAP';
  };

  if (otpButtons.length > 0) {
    if (isOneTapOrZeroTap(otpButtons[0])) return undefined;
    return code;
  }

  if (urlButtons.length > 0) {
    if (urlButtons.some(isOneTapOrZeroTap)) return undefined;
    return code;
  }

  // Body-only AUTH template (no button component): do not append a synthetic button.
  return undefined;
}

export interface BusinessAPICredentials {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string;
}

export class WhatsAppBusinessAPIManager {
  private credentials: Map<string, BusinessAPICredentials>;
  private statusCallbacks: Map<string, (status: WhatsappSession['status']) => void>;
  private messageCallbacks: Map<string, (message: any) => void>;
  // Map to store WhatsApp message ID to our message ID mapping
  private messageIdMap: Map<string, { messageId: string; sessionId: string; timestamp: Date }>;
  private readonly apiVersion = 'v23.0';
  private readonly baseUrl = 'https://graph.facebook.com';

  constructor() {
    this.credentials = new Map();
    this.statusCallbacks = new Map();
    this.messageCallbacks = new Map();
    this.messageIdMap = new Map();
  }

  async createSession(
    sessionId: string,
    credentials: BusinessAPICredentials
  ): Promise<void> {
    // If credentials are already in memory, allow updating when token/phone changes
    this.credentials.set(sessionId, credentials);
    console.log(`[Create Session] Credentials stored/updated for session ${sessionId}`);

    try {
      const isValid = await this.verifyCredentials(credentials);
      if (!isValid) {
        this.credentials.delete(sessionId);
        throw new Error('Invalid WhatsApp Business API credentials');
      }
    } catch (verifyError) {
      this.credentials.delete(sessionId);
      throw verifyError;
    }

    try {
      const phoneInfo = await this.getPhoneNumberInfo(credentials);

      // Get existing session to preserve deviceInfo fields
      const existingSession = await storage.getSession(sessionId);
      const existingDeviceInfo = existingSession?.deviceInfo || {};
      
      // Prefer WABA from Graph so reconnect / multi-account flows do not keep a stale wabaId
      const resolvedWabaId =
        phoneInfo.whatsapp_business_account?.id || existingDeviceInfo.wabaId;
      const businessAccountId =
        credentials.businessAccountId ||
        resolvedWabaId ||
        (existingDeviceInfo as any).businessAccountId;

      await storage.updateSession(sessionId, {
        status: 'connected',
        deviceInfo: {
          ...existingDeviceInfo,
          platform: 'WhatsApp Business API',
          phoneNumber: phoneInfo.display_phone_number || credentials.phoneNumberId,
          name: phoneInfo.verified_name || 'Business Account',
          apiPhoneNumberId: credentials.phoneNumberId,
          businessAccountId,
          wabaId: resolvedWabaId,
        },
        qrCode: undefined,
      });

      const callback = this.statusCallbacks.get(sessionId);
      if (callback) callback('connected');

      console.log(`WhatsApp Business API session ${sessionId} connected`);
    } catch (error) {
      await storage.updateSession(sessionId, {
        status: 'disconnected',
        qrCode: undefined,
      });
      throw error;
    }
  }

  async disconnectSession(sessionId: string): Promise<void> {
    this.credentials.delete(sessionId);
    this.statusCallbacks.delete(sessionId);
    this.messageCallbacks.delete(sessionId);

    await storage.updateSession(sessionId, {
      status: 'disconnected',
      qrCode: undefined,
    });
  }

  // Restore credentials for an existing session (useful after server restart)
  getCredentials(sessionId: string): BusinessAPICredentials | undefined {
    return this.credentials.get(sessionId);
  }

  async restoreSession(sessionId: string, credentials: BusinessAPICredentials): Promise<void> {
    // Validate credentials before storing
    if (!credentials.accessToken || !credentials.phoneNumberId) {
      console.error(`[Restore Session] Invalid credentials provided:`, {
        hasAccessToken: !!credentials.accessToken,
        hasPhoneNumberId: !!credentials.phoneNumberId,
        sessionId,
      });
      throw new Error('Invalid credentials: accessToken and phoneNumberId are required');
    }
    
    // Create a clean credentials object to ensure no undefined values
    const cleanCredentials: BusinessAPICredentials = {
      phoneNumberId: String(credentials.phoneNumberId).trim(),
      accessToken: String(credentials.accessToken).trim(),
      businessAccountId: credentials.businessAccountId ? String(credentials.businessAccountId).trim() : undefined,
    };
    
    // If session already exists, just update credentials
    if (this.credentials.has(sessionId)) {
      this.credentials.set(sessionId, cleanCredentials);
      console.log(`WhatsApp Business API session ${sessionId} credentials restored`);
      
      // Verify credentials were stored correctly
      const stored = this.credentials.get(sessionId);
      if (!stored || !stored.accessToken || !stored.phoneNumberId) {
        console.error(`[Restore Session] Verification failed:`, {
          hasStored: !!stored,
          hasAccessToken: !!stored?.accessToken,
          hasPhoneNumberId: !!stored?.phoneNumberId,
          storedKeys: stored ? Object.keys(stored) : [],
        });
        throw new Error('Failed to store credentials in memory');
      }
      console.log(`[Restore Session] Credentials verified in memory:`, {
        hasAccessToken: !!stored.accessToken,
        hasPhoneNumberId: !!stored.phoneNumberId,
        accessTokenLength: stored.accessToken?.length,
        phoneNumberIdLength: stored.phoneNumberId?.length,
      });
      
      // Double-check immediately after verification
      const doubleCheck = this.credentials.get(sessionId);
      if (!doubleCheck || !doubleCheck.accessToken || !doubleCheck.phoneNumberId) {
        console.error(`[Restore Session] CRITICAL: Credentials lost immediately after storage!`, {
          hasDoubleCheck: !!doubleCheck,
          hasAccessToken: !!doubleCheck?.accessToken,
          hasPhoneNumberId: !!doubleCheck?.phoneNumberId,
          allSessions: Array.from(this.credentials.keys()),
        });
        throw new Error('Credentials were lost immediately after storage');
      }
      
      return;
    }

    // Otherwise, create the session normally
    // Note: createSession will verify credentials, which might fail if credentials are invalid
    // But we've already validated them, so this should work
    console.log(`[Restore Session] Creating new session for ${sessionId}`);
    
    // Store credentials immediately before calling createSession to avoid race conditions
    this.credentials.set(sessionId, cleanCredentials);
    console.log(`[Restore Session] Credentials stored before createSession`);
    
    // Immediately verify they're stored correctly
    const immediateCheck = this.credentials.get(sessionId);
    if (!immediateCheck || !immediateCheck.accessToken || !immediateCheck.phoneNumberId) {
      console.error(`[Restore Session] CRITICAL: Credentials not stored correctly immediately after set!`, {
        hasImmediateCheck: !!immediateCheck,
        hasAccessToken: !!immediateCheck?.accessToken,
        hasPhoneNumberId: !!immediateCheck?.phoneNumberId,
        allSessions: Array.from(this.credentials.keys()),
      });
      throw new Error('Credentials were not stored correctly');
    }
    console.log(`[Restore Session] Credentials verified immediately after storage`);
    
    try {
      await this.createSession(sessionId, cleanCredentials);
    } catch (createError: any) {
      // If createSession fails, credentials might still be in memory from our set above
      // But if verification fails, createSession will throw and we should check
      const afterError = this.credentials.get(sessionId);
      if (!afterError || !afterError.accessToken || !afterError.phoneNumberId) {
        console.error(`[Restore Session] createSession failed and credentials not available:`, createError.message);
        throw createError;
      }
      // If credentials are still there, we can continue (createSession might have failed on verification but credentials are valid)
      console.warn(`[Restore Session] createSession failed but credentials are still in memory, continuing...`);
    }
    
    // Verify credentials after createSession
    const afterCreate = this.credentials.get(sessionId);
    if (!afterCreate || !afterCreate.accessToken || !afterCreate.phoneNumberId) {
      console.error(`[Restore Session] CRITICAL: Credentials lost after createSession!`, {
        hasAfterCreate: !!afterCreate,
        hasAccessToken: !!afterCreate?.accessToken,
        hasPhoneNumberId: !!afterCreate?.phoneNumberId,
        allSessions: Array.from(this.credentials.keys()),
      });
      throw new Error('Credentials were lost after createSession');
    }
    
    console.log(`[Restore Session] Credentials verified after createSession:`, {
      hasAccessToken: !!afterCreate.accessToken,
      hasPhoneNumberId: !!afterCreate.phoneNumberId,
    });
  }

  async sendTextMessage(
    sessionId: string,
    to: string,
    message: string,
    options?: { replyToWhatsAppMessageId?: string; walletBilling?: OutboundWalletBillingOverrides }
  ): Promise<any> {
    const wb = options?.walletBilling;
    return withOutboundWalletBilling(
      {
        sessionId,
        recipientPhone: to,
        metaCategory: 'service',
        debitType: wb?.debitType,
        referenceType: wb?.referenceType,
        referenceId: wb?.referenceId,
        description: wb?.description,
      },
      async () => this.sendTextMessageCore(sessionId, to, message, options)
    );
  }

  private async sendTextMessageCore(
    sessionId: string,
    to: string,
    message: string,
    options?: { replyToWhatsAppMessageId?: string; walletBilling?: OutboundWalletBillingOverrides }
  ): Promise<any> {
    let creds = this.credentials.get(sessionId);
    if (!creds) {
      // Try to restore session credentials from database (use session's integrationId when multiple Meta accounts)
      console.log(`[Business API] Credentials not in memory for session ${sessionId}, attempting to restore...`);
      try {
        const session = await storage.getSession(sessionId);
        if (session && session.userId) {
          let integration = null;
          if (session.deviceInfo?.integrationId) {
            integration = await storage.getIntegration(session.deviceInfo.integrationId, session.userId);
          }
          if (!integration) {
            integration = await storage.getIntegrationByName("whatsapp-business", session.userId, session.organizationId || undefined);
          }
          if (integration?.status === "connected" && integration.credentials) {
            const credentials = integration.credentials as any;
            await this.restoreSession(sessionId, {
              phoneNumberId: session.deviceInfo?.apiPhoneNumberId || credentials.phone_number_id,
              accessToken: credentials.access_token,
              businessAccountId: session.deviceInfo?.businessAccountId || credentials.business_account_id,
            });
            creds = this.credentials.get(sessionId);
            if (creds) console.log(`[Business API] Successfully restored credentials for session ${sessionId} (integration ${integration.id})`);
          }
          if (!creds) {
            const settings = await storage.getUserSettings(session.userId);
            if (settings?.whatsappBusinessCredentials?.phoneNumberId === session.deviceInfo?.apiPhoneNumberId && 
                settings.whatsappBusinessCredentials.accessToken) {
              await this.restoreSession(sessionId, {
                phoneNumberId: settings.whatsappBusinessCredentials.phoneNumberId,
                accessToken: settings.whatsappBusinessCredentials.accessToken,
                businessAccountId: settings.whatsappBusinessCredentials.businessAccountId,
              });
              creds = this.credentials.get(sessionId);
              if (creds) console.log(`[Business API] Successfully restored credentials for session ${sessionId}`);
            }
          }
        }
      } catch (error: any) {
        console.error(`[Business API] Failed to restore session credentials:`, error.message);
      }
    }
    
    if (!creds) {
      throw new Error(`Session not found or credentials not available for session: ${sessionId}`);
    }

    // Check if this is a group ID (WhatsApp Business API doesn't support sending to groups directly)
    if (to.includes('@g.us')) {
      throw new Error('WhatsApp Business API does not support sending messages to groups. Groups can only receive messages via the unofficial WhatsApp client.');
    }

    const phoneNumber = this.formatPhoneNumber(to);
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;

    const requestBody: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    };
    if (options?.replyToWhatsAppMessageId) {
      requestBody.context = { message_id: options.replyToWhatsAppMessageId };
    }

    console.log(`[Business API] Sending message to ${phoneNumber} (original: ${to})`);
    console.log(`[Business API] Request URL: ${url}`);
    console.log(`[Business API] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log(`[Business API] Response status: ${response.status}`);
    console.log(`[Business API] Response body:`, responseText);

    if (!response.ok) {
      let error;
      try {
        error = JSON.parse(responseText);
      } catch {
        error = { error: { message: responseText || 'Unknown error' } };
      }
      
      const errorMessage = error.error?.message || error.error?.error_user_msg || error.error?.error_subcode || JSON.stringify(error);
      const errorCode = error.error?.code;
      const errorSubcode = error.error?.error_subcode;
      
      console.error(`[Business API] Error sending message:`, {
        status: response.status,
        code: errorCode,
        subcode: errorSubcode,
        message: errorMessage,
        fullError: error,
      });
      
      // Provide more helpful error messages (check specific codes first so we don't override with generic "phone" message)
      if (errorCode === 131031) {
        throw new Error('Message failed: The recipient phone number is not a valid WhatsApp number or is not registered on WhatsApp. Ask them to install WhatsApp and ensure the number is correct.');
      }
      if (errorCode === 131026 || errorSubcode === 131026) {
        throw new Error('Message failed: You can only send free-form messages within 24 hours of the recipient\'s last message. Use an approved message template instead.');
      }
      if (errorMessage.includes('template') || errorMessage.includes('24 hour') || errorMessage.includes('outside') || errorCode === 131047) {
        throw new Error('Cannot send free-form message: Recipient must have messaged you first (24-hour window) or you need to use an approved message template. For testing, have the recipient send you a message first, or use a template message.');
      }
      if (errorMessage.includes('rate limit') || errorMessage.includes('429') || errorCode === 80007) {
        throw new Error('Rate limit exceeded. Please wait before sending more messages.');
      }
      // Code 100 + subcode 33 or "does not exist" / "missing permissions" = Phone Number ID invalid or token lacks permission
      const isPhoneNumberIdError = errorCode === 100 && (
        errorSubcode === 33 ||
        /does not exist|cannot be loaded due to missing permissions|does not support this operation/i.test(errorMessage)
      );
      if (isPhoneNumberIdError) {
        console.error('[Business API] Phone Number ID / permissions error:', {
          code: errorCode,
          error_subcode: errorSubcode,
          message: errorMessage,
          phoneNumberId: creds.phoneNumberId,
        });
        throw new Error(
          'WhatsApp Business phone number is invalid or the connection has expired. The Phone Number ID used for sending no longer exists or your app does not have permission. Go to Integrations → WhatsApp Business, disconnect and reconnect your WhatsApp Business account, then add the phone number again.'
        );
      }
      // Code 100 = other invalid parameter (e.g. recipient). Only show "format" message if the number doesn't look like E.164.
      const looksLikeE164 = /^\d{10,15}$/.test(phoneNumber);
      if (errorCode === 100) {
        if (looksLikeE164) {
          throw new Error(
            'WhatsApp API rejected the request. For free-form text (e.g. "Hi"), the recipient must have messaged your business number in the last 24 hours. Otherwise use an approved Message Template. Ask the recipient to send you a message first from WhatsApp, then reply within 24 hours, or send via a template from the Templates section.'
          );
        }
        throw new Error(`Invalid phone number format. Use country code + number without + (e.g. 919876543210 for India). Original: ${to}`);
      }
      if (errorMessage.includes('invalid') && errorMessage.includes('phone') && !looksLikeE164) {
        throw new Error(`Invalid phone number format. Use country code + number without + (e.g. 919876543210 for India). Original: ${to}`);
      }
      if (errorMessage.toLowerCase().includes('phone') || errorMessage.toLowerCase().includes('invalid')) {
        if (looksLikeE164) {
          throw new Error(`WhatsApp API error: ${errorMessage}. The number format (${phoneNumber}) is correct. Ensure the recipient messaged you in the last 24 hours for free-form text, or use an approved Message Template.`);
        }
        throw new Error(`WhatsApp API error: ${errorMessage}. If the number is in format 919876543210, the recipient may not be on WhatsApp or the number may be invalid.`);
      }
      
      throw new Error(`WhatsApp API error (${errorCode || 'unknown'}): ${errorMessage}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid response from WhatsApp API: ${responseText}`);
    }

    console.log(`[Business API] Message sent successfully:`, {
      messageId: result.messages?.[0]?.id,
      status: result.messages?.[0]?.message_status,
      contacts: result.contacts,
    });

    // Check if message was actually accepted
    if (!result.messages || !result.messages[0] || !result.messages[0].id) {
      console.warn(`[Business API] Warning: API returned success but no message ID. Response:`, result);
      throw new Error('Message was accepted but WhatsApp did not return a message ID. The message may not be delivered.');
    }

    const messageStatus = result.messages[0].message_status;
    const messageId = result.messages[0].id;

    // Check for potential delivery issues
    // Note: WhatsApp Business API accepts messages even outside 24-hour window,
    // but delivery status will come via webhook. If status is not 'sent' or 'accepted',
    // there might be an issue.
    if (messageStatus && !['sent', 'accepted', 'pending'].includes(messageStatus.toLowerCase())) {
      console.warn(`[Business API] Warning: Message status is '${messageStatus}', which may indicate delivery issues.`);
    }

    return {
      id: messageId,
      timestamp: new Date(),
      status: messageStatus || 'sent',
      contacts: result.contacts,
      warning: messageStatus && !['sent', 'accepted', 'pending'].includes(messageStatus.toLowerCase()) 
        ? 'Message may not be delivered. Check delivery status via webhook. Free-form messages require recipient to have messaged you within 24 hours.'
        : undefined,
    };
  }

  /**
   * Send a reaction to a message (official WhatsApp Cloud API).
   * Reactions are not wallet-billed.
   * @param sessionId - Session ID
   * @param to - Recipient phone number (with or without @c.us)
   * @param messageId - WhatsApp message ID (wamid) of the message to react to
   * @param emoji - Single emoji character (e.g. "👍", "❤️")
   */
  async sendReaction(sessionId: string, to: string, messageId: string, emoji: string): Promise<void> {
    let creds = this.credentials.get(sessionId);
    if (!creds) {
      try {
        const session = await storage.getSession(sessionId);
        if (session && session.userId) {
          let integration = null;
          if (session.deviceInfo?.integrationId) {
            integration = await storage.getIntegration(session.deviceInfo.integrationId, session.userId);
          }
          if (!integration) {
            integration = await storage.getIntegrationByName("whatsapp-business", session.userId, session.organizationId || undefined);
          }
          if (integration?.status === "connected" && integration.credentials) {
            const credentials = integration.credentials as any;
            await this.restoreSession(sessionId, {
              phoneNumberId: session.deviceInfo?.apiPhoneNumberId || credentials.phone_number_id,
              accessToken: credentials.access_token,
              businessAccountId: session.deviceInfo?.businessAccountId || credentials.business_account_id,
            });
            creds = this.credentials.get(sessionId);
          }
          if (!creds) {
            const settings = await storage.getUserSettings(session.userId);
            if (settings?.whatsappBusinessCredentials?.phoneNumberId === session.deviceInfo?.apiPhoneNumberId &&
                settings.whatsappBusinessCredentials.accessToken) {
              await this.restoreSession(sessionId, {
                phoneNumberId: settings.whatsappBusinessCredentials.phoneNumberId,
                accessToken: settings.whatsappBusinessCredentials.accessToken,
                businessAccountId: settings.whatsappBusinessCredentials.businessAccountId,
              });
              creds = this.credentials.get(sessionId);
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }
    if (!creds) {
      throw new Error(`Session not found or credentials not available for session: ${sessionId}`);
    }

    const phoneNumber = this.formatPhoneNumber(to);
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;

    const requestBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'reaction',
      reaction: {
        message_id: messageId,
        emoji: emoji || '👍',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    if (!response.ok) {
      let error: any;
      try {
        error = JSON.parse(responseText);
      } catch {
        error = { error: { message: responseText || 'Unknown error' } };
      }
      const errorMessage = error.error?.message || error.error?.error_user_msg || responseText;
      throw new Error(`WhatsApp API reaction failed: ${errorMessage}`);
    }
  }

  // Mark message as read (send read receipt to WhatsApp)
  async markMessageAsRead(sessionId: string, whatsappMessageId: string): Promise<void> {
    let creds = this.credentials.get(sessionId);
    if (!creds) {
      // Try to restore session credentials from database
      console.log(`[Business API] Credentials not in memory for session ${sessionId}, attempting to restore...`);
      try {
        const session = await storage.getSession(sessionId);
        if (session && session.userId) {
          const settings = await storage.getUserSettings(session.userId);
          if (settings?.whatsappBusinessCredentials?.phoneNumberId === session.deviceInfo?.apiPhoneNumberId && 
              settings.whatsappBusinessCredentials.accessToken) {
            await this.restoreSession(sessionId, {
              phoneNumberId: settings.whatsappBusinessCredentials.phoneNumberId,
              accessToken: settings.whatsappBusinessCredentials.accessToken,
              businessAccountId: settings.whatsappBusinessCredentials.businessAccountId,
            });
            creds = this.credentials.get(sessionId);
            if (creds) {
              console.log(`[Business API] Successfully restored credentials for session ${sessionId}`);
            }
          }
        }
      } catch (error: any) {
        console.error(`[Business API] Failed to restore session credentials:`, error.message);
      }
    }
    
    if (!creds) {
      throw new Error(`Session not found or credentials not available for session: ${sessionId}`);
    }

    const url = `${this.baseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;
    
    const body = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: whatsappMessageId,
    };

    console.log(`[Business API] Sending read receipt for message: ${whatsappMessageId}`);
    console.log(`[Business API] Request URL: ${url}`);
    console.log(`[Business API] Request body:`, JSON.stringify(body, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${responseText}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error?.message || errorData.error_message || errorMessage;
        const errorCode = errorData.error?.code || errorData.error_code;
        console.error(`[Business API] Read receipt failed:`, {
          status: response.status,
          error: errorMessage,
          code: errorCode,
          response: errorData,
        });
      } catch {
        console.error(`[Business API] Read receipt failed:`, {
          status: response.status,
          response: responseText,
        });
      }
      throw new Error(`Failed to send read receipt: ${errorMessage}`);
    }

    console.log(`[Business API] Read receipt sent successfully for message: ${whatsappMessageId}`);
  }

  // Send template message (works outside 24-hour window)
  // For form/flow templates, set flowButton so we add the required button component (type: button, sub_type: flow).
  async sendTemplateMessage(
    sessionId: string,
    to: string,
    templateName: string,
    templateLanguage: string = 'en',
    templateParams?: string[] | Array<{ parameter_name: string; text: string }>,
    headerImageId?: string,
    headerVideoId?: string,
    headerDocumentId?: string,
    templateBodyText?: string, // Optional: template body text to detect parameter format
    flowButton?: { flowToken?: string; flowActionData?: Record<string, unknown> }, // Optional: for templates with FLOW button; include to add button component
    carouselSend?: { cards: any[] }, // Media card carousel: Meta requires carousel component with card_index + per-card header media IDs
    headerImageLink?: string,
    headerVideoLink?: string,
    headerDocumentLink?: string,
    templateMetaForAuth?: TemplateMetaForAuth | null, // AUTHENTICATION + OTP button: duplicate OTP on url button (Meta docs)
    walletBilling?: OutboundWalletBillingOverrides,
    /** Without this, WhatsApp clients show document headers as "Untitled" */
    headerDocumentFilename?: string
  ): Promise<any> {
    return withOutboundWalletBilling(
      {
        sessionId,
        recipientPhone: to,
        templateName,
        debitType: walletBilling?.debitType,
        referenceType: walletBilling?.referenceType,
        referenceId: walletBilling?.referenceId,
        description: walletBilling?.description,
      },
      async () =>
        this.sendTemplateMessageCore(
          sessionId,
          to,
          templateName,
          templateLanguage,
          templateParams,
          headerImageId,
          headerVideoId,
          headerDocumentId,
          templateBodyText,
          flowButton,
          carouselSend,
          headerImageLink,
          headerVideoLink,
          headerDocumentLink,
          templateMetaForAuth,
          headerDocumentFilename
        )
    );
  }

  private async sendTemplateMessageCore(
    sessionId: string,
    to: string,
    templateName: string,
    templateLanguage: string = 'en',
    templateParams?: string[] | Array<{ parameter_name: string; text: string }>,
    headerImageId?: string,
    headerVideoId?: string,
    headerDocumentId?: string,
    templateBodyText?: string,
    flowButton?: { flowToken?: string; flowActionData?: Record<string, unknown> },
    carouselSend?: { cards: any[] },
    headerImageLink?: string,
    headerVideoLink?: string,
    headerDocumentLink?: string,
    templateMetaForAuth?: TemplateMetaForAuth | null,
    headerDocumentFilename?: string
  ): Promise<any> {
    let creds = this.credentials.get(sessionId);
    if (!creds) {
      // Try to restore session credentials from database
      console.log(`[Business API] Credentials not in memory for session ${sessionId}, attempting to restore...`);
      try {
        const session = await storage.getSession(sessionId);
        if (session && session.userId) {
          const settings = await storage.getUserSettings(session.userId);
          if (settings?.whatsappBusinessCredentials?.phoneNumberId === session.deviceInfo?.apiPhoneNumberId && 
              settings.whatsappBusinessCredentials.accessToken) {
            await this.restoreSession(sessionId, {
              phoneNumberId: settings.whatsappBusinessCredentials.phoneNumberId,
              accessToken: settings.whatsappBusinessCredentials.accessToken,
              businessAccountId: settings.whatsappBusinessCredentials.businessAccountId,
            });
            creds = this.credentials.get(sessionId);
            if (creds) {
              console.log(`[Business API] Successfully restored credentials for session ${sessionId}`);
            }
          }
        }
      } catch (error: any) {
        console.error(`[Business API] Failed to restore session credentials:`, error.message);
      }
    }
    
    if (!creds) {
      throw new Error(`Session not found or credentials not available for session: ${sessionId}`);
    }

    const phoneNumber = this.formatPhoneNumber(to);
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;

    const requestBody: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: templateLanguage,
        },
      },
    };

    // Build components array - must match template structure exactly
    const components: any[] = [];

    const hasCarousel = !!(carouselSend?.cards?.length);
    const headerImageIdEff = hasCarousel ? undefined : headerImageId;
    const headerVideoIdEff = hasCarousel ? undefined : headerVideoId;
    const headerDocumentIdEff = hasCarousel ? undefined : headerDocumentId;
    const headerImageLinkEff = hasCarousel ? undefined : headerImageLink?.trim();
    const headerVideoLinkEff = hasCarousel ? undefined : headerVideoLink?.trim();
    const headerDocumentLinkEff = hasCarousel ? undefined : headerDocumentLink?.trim();
    
    // Add HEADER component if media ID or public link is provided
    if (headerImageIdEff) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'image',
            image: {
              id: headerImageIdEff,
            },
          },
        ],
      });
    } else if (headerImageLinkEff) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'image',
            image: {
              link: headerImageLinkEff,
            },
          },
        ],
      });
    } else if (headerVideoIdEff) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'video',
            video: {
              id: headerVideoIdEff,
            },
          },
        ],
      });
    } else if (headerVideoLinkEff) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'video',
            video: {
              link: headerVideoLinkEff,
            },
          },
        ],
      });
    } else if (headerDocumentIdEff) {
      const documentFilename = resolveWhatsAppDocumentFilename(
        headerDocumentFilename,
        headerDocumentLinkEff
      );
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: {
              id: headerDocumentIdEff,
              filename: documentFilename,
            },
          },
        ],
      });
    } else if (headerDocumentLinkEff) {
      const documentFilename = resolveWhatsAppDocumentFilename(
        headerDocumentFilename,
        headerDocumentLinkEff
      );
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: {
              link: headerDocumentLinkEff,
              filename: documentFilename,
            },
          },
        ],
      });
    }
    
    // Add BODY component with parameters if provided
    // Note: Even if templateParams is an empty array, we should check if the template requires parameters
    // For now, we only add BODY component if parameters are provided
    // If template requires parameters but none are provided, WhatsApp will reject the message
    if (templateParams !== undefined && templateParams !== null && templateParams.length > 0) {
      // Check if template uses named parameters by examining templateBodyText or first param structure
      const usesNamedParams = templateBodyText 
        ? /\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/.test(templateBodyText) // Check for {{name}} pattern (not {{1}})
        : templateParams.length > 0 && typeof templateParams[0] === 'object' && 'parameter_name' in templateParams[0];
      
      if (usesNamedParams && templateBodyText) {
        // Template uses named parameters - extract parameter names from template body
        const namedParamMatches = templateBodyText.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g);
        const paramNames: string[] = [];
        for (const match of namedParamMatches) {
          if (!paramNames.includes(match[1])) {
            paramNames.push(match[1]);
          }
        }
        
        console.log(`[Business API] Template uses named parameters: ${paramNames.join(', ')}`);
        
        // Map parameters to named format
        const namedParams: any[] = [];
        
        if (templateParams.length > 0 && typeof templateParams[0] === 'object' && 'parameter_name' in templateParams[0]) {
          // Already in named format
          namedParams.push(...templateParams.map((param: any) => ({
            type: 'text',
            parameter_name: param.parameter_name,
            text: sanitizeWhatsAppTemplateParamText(param.text) || '-',
          })));
        } else {
          // Convert positional to named - map by order
          if (templateParams.length !== paramNames.length) {
            console.warn(`[Business API] Parameter count mismatch: template has ${paramNames.length} named parameters but ${templateParams.length} values provided`);
          }
          
          // Map each parameter value to its corresponding name
          paramNames.forEach((paramName, index) => {
            const paramValue = index < templateParams.length ? templateParams[index] : '';
            namedParams.push({
              type: 'text',
              parameter_name: paramName,
              text: sanitizeWhatsAppTemplateParamText(paramValue) || '-',
            });
          });
        }
        
        components.push({
          type: 'body',
          parameters: namedParams,
        });
        console.log(`[Business API] Adding BODY component with ${namedParams.length} named parameters`);
      } else {
        // Template uses positional parameters - send as array
        const validParams = templateParams.filter((p: any) => {
          if (typeof p === 'object') return false; // Skip named param objects in positional mode
          return p !== undefined && p !== null;
        });
        
        if (validParams.length > 0) {
          components.push({
            type: 'body',
            parameters: validParams.map((param: any) => ({
              type: 'text',
              text: sanitizeWhatsAppTemplateParamText(param) || '-',
            })),
          });
          console.log(`[Business API] Adding BODY component with ${validParams.length} positional parameters`);
        }
      }
    } else {
      console.log(`[Business API] No template parameters provided - template may not require parameters or may fail if it does`);
    }

    const authOtpForButton = resolveAuthenticationCopyCodeForSend(templateMetaForAuth ?? undefined, templateParams as any);
    if (authOtpForButton) {
      const otp = authOtpForButton.slice(0, 15);
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [
          {
            type: 'text',
            text: otp,
          },
        ],
      });
      console.log(
        `[Business API] Adding AUTHENTICATION OTP button (sub_type url + text param — same OTP as body per Meta docs)`
      );
    }

    // Add BUTTON component for form/flow templates (Meta requires type: button, sub_type: flow, index: 0, parameters with action)
    if (flowButton) {
      components.push({
        type: 'button',
        sub_type: 'flow',
        index: '0',
        parameters: [
          {
            type: 'action',
            action: {
              flow_token: flowButton.flowToken ?? 'unused',
              ...(flowButton.flowActionData && Object.keys(flowButton.flowActionData).length > 0
                ? { flow_action_data: flowButton.flowActionData }
                : {}),
            },
          },
        ],
      });
      console.log(`[Business API] Adding FLOW button component for form template`);
    }

    if (carouselSend?.cards?.length) {
      components.push({
        type: 'carousel',
        cards: carouselSend.cards,
      });
      console.log(`[Business API] Adding carousel component with ${carouselSend.cards.length} card(s)`);
    }

    // Only add components array if we have components
    if (components.length > 0) {
      requestBody.template.components = components;
    }

    // Helper to send request with retry for language code mismatch (132001)
    // credit_line orgs: template send via supplier middleware; self_pay: Meta Graph
    const templateSendRoute = await resolveTemplateSendRoute(sessionId);
    let templateMetaCategory: import('@shared/schema').WalletMetaCategory | undefined;
    if (templateSendRoute.via === 'credit_line') {
      try {
        const sessionForCat = await storage.getSession(sessionId);
        const orgId = sessionForCat
          ? await resolveOrganizationIdForSession(sessionForCat, sessionForCat.userId, null)
          : null;
        if (sessionForCat && orgId) {
          templateMetaCategory = await resolveTemplateWalletCategory(
            templateName,
            sessionForCat.userId,
            orgId,
            creds.phoneNumberId
          );
        }
      } catch {
        templateMetaCategory = 'marketing';
      }
    }

    const sendTemplateRequest = async (lang: string) => {
      const body = {
        ...requestBody,
        template: { ...requestBody.template, language: { code: lang } },
      };

      if (templateSendRoute.via === 'credit_line') {
        const wabaId = templateSendRoute.wabaId || creds.businessAccountId || '';
        console.log(
          `[Business API] Template send via credit-line provider=${templateSendRoute.providerId} waba=${wabaId} mmLiteCat=${templateMetaCategory}`
        );
        const cl = await sendTemplateViaCreditLine({
          providerId: templateSendRoute.providerId,
          phoneNumberId: creds.phoneNumberId,
          wabaId,
          body,
          metaCategory: templateMetaCategory,
        });
        // Mimic fetch Response for shared error handling below
        const fakeResponse = {
          ok: cl.ok,
          status: cl.status,
        } as Response;
        return { response: fakeResponse, responseText: cl.responseText };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      return { response, responseText: text };
    };

    let response: Response;
    let responseText: string;
    let lastError: any;
    const languagesToTry: string[] = [templateLanguage];

    // On 132001 (template does not exist in translation), try "en" fallback for en_US/en_GB etc.
    if (templateLanguage && templateLanguage !== 'en' && /^en[_\-]/.test(templateLanguage)) {
      languagesToTry.push('en');
    } else if (templateLanguage === 'en_US') {
      languagesToTry.push('en');
    }

    for (const lang of languagesToTry) {
      console.log(`[Business API] Sending template message to ${phoneNumber} (original: ${to})`);
      console.log(`[Business API] Template: ${templateName}, Language: ${lang}`);
      const result = await sendTemplateRequest(lang);
      response = result.response;
      responseText = result.responseText;
      console.log(`[Business API] Template message response status: ${response.status}`);
      console.log(`[Business API] Template message response body:`, responseText);

      if (response.ok) break;

      let error: any;
      try {
        error = JSON.parse(responseText);
      } catch {
        error = { error: { message: responseText || 'Unknown error' } };
      }
      lastError = error;

      const errorCode = error.error?.code;
      if (errorCode === 132001 && lang !== 'en' && languagesToTry.indexOf('en') > languagesToTry.indexOf(lang)) {
        console.log(`[Business API] Template not found in "${lang}", retrying with "en"...`);
        continue;
      }
      break;
    }

    if (!response!.ok) {
      const error = lastError!;
      const errorCode = error.error?.code;
      const errorMessage = error.error?.message || error.error?.error_user_msg || JSON.stringify(error);
      
      let userFriendlyMessage = errorMessage;
      if (errorCode === 133010) {
        userFriendlyMessage = `Phone number not registered: The phone number needs to be verified and registered in Meta Business Manager. Please complete the phone number verification process in Meta Business Manager before sending messages.`;
      } else if (errorCode === 100) {
        userFriendlyMessage = `Invalid phone number ID: The phone number ID is invalid or doesn't exist. Please reconnect the phone number.`;
      } else if (errorCode === 190) {
        userFriendlyMessage = `Access token expired or invalid: Please reconnect your WhatsApp Business integration.`;
      } else if (errorCode === 132001) {
        userFriendlyMessage = `Template "${templateName}" does not exist for language "${templateLanguage}". The template may be registered in Meta with a different language (e.g. "en" instead of "en_US"). Check Meta Business Manager → WhatsApp Manager → Message Templates for the exact language code.`;
      } else if (errorCode === 132018) {
        userFriendlyMessage = `There's an issue with the parameters in your template. WhatsApp body variables cannot contain line breaks or more than 1024 characters each. Use shorter single-line values, or put extra lines in the approved template body instead of {{1}} / {{2}}.`;
      }
      
      throw new Error(`WhatsApp API error: ${userFriendlyMessage}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid response from WhatsApp API: ${responseText}`);
    }

    // Check if message was actually accepted
    if (!result.messages || !result.messages[0] || !result.messages[0].id) {
      console.error(`[Business API] Template message API returned success but no message ID. Response:`, result);
      throw new Error('Template message was accepted but WhatsApp did not return a message ID. The message may not be delivered. Please check if the template is approved and the recipient phone number is valid.');
    }

    const messageStatus = result.messages[0].message_status;
    const messageId = result.messages[0].id;

    console.log(`[Business API] Template message sent successfully:`, {
      messageId: messageId,
      status: messageStatus,
      contacts: result.contacts,
    });

    // Warn if status indicates potential issues
    if (messageStatus && !['sent', 'accepted', 'pending'].includes(messageStatus.toLowerCase())) {
      console.warn(`[Business API] Warning: Template message status is '${messageStatus}', which may indicate delivery issues.`);
    }

    return {
      id: messageId,
      timestamp: new Date(),
      status: messageStatus || 'sent',
      contacts: result.contacts,
      warning: messageStatus && !['sent', 'accepted', 'pending'].includes(messageStatus.toLowerCase()) 
        ? `Message status is '${messageStatus}'. Delivery status will be updated via webhook.`
        : undefined,
    };
  }

  async sendMediaMessage(
    sessionId: string,
    to: string,
    media: Buffer,
    fileName: string,
    caption?: string,
    preferredMimeType?: string,
    walletBilling?: OutboundWalletBillingOverrides
  ): Promise<any> {
    return withOutboundWalletBilling(
      {
        sessionId,
        recipientPhone: to,
        metaCategory: 'service',
        debitType: walletBilling?.debitType,
        referenceType: walletBilling?.referenceType,
        referenceId: walletBilling?.referenceId,
        description: walletBilling?.description,
      },
      async () =>
        this.sendMediaMessageCore(sessionId, to, media, fileName, caption, preferredMimeType)
    );
  }

  private async sendMediaMessageCore(
    sessionId: string,
    to: string,
    media: Buffer,
    fileName: string,
    caption?: string,
    preferredMimeType?: string
  ): Promise<any> {
    const creds = this.credentials.get(sessionId);
    if (!creds) {
      throw new Error('Session not found');
    }

    const mediaId = await this.uploadMedia(creds, media, fileName, undefined, false, preferredMimeType);
    const phoneNumber = this.formatPhoneNumber(to);
    const mediaType = preferredMimeType?.startsWith('audio/') ? 'audio' : this.getMediaType(fileName);
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;

    const body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: mediaType,
      [mediaType]: {
        id: mediaId,
      },
    };

    if (caption && (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')) {
      body[mediaType].caption = caption;
    }

    if (mediaType === 'document') {
      body[mediaType].filename = fileName;
    }

    /** Voice note UI only for OGG+Opus. MP3/M4A/etc. must omit `voice` or Meta may reject. */
    if (mediaType === 'audio' && body.audio) {
      const resolved = this.resolveMimeType(media, fileName, preferredMimeType);
      const eff = resolved.toLowerCase().split(';')[0].trim().startsWith('audio/')
        ? this.normalizeAudioMimeForWhatsAppUpload(resolved, fileName)
        : resolved;
      if (this.shouldMarkAudioAsVoiceNote(eff, fileName)) {
        body.audio.voice = true;
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();

    return {
      id: result.messages[0].id,
      timestamp: new Date(),
      status: 'sent',
    };
  }

  /** Chatbot executor compatibility: send image by URL. */
  async sendImageMessage(sessionId: string, to: string, url: string, caption?: string): Promise<any> {
    return this.sendMediaByLinkOrId(sessionId, to, { type: 'image', link: url, caption });
  }

  /** Chatbot executor compatibility: send video by URL. */
  async sendVideoMessage(sessionId: string, to: string, url: string, caption?: string): Promise<any> {
    return this.sendMediaByLinkOrId(sessionId, to, { type: 'video', link: url, caption });
  }

  /** Chatbot executor compatibility: send document by URL. */
  async sendDocumentMessage(sessionId: string, to: string, url: string, caption?: string): Promise<any> {
    return this.sendMediaByLinkOrId(sessionId, to, { type: 'document', link: url, caption });
  }

  /** Chatbot executor compatibility: send audio by URL. */
  async sendAudioMessage(sessionId: string, to: string, url: string): Promise<any> {
    return this.sendMediaByLinkOrId(sessionId, to, { type: 'audio', link: url });
  }

  /**
   * Send media message by URL (link) or WhatsApp media ID.
   * Supports image, video, audio, document.
   */
  async sendMediaByLinkOrId(
    sessionId: string,
    to: string,
    options: {
      type: 'image' | 'video' | 'audio' | 'document';
      link?: string;
      id?: string;
      caption?: string;
      filename?: string;
      walletBilling?: OutboundWalletBillingOverrides;
    }
  ): Promise<any> {
    const wb = options.walletBilling;
    return withOutboundWalletBilling(
      {
        sessionId,
        recipientPhone: to,
        metaCategory: 'service',
        debitType: wb?.debitType,
        referenceType: wb?.referenceType,
        referenceId: wb?.referenceId,
        description: wb?.description,
      },
      async () => this.sendMediaByLinkOrIdCore(sessionId, to, options)
    );
  }

  private async sendMediaByLinkOrIdCore(
    sessionId: string,
    to: string,
    options: {
      type: 'image' | 'video' | 'audio' | 'document';
      link?: string;
      id?: string;
      caption?: string;
      filename?: string;
      walletBilling?: OutboundWalletBillingOverrides;
    }
  ): Promise<any> {
    let creds = this.credentials.get(sessionId);
    if (!creds) {
      throw new Error('Session not found');
    }

    if (!options.link && !options.id) {
      throw new Error('Either link or id is required for media message');
    }

    // When link is provided, always handle internally: upload to WhatsApp first, then send by media ID.
    // This works for: full URL with base (our server), local path, or URL from any other website.
    let mediaId = options.id;
    /** Set when we fetched/read bytes — needed for voice-note detection on audio sends. */
    let fileBuffer: Buffer | undefined;
    let fileName: string | undefined;
    if (options.link && !mediaId) {
      const link = options.link;

      // 1) Path-only (no scheme): treat as local path on this server (e.g. /uploads/org/gallery/file.png)
      // 2) Full URL (http/https): always fetch from URL so that localhost:5000, CDN, etc. work
      const isFullUrl = link.startsWith('http://') || link.startsWith('https://');
      const isPathOnly = link.startsWith('/uploads/') && !isFullUrl;

      if (isPathOnly) {
        const fs = await import('fs');
        const path = await import('path');
        let resolvedPath = link;
        try {
          resolvedPath = decodeURIComponent(resolvedPath);
        } catch {
          // keep original if decoding fails
        }
        const filePath = path.join(process.cwd(), resolvedPath);
        if (!fs.existsSync(filePath)) {
          throw new Error(`Local file not found: ${resolvedPath}`);
        }
        fileBuffer = fs.readFileSync(filePath);
        fileName = options.filename || path.basename(filePath);
        console.log(`[Send Media] Read local file ${resolvedPath}`);
      } else if (isFullUrl) {
        // Fetch from URL (works for localhost:5000, same server, or any public URL)
        const res = await fetch(link, { redirect: 'follow' });
        if (!res.ok) {
          throw new Error(`Failed to fetch media from URL: ${res.status} ${res.statusText}`);
        }
        const arr = await res.arrayBuffer();
        fileBuffer = Buffer.from(arr);
        const disp = res.headers.get('content-disposition');
        const match = disp && disp.match(/filename[*]?=(?:UTF-8'')?["']?([^"'\s]+)["']?/i);
        fileName = options.filename || match?.[1] || link.split('/').pop()?.split('?')[0] || 
          (options.type === 'image' ? 'image.jpg' : options.type === 'video' ? 'video.mp4' : options.type === 'document' ? 'document.pdf' : 'file');
        console.log(`[Send Media] Fetched ${fileBuffer.length} bytes from URL: ${link}`);
      } else {
        throw new Error(`Invalid media link: ${link}. Use a full URL (http:// or https://) or a path starting with /uploads/`);
      }

      const uploadType = options.type === 'image' ? 'IMAGE' : options.type === 'video' ? 'VIDEO' : options.type === 'document' ? 'DOCUMENT' : undefined;
      mediaId = await this.uploadMedia(creds, fileBuffer, fileName, uploadType, false);
      console.log(`[Send Media] Uploaded to WhatsApp, got media ID: ${mediaId}`);
    }

    const phoneNumber = this.formatPhoneNumber(to);
    const apiUrl = `${this.baseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;

    // Always use media ID when we have it (we upload whenever link was provided)
    const mediaPayload: any = mediaId ? { id: mediaId } : { link: options.link };

    if (options.caption && ['image', 'video', 'document'].includes(options.type)) {
      mediaPayload.caption = options.caption;
    }
    if (options.filename && options.type === 'document') {
      mediaPayload.filename = options.filename;
    }
    if (options.type === 'audio' && mediaPayload.id && fileBuffer && fileName) {
      const resolved = this.resolveMimeType(fileBuffer, fileName, undefined);
      const eff = resolved.toLowerCase().split(';')[0].trim().startsWith('audio/')
        ? this.normalizeAudioMimeForWhatsAppUpload(resolved, fileName)
        : resolved;
      if (this.shouldMarkAudioAsVoiceNote(eff, fileName)) {
        mediaPayload.voice = true;
      }
    }

    const requestBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: options.type,
      [options.type]: mediaPayload,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: { message: errorText } };
      }
      
      // Provide more helpful error messages
      const errorCode = error.error?.code;
      let userMessage = error.error?.message || JSON.stringify(error);
      if (errorCode === 131047) {
        userMessage = 'Media URL is not accessible. Ensure the URL is publicly accessible (no authentication required) and uses HTTPS.';
      } else if (errorCode === 131026) {
        userMessage = 'Invalid media format or file too large. Check file size and format requirements.';
      }
      
      throw new Error(`WhatsApp API error: ${userMessage}`);
    }

    const result = await response.json();
    return {
      id: result.messages[0].id,
      timestamp: new Date(),
      status: 'sent',
    };
  }

  // Send interactive button message
  async sendButtonMessage(
    sessionId: string,
    to: string,
    options: {
      body: string;
      footer?: string;
      buttons: string[]; // Array of button texts (max 3)
      headerType?: 'none' | 'text' | 'image' | 'video' | 'document';
      headerText?: string;
      headerUrl?: string;
      walletBilling?: OutboundWalletBillingOverrides;
    }
  ): Promise<any> {
    const wb = options.walletBilling;
    return withOutboundWalletBilling(
      {
        sessionId,
        recipientPhone: to,
        metaCategory: 'service',
        debitType: wb?.debitType,
        referenceType: wb?.referenceType,
        referenceId: wb?.referenceId,
        description: wb?.description,
      },
      async () => this.sendButtonMessageCore(sessionId, to, options)
    );
  }

  private async sendButtonMessageCore(
    sessionId: string,
    to: string,
    options: {
      body: string;
      footer?: string;
      buttons: string[];
      headerType?: 'none' | 'text' | 'image' | 'video' | 'document';
      headerText?: string;
      headerUrl?: string;
      walletBilling?: OutboundWalletBillingOverrides;
    }
  ): Promise<any> {
    let creds = this.credentials.get(sessionId);
    if (!creds) {
      throw new Error('Session not found');
    }

    const phoneNumber = this.formatPhoneNumber(to);
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;

    // Build interactive button message
    const buttons = options.buttons.slice(0, 3).map((text, index) => ({
      type: 'reply',
      reply: {
        id: `btn_${index + 1}`,
        title: text.slice(0, 20), // Max 20 chars per button
      },
    }));

    const requestBody: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: options.body.slice(0, 1024),
        },
        action: {
          buttons,
        },
      },
    };

    if (options.footer) {
      requestBody.interactive.footer = {
        text: options.footer.slice(0, 60),
      };
    }

    // Add header if specified
    if (options.headerType && options.headerType !== 'none') {
      if (options.headerType === 'text' && options.headerText) {
        requestBody.interactive.header = {
          type: 'text',
          text: options.headerText.slice(0, 60),
        };
      } else if (options.headerType === 'image' && options.headerUrl) {
        const url = options.headerUrl.trim();
        if (url.startsWith('http://') || url.startsWith('https://')) {
          requestBody.interactive.header = {
            type: 'image',
            image: { link: url },
          };
        } else {
          console.warn('[Business API] Image header requires full URL (https://...). Got:', url.slice(0, 50));
        }
      } else if (options.headerType === 'video' && options.headerUrl) {
        const url = options.headerUrl.trim();
        if (url.startsWith('http://') || url.startsWith('https://')) {
          requestBody.interactive.header = {
            type: 'video',
            video: { link: url },
          };
        } else {
          console.warn('[Business API] Video header requires full URL (https://...). Got:', url.slice(0, 50));
        }
      } else if (options.headerType === 'document' && options.headerUrl) {
        const url = options.headerUrl.trim();
        if (url.startsWith('http://') || url.startsWith('https://')) {
          requestBody.interactive.header = {
            type: 'document',
            document: { link: url, filename: resolveWhatsAppDocumentFilename(undefined, url) },
          };
        } else {
          console.warn('[Business API] Document header requires full URL (https://...). Got:', url.slice(0, 50));
        }
      }
    }

    console.log(`[Business API] Sending button message to ${phoneNumber}`);
    console.log(`[Business API] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      const error = JSON.parse(responseText);
      throw new Error(`WhatsApp API error: ${error.error?.message || JSON.stringify(error)}`);
    }

    const result = JSON.parse(responseText);
    return {
      id: result.messages[0].id,
      timestamp: new Date(),
      status: 'sent',
    };
  }

  // Send CTA message with URL button
  async sendCtaMessage(
    sessionId: string,
    to: string,
    options: {
      body: string;
      footer?: string;
      buttonText: string; // Display text for the URL button (max 20 chars)
      url: string; // URL to open
      headerType?: 'none' | 'text' | 'image' | 'video' | 'document';
      headerText?: string;
      headerUrl?: string;
      walletBilling?: OutboundWalletBillingOverrides;
    }
  ): Promise<any> {
    const wb = options.walletBilling;
    return withOutboundWalletBilling(
      {
        sessionId,
        recipientPhone: to,
        metaCategory: 'service',
        debitType: wb?.debitType,
        referenceType: wb?.referenceType,
        referenceId: wb?.referenceId,
        description: wb?.description,
      },
      async () => this.sendCtaMessageCore(sessionId, to, options)
    );
  }

  private async sendCtaMessageCore(
    sessionId: string,
    to: string,
    options: {
      body: string;
      footer?: string;
      buttonText: string;
      url: string;
      headerType?: 'none' | 'text' | 'image' | 'video' | 'document';
      headerText?: string;
      headerUrl?: string;
      walletBilling?: OutboundWalletBillingOverrides;
    }
  ): Promise<any> {
    let creds = this.credentials.get(sessionId);
    if (!creds) {
      throw new Error('Session not found');
    }

    const phoneNumber = this.formatPhoneNumber(to);
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;

    // Build interactive CTA URL message
    // WhatsApp Cloud API uses type "cta_url" with action.name and action.parameters (NOT type "button" with buttons array)
    const requestBody: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: {
          text: options.body.slice(0, 1024),
        },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: options.buttonText.slice(0, 20), // Max 20 chars
            url: options.url,
          },
        },
      },
    };

    if (options.footer) {
      requestBody.interactive.footer = {
        text: options.footer.slice(0, 60),
      };
    }

    // Add header if specified
    if (options.headerType && options.headerType !== 'none') {
      if (options.headerType === 'text' && options.headerText) {
        requestBody.interactive.header = {
          type: 'text',
          text: options.headerText.slice(0, 60),
        };
      } else if (options.headerType === 'image' && options.headerUrl) {
        requestBody.interactive.header = {
          type: 'image',
          image: { link: options.headerUrl.trim() },
        };
      } else if (options.headerType === 'video' && options.headerUrl) {
        requestBody.interactive.header = {
          type: 'video',
          video: { link: options.headerUrl.trim() },
        };
      } else if (options.headerType === 'document' && options.headerUrl) {
        requestBody.interactive.header = {
          type: 'document',
          document: {
            link: options.headerUrl.trim(),
            filename: resolveWhatsAppDocumentFilename(undefined, options.headerUrl),
          },
        };
      }
    }

    console.log(`[Business API] Sending CTA message to ${phoneNumber}`);
    console.log(`[Business API] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      const error = JSON.parse(responseText);
      throw new Error(`WhatsApp API error: ${error.error?.message || JSON.stringify(error)}`);
    }

    const result = JSON.parse(responseText);
    return {
      id: result.messages[0].id,
      timestamp: new Date(),
      status: 'sent',
    };
  }

  // Send interactive list message
  async sendListMessage(
    sessionId: string,
    to: string,
    options: {
      body: string;
      footer?: string;
      buttonText: string; // Button text to open list (max 20 chars)
      headerType?: 'none' | 'text' | 'image' | 'video' | 'document';
      headerText?: string;
      headerUrl?: string;
      sections: Array<{
        title: string; // Section title (max 24 chars)
        rows: Array<{
          id: string; // Row ID (used for reply)
          title: string; // Row title (max 24 chars)
          description?: string; // Row description (max 72 chars)
        }>;
      }>;
      walletBilling?: OutboundWalletBillingOverrides;
    }
  ): Promise<any> {
    const wb = options.walletBilling;
    return withOutboundWalletBilling(
      {
        sessionId,
        recipientPhone: to,
        metaCategory: 'service',
        debitType: wb?.debitType,
        referenceType: wb?.referenceType,
        referenceId: wb?.referenceId,
        description: wb?.description,
      },
      async () => this.sendListMessageCore(sessionId, to, options)
    );
  }

  private async sendListMessageCore(
    sessionId: string,
    to: string,
    options: {
      body: string;
      footer?: string;
      buttonText: string;
      headerType?: 'none' | 'text' | 'image' | 'video' | 'document';
      headerText?: string;
      headerUrl?: string;
      sections: Array<{
        title: string;
        rows: Array<{
          id: string;
          title: string;
          description?: string;
        }>;
      }>;
      walletBilling?: OutboundWalletBillingOverrides;
    }
  ): Promise<any> {
    let creds = this.credentials.get(sessionId);
    if (!creds) {
      throw new Error('Session not found');
    }

    const phoneNumber = this.formatPhoneNumber(to);
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;

    const sections = normalizeCloudApiListSections(
      options.sections.map((section) => ({
        title: section.title,
        rows: (section.rows || []).map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
        })),
      }))
    );

    if (!sections.length || !sections.some((s) => s.rows.length)) {
      throw new Error(
        'WhatsApp list message: at least one row is required (Cloud API max 10 rows total across all sections)'
      );
    }

    const bodyText = (options.body && options.body.trim() ? options.body.trim() : ' ').slice(0, CLOUD_API_LIST_BODY_MAX);
    const buttonLabel = (options.buttonText || 'Menu').slice(0, CLOUD_API_LIST_BUTTON_MAX);

    const requestBody: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: {
          text: bodyText,
        },
        action: {
          button: buttonLabel,
          sections,
        },
      },
    };

    if (options.footer && options.footer.trim()) {
      requestBody.interactive.footer = {
        text: options.footer.trim().slice(0, CLOUD_API_LIST_FOOTER_MAX),
      };
    }

    // Add header if specified
    if (options.headerType && options.headerType !== 'none') {
      if (options.headerType === 'text' && options.headerText) {
        requestBody.interactive.header = {
          type: 'text',
          text: options.headerText.trim().slice(0, CLOUD_API_LIST_HEADER_TEXT_MAX),
        };
      } else if (options.headerType === 'image' && options.headerUrl) {
        const url = options.headerUrl.trim();
        if (url.startsWith('http://') || url.startsWith('https://')) {
          requestBody.interactive.header = {
            type: 'image',
            image: { link: url },
          };
        }
      } else if (options.headerType === 'video' && options.headerUrl) {
        const url = options.headerUrl.trim();
        if (url.startsWith('http://') || url.startsWith('https://')) {
          requestBody.interactive.header = {
            type: 'video',
            video: { link: url },
          };
        }
      } else if (options.headerType === 'document' && options.headerUrl) {
        const url = options.headerUrl.trim();
        if (url.startsWith('http://') || url.startsWith('https://')) {
          requestBody.interactive.header = {
            type: 'document',
            document: { link: url, filename: resolveWhatsAppDocumentFilename(undefined, url) },
          };
        }
      }
    }

    console.log(`[Business API] Sending list message to ${phoneNumber}`);
    console.log(`[Business API] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      const error = JSON.parse(responseText);
      throw new Error(`WhatsApp API error: ${error.error?.message || JSON.stringify(error)}`);
    }

    const result = JSON.parse(responseText);
    return {
      id: result.messages[0].id,
      timestamp: new Date(),
      status: 'sent',
    };
  }

  async sendLocationMessage(
    sessionId: string,
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string,
    walletBilling?: OutboundWalletBillingOverrides
  ): Promise<any> {
    return withOutboundWalletBilling(
      {
        sessionId,
        recipientPhone: to,
        metaCategory: 'service',
        debitType: walletBilling?.debitType,
        referenceType: walletBilling?.referenceType,
        referenceId: walletBilling?.referenceId,
        description: walletBilling?.description,
      },
      async () => this.sendLocationMessageCore(sessionId, to, latitude, longitude, name, address)
    );
  }

  private async sendLocationMessageCore(
    sessionId: string,
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string
  ): Promise<any> {
    const creds = this.credentials.get(sessionId);
    if (!creds) {
      throw new Error('Session not found');
    }

    const phoneNumber = this.formatPhoneNumber(to);
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;

    const body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'location',
      location: {
        latitude,
        longitude,
      },
    };

    if (name) body.location.name = name;
    if (address) body.location.address = address;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();

    return {
      id: result.messages[0].id,
      timestamp: new Date(),
      status: 'sent',
    };
  }

  /**
   * Send native WhatsApp "Send Location" request button.
   * Opens the location picker on the recipient device.
   */
  async sendLocationRequestMessage(
    sessionId: string,
    to: string,
    bodyText: string,
    walletBilling?: OutboundWalletBillingOverrides
  ): Promise<any> {
    return withOutboundWalletBilling(
      {
        sessionId,
        recipientPhone: to,
        metaCategory: 'service',
        debitType: walletBilling?.debitType,
        referenceType: walletBilling?.referenceType,
        referenceId: walletBilling?.referenceId,
        description: walletBilling?.description,
      },
      async () => this.sendLocationRequestMessageCore(sessionId, to, bodyText)
    );
  }

  private async sendLocationRequestMessageCore(
    sessionId: string,
    to: string,
    bodyText: string
  ): Promise<any> {
    const creds = this.credentials.get(sessionId);
    if (!creds) {
      throw new Error('Session not found');
    }

    const phoneNumber = this.formatPhoneNumber(to);
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;

    const body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'interactive',
      interactive: {
        type: 'location_request_message',
        body: {
          text: bodyText || 'Please send your location.',
        },
        action: {
          name: 'send_location',
        },
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`WhatsApp API error: ${error.error?.message || JSON.stringify(error)}`);
    }

    const result = await response.json();
    return {
      id: result.messages?.[0]?.id,
      timestamp: new Date(),
      status: 'sent',
    };
  }

  async sendContactMessage(
    sessionId: string,
    to: string,
    contactName: string,
    contactPhone: string,
    walletBilling?: OutboundWalletBillingOverrides
  ): Promise<any> {
    return withOutboundWalletBilling(
      {
        sessionId,
        recipientPhone: to,
        metaCategory: 'service',
        debitType: walletBilling?.debitType,
        referenceType: walletBilling?.referenceType,
        referenceId: walletBilling?.referenceId,
        description: walletBilling?.description,
      },
      async () => this.sendContactMessageCore(sessionId, to, contactName, contactPhone)
    );
  }

  private async sendContactMessageCore(
    sessionId: string,
    to: string,
    contactName: string,
    contactPhone: string
  ): Promise<any> {
    const creds = this.credentials.get(sessionId);
    if (!creds) {
      throw new Error('Session not found');
    }

    const phoneNumber = this.formatPhoneNumber(to);
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'contacts',
        contacts: [
          {
            name: {
              formatted_name: contactName,
              first_name: contactName,
            },
            phones: [
              {
                phone: this.formatPhoneNumber(contactPhone),
                type: 'CELL',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();

    return {
      id: result.messages[0].id,
      timestamp: new Date(),
      status: 'sent',
    };
  }

  isClientReady(sessionId: string): boolean {
    return this.credentials.has(sessionId);
  }

  // Store mapping between WhatsApp message ID and our internal message ID
  storeMessageMapping(whatsappMessageId: string, messageId: string, sessionId: string): void {
    this.messageIdMap.set(whatsappMessageId, {
      messageId,
      sessionId,
      timestamp: new Date(),
    });
  }

  async getChats(sessionId: string): Promise<any[]> {
    throw new Error('getChats is not supported for WhatsApp Business API. Use webhooks to receive messages.');
  }

  async getContacts(sessionId: string): Promise<any[]> {
    throw new Error('getContacts is not supported for WhatsApp Business API');
  }

  async getGroups(sessionId: string): Promise<any[]> {
    throw new Error('getGroups is not supported for WhatsApp Business API');
  }

  onQRCode(sessionId: string, callback: (qr: string) => void): void {
    // No-op for Business API - no QR code needed
  }

  onStatusChange(sessionId: string, callback: (status: WhatsappSession['status']) => void): void {
    this.statusCallbacks.set(sessionId, callback);
  }

  onMessage(sessionId: string, callback: (message: any) => void): void {
    this.messageCallbacks.set(sessionId, callback);
  }

  async handleWebhookMessage(data: any): Promise<void> {
    try {
      const entry = data.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value) return;

      if (value.messages) {
        for (const message of value.messages) {
          await this.processIncomingMessage(message, value.metadata, value.contacts);
        }
      }

      // Messages sent by the business from their phone (e.g. from WhatsApp Business app) – store so they show on /chat
      if (value.sent && Array.isArray(value.sent)) {
        for (const message of value.sent) {
          await this.processIncomingMessage(message, value.metadata, value.contacts, { isSentByBusiness: true });
        }
      }

      if (value.statuses) {
        for (const status of value.statuses) {
          await this.processMessageStatus(status, value.metadata);
        }
      }
    } catch (error) {
      console.error('Error processing webhook message:', error);
    }
  }

  async processIncomingMessage(
    message: any,
    metadata: any,
    contacts?: any[],
    options?: { isSentByBusiness?: boolean }
  ): Promise<{ updatedMessage?: Message; userId?: string; updatedMessages?: Array<{ message: Message; userId: string }> } | void> {
    const isSentByBusiness = options?.isSentByBusiness === true;
    // For incoming: message.from = customer. For sent-from-app: message.to = customer (recipient).
    const peerWaId = isSentByBusiness ? (message.to || message.recipient_id) : message.from;
    if (!peerWaId) {
      console.warn('[Business API] Cannot process message: missing from/to', { messageId: message.id, isSentByBusiness });
      return;
    }
    console.log('[Business API] Processing message:', {
      messageId: message.id,
      from: message.from,
      to: message.to,
      isSentByBusiness,
      peerWaId,
      type: message.type,
      phoneNumberId: metadata.phone_number_id,
      displayPhoneNumber: metadata.display_phone_number,
    });

    // Find ALL sessions for this phone number (same number can be connected to multiple accounts)
    // Pass display_phone_number for fallback matching (coexistence: Business App messages may use different ID)
    const sessionIds = await this.findSessionsByPhoneNumberId(
      metadata.phone_number_id,
      metadata.display_phone_number
    );
    
    if (sessionIds.length === 0) {
      console.error('[Business API] ⚠️  CRITICAL: No session found for phone number ID:', metadata.phone_number_id);
      console.error('[Business API] This means the webhook was received but no session exists in the database.');
      console.error('[Business API] Phone Number ID:', metadata.phone_number_id);
      console.error('[Business API] Display Phone Number:', metadata.display_phone_number);
      console.error('[Business API] Message from:', message.from);
      console.error('[Business API] ❌ Message will NOT be stored. This message is for a different phone number that is not connected to this system.');
      console.error('[Business API] To receive messages for this number, please connect it as a session in the system.');
      return;
    }

    console.log('[Business API] Processing for', sessionIds.length, 'session(s):', sessionIds);
    
    // Get contact name from contacts array if available (peer = customer in both incoming and sent cases)
    const contactInfo = contacts?.find(c => c.wa_id === peerWaId);
    const contactName = contactInfo?.profile?.name || peerWaId;
    const updatedMessages: Array<{ message: Message; userId: string }> = [];

    // Normalize phone for comparison (E.164 digits)
    const normalizePhone = (p: string) => (p || '').replace(/\D/g, '');

    // Detect reaction payload (Cloud API uses type "reaction"; when you react from your device, same type is sent)
    const reactionObj = message.reaction || (Array.isArray(message.reactions) && message.reactions[0]) || null;
    const hasReactionPayload = message.type === 'reaction' ||
      (reactionObj && (reactionObj.message_id || reactionObj.messageId));
    const hasNoBody = !message.text?.body?.trim() && !message.caption?.trim();
    const hasNoMedia = !message.image?.id && !message.video?.id && !message.audio?.id && !message.document?.id && !message.sticker?.id;

    // Handle reaction: update the message in ALL sessions that have it
    if (hasReactionPayload || (hasNoBody && hasNoMedia && reactionObj)) {
      const reactionMessageId = reactionObj?.message_id ?? reactionObj?.messageId ?? message.context?.id;
      const emoji = (reactionObj?.emoji ?? '').trim() || '👍';
      console.log('[Business API] Reaction webhook received:', { reactionMessageId, emoji, messageFrom: message.from });
      if (reactionMessageId) {
        for (const sessionId of sessionIds) {
          const session = await storage.getSession(sessionId);
          if (!session) continue;
          const ourNumber = normalizePhone(metadata.display_phone_number || (session.deviceInfo as any)?.phoneNumber || '');
          const fromMe = isSentByBusiness || (ourNumber ? normalizePhone(String(message.from)) === ourNumber : false);
          let targetMessage = await storage.getMessageByIdOrWhatsAppId(reactionMessageId, session.userId, sessionId);
          if (!targetMessage && reactionMessageId.startsWith('wamid.')) {
            targetMessage = await storage.getMessageByIdOrWhatsAppId(reactionMessageId.slice(6), session.userId, sessionId);
          }
          if (!targetMessage && !reactionMessageId.startsWith('wamid.')) {
            targetMessage = await storage.getMessageByIdOrWhatsAppId('wamid.' + reactionMessageId, session.userId, sessionId);
          }
          if (!targetMessage) {
            const idVariants = [reactionMessageId];
            if (reactionMessageId.startsWith('wamid.')) idVariants.push(reactionMessageId.slice(6));
            else idVariants.push('wamid.' + reactionMessageId);
            const chats = await storage.getChatsBySession(sessionId);
            for (const chat of chats) {
              const messages = await storage.getMessagesByChat(chat.id);
              targetMessage = messages.find((m: any) => m.whatsappMessageId && idVariants.includes(m.whatsappMessageId));
              if (targetMessage) break;
            }
          }
          if (targetMessage) {
            const existing = (targetMessage.reactions as Array<{ emoji: string; fromMe: boolean }>) || [];
            const next = [...existing.filter((r: { fromMe: boolean }) => r.fromMe !== fromMe), { emoji, fromMe }];
            const updated = await storage.updateMessage(targetMessage.id, { reactions: next });
            if (updated) {
              updatedMessages.push({ message: { ...updated, reactions: updated.reactions ?? next }, userId: session.userId, eventType: 'message_updated' as const });
            }
          }
        }
        if (updatedMessages.length > 0) {
          return { updatedMessages };
        }
      }
      return;
    }

    // Never create a message with no content (avoids blank bubbles when reaction payload lacks type/reaction field).
    // CRITICAL: Never skip type 'button' (template button click) - we must record CTA and store the message.
    if (message.type === 'button') {
      console.log('[Business API] Template button click received, processing for CTA and storage:', { id: message.id, from: message.from });
    } else if (hasNoBody && hasNoMedia && !message.interactive && !message.button && message.type !== 'template') {
      console.log('[Business API] Skipping message with no content (likely reaction):', { id: message.id, type: message.type });
      return;
    }

    // Extract template components if this is a template message
    // These are needed for both callback and direct storage paths
    let footer: string | null = null;
    let footerButtonText: string | null = null;
    let footerButtonType: 'NONE' | 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | null = null;
    let footerButtonUrl: string | null = null;
    let footerButtonPhone: string | null = null;
    
    // Extract template components from message (needed for both callback and direct storage)
    if (message.type === 'template') {
      // Template messages have context with template info
      if (message.context) {
        // Footer is typically in the template structure, not in the message itself
        // But we can extract it if available
      }
    }

    // Track campaign template button clicks (context.id = the campaign message they replied to)
    // WhatsApp can send: type 'interactive' with interactive.button_reply, OR type 'button' (with or without message.button)
    const repliedToMessageId = message.context?.id || message.context?.message_id;
    const buttonReplyInteractive = message.interactive?.type === 'button_reply' && (message.interactive?.button_reply || message.interactive?.buttonReply);
    const buttonReplyLegacy = message.type === 'button';

    if (repliedToMessageId && (buttonReplyInteractive || buttonReplyLegacy)) {
      let buttonId: string;
      let buttonTitle: string;
      if (buttonReplyInteractive) {
        const btn = message.interactive?.button_reply || message.interactive?.buttonReply;
        buttonId = btn?.id ?? '0';
        buttonTitle = btn?.title || btn?.id || '';
      } else {
        // type 'button' - message.button may be at top level or nested; use optional chaining
        const btn = (message as any).button;
        buttonId = btn?.payload ?? btn?.id ?? (typeof btn?.index === 'number' ? String(btn.index) : undefined) ?? '0';
        buttonTitle = btn?.text ?? '';
      }
      try {
        const recorded = await storage.recordCampaignButtonClick(repliedToMessageId, buttonId, buttonTitle);
        if (recorded) {
          console.log('[Business API] Recorded campaign button click (CTA):', { repliedToMessageId: repliedToMessageId.slice(0, 20) + '...', buttonId, buttonTitle });
        } else {
          console.warn('[Business API] Campaign button click NOT recorded (no campaign recipient found for message id):', repliedToMessageId?.slice(0, 30));
        }
      } catch (err: any) {
        console.error('[Business API] Failed to record campaign button click:', err?.message || err);
      }
    }

    // Extract interactive buttons if present (support both snake_case from webhook and camelCase)
    if (message.interactive) {
      const interactive = message.interactive;
      const btnReply = interactive.button_reply || interactive.buttonReply;
      const listReply = interactive.list_reply || interactive.listReply;
      if (interactive.type === 'button_reply' && btnReply) {
        footerButtonType = 'QUICK_REPLY';
        footerButtonText = JSON.stringify([{
          type: 'QUICK_REPLY',
          text: btnReply.title || '',
        }]);
      } else if (interactive.type === 'list_reply' && listReply) {
        footerButtonType = 'QUICK_REPLY';
        footerButtonText = JSON.stringify([{
          type: 'QUICK_REPLY',
          text: listReply.title || '',
        }]);
      }
    }

    // Extract buttons from template if present (type 'button' with message.button, or interactive fallback)
    if (message.button && ((message.button as any).payload !== undefined || (message.button as any).text !== undefined)) {
      footerButtonType = 'QUICK_REPLY';
      footerButtonText = JSON.stringify([{
        type: 'QUICK_REPLY',
        text: (message.button as any).text || '',
      }]);
    } else if (message.type === 'button') {
      // Template button click without message.button in payload - still mark as quick reply for UI
      footerButtonType = 'QUICK_REPLY';
      footerButtonText = JSON.stringify([{ type: 'QUICK_REPLY', text: (message as any).button?.text || 'Button clicked' }]);
    }
    
    // Extract button/list reply text for chatbot processing (support both snake_case and camelCase)
    let replyText = message.text?.body || message.caption || '';
    let interactiveData: any = undefined;
    if (message.interactive) {
      const interactive = message.interactive;
      const btnReply = interactive.button_reply || interactive.buttonReply;
      const listReply = interactive.list_reply || interactive.listReply;
      if (interactive.type === 'button_reply' && btnReply) {
        replyText = btnReply.title || replyText;
        interactiveData = { type: 'button_reply', buttonReply: btnReply };
      } else if (interactive.type === 'list_reply' && listReply) {
        replyText = listReply.title || replyText;
        interactiveData = { type: 'list_reply', listReply };
      }
    }
    if (!replyText && message.type === 'button') {
      replyText = (message as any).button?.text || 'Button clicked';
      interactiveData = interactiveData || { type: 'button_reply', buttonReply: { title: (message as any).button?.text || 'Button clicked' } };
    }

    // Process for each session (same phone number can be connected to multiple accounts)
    for (const sessionId of sessionIds) {
      const session = await storage.getSession(sessionId);
      if (!session) continue;
      // Session was found by findSessionsByPhoneNumberId (by phone_number_id or display_phone_number fallback) - trust it
      const callback = this.messageCallbacks.get(sessionId);
      if (callback) {
        let replyToMessageId: string | null = null;
        let quotedBody: string | null = null;
        let quotedFromMe: boolean | null = null;
        const replyToWamid = message.context?.message_id ?? message.context?.id;
        if (replyToWamid && session.userId) {
          let refMsg = await storage.getMessageByIdOrWhatsAppId(replyToWamid, session.userId, sessionId);
          if (!refMsg && replyToWamid.startsWith('wamid.')) {
            refMsg = await storage.getMessageByIdOrWhatsAppId(replyToWamid.slice(6), session.userId, sessionId);
          }
          if (!refMsg && !replyToWamid.startsWith('wamid.')) {
            refMsg = await storage.getMessageByIdOrWhatsAppId('wamid.' + replyToWamid, session.userId, sessionId);
          }
          if (refMsg) {
            replyToMessageId = refMsg.id;
            quotedBody = (refMsg.body && String(refMsg.body).trim()) ? String(refMsg.body).substring(0, 500) : '[Message]';
            quotedFromMe = refMsg.fromMe ?? false;
          }
        }
        const formattedMessage = {
          sessionId,
          chatId: peerWaId,
          body: replyText,
          fromMe: isSentByBusiness,
          type: message.type,
          timestamp: new Date(parseInt(message.timestamp) * 1000),
          senderName: contactName,
          senderNumber: peerWaId,
          hasMedia: ['image', 'video', 'audio', 'document', 'sticker'].includes(message.type),
          mediaId: message.image?.id || message.video?.id || message.audio?.id || message.document?.id,
          footer,
          footerButtonType,
          footerButtonText,
          footerButtonUrl,
          footerButtonPhone,
          interactive: interactiveData,
          whatsappMessageId: message.id,
          replyToMessageId: replyToMessageId ?? undefined,
          quotedBody: quotedBody ?? undefined,
          quotedFromMe: quotedFromMe ?? undefined,
        };
        callback(formattedMessage);
        // Process chatbots for incoming messages (callback path - when user has chat open)
        if (!isSentByBusiness && (replyText || interactiveData)) {
          try {
            const chatbotInteractiveData = interactiveData ? {
              type: interactiveData.type,
              buttonReply: interactiveData.buttonReply,
              listReply: interactiveData.listReply,
              isTemplateButton: message.type === 'button',
            } : undefined;
            const chatbotMessageBody = replyText || interactiveData?.buttonReply?.title || interactiveData?.listReply?.title || '';
            await processMessageForChatbots(
              sessionId,
              peerWaId,
              chatbotMessageBody,
              session.userId,
              session.organizationId || undefined,
              chatbotInteractiveData
            );
          } catch (chatbotErr: any) {
            console.error('[Business API] Chatbot error (callback path):', chatbotErr?.message);
          }
        }
      } else {
        const storedMessage = await this.storeMessageDirectly(sessionId, message, contactName, metadata, {
          footer,
          footerButtonType,
          footerButtonText,
          footerButtonUrl,
          footerButtonPhone,
          isSentByBusiness,
        });
        if (storedMessage) {
          updatedMessages.push({ message: storedMessage, userId: session.userId, eventType: 'new_message' as const });
          const event = isSentByBusiness ? 'message.sent' : 'message.received';
          await triggerWebhooks(session.userId, event, {
            message: storedMessage,
            chat: { contactName, contactNumber: peerWaId },
          });
        }
      }
    }
    if (updatedMessages.length > 0) {
      return { updatedMessages };
    }
  }

  private async storeMessageDirectly(
    sessionId: string,
    message: any,
    contactName: string,
    metadata: any,
    templateData: {
      footer: string | null;
      footerButtonType: 'NONE' | 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | null;
      footerButtonText: string | null;
      footerButtonUrl: string | null;
      footerButtonPhone: string | null;
      isSentByBusiness?: boolean;
    }
  ): Promise<any | null> {
    const isSentByBusiness = templateData.isSentByBusiness === true;
    try {
      const session = await storage.getSession(sessionId);
      if (!session) {
        console.error('[Business API] Cannot store message: session not found:', sessionId);
        return null;
      }
      
      // Verify incoming message belongs to this session (phone_number_id or display_phone_number for coexistence)
      const sessionPhoneNumberId = session.deviceInfo?.apiPhoneNumberId || session.deviceInfo?.phoneNumberId;
      const incomingPhoneNumberId = metadata.phone_number_id;
      const idMatch = sessionPhoneNumberId && incomingPhoneNumberId && String(sessionPhoneNumberId) === String(incomingPhoneNumberId);
      const displayMatch = metadata.display_phone_number && (session.deviceInfo as any)?.displayPhoneNumber &&
        this.normalizePhoneForMatch(metadata.display_phone_number) === this.normalizePhoneForMatch((session.deviceInfo as any).displayPhoneNumber);
      if (sessionPhoneNumberId && incomingPhoneNumberId && !idMatch && !displayMatch) {
        console.error('[Business API] ❌ PHONE NUMBER MISMATCH - Message rejected:');
        console.error('[Business API] Session Phone Number ID:', sessionPhoneNumberId);
        console.error('[Business API] Incoming Message Phone Number ID:', incomingPhoneNumberId);
        console.error('[Business API] Message from:', message.from);
        console.error('[Business API] This message is for a different phone number and will NOT be stored.');
        console.error('[Business API] To receive messages for this number, connect it as a separate session.');
        return null;
      }
      
      if (!sessionPhoneNumberId) {
        console.warn('[Business API] ⚠️  Session does not have phone number ID stored. Cannot verify message belongs to this session.');
        console.warn('[Business API] Session ID:', sessionId);
        console.warn('[Business API] Incoming Phone Number ID:', incomingPhoneNumberId);
        // Still allow storage but log warning
      }

      // For sent-from-app: chat partner is message.to (recipient). For incoming: message.from (sender).
      const senderNumber = isSentByBusiness ? (message.to || message.recipient_id) : message.from;
      
      // Extract media URL and ID from webhook
      let mediaUrl: string | null = null;
      let mediaId: string | null = null;
      
      if (message.image) {
        mediaUrl = message.image.url || null;
        mediaId = message.image.id || null;
      } else if (message.video) {
        mediaUrl = message.video.url || null;
        mediaId = message.video.id || null;
      } else if (message.audio) {
        mediaUrl = message.audio.url || null;
        mediaId = message.audio.id || null;
      } else if (message.document) {
        mediaUrl = message.document.url || null;
        mediaId = message.document.id || null;
      } else if (message.sticker) {
        mediaUrl = message.sticker.url || null;
        mediaId = message.sticker.id || null;
      }

      // Many webhooks omit ephemeral CDN URLs; keep Graph media id so inbox can load via /api/media/:id
      if (!mediaUrl && mediaId) {
        mediaUrl = mediaId;
      }
      
      // Get message body - text field, legacy caption, or media captions (Cloud API puts image/video captions on image.caption, not message.caption)
      let messageBody =
        message.text?.body ||
        message.caption ||
        message.image?.caption ||
        message.video?.caption ||
        message.audio?.caption ||
        message.document?.caption ||
        '';
      if (!messageBody && message.interactive?.type === 'button_reply' && message.interactive?.button_reply?.title) {
        messageBody = message.interactive.button_reply.title;
      }
      if (!messageBody && message.interactive?.type === 'list_reply' && message.interactive?.list_reply?.title) {
        messageBody = message.interactive.list_reply.title;
      }
      if (!messageBody && message.type === 'button') {
        messageBody = (message as any).button?.text || 'Button clicked';
      }
      if (!messageBody && ['image', 'video', 'audio', 'document', 'sticker'].includes(message.type)) {
        // Set default body for media messages without captions
        const mediaTypeLabels: Record<string, string> = {
          'image': '[Image]',
          'video': '[Video]',
          'audio': '[Audio]',
          'document': '[Document]',
          'sticker': '[Sticker]',
        };
        messageBody = mediaTypeLabels[message.type] || '[Media]';
      }
      
      const messageType = message.type === 'text' ? 'text' : 
                         message.type === 'image' ? 'image' :
                         message.type === 'video' ? 'video' :
                         message.type === 'audio' ? 'audio' :
                         message.type === 'document' ? 'document' :
                         message.type === 'location' ? 'location' :
                         message.type === 'contacts' ? 'contact' :
                         message.type === 'template' ? 'template' :
                         message.type === 'interactive' ? 'text' :
                         message.type === 'button' ? 'text' : 'text';

      // Normalize phone number for comparison
      const normalizePhoneNumber = (phoneNumber: string): string => {
        return phoneNumber.replace('@c.us', '').replace('@g.us', '').replace(/^\+/, '').trim();
      };
      
      const normalizedSenderNumber = normalizePhoneNumber(senderNumber);
      
      // Find or create contact (normalize for comparison)
      const existingContacts = await storage.getContactsBySession(sessionId);
      let contact = existingContacts.find(c => {
        const normalizedContact = normalizePhoneNumber(c.number);
        return normalizedContact === normalizedSenderNumber;
      });
      
      // Ensure senderNumber has proper format for storage
      let formattedSenderNumber = senderNumber;
      if (!formattedSenderNumber.includes('@c.us') && !formattedSenderNumber.includes('@g.us')) {
        formattedSenderNumber = `${formattedSenderNumber}@c.us`;
      }
      
      if (!contact) {
        contact = await storage.createContact({
          sessionId,
          name: contactName,
          number: formattedSenderNumber,
          isGroup: false,
        });
      }
      
      // Always create/update managed contact with source "whatsapp" if it doesn't exist
      // This ensures contacts appear on the /contacts page even if they already exist in the contacts table
      try {
        // Derive organizationId: sessions don't have it, so use integration's org or user's first org
        // (Contacts page shows contacts by org; without this, new contacts would have org=null and not appear)
        let organizationId: string | undefined = (session.deviceInfo as any)?.integrationId
          ? (await storage.getIntegration((session.deviceInfo as any).integrationId, session.userId))?.organizationId ?? undefined
          : undefined;
        if (!organizationId) {
          const orgs = await storage.getOrganizationsByUser(session.userId);
          organizationId = orgs[0]?.id ?? undefined;
        }
        const orgIdForStorage = organizationId ?? '';

        const managedContacts = await storage.getManagedContactsByUser(session.userId, orgIdForStorage);
        
        // Normalize phone number for managed contacts (remove + and @c.us, keep only digits)
        const phoneForManaged = normalizedSenderNumber.replace(/[^\d]/g, '');
        
        // Check if managed contact already exists with this phone number
        const existingManagedContact = managedContacts.find(mc => {
          const mcPhone = mc.phoneNumber.replace(/[^\d]/g, ''); // Remove all non-digits
          return mcPhone === phoneForManaged;
        });
        
        if (!existingManagedContact) {
          // Create new managed contact with source "whatsapp"
          // Use contact name if available, otherwise use phone number
          const contactDisplayName = contactName && contactName !== senderNumber ? contactName : phoneForManaged;
          
          await storage.createManagedContact({
            userId: session.userId,
            organizationId: organizationId || undefined,
            name: contactDisplayName,
            phoneNumber: phoneForManaged,
            source: 'whatsapp',
          });
          console.log('[Business API] ✅ Created managed contact with source "whatsapp":', {
            name: contactDisplayName,
            phoneNumber: phoneForManaged,
            userId: session.userId,
          });
        } else if (existingManagedContact.source !== 'whatsapp') {
          // Update existing managed contact to set source as "whatsapp" if it's not already set
          await storage.updateManagedContact(
            existingManagedContact.id,
            session.userId,
            orgIdForStorage,
            { source: 'whatsapp' }
          );
          console.log('[Business API] ✅ Updated managed contact source to "whatsapp":', {
            contactId: existingManagedContact.id,
            phoneNumber: phoneForManaged,
          });
        }
      } catch (managedContactError: any) {
        // Log error but don't fail message storage if managed contact creation fails
        console.warn('[Business API] ⚠️  Could not create/update managed contact:', managedContactError.message);
        console.warn('[Business API] Error details:', {
          error: managedContactError.message,
          stack: managedContactError.stack,
          userId: session.userId,
          phoneNumber: normalizedSenderNumber,
        });
      }

      // Find or create chat (normalize for comparison)
      const chats = await storage.getChatsBySession(sessionId);
      let chat = chats.find(c => {
        const normalizedChat = normalizePhoneNumber(c.contactNumber);
        return normalizedChat === normalizedSenderNumber;
      });
      
      // Prepare lastMessage text for chat preview
      let lastMessageText = messageBody.substring(0, 100);
      if (!lastMessageText && ['image', 'video', 'audio', 'document', 'sticker'].includes(message.type)) {
        // For media messages without captions, show media type in chat preview
        const mediaTypeLabels: Record<string, string> = {
          'image': '📷 Image',
          'video': '🎥 Video',
          'audio': '🎵 Audio',
          'document': '📄 Document',
          'sticker': '😀 Sticker',
        };
        lastMessageText = mediaTypeLabels[message.type] || '📎 Media';
      }
      
      if (!chat) {
        chat = await storage.createChat({
          sessionId,
          contactId: contact.id,
          contactName: contactName,
          contactNumber: senderNumber,
          lastMessage: lastMessageText,
          lastMessageTime: new Date(parseInt(message.timestamp) * 1000),
          unreadCount: isSentByBusiness ? 0 : 1,
          isGroup: false,
        });
      } else {
        await storage.updateChat(chat.id, {
          lastMessage: lastMessageText,
          lastMessageTime: new Date(parseInt(message.timestamp) * 1000),
          unreadCount: isSentByBusiness ? (chat.unreadCount || 0) : (chat.unreadCount || 0) + 1,
        });
      }

      // Check if message already exists (by WhatsApp message ID)
      const existingMessages = await storage.getMessagesByChat(chat.id);
      const messageExists = existingMessages.some(m => m.whatsappMessageId === message.id);
      
      if (messageExists) {
        console.log('[Business API] Message already exists, skipping:', message.id);
        return null;
      }

      // Resolve reply/quote context when user sends a reply from their device (context.message_id)
      let replyToMessageId: string | null = null;
      let quotedBody: string | null = null;
      let quotedFromMe: boolean | null = null;
      const replyToWamid = message.context?.message_id ?? message.context?.id;
      if (replyToWamid && session?.userId) {
        let refMsg = await storage.getMessageByIdOrWhatsAppId(replyToWamid, session.userId, sessionId);
        if (!refMsg && replyToWamid.startsWith('wamid.')) {
          refMsg = await storage.getMessageByIdOrWhatsAppId(replyToWamid.slice(6), session.userId, sessionId);
        }
        if (!refMsg && !replyToWamid.startsWith('wamid.')) {
          refMsg = await storage.getMessageByIdOrWhatsAppId('wamid.' + replyToWamid, session.userId, sessionId);
        }
        if (refMsg) {
          replyToMessageId = refMsg.id;
          quotedBody = (refMsg.body && String(refMsg.body).trim()) ? String(refMsg.body).substring(0, 500) : '[Message]';
          quotedFromMe = refMsg.fromMe ?? false;
        }
      }

      // Store message in database
      console.log('[Business API] Storing message in database:', {
        sessionId,
        chatId: chat.id,
        body: messageBody,
        from: senderNumber,
        whatsappMessageId: message.id,
        contactName,
        hasReplyContext: !!replyToMessageId,
      });
      
      const storedMessage = await storage.createMessage({
        sessionId,
        chatId: chat.id,
        body: messageBody,
        fromMe: isSentByBusiness,
        type: messageType,
        timestamp: new Date(parseInt(message.timestamp) * 1000),
        status: isSentByBusiness ? 'sent' : 'delivered',
        senderName: contactName,
        senderNumber: senderNumber,
        whatsappMessageId: message.id,
        mediaUrl: mediaUrl || undefined,
        footer: templateData.footer,
        footerButtonType: templateData.footerButtonType,
        footerButtonText: templateData.footerButtonText,
        footerButtonUrl: templateData.footerButtonUrl,
        footerButtonPhone: templateData.footerButtonPhone,
        replyToMessageId: replyToMessageId ?? undefined,
        quotedBody: quotedBody ?? undefined,
        quotedFromMe: quotedFromMe ?? undefined,
      });

      console.log('[Business API] ✅ Message stored in database:', {
        messageId: storedMessage.id,
        whatsappMessageId: message.id,
        from: senderNumber,
        chatId: chat.id,
        contactId: contact.id,
        sessionUserId: session.userId,
        sessionOrganizationId: session.organizationId,
      });

      // Human takeover: stop chatbot when message was sent by business (human/agent)
      if (isSentByBusiness) {
        clearChatbotConversationForContact(sessionId, senderNumber);
      }

      // Note: Broadcasting is handled via WebSocket in routes.ts when callback is used
      console.log('[Business API] Message stored successfully. Frontend will receive update on next refresh or via WebSocket.');

      // Process chatbots for incoming messages only (skip for sent-from-app)
      const hasInteractiveData = message.interactive && (message.interactive.type === 'button_reply' || message.interactive.type === 'list_reply');
      
      if (!isSentByBusiness && (messageBody || hasInteractiveData)) {
        try {
          // Extract interactive data if available
          const interactiveData = message.interactive ? {
            type: message.interactive.type,
            buttonReply: message.interactive.button_reply,
            listReply: message.interactive.list_reply,
            isTemplateButton: message.type === 'button', // Template Quick Reply sends type 'button'
          } : (message.type === 'button' ? {
            type: 'button_reply' as const,
            buttonReply: { title: (message as any).button?.text || 'Button clicked' },
            isTemplateButton: true,
          } : undefined);
          
          // For interactive messages, use the button/list title as the message body
          let chatbotMessageBody = messageBody;
          if (hasInteractiveData && !messageBody) {
            if (message.interactive.type === 'button_reply' && message.interactive.button_reply) {
              chatbotMessageBody = message.interactive.button_reply.title || '';
            } else if (message.interactive.type === 'list_reply' && message.interactive.list_reply) {
              chatbotMessageBody = message.interactive.list_reply.title || '';
            }
          }
          
          console.log('[Business API] Processing message for chatbots:', {
            messageBody: chatbotMessageBody,
            hasInteractiveData,
            interactiveType: interactiveData?.type,
          });
          
          await processMessageForChatbots(
            sessionId,
            senderNumber,
            chatbotMessageBody || '',
            session.userId,
            session.organizationId || undefined,
            interactiveData
          );
        } catch (chatbotError: any) {
          // Log but don't fail message processing if chatbot execution fails
          console.error('[Business API] Error processing chatbots:', chatbotError);
        }
      }

      return storedMessage;
    } catch (error: any) {
      console.error('[Business API] Error storing message directly:', error);
      console.error('[Business API] Error details:', {
        message: error.message,
        stack: error.stack,
        sessionId,
        messageId: message.id,
      });
      return null;
    }
  }

  /**
   * Create a WhatsApp Flow in Meta's API
   * @param businessAccountId - WhatsApp Business Account ID (WABA-ID)
   * @param flowName - Name of the flow
   * @param flowJSON - Flow JSON in WhatsApp Flow format (from convertToWhatsAppFlowFormat)
   * @param accessToken - Access token for the business account
   * @param publish - If true, flow is created and published in one request (default false = DRAFT)
   * @returns Meta flow ID
   */
  async createFlow(
    businessAccountId: string,
    flowName: string,
    flowJSON: any,
    accessToken: string,
    publish: boolean = false
  ): Promise<string> {
    const url = `${this.baseUrl}/${this.apiVersion}/${businessAccountId}/flows`;
    const requestBody: Record<string, unknown> = {
      name: flowName,
      categories: ['OTHER'],
      flow_json: typeof flowJSON === 'string' ? flowJSON : JSON.stringify(flowJSON),
    };
    if (publish) {
      requestBody.publish = true;
    }

    console.log(`[Business API] Creating flow on Meta: ${flowName}, publish=${publish}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    if (!response.ok) {
      let errMsg = responseText;
      try {
        const err = JSON.parse(responseText);
        const errObj = err.error || err;
        const parts = [
          errObj.error_user_msg || errObj.message || errMsg,
          errObj.code != null && `(code: ${errObj.code})`,
          Array.isArray(errObj.validation_errors) && errObj.validation_errors.length > 0
            ? `Validation: ${JSON.stringify(errObj.validation_errors)}`
            : '',
        ].filter(Boolean);
        errMsg = parts.join(' ');
      } catch {
        // use raw text
      }
      throw new Error(`Meta Flows API: ${errMsg}`);
    }

    const result = JSON.parse(responseText);
    const validationErrors = result.validation_errors;
    if (Array.isArray(validationErrors) && validationErrors.length > 0) {
      const messages = validationErrors.map((e: any) =>
        e.message || e.error || JSON.stringify(e)
      ).join('; ');
      throw new Error(
        `Flow JSON validation failed. Fix the following before publishing: ${messages}`
      );
    }
    const metaFlowId = result.id;
    if (!metaFlowId) {
      throw new Error('Flow created but no ID returned from Meta API');
    }
    console.log(`[Business API] Flow created on Meta with ID: ${metaFlowId}`);
    return metaFlowId;
  }

  /**
   * Update a flow's JSON on Meta (for DRAFT flows). Must be called before publishing if flow was edited.
   */
  async updateFlowAssets(
    metaFlowId: string,
    flowJSON: object,
    accessToken: string
  ): Promise<void> {
    const url = `${this.baseUrl}/${this.apiVersion}/${metaFlowId}/assets`;
    const formData = new FormData();
    const blob = new Blob([JSON.stringify(flowJSON)], { type: 'application/json' });
    formData.append('file', blob, 'flow.json');
    formData.append('name', 'flow.json');
    formData.append('asset_type', 'FLOW_JSON');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: formData,
    });
    const responseText = await response.text();
    if (!response.ok) {
      let errMsg = responseText;
      try {
        const err = JSON.parse(responseText);
        const errObj = err.error || err;
        const parts = [
          errObj.error_user_msg || errObj.message || errMsg,
          errObj.code != null && `(code: ${errObj.code})`,
          Array.isArray(errObj.validation_errors) && errObj.validation_errors.length > 0
            ? `Validation: ${JSON.stringify(errObj.validation_errors)}`
            : '',
        ].filter(Boolean);
        errMsg = parts.join(' ');
      } catch {
        // ignore
      }
      throw new Error(`Meta Flows API (update assets): ${errMsg}`);
    }
    // Meta can return success: true but still include validation_errors; publishing then fails with 139002
    try {
      const body = JSON.parse(responseText);
      const validationErrors = body.validation_errors;
      if (Array.isArray(validationErrors) && validationErrors.length > 0) {
        const messages = validationErrors.map((e: any) =>
          e.message || e.error || JSON.stringify(e)
        ).join('; ');
        throw new Error(
          `Flow JSON validation failed. Fix the following before publishing: ${messages}`
        );
      }
    } catch (e: any) {
      if (e.message && e.message.startsWith('Flow JSON validation failed')) throw e;
      // ignore parse errors for non-JSON or other response shapes
    }
    console.log(`[Business API] Flow assets updated on Meta for flow: ${metaFlowId}`);
  }

  /**
   * Publish an existing DRAFT flow on Meta (POST /{flow-id}/publish).
   */
  async publishFlow(metaFlowId: string, accessToken: string): Promise<void> {
    const url = `${this.baseUrl}/${this.apiVersion}/${metaFlowId}/publish`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    const responseText = await response.text();
    if (!response.ok) {
      let errMsg = responseText;
      try {
        const err = JSON.parse(responseText);
        const errObj = err.error || err;
        const parts = [
          errObj.error_user_msg || errObj.message || errMsg,
          errObj.code != null && `(code: ${errObj.code})`,
          errObj.error_subcode != null && `(subcode: ${errObj.error_subcode})`,
          Array.isArray(errObj.validation_errors) && errObj.validation_errors.length > 0
            ? `Validation: ${JSON.stringify(errObj.validation_errors)}`
            : '',
        ].filter(Boolean);
        errMsg = parts.join(' ');
      } catch {
        // ignore
      }
      throw new Error(`Meta Flows API (publish): ${errMsg}`);
    }
    console.log(`[Business API] Flow published on Meta: ${metaFlowId}`);
  }

  async processMessageStatus(status: any, metadata: any): Promise<{ messageId: string; userId: string; status: string } | { results: Array<{ messageId: string; userId: string; status: string }> } | null> {
    try {
      const whatsappMessageId = status.id;
      const statusValue = status.status; // 'sent', 'delivered', 'read', 'failed'
      
      console.log('[Business API] Processing message status update:', {
        whatsappMessageId,
        status: statusValue,
        timestamp: status.timestamp,
        phoneNumberId: metadata.phone_number_id,
      });

      const sessionIds = await this.findSessionsByPhoneNumberId(
        metadata.phone_number_id,
        metadata.display_phone_number
      );
      if (sessionIds.length === 0) {
        console.warn('[Business API] Could not find session for phone number ID:', metadata.phone_number_id);
        return null;
      }

      // Map WhatsApp status to our status enum
      let messageStatus: 'sent' | 'delivered' | 'read' | 'failed' = 'sent';
      if (statusValue === 'delivered') messageStatus = 'delivered';
      else if (statusValue === 'read' || statusValue === 'seen') messageStatus = 'read';
      else if (statusValue === 'failed') messageStatus = 'failed';

      if (statusValue === 'failed') {
        console.error('[Business API] Message delivery failed:', {
          whatsappMessageId,
          errorCode: status.errors?.[0]?.code,
          errorTitle: status.errors?.[0]?.title,
          recipient: status.recipient_id,
        });
      }

      const errorMessage = statusValue === 'failed' ? (status.errors?.[0]?.message || status.errors?.[0]?.title || 'Message delivery failed') : undefined;
      const errorCode = statusValue === 'failed' ? status.errors?.[0]?.code?.toString() : undefined;
      const results: Array<{ messageId: string; userId: string; status: string }> = [];

      for (const sessionId of sessionIds) {
        const session = await storage.getSession(sessionId);
        if (!session) continue;

        const messageMapping = this.messageIdMap.get(whatsappMessageId);
        let messageToUpdate: any = null;
        
        if (messageMapping && messageMapping.sessionId === sessionId) {
          const chats = await storage.getChatsBySession(sessionId);
          for (const chat of chats) {
            const messages = await storage.getMessagesByChat(chat.id);
            messageToUpdate = messages.find((m: any) => m.id === messageMapping.messageId);
            if (messageToUpdate) break;
          }
        }
        if (!messageToUpdate) {
          const chats = await storage.getChatsBySession(sessionId);
          for (const chat of chats) {
            const messages = await storage.getMessagesByChat(chat.id);
            messageToUpdate = messages.find((m: any) => m.whatsappMessageId === whatsappMessageId);
            if (messageToUpdate) break;
          }
        }
        if (!messageToUpdate) {
          const chats = await storage.getChatsBySession(sessionId);
          for (const chat of chats) {
            const messages = await storage.getMessagesByChat(chat.id);
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const recentMessages = messages
              .filter((m: any) => m.fromMe && new Date(m.timestamp) > tenMinutesAgo)
              .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            if (recentMessages.length > 0) {
              messageToUpdate = recentMessages[0];
              break;
            }
          }
        }

        if (messageToUpdate) {
          const updatedMessage = await storage.updateMessageStatus(messageToUpdate.id, messageStatus, errorMessage, errorCode);
          if (updatedMessage) {
            await storage.updateCampaignRecipientStatusByWhatsAppMessageId(whatsappMessageId, messageStatus, errorMessage);
            const { triggerWebhooks } = await import('../webhooks/delivery');
            await triggerWebhooks(session.userId, 'message.status_updated', {
              messageId: updatedMessage.id,
              whatsappMessageId,
              status: messageStatus,
              message: updatedMessage,
              errorMessage,
              errorCode,
            });
            results.push({ messageId: updatedMessage.id, userId: session.userId, status: messageStatus });
          }
        }
      }

      if (results.length === 0) {
        console.warn('[Business API] Could not find message to update for WhatsApp message ID:', whatsappMessageId);
        return null;
      }
      return results.length === 1 ? results[0] : { results };
    } catch (error) {
      console.error('[Business API] Error processing message status:', error);
      return null;
    }
  }

  /**
   * Query message status directly from WhatsApp API
   * Note: WhatsApp doesn't provide a direct API to query message status.
   * Status updates are only available via webhooks.
   * This method can be used to verify if a message ID is valid.
   */
  async verifyMessageId(sessionId: string, whatsappMessageId: string): Promise<{ valid: boolean; error?: string }> {
    const creds = this.credentials.get(sessionId);
    if (!creds) {
      throw new Error('Session not found');
    }

    // WhatsApp doesn't have a direct status query endpoint
    // We can only verify the message ID format and check if it exists in our mapping
    const messageMapping = this.messageIdMap.get(whatsappMessageId);
    
    if (messageMapping) {
      return { valid: true };
    }

    // Check if message exists in database
    const session = await storage.getSession(sessionId);
    if (!session) {
      return { valid: false, error: 'Session not found' };
    }

    const chats = await storage.getChatsBySession(sessionId);
    for (const chat of chats) {
      const messages = await storage.getMessagesByChat(chat.id);
      const message = messages.find(m => m.whatsappMessageId === whatsappMessageId);
      if (message) {
        return { valid: true };
      }
    }

    return { valid: false, error: 'Message ID not found in local database. Status updates come via webhook.' };
  }

  /**
   * Normalize phone for comparison (E.164 digits only).
   */
  private normalizePhoneForMatch(p: string | undefined): string {
    return (p || '').replace(/\D/g, '');
  }

  /**
   * Find ALL sessions that have this phone number ID.
   * Used when the same phone number is connected to multiple accounts - webhook must save to all.
   * Uses String() for type-safe comparison (webhook may send string, DB may store number).
   * Optional displayPhoneNumber: fallback when phone_number_id doesn't match (coexistence edge cases).
   */
  private async findSessionsByPhoneNumberId(phoneNumberId: string, displayPhoneNumber?: string): Promise<string[]> {
    const sessionIds: string[] = [];
    const seen = new Set<string>();
    const phoneIdStr = String(phoneNumberId);
    void displayPhoneNumber;

    // First, check in-memory credentials (fastest) - use String() for type safety
    for (const [sessionId, creds] of this.credentials.entries()) {
      if (String(creds.phoneNumberId) === phoneIdStr && !seen.has(sessionId)) {
        sessionIds.push(sessionId);
        seen.add(sessionId);
      }
    }

    // Also search database for sessions with matching apiPhoneNumberId (may have more than in memory)
    try {
      const matchingSessions = (await storage.getOfficialSessionsForWebhook(phoneNumberId, displayPhoneNumber))
        .filter((s) => !(s as any).deletedAt);

      for (const s of matchingSessions) {
        if (!seen.has(s.sessionId)) {
          sessionIds.push(s.sessionId);
          seen.add(s.sessionId);
          // Restore credentials to memory for future lookups
          try {
            const integration = await storage.getIntegrationByName("whatsapp-business", s.userId, s.organizationId || undefined);
            if (integration?.status === "connected" && integration.credentials) {
              const credentials = integration.credentials as any;
              await this.restoreSession(s.sessionId, {
                phoneNumberId: phoneNumberId,
                accessToken: credentials.access_token,
                businessAccountId: credentials.business_account_id || credentials.businessAccountId,
              });
            }
          } catch {
            // ignore restore errors
          }
        }
      }

      if (sessionIds.length > 0) {
        console.log(`[Business API] Found ${sessionIds.length} session(s) for phone number ID: ${phoneNumberId}`, sessionIds);
      }
    } catch (error: any) {
      console.error(`[Business API] Error searching database for sessions:`, error);
    }

    return sessionIds;
  }

  /** @deprecated Use findSessionsByPhoneNumberId - returns first match for backward compatibility */
  private async findSessionByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
    const sessions = await this.findSessionsByPhoneNumberId(phoneNumberId);
    return sessions[0] ?? null;
  }

  private async verifyCredentials(credentials: BusinessAPICredentials): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/${credentials.phoneNumberId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async getPhoneNumberInfo(credentials: BusinessAPICredentials): Promise<any> {
    const url = `${this.baseUrl}/${this.apiVersion}/${credentials.phoneNumberId}?fields=id,display_phone_number,verified_name,whatsapp_business_account{id}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
      },
    });

    if (!response.ok) {
      return {
        display_phone_number: credentials.phoneNumberId,
        verified_name: 'Business Account',
      };
    }

    return await response.json();
  }

  // Public method to upload media and get media ID (for template headers)
  async uploadMediaForTemplate(
    sessionId: string,
    media: Buffer,
    fileName: string,
    type: 'IMAGE' | 'VIDEO' | 'DOCUMENT' = 'IMAGE'
  ): Promise<{ id: string; url?: string }> {
    console.log(`[Upload Media for Template] PUBLIC METHOD CALLED with sessionId: ${sessionId}, fileName: ${fileName}`);
    let creds = this.credentials.get(sessionId);
    console.log(`[Upload Media for Template] Retrieved credentials from memory:`, {
      hasCreds: !!creds,
      hasAccessToken: !!creds?.accessToken,
      hasPhoneNumberId: !!creds?.phoneNumberId,
      sessionId,
      allSessionIds: Array.from(this.credentials.keys()),
      credsType: typeof creds,
      credsKeys: creds ? Object.keys(creds) : [],
      credsValue: creds ? JSON.stringify({ 
        phoneNumberId: creds.phoneNumberId?.substring(0, 10) + '...',
        accessToken: creds.accessToken?.substring(0, 20) + '...',
        hasBusinessAccountId: !!creds.businessAccountId,
      }) : 'null',
    });
    
    if (!creds || !creds.accessToken || !creds.phoneNumberId) {
      console.warn(`[Upload Media for Template] Credentials not in memory for session ${sessionId}, attempting to restore...`);
      // Try to restore credentials - this should have been done by the caller, but try again
      try {
        const session = await storage.getSession(sessionId);
        if (session) {
          // Prefer integration by session's integrationId (multiple Meta/WhatsApp accounts)
          let integration = null;
          if (session.deviceInfo?.integrationId) {
            integration = await storage.getIntegration(session.deviceInfo.integrationId, session.userId);
          }
          if (!integration) {
            integration = await storage.getIntegrationByName("whatsapp-business", session.userId, session.organizationId || undefined);
          }
          if (integration?.status === "connected" && integration.credentials) {
            const credentials = integration.credentials as any;
            const accessToken = credentials.access_token || credentials.accessToken;
            const phoneNumberId = session.deviceInfo?.apiPhoneNumberId || session.deviceInfo?.phoneNumberId;
            
            if (!accessToken || !phoneNumberId) {
              console.error(`[Upload Media for Template] Missing credentials from integration:`, {
                hasAccessToken: !!accessToken,
                hasPhoneNumberId: !!phoneNumberId,
                sessionId,
              });
              throw new Error('Integration credentials are incomplete');
            }
            
            await this.restoreSession(sessionId, {
              phoneNumberId: phoneNumberId,
              accessToken: accessToken,
              businessAccountId: session.deviceInfo?.businessAccountId || credentials.business_account_id,
            });
            creds = this.credentials.get(sessionId);
            console.log(`[Upload Media for Template] Credentials restored, re-checking:`, {
              hasCreds: !!creds,
              hasAccessToken: !!creds?.accessToken,
              hasPhoneNumberId: !!creds?.phoneNumberId,
            });
          }
        }
      } catch (restoreError: any) {
        console.error(`[Upload Media for Template] Failed to restore credentials:`, restoreError);
      }
    }
    
    if (!creds) {
      throw new Error('Session not found or credentials not available');
    }
    
    if (!creds.accessToken || !creds.phoneNumberId) {
      console.error(`[Upload Media for Template] Invalid credentials:`, {
        hasAccessToken: !!creds.accessToken,
        hasPhoneNumberId: !!creds.phoneNumberId,
        sessionId,
        credsKeys: Object.keys(creds || {}),
      });
      throw new Error('Invalid credentials: accessToken or phoneNumberId is missing');
    }
    
    // Final validation before calling uploadMedia
    if (!creds.accessToken || !creds.phoneNumberId) {
      console.error(`[Upload Media for Template] CRITICAL: Credentials became invalid before uploadMedia call!`, {
        hasAccessToken: !!creds.accessToken,
        hasPhoneNumberId: !!creds.phoneNumberId,
        sessionId,
        credsKeys: Object.keys(creds),
      });
      throw new Error('Invalid credentials: accessToken or phoneNumberId is missing');
    }
    
    console.log(`[Upload Media for Template] Calling uploadMedia with valid credentials:`, {
      hasAccessToken: !!creds.accessToken,
      hasPhoneNumberId: !!creds.phoneNumberId,
      phoneNumberId: creds.phoneNumberId?.substring(0, 10) + '...',
    });
    
    // Make a copy of credentials to prevent any mutation issues
    const credsCopy: BusinessAPICredentials = {
      phoneNumberId: String(creds.phoneNumberId),
      accessToken: String(creds.accessToken),
      businessAccountId: creds.businessAccountId ? String(creds.businessAccountId) : undefined,
    };
    
    console.log(`[Upload Media for Template] Calling uploadMedia with credsCopy:`, {
      hasAccessToken: !!credsCopy.accessToken,
      hasPhoneNumberId: !!credsCopy.phoneNumberId,
      phoneNumberId: credsCopy.phoneNumberId?.substring(0, 10) + '...',
      accessToken: credsCopy.accessToken?.substring(0, 20) + '...',
    });
    
    // IMPORTANT: Explicitly pass useBusinessAccount: false to prevent calling private uploadMediaForTemplate
    // The /uploads endpoint is only for template creation, not for sending template messages
    // We want to use the regular /media endpoint which returns a media ID suitable for sending
    const useBusinessAccountParam = false;
    console.log(`[Upload Media for Template] Calling uploadMedia with useBusinessAccount=${useBusinessAccountParam}`);
    const mediaId = await this.uploadMedia(credsCopy, media, fileName, type, useBusinessAccountParam);
    console.log(`[Upload Media for Template] uploadMedia returned mediaId: ${mediaId}`);
    return { id: mediaId };
  }

  async uploadMediaWithCredentials(
    credentials: BusinessAPICredentials,
    media: Buffer,
    fileName: string,
    type?: 'IMAGE' | 'VIDEO' | 'DOCUMENT',
    useBusinessAccount?: boolean,
    mimeType?: string
  ): Promise<{ id: string; url?: string }> {
    const mediaId = await this.uploadMedia(credentials, media, fileName, type, useBusinessAccount, mimeType);
    return { id: mediaId };
  }

  private async uploadMedia(
    credentials: BusinessAPICredentials,
    media: Buffer,
    fileName: string,
    type?: 'IMAGE' | 'VIDEO' | 'DOCUMENT',
    useBusinessAccount?: boolean,
    mimeType?: string
  ): Promise<string> {
    // Validate credentials at the start
    if (!credentials || !credentials.accessToken || !credentials.phoneNumberId) {
      console.error(`[Upload Media] Invalid credentials received:`, {
        hasCredentials: !!credentials,
        hasAccessToken: !!credentials?.accessToken,
        hasPhoneNumberId: !!credentials?.phoneNumberId,
        useBusinessAccount,
      });
      throw new Error('Invalid credentials: accessToken and phoneNumberId are required');
    }
    
    console.log(`[Upload Media] Starting upload with credentials:`, {
      hasAccessToken: !!credentials.accessToken,
      hasPhoneNumberId: !!credentials.phoneNumberId,
      phoneNumberId: credentials.phoneNumberId?.substring(0, 10) + '...',
      useBusinessAccount,
    });
    
    // Always use the phone number endpoint for media uploads
    // Meta's documentation shows that media uploads should use /{phone-number-id}/media
    // even for templates. The /uploads endpoint is not available for all business accounts.
    // Use form-data package so getHeaders() sets Content-Type with boundary - required for Meta to receive all fields.
    const formDataModule = await import('form-data');
    const FormDataPkg = (formDataModule as any).default ?? formDataModule;
    const formData = new FormDataPkg();
    const url = `${this.baseUrl}/${this.apiVersion}/${credentials.phoneNumberId}/media`;
    const resolvedMime = this.resolveMimeType(media, fileName, mimeType);
    const baseMime = resolvedMime.split(';')[0].trim().toLowerCase();
    let effectiveMime = resolvedMime;
    if (baseMime.startsWith('audio/')) {
      effectiveMime = this.normalizeAudioMimeForWhatsAppUpload(resolvedMime, fileName);
    }
    // Ensure filename has correct extension for Meta (some clients send "image" or "blob" without extension)
    const ext = this.getExtensionForMime(effectiveMime);
    let safeFileName = ext && !fileName.toLowerCase().endsWith(ext) ? `${fileName.replace(/\.[^.]+$/, '')}${ext}` : fileName;
    safeFileName = this.sanitizeMediaUploadFileName(safeFileName);

    formData.append('messaging_product', 'whatsapp');
    formData.append('type', effectiveMime);
    formData.append('file', media, { filename: safeFileName, contentType: effectiveMime } as any);

    // For template media uploads, we need to get the asset handle (h field)
    if (useBusinessAccount) {
      console.log(`[Upload Media] Uploading for template - will check for asset handle (h) in response`);
    }

    console.log(`[Upload Media] Uploading to ${url}, fileName: ${fileName}, size: ${media.length} bytes, MIME type: ${effectiveMime}${useBusinessAccount ? ' (for template)' : ''}`);

    // Node's fetch can fail to send form-data stream correctly; pipe stream into buffer so Meta receives all parts (file + fields).
    const bodyBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const collector = new Writable({
        write(chunk: Buffer, _enc, cb) {
          chunks.push(chunk);
          cb();
        },
      });
      collector.on('finish', () => resolve(Buffer.concat(chunks)));
      collector.on('error', reject);
      formData.on('error', reject);
      formData.pipe(collector);
    });
    const headers = {
      ...formData.getHeaders(),
      'Authorization': `Bearer ${credentials.accessToken}`,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: bodyBuffer,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      console.error(`[Upload Media] Upload failed:`, JSON.stringify(error, null, 2));
      const details = error?.error?.error_data?.details;
      const userMsg = error?.error?.error_user_msg || error?.error?.message;
      if (typeof details === 'string' && /too large/i.test(details)) {
        throw new Error(
          `${details} WhatsApp Cloud API limits: images max 5MB, videos max 16MB (per file). For carousel templates each card’s header media must fit these limits.`
        );
      }
      if (typeof userMsg === 'string' && /too large/i.test(userMsg)) {
        throw new Error(
          `${userMsg} Images max 5MB, videos max 16MB per upload.`
        );
      }
      throw new Error(`Media upload failed: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log(`[Upload Media] Upload successful, full response:`, JSON.stringify(result, null, 2));
    
    // CRITICAL: For template media, Meta requires the 'h' field (asset handle), NOT the 'id' field
    // - 'id' field = media ID (numeric, like "1411117610692673") - used for sending messages
    // - 'h' field = asset handle (string token, like "2:NjI0MTQ4ODk5NTY1MzI2OjM1...") - used for templates
    // 
    // If 'h' is not in the upload response, we need to query the media to get it
    // Some API versions or configurations may require a follow-up call
    
    if (useBusinessAccount === true) {
      // Template media: Try /uploads endpoint first (returns 'h' field directly)
      // If that fails, fall back to /media endpoint
      // Note: /uploads endpoint may not be available for all accounts, so we gracefully fall back
      console.log(`[Upload Media] useBusinessAccount is TRUE, will try /uploads endpoint`);
      const metaAppId = process.env.FACEBOOK_APP_ID;
      if (metaAppId) {
        try {
          console.log(`[Upload Media] Template media detected, trying /uploads endpoint first...`);
          // Double-check credentials before calling private method
          if (!credentials || !credentials.accessToken || !credentials.phoneNumberId) {
            console.error(`[Upload Media] Credentials invalid before calling uploadMediaForTemplate:`, {
              hasCredentials: !!credentials,
              hasAccessToken: !!credentials?.accessToken,
              hasPhoneNumberId: !!credentials?.phoneNumberId,
            });
            throw new Error('Invalid credentials: accessToken and phoneNumberId are required');
          }
          return await this.uploadMediaForTemplateInternal(credentials, media, fileName, type, metaAppId);
        } catch (uploadError: any) {
          // If /uploads fails, continue to /media endpoint below
          console.warn(`[Upload Media] /uploads endpoint failed: ${uploadError.message}, using /media endpoint...`);
        }
      } else {
        console.log(`[Upload Media] Template media detected, FACEBOOK_APP_ID not set, using /media endpoint directly...`);
      }
      
      // Fall back to /media endpoint - check if it returns 'h'
      if (result.h && typeof result.h === 'string') {
        const assetHandle = String(result.h).trim();
        console.log(`[Upload Media] Found asset handle (h) in /media response: "${assetHandle}"`);
        return assetHandle;
      }
      
      // 'h' not in /media response - query the media
      if (!result.id) {
        throw new Error(`Template media upload did not return media ID or asset handle. Response: ${JSON.stringify(result)}`);
      }
      
      const mediaId = String(result.id).trim();
      console.log(`[Upload Media] Querying media ${mediaId} to get asset handle...`);
      
      try {
        const mediaUrl = `${this.baseUrl}/${this.apiVersion}/${mediaId}?fields=id,h,url,mime_type,sha256,file_size`;
        const mediaResponse = await fetch(mediaUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
          },
        });
        
        if (mediaResponse.ok) {
          const mediaDetails = await mediaResponse.json();
          console.log(`[Upload Media] Media details response:`, JSON.stringify(mediaDetails, null, 2));
          
          if (mediaDetails.h && typeof mediaDetails.h === 'string') {
            const assetHandle = String(mediaDetails.h).trim();
            console.log(`[Upload Media] Found asset handle (h) in media details: "${assetHandle}"`);
            return assetHandle;
          }
        }
        
        // Last resort: use media ID as asset handle (some configurations may accept this)
        console.warn(`[Upload Media] Could not get asset handle (h), using media ID as fallback: ${mediaId}`);
        return mediaId;
      } catch (queryError: any) {
        // If query fails, use media ID as fallback
        console.warn(`[Upload Media] Failed to query media for asset handle: ${queryError.message}, using media ID as fallback: ${mediaId}`);
        return mediaId;
      }
    } else {
      // Regular media: use media ID (id field)
      if (!result.id) {
        console.error(`[Upload Media] No media ID in response:`, JSON.stringify(result, null, 2));
        throw new Error(`Media upload succeeded but no media ID returned. Response: ${JSON.stringify(result)}`);
      }
      const mediaId = String(result.id).trim();
      console.log(`[Upload Media] Using media ID (id) for regular media: "${mediaId}"`);
      return mediaId;
    }
  }

  /**
   * Upload media for template use using Meta's /uploads endpoint
   * This is a two-step process that returns an asset handle for template use
   * Based on reference implementation, this endpoint returns the 'h' field directly
   * Internal helper method - use the public uploadMediaForTemplate() method instead
   */
  private async uploadMediaForTemplateInternal(
    credentials: BusinessAPICredentials,
    media: Buffer,
    fileName: string,
    type?: 'IMAGE' | 'VIDEO' | 'DOCUMENT',
    appId?: string // Meta App ID (FACEBOOK_APP_ID) - required for /uploads endpoint
  ): Promise<string> {
    console.error(`[Upload Media for Template] PRIVATE METHOD CALLED - This should NOT be called for regular media uploads!`, {
      hasAccessToken: !!credentials.accessToken,
      hasPhoneNumberId: !!credentials.phoneNumberId,
      fileName,
      type,
      appId,
      stackTrace: new Error().stack,
    });
    
    // Validate credentials first
    if (!credentials.accessToken || !credentials.phoneNumberId) {
      console.error(`[Upload Media for Template] Invalid credentials provided:`, {
        hasAccessToken: !!credentials.accessToken,
        hasPhoneNumberId: !!credentials.phoneNumberId,
        credentialsType: typeof credentials,
        credentialsKeys: credentials ? Object.keys(credentials) : [],
      });
      throw new Error('Invalid credentials: accessToken and phoneNumberId are required for media upload');
    }
    
    // According to Meta's documentation, /uploads endpoint requires Meta App ID, not Business Account ID
    const metaAppId = appId || process.env.FACEBOOK_APP_ID;
    if (!metaAppId) {
      // If no App ID provided, skip /uploads endpoint and use /media endpoint directly
      console.warn(`[Upload Media for Template] Meta App ID (FACEBOOK_APP_ID) not provided, skipping /uploads endpoint and using /media endpoint directly`);
      return await this.uploadMedia(credentials, media, fileName, type, true);
    }

    const mimeType = this.getMimeType(fileName);
    const fileLength = media.length;

    // Step 1: Start upload session - POST to /<APP_ID>/uploads
    // This endpoint requires Meta App ID (FACEBOOK_APP_ID), not Business Account ID
    // Format: POST /<APP_ID>/uploads
    const startUploadUrl = `${this.baseUrl}/${this.apiVersion}/${metaAppId}/uploads?file_name=${encodeURIComponent(fileName)}&file_length=${fileLength}&file_type=${encodeURIComponent(mimeType)}&access_token=${credentials.accessToken}`;
    
    console.log(`[Upload Media for Template] Step 1: Starting upload session: ${startUploadUrl}, fileName: ${fileName}, size: ${fileLength} bytes, MIME type: ${mimeType}`);

    try {
      const startResponse = await fetch(startUploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Empty body for starting session
      });

      if (!startResponse.ok) {
        const error = await startResponse.json().catch(() => ({ error: { message: 'Unknown error' } }));
        const errorCode = error.error?.code;
        
        // If error is 100 (object doesn't exist) or 33 (permissions), skip /uploads and use /media
        if (errorCode === 100 || error.error_subcode === 33) {
          console.warn(`[Upload Media for Template] /uploads endpoint not available (error ${errorCode}), using /media endpoint directly`);
          return await this.uploadMedia(credentials, media, fileName, type, true);
        }
        
        console.error(`[Upload Media for Template] Start upload session failed:`, JSON.stringify(error, null, 2));
        // For other errors, still try /media endpoint as fallback
        console.log(`[Upload Media for Template] /uploads endpoint failed, falling back to /media endpoint...`);
        return await this.uploadMedia(credentials, media, fileName, type, true);
      }

      const startResult = await startResponse.json();
      console.log(`[Upload Media for Template] Step 1: Upload session started, response:`, JSON.stringify(startResult, null, 2));

      // Extract upload session ID from response
      // Response format: { "id": "upload:<UPLOAD_SESSION_ID>" }
      if (!startResult.id || !startResult.id.startsWith('upload:')) {
        throw new Error(`Invalid upload session ID format. Expected "upload:...", got: ${startResult.id}`);
      }

      const uploadSessionId = startResult.id; // e.g., "upload:MTphdHRhY2htZW50..."
      console.log(`[Upload Media for Template] Step 2: Upload session ID: ${uploadSessionId}`);

      // Step 2: Upload file data to the session - POST to /upload:<UPLOAD_SESSION_ID>
      // This should return the asset handle (h field)
      const uploadFileUrl = `${this.baseUrl}/${this.apiVersion}/${uploadSessionId}`;
      console.log(`[Upload Media for Template] Step 2: Uploading file data to session: ${uploadFileUrl}`);

      const uploadFileResponse = await fetch(uploadFileUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'file_offset': '0', // Start from offset 0
          'Content-Type': 'application/octet-stream',
        },
        body: media, // Send the actual file data
      });

      if (!uploadFileResponse.ok) {
        const error = await uploadFileResponse.json().catch(() => ({ error: { message: 'Unknown error' } }));
        console.error(`[Upload Media for Template] Step 2: Upload file data failed:`, JSON.stringify(error, null, 2));
        // Fall back to /media endpoint
        console.log(`[Upload Media for Template] File upload failed, falling back to /media endpoint...`);
        return await this.uploadMedia(credentials, media, fileName, type, true);
      }

      const uploadFileResult = await uploadFileResponse.json();
      console.log(`[Upload Media for Template] Step 2: File upload successful, response:`, JSON.stringify(uploadFileResult, null, 2));

      // The upload should return 'h' field (asset handle)
      if (uploadFileResult.h && typeof uploadFileResult.h === 'string') {
        const assetHandle = String(uploadFileResult.h).trim();
        console.log(`[Upload Media for Template] ✅ Found asset handle (h): "${assetHandle}"`);
        return assetHandle;
      }

      // If 'h' is not in response, this is unexpected - fall back to /media endpoint
      console.warn(`[Upload Media for Template] ⚠️  No 'h' field in upload response, falling back to /media endpoint...`);
      return await this.uploadMedia(credentials, media, fileName, type, true);
    } catch (fetchError: any) {
      // Network or other errors - fall back to /media endpoint
      console.warn(`[Upload Media for Template] /uploads endpoint error: ${fetchError.message}, falling back to /media endpoint...`);
      return await this.uploadMedia(credentials, media, fileName, type, true);
    }
  }

  async getMediaUrl(credentials: BusinessAPICredentials, mediaId: string): Promise<string> {
    // WhatsApp Business API endpoint to get media URL
    const url = `${this.baseUrl}/${this.apiVersion}/${mediaId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get media URL: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[Get Media URL] Media ${mediaId} details:`, JSON.stringify(result, null, 2));
    
    // WhatsApp returns the media URL in the 'url' field
    if (!result.url) {
      throw new Error('Media URL not found in response');
    }
    return result.url;
  }
  
  // Check if media is ready for template use by querying its details
  async checkMediaReady(credentials: BusinessAPICredentials, mediaId: string): Promise<boolean> {
    try {
      const url = await this.getMediaUrl(credentials, mediaId);
      console.log(`[Check Media Ready] Media ${mediaId} is accessible at: ${url}`);
      return !!url;
    } catch (error: any) {
      console.warn(`[Check Media Ready] Media ${mediaId} check failed:`, error.message);
      return false;
    }
  }

  async getMediaForTemplate(sessionId: string, mediaId: string): Promise<{ url: string }> {
    const creds = this.credentials.get(sessionId);
    if (!creds) {
      throw new Error('Session not found');
    }
    const url = await this.getMediaUrl(creds, mediaId);
    return { url };
  }

  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters except + at the start
    let cleaned = phone.trim();
    
    // Remove + sign if present (WhatsApp Business API doesn't accept +)
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    
    // Remove all non-digit characters
    cleaned = cleaned.replace(/\D/g, '');
    
    // Remove leading zeros
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Ensure we have a valid phone number (at least 10 digits)
    if (cleaned.length < 10) {
      throw new Error(`Invalid phone number: ${phone}. Phone number must include country code.`);
    }
    
    return cleaned;
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'video/mp4',
      webm: 'video/webm',
      '3gp': 'video/3gpp',
      mp3: 'audio/mpeg',
      /** WhatsApp exports voice notes as `.mpeg` / `.mpg`; must not fall through to image/jpeg. */
      mpeg: 'audio/mpeg',
      mpg: 'audio/mpeg',
      m4a: 'audio/mp4',
      opus: 'audio/ogg',
      caf: 'audio/x-caf',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  /** Detect MIME type from file buffer magic bytes (for when client sends application/octet-stream) */
  private detectMimeTypeFromBuffer(buffer: Buffer): string {
    if (!buffer || buffer.length < 4) return 'application/octet-stream';
    const b0 = buffer[0], b1 = buffer[1], b2 = buffer[2], b3 = buffer[3];
    /** Ogg (Opus/Vorbis) — WhatsApp sometimes saves voice as `.mpeg` though bytes are Ogg. */
    if (b0 === 0x4f && b1 === 0x67 && b2 === 0x67 && b3 === 0x53) return 'audio/ogg';
    /** MPEG-1 Layer 3 / MP3 sync (common for `.mp3` / `.mpeg` voice exports). */
    if (b0 === 0xff && (b1 & 0xe0) === 0xe0) return 'audio/mpeg';
    if (b0 === 0x49 && b1 === 0x44 && b2 === 0x33) return 'audio/mpeg'; // "ID3"
    if (b0 === 0xFF && b1 === 0xD8) return 'image/jpeg';
    if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4E && b3 === 0x47) return 'image/png';
    if (b0 === 0x47 && b1 === 0x49 && b2 === 0x46) return 'image/gif';
    if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'image/webp';
    }
    if (buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
      if (buffer[8] === 0x69 && buffer[9] === 0x73 && buffer[10] === 0x6F && buffer[11] === 0x6D) return 'video/mp4';
    }
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
    return 'application/octet-stream';
  }

  /**
   * Meta's multipart upload is sensitive to long paths and odd characters. WhatsApp exports use
   * names like `WhatsApp Audio 2026-05-03 at 15.01.16-....mpeg` — spaces/symbols can break some stacks.
   */
  private sanitizeMediaUploadFileName(fileName: string): string {
    const slash = Math.max(fileName.lastIndexOf('/'), fileName.lastIndexOf('\\'));
    const base = slash >= 0 ? fileName.slice(slash + 1) : fileName;
    let s = base.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_');
    if (!s || s === '_') s = 'media.bin';
    return s.length > 200 ? s.slice(0, 200) : s;
  }

  private getExtensionForMime(mime: string): string {
    const base = mime.split(';')[0].trim().toLowerCase();
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/3gpp': '.3gp',
      'application/pdf': '.pdf',
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'audio/webm': '.webm',
      'audio/aac': '.aac',
      'audio/amr': '.amr',
    };
    return map[base] || '';
  }

  /**
   * Meta rejects some audio MIME labels on upload (e.g. audio/opus) and expects
   * `audio/ogg; codecs=opus` for Opus-in-Ogg. Voice notes (`voice: true`) must be OGG+Opus only —
   * do not set voice for MP3/M4A/etc. or Cloud API may reject or mis-deliver.
   */
  private normalizeAudioMimeForWhatsAppUpload(mime: string, fileName: string): string {
    const lower = mime.toLowerCase().trim();
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (lower === 'audio/opus' || lower.startsWith('audio/opus;')) {
      return 'audio/ogg; codecs=opus';
    }
    if (
      lower === 'audio/ogg' ||
      (lower.startsWith('audio/ogg') && !lower.includes('codecs='))
    ) {
      return 'audio/ogg; codecs=opus';
    }
    if (['ogg', 'oga', 'opus'].includes(ext) && /^audio\//.test(lower)) {
      return 'audio/ogg; codecs=opus';
    }
    return mime;
  }

  /** Only request voice-note UI when file is OGG Opus; MP3/M4A must use basic audio (omit voice). */
  private shouldMarkAudioAsVoiceNote(resolvedMime: string, fileName: string): boolean {
    const m = resolvedMime.toLowerCase();
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const isOggFamily = ['ogg', 'oga'].includes(ext);
    /** `.mpeg` is often WhatsApp voice export; after magic-byte sniff it may be OGG despite extension. */
    const mislabeledAsMpeg = ['mpeg', 'mpg'].includes(ext);
    const isOggOpusMime =
      m.includes('audio/ogg') && (m.includes('codecs=opus') || m.includes('opus'));
    return isOggOpusMime && (isOggFamily || mislabeledAsMpeg);
  }

  /** Resolve MIME type: prefer provided/from buffer, fallback to filename extension */
  private resolveMimeType(media: Buffer, fileName: string, providedMime?: string): string {
    const fromExt = this.getMimeType(fileName);
    const fromBuffer = this.detectMimeTypeFromBuffer(media);
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    /** `.mpeg`/`.mpg` from WhatsApp may be MP3 *or* OGG Opus — never trust extension/hint over magic bytes. */
    if (['mpeg', 'mpg'].includes(ext) && fromBuffer !== 'application/octet-stream') {
      return fromBuffer;
    }
    if (
      providedMime &&
      providedMime !== 'application/octet-stream' &&
      (/^image\/(jpeg|png|gif|webp)|video\/(mp4|3gpp|webm)|audio\//.test(providedMime) ||
        /^application\/pdf$/.test(providedMime))
    ) {
      return providedMime;
    }
    if (fromBuffer !== 'application/octet-stream') return fromBuffer;
    if (fromExt !== 'application/octet-stream') return fromExt;
    if (this.getMediaType(fileName) === 'audio') {
      const a = this.getMimeType(fileName);
      return a.startsWith('audio/') ? a : 'audio/ogg';
    }
    return 'image/jpeg'; // Safe default for images when type is unknown
  }

  private getMediaType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return 'image';
    if (['mp4', 'webm', '3gp'].includes(ext || '')) return 'video';
    if (['mp3', 'wav', 'ogg', 'aac', 'amr', 'mpeg', 'mpg', 'm4a', 'opus', 'caf', 'oga'].includes(ext || ''))
      return 'audio';
    
    return 'document';
  }

  /**
   * Fetch message templates from Meta WhatsApp Business API
   * Templates must be fetched from WABA ID; message_templates is not available on phone number node
   * @param credentials WhatsApp Business API credentials
   * @param wabaId WABA ID (WhatsApp Business Account ID) - required
   * @returns Array of message templates
   */
  async fetchMessageTemplates(credentials: BusinessAPICredentials, wabaId?: string): Promise<any[]> {
    if (!wabaId) {
      throw new Error("WABA ID is required to fetch message templates. Resolve WABA via me/whatsapp_business_accounts.");
    }
    const url = `${this.baseUrl}/${this.apiVersion}/${wabaId}/message_templates`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`Failed to fetch templates: ${error.error?.message || JSON.stringify(error)}`);
    }
    const result = await response.json();
    return result.data || [];
  }

  /**
   * Resolve the WhatsApp Business Account ID that owns this phone number for the given token.
   * Prefer this over stored session wabaId when they disagree (fixes stale/wrong DB values).
   */
  async resolveWabaIdFromPhoneNumber(
    accessToken: string,
    phoneNumberId: string
  ): Promise<string | null> {
    if (!accessToken?.trim() || !phoneNumberId?.trim() || phoneNumberId === 'unknown') {
      return null;
    }
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}?fields=whatsapp_business_account{id}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      const id = data?.whatsapp_business_account?.id;
      return typeof id === 'string' && id.length > 0 ? id : null;
    } catch {
      return null;
    }
  }

  async createMessageTemplate(
    credentials: BusinessAPICredentials,
    businessAccountId: string,
    templateData: {
      name: string;
      language: string;
      category: string;
      components: Array<any>;
    }
  ): Promise<any> {
    if (!businessAccountId) {
      throw new Error("Business Account ID is required to create message templates.");
    }

    let effectiveWabaId = businessAccountId;
    if (credentials.phoneNumberId && credentials.phoneNumberId !== 'unknown') {
      const resolved = await this.resolveWabaIdFromPhoneNumber(
        credentials.accessToken,
        credentials.phoneNumberId
      );
      if (resolved) {
        if (resolved !== businessAccountId) {
          console.warn(
            `[Create Template] Session WABA (${businessAccountId}) differs from Graph resolution for phone ${credentials.phoneNumberId} (${resolved}); using resolved WABA.`
          );
        }
        effectiveWabaId = resolved;
      }
    }
    
    // Check phone verification status and WABA access (optional - don't block if check fails)
    let phoneVerificationStatus: string | null = null;
    let wabaAccessible = false;
    
    // First, verify WABA ID is accessible
    try {
      const wabaInfoUrl = `${this.baseUrl}/${this.apiVersion}/${effectiveWabaId}?fields=id,name,message_template_namespace`;
      const wabaInfoResponse = await fetch(wabaInfoUrl, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });
      if (wabaInfoResponse.ok) {
        wabaAccessible = true;
        const wabaInfo = await wabaInfoResponse.json();
        console.log(`[Create Template] ✅ WABA ID ${effectiveWabaId} is accessible. Name: ${wabaInfo.name || 'N/A'}`);
      } else {
        const wabaError = await wabaInfoResponse.json().catch(() => ({}));
        console.warn(`[Create Template] ⚠️  WABA ID ${effectiveWabaId} may not be accessible:`, wabaError.error?.message || 'Unknown error');
      }
    } catch (wabaCheckError) {
      console.warn('[Create Template] Could not verify WABA access:', wabaCheckError);
      // Continue anyway - attempt template creation
    }
    
    // Check phone verification status (optional - don't block if check fails)
    if (credentials.phoneNumberId) {
      try {
        const phoneInfoUrl = `${this.baseUrl}/${this.apiVersion}/${credentials.phoneNumberId}?fields=code_verification_status,verified_name`;
        const phoneInfoResponse = await fetch(phoneInfoUrl, {
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
          },
        });
        if (phoneInfoResponse.ok) {
          const phoneInfo = await phoneInfoResponse.json();
          phoneVerificationStatus = phoneInfo.code_verification_status || null;
          if (phoneVerificationStatus === 'NOT_VERIFIED') {
            console.warn(`[Create Template] ⚠️  Phone number ${credentials.phoneNumberId} is NOT_VERIFIED. Template creation will be attempted anyway - templates can be created for unverified numbers.`);
          } else if (phoneVerificationStatus === 'VERIFIED') {
            console.log(`[Create Template] ✅ Phone number ${credentials.phoneNumberId} is VERIFIED`);
          }
        }
      } catch (checkError) {
        console.warn('[Create Template] Could not check phone verification status:', checkError);
        // Continue anyway - don't block template creation
      }
    }
    
    const url = `${this.baseUrl}/${this.apiVersion}/${effectiveWabaId}/message_templates`;
    console.log('[Create Template] Sending template to Meta:', JSON.stringify(templateData, null, 2));
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templateData),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error creating template' } }));
      const errorMessage = error.error?.message || error.message || JSON.stringify(error);
      const errorCode = error.error?.code;
      const errorSubcode = error.error?.error_subcode;
      console.error('[Create Template] Meta API error response:', JSON.stringify(error, null, 2));
      
      // Detect common error scenarios and provide helpful guidance
      if (errorCode === 100 && errorSubcode === 33) {
        // Error code 100 with subcode 33 typically means: missing permissions, object doesn't exist, or WABA access issue
        let helpfulMessage = `Failed to create template. `;
        
        // Provide specific guidance based on phone verification status
        if (phoneVerificationStatus === 'NOT_VERIFIED') {
          helpfulMessage += `Note: Phone number is NOT_VERIFIED. Templates can be created for unverified numbers, but this error suggests a different issue. `;
        }
        
        // Provide specific guidance based on what we checked
        if (!wabaAccessible) {
          helpfulMessage += `⚠️  WABA ID "${effectiveWabaId}" is not accessible with the current access token. `;
        }
        
        helpfulMessage += `This error (code 100, subcode 33) usually indicates:\n\n` +
          `1. **Access Token Permissions**: The access token may not have required permissions.\n` +
          `   Required permissions: 'whatsapp_business_messaging', 'whatsapp_business_management'\n` +
          `   Check: Meta Business Manager → System Users → Permissions\n\n` +
          `2. **WABA ID Access**: The Business Account ID "${effectiveWabaId}" may not be accessible with this token.\n` +
          `   Verify: The WABA ID matches the one in Meta Business Manager\n` +
          `   Check: https://business.facebook.com → WhatsApp Manager → Phone Numbers\n\n`;
        
        if (phoneVerificationStatus === 'NOT_VERIFIED') {
          helpfulMessage += `3. **Phone Number Status**: Phone number is NOT_VERIFIED.\n` +
            `   ✅ IMPORTANT: Templates CAN be created for NOT_VERIFIED numbers - this status is NOT the cause of this error.\n` +
            `   The real issue is permissions/WABA access (see points 1-2 above).\n` +
            `   However, verifying the phone number may help with overall account setup.\n\n`;
        } else if (phoneVerificationStatus === 'VERIFIED') {
          helpfulMessage += `3. **Phone Number Status**: Phone number is VERIFIED ✅\n` +
            `   This confirms the issue is permissions/WABA access, not phone verification.\n\n`;
        } else {
          helpfulMessage += `3. **Phone Number Connection**: Ensure the phone number is properly connected to the WABA.\n` +
            `   Status: ${phoneVerificationStatus || 'Unknown (could not check)'}\n` +
            `   Note: Even if status is unknown or NOT_VERIFIED, templates should still be creatable with proper permissions.\n\n`;
        }
        
        helpfulMessage += `**Troubleshooting Steps:**\n` +
          `- If this panel has **more than one** WhatsApp Business (Meta) integration, the wrong token may have been used. Disconnect/re-add the phone so it binds to the correct Meta account, or reconnect that integration.\n` +
          `- WABA created only in the **WhatsApp Business app** (not Cloud API) often cannot be assigned to a system user — use a WhatsApp Business **Platform** WABA in Business Manager.\n` +
          `- Go to Meta Business Manager: https://business.facebook.com\n` +
          `- Navigate to WhatsApp Manager → Phone Numbers\n` +
          `- Verify the phone number shows as connected to WABA ID: ${effectiveWabaId}\n` +
          `- Check System Users have WhatsApp Business API permissions\n` +
          `- Regenerate access token if permissions are missing\n` +
          `- If phone is NOT_VERIFIED, verify it in Meta Business Manager\n\n` +
          `Original Meta API error: ${errorMessage}`;
        
        throw new Error(helpfulMessage);
      }

      // Duplicate template name + language on WABA (Meta user-facing message is clear)
      if (errorCode === 100 && errorSubcode === 2388024) {
        const userMsg = error.error?.error_user_msg || error.error?.error_user_title;
        throw new Error(
          userMsg
            ? `Failed to create message template: ${userMsg} (Use a new template name, delete the existing template in WhatsApp Manager, or change language code e.g. en_US.)`
            : `Failed to create message template: A template with this name and language already exists. Rename the template or remove the old one in Meta Business Suite → WhatsApp Manager → Message templates.`
        );
      }

      // Same name + language as a template that is still being deleted (Meta holds the slot for days/weeks)
      const metaTextForDeletionCheck = [
        error.error?.error_user_title,
        error.error?.error_user_msg,
        error.error?.message,
        errorMessage,
      ]
        .filter(Boolean)
        .join(" ");
      if (
        /being deleted/i.test(metaTextForDeletionCheck) ||
        /Language is Being Deleted/i.test(metaTextForDeletionCheck) ||
        /can't be added while the existing/i.test(metaTextForDeletionCheck) ||
        /cannot be added while the existing/i.test(metaTextForDeletionCheck)
      ) {
        const metaLine =
          error.error?.error_user_msg ||
          error.error?.error_user_title ||
          errorMessage;
        throw new Error(
          [
            "WhatsApp/Meta is still removing a previous template with this exact name and language. Until that finishes, you cannot submit a new one with the same pair — this is Meta’s rule, not a bug in the panel.",
            "",
            "What works:",
            "• Use a different template name (recommended), e.g. add _v2 or a date.",
            "• Or wait until Meta clears the deletion (they may say a few days to a few weeks), then reuse the name.",
            "",
            `Meta said: ${metaLine}`,
          ].join("\n")
        );
      }

      const userFacing =
        error.error?.error_user_msg ||
        error.error?.error_user_title;
      throw new Error(
        userFacing
          ? `Failed to create message template: ${userFacing}`
          : `Failed to create message template: ${errorMessage}`
      );
    }
    
    const result = await response.json();
    return result;
  }

  /**
   * Delete a message template from Meta WhatsApp Business API.
   * DELETE /<WABA_ID>/message_templates?name=<name> or ?hsm_id=<templateId>
   */
  async deleteMessageTemplate(
    credentials: BusinessAPICredentials,
    businessAccountId: string,
    options: { name: string } | { hsmId: string }
  ): Promise<{ success: boolean }> {
    if (!businessAccountId) {
      throw new Error("Business Account ID (WABA) is required to delete message templates.");
    }
    const param = 'name' in options
      ? `name=${encodeURIComponent(options.name)}`
      : `hsm_id=${encodeURIComponent(options.hsmId)}`;
    const url = `${this.baseUrl}/${this.apiVersion}/${businessAccountId}/message_templates?${param}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      const errorMessage = error.error?.message || error.message || JSON.stringify(error);
      throw new Error(`Failed to delete message template: ${errorMessage}`);
    }
    const result = await response.json();
    return result;
  }

  /**
   * Step 1: Start a resumable upload session
   * POST to /<APP_ID>/uploads to get upload session ID
   * 
   * @param credentials - Business API credentials
   * @param appId - Meta App ID (can be from FACEBOOK_APP_ID env var or passed directly)
   * @param fileName - Name of the file
   * @param fileLength - File size in bytes
   * @param fileType - MIME type (application/pdf, image/jpeg, image/jpg, image/png, video/mp4)
   * @returns Upload session ID (format: "upload:<UPLOAD_SESSION_ID>")
   */
  async startResumableUploadSession(
    credentials: BusinessAPICredentials,
    appId: string,
    fileName: string,
    fileLength: number,
    fileType: string
  ): Promise<string> {
    const url = `${this.baseUrl}/${this.apiVersion}/${appId}/uploads?file_name=${encodeURIComponent(fileName)}&file_length=${fileLength}&file_type=${encodeURIComponent(fileType)}&access_token=${credentials.accessToken}`;
    
    console.log(`[Resumable Upload] Starting upload session: ${url}, fileName: ${fileName}, size: ${fileLength} bytes, MIME type: ${fileType}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${credentials.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      console.error(`[Resumable Upload] Failed to start session:`, JSON.stringify(error, null, 2));
      throw new Error(`Failed to start upload session: ${error.error?.message || JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log(`[Resumable Upload] Session started, response:`, JSON.stringify(result, null, 2));

    if (!result.id || !result.id.startsWith('upload:')) {
      throw new Error(`Invalid upload session ID returned: ${JSON.stringify(result)}`);
    }

    return result.id; // Returns "upload:<UPLOAD_SESSION_ID>"
  }

  /**
   * Step 2: Upload file chunk (or full file)
   * POST to /upload:<UPLOAD_SESSION_ID> with file_offset header
   * 
   * @param credentials - Business API credentials
   * @param uploadSessionId - Upload session ID (format: "upload:<UPLOAD_SESSION_ID>")
   * @param fileData - File data as Buffer
   * @param fileOffset - Byte offset to start upload from (0 for new upload, >0 for resume)
   * @returns File handle (h field) that can be used in template headers
   */
  async uploadFileChunk(
    credentials: BusinessAPICredentials,
    uploadSessionId: string,
    fileData: Buffer,
    fileOffset: number = 0
  ): Promise<string> {
    // Extract session ID from "upload:<SESSION_ID>" format
    const sessionId = uploadSessionId.startsWith('upload:') 
      ? uploadSessionId 
      : `upload:${uploadSessionId}`;

    const url = `${this.baseUrl}/${this.apiVersion}/${sessionId}`;
    
    // Calculate chunk size - upload from fileOffset to end of file
    const chunkData = fileData.slice(fileOffset);
    
    console.log(`[Resumable Upload] Uploading chunk: ${url}, offset: ${fileOffset}, chunk size: ${chunkData.length} bytes`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${credentials.accessToken}`,
        'file_offset': fileOffset.toString(),
        'Content-Type': 'application/octet-stream',
      },
      body: chunkData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      console.error(`[Resumable Upload] Failed to upload chunk:`, JSON.stringify(error, null, 2));
      throw new Error(`Failed to upload file chunk: ${error.error?.message || JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log(`[Resumable Upload] Upload successful, response:`, JSON.stringify(result, null, 2));

    if (!result.h || typeof result.h !== 'string') {
      throw new Error(`Upload succeeded but no file handle (h) returned. Response: ${JSON.stringify(result)}`);
    }

    return result.h; // Returns the file handle
  }

  /**
   * Check upload status and get current file_offset for resuming
   * GET to /upload:<UPLOAD_SESSION_ID>
   * 
   * @param credentials - Business API credentials
   * @param uploadSessionId - Upload session ID (format: "upload:<UPLOAD_SESSION_ID>")
   * @returns Object with upload session ID and current file_offset
   */
  async getUploadStatus(
    credentials: BusinessAPICredentials,
    uploadSessionId: string
  ): Promise<{ id: string; file_offset: number }> {
    // Extract session ID from "upload:<SESSION_ID>" format
    const sessionId = uploadSessionId.startsWith('upload:') 
      ? uploadSessionId 
      : `upload:${uploadSessionId}`;

    const url = `${this.baseUrl}/${this.apiVersion}/${sessionId}`;
    
    console.log(`[Resumable Upload] Checking upload status: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `OAuth ${credentials.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      console.error(`[Resumable Upload] Failed to get upload status:`, JSON.stringify(error, null, 2));
      throw new Error(`Failed to get upload status: ${error.error?.message || JSON.stringify(error)}`);
    }

    const result = await response.json();
    console.log(`[Resumable Upload] Upload status:`, JSON.stringify(result, null, 2));

    if (!result.id || !result.file_offset) {
      throw new Error(`Invalid upload status response: ${JSON.stringify(result)}`);
    }

    return {
      id: result.id,
      file_offset: parseInt(result.file_offset, 10) || 0,
    };
  }

  /**
   * Complete resumable upload flow (convenience method)
   * Handles the full flow: start session -> upload file -> return handle
   * 
   * @param credentials - Business API credentials
   * @param appId - Meta App ID
   * @param fileData - File data as Buffer
   * @param fileName - Name of the file
   * @param fileType - MIME type
   * @returns File handle (h field) that can be used in template headers
   */
  async uploadFileResumable(
    credentials: BusinessAPICredentials,
    appId: string,
    fileData: Buffer,
    fileName: string,
    fileType: string
  ): Promise<string> {
    // Step 1: Start upload session
    const uploadSessionId = await this.startResumableUploadSession(
      credentials,
      appId,
      fileName,
      fileData.length,
      fileType
    );

    // Step 2: Upload file (starting from offset 0)
    const fileHandle = await this.uploadFileChunk(
      credentials,
      uploadSessionId,
      fileData,
      0
    );

    return fileHandle;
  }

  /**
   * Resume an interrupted upload
   * 
   * @param credentials - Business API credentials
   * @param uploadSessionId - Upload session ID from startResumableUploadSession
   * @param fileData - Full file data as Buffer
   * @returns File handle (h field) that can be used in template headers
   */
  async resumeUpload(
    credentials: BusinessAPICredentials,
    uploadSessionId: string,
    fileData: Buffer
  ): Promise<string> {
    // Step 1: Get current upload status
    const status = await this.getUploadStatus(credentials, uploadSessionId);

    // Step 2: Resume upload from the file_offset
    const fileHandle = await this.uploadFileChunk(
      credentials,
      status.id,
      fileData,
      status.file_offset
    );

    return fileHandle;
  }
}

export const businessAPIManager = new WhatsAppBusinessAPIManager();