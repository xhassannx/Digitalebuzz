// @ts-nocheck
import { db } from "../db";
import { 
  users, apiKeys, whatsappSessions, contacts, chats, messages, webhooks, 
  plans, subscriptions, payments, usageTracking, userSettings, smtpSettings, countryDialCodes,
  organizations, organizationMembers, organizationThemes, websiteBuilderPages,   managedContacts, contactTags, contactTagAssignments, contactActivityLog, contactNotes, contactReminders,
  groups, groupMembers, campaigns, campaignRecipients, insertCampaignRecipientSchema, campaignRecipientButtonClicks, trackedUrls, trackedUrlClicks, messageActivityLog, messageTemplates, messageSyncRequests, integrations, integrationOAuthStates, whatsappFlows, whatsappFlowResponses, contactColumns, contactPaymentRequests, chatbots, chatbotNodes, aiAssistants, aiAssistantKnowledgeFiles, optKeywords, addons, userAddons, coupons, subscriptionHistory, automationFlows, automationFlowRuns, automationFlowRunLogs, automationFlowScheduledRuns, faqItems, faqBotSettings, organizationLiveChatSettings, liveChatAutoReplyState, organizationCommerceSettings, organizationInvoiceSettings, organizationInvoices, organizationLeads, organizationLeadStatuses, cannedMessages, platformMasterSettings, whitelabelOnboardingFees, whitelabelOnboardingSettlements, panelTransactionalEmailLog, supportTickets, supportMessages, supportAttachments
} from "@shared/schema";
import {
  allCanvasSelectedTriggersFromLinearFlow,
  isLinearFlowDefinition,
  toLinearFlowV2ForEdit,
} from "@shared/linear-flow";
import type { 
  User,
  UpsertUser,
  ApiKey,
  InsertApiKey,
  WhatsappSession, 
  InsertWhatsappSession,
  Contact,
  InsertContact,
  Chat,
  InsertChat,
  Message,
  InsertMessage,
  Webhook,
  InsertWebhook,
  Plan,
  InsertPlan,
  Subscription,
  InsertSubscription,
  Payment,
  InsertPayment,
  UsageTracking,
  InsertUsageTracking,
  UserSettings,
  InsertUserSettings,
  SmtpSettings,
  InsertSmtpSettings,
  Organization,
  InsertOrganization,
  OrganizationMember,
  InsertOrganizationMember,
  OrganizationTheme,
  InsertOrganizationTheme,
  WebsiteBuilderPage,
  InsertWebsiteBuilderPage,
  ManagedContact,
  InsertManagedContact,
  ContactTag,
  InsertContactTag,
  ContactActivityLog,
  InsertContactActivityLog,
  ContactNote,
  InsertContactNote,
  ContactReminder,
  InsertContactReminder,
  ContactColumn,
  InsertContactColumn,
  Group,
  InsertGroup,
  GroupMember,
  InsertGroupMember,
  Campaign,
  InsertCampaign,
  CampaignRecipient,
  InsertCampaignRecipient,
  MessageActivityLog,
  InsertMessageActivityLog,
  MessageTemplate,
  InsertMessageTemplate,
  MessageSyncRequest,
  InsertMessageSyncRequest,
  Integration,
  InsertIntegration,
  IntegrationOAuthState,
  InsertIntegrationOAuthState,
  WhatsAppFlow,
  InsertWhatsAppFlow,
  WhatsAppFlowResponse,
  InsertWhatsAppFlowResponse,
  Chatbot,
  InsertChatbot,
  ChatbotNode,
  InsertChatbotNode,
  AiAssistant,
  InsertAiAssistant,
  AiAssistantKnowledgeFile,
  InsertAiAssistantKnowledgeFile,
  OptKeyword,
  InsertOptKeyword,
  Addon,
  InsertAddon,
  UserAddon,
  InsertUserAddon,
  Coupon,
  InsertCoupon,
  AutomationFlow,
  InsertAutomationFlow,
  AutomationFlowScheduledRun,
  InsertAutomationFlowScheduledRun,
  AutomationFlowRun,
  InsertAutomationFlowRun,
  AutomationFlowRunLog,
  InsertAutomationFlowRunLog,
  AutomationFlowRun,
  InsertAutomationFlowRun,
  AutomationFlowRunLog,
  InsertAutomationFlowRunLog,
  FaqItem,
  InsertFaqItem,
  FaqBotSettings,
  InsertFaqBotSettings,
  OrganizationLiveChatSettings,
  InsertOrganizationLiveChatSettings,
  LiveChatAutoReplyState,
  OrganizationCommerceSettings,
  InsertOrganizationCommerceSettings,
  OrganizationInvoiceSettings,
  InsertOrganizationInvoiceSettings,
  OrganizationInvoice,
  InsertOrganizationInvoice,
  OrganizationLead,
  InsertOrganizationLead,
  OrganizationLeadStatus,
  InsertOrganizationLeadStatus,
  CannedMessageRow,
  CountryDialCode,
  InsertCannedMessage,
  ContactPaymentRequestRow,
  InsertContactPaymentRequest,
  PlatformMasterSettingsRow,
  WhitelabelOnboardingFeeRow,
  InsertWhitelabelOnboardingFee,
  WhitelabelOnboardingSettlementRow,
  InsertWhitelabelOnboardingSettlement,
  SubscriptionHistory,
  SupportTicket,
  InsertSupportTicket,
  SupportMessage,
  InsertSupportMessage,
  SupportAttachment,
  InsertSupportAttachment
} from "@shared/schema";
import {
  eq,
  and,
  desc,
  asc,
  inArray,
  or,
  gte,
  lte,
  gt,
  ne,
  sql,
  ilike,
  isNull,
  isNotNull,
  lt,
  max
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { encryptCredentials, decryptCredentials } from "./utils/encryption";
import { isSubscriptionPeriodActiveByCalendarDay } from "./utils/subscription-calendar";

export type ManagedContactFilters = {
  search?: string;
  createdDateFrom?: string;
  createdDateTo?: string;
  updatedDateFrom?: string;
  updatedDateTo?: string;
  reminderDateFrom?: string;
  reminderDateTo?: string;
  assignedDateFrom?: string;
  assignedDateTo?: string;
  source?: string;
  assignedTo?: string[];
  tagIds?: string[];
  /** When true, return only contacts that have no tags assigned */
  noTagsOnly?: boolean;
  unassignedOnly?: boolean;
  optInStatus?: "all" | "opted_in" | "opted_out";
  duplicate?: "all" | "duplicates" | "non_duplicates";
  /** Filter by email (ILIKE on email column) */
  email?: string;
  /** Filter by dynamic column values (column id -> search value; ILIKE match) */
  customFieldFilters?: Record<string, string>;
};

export interface IStorage {
  // User methods (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  /** First user marked SaaS platform owner (for forgot-password SMTP, etc.) */
  getSaasOwnerUser(): Promise<User | undefined>;
  /** Whitelabel admin's Razorpay integration used for panel subscription billing (`useForOrgSubscription`). */
  getSaasOwnerRazorpayForOrgSubscription(): Promise<Integration | undefined>;
  /** Whitelabel admin's Stripe integration used for USD panel subscription checkout (`useForOrgSubscription`). */
  getSaasOwnerStripeForOrgSubscription(): Promise<Integration | undefined>;
  /** Whitelabel admin's SMTP integration from Integrations (connected `smtp`). */
  getSaasOwnerSmtpIntegration(): Promise<Integration | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // API Key methods
  createApiKey(data: InsertApiKey): Promise<ApiKey>;
  getApiKeysByUser(userId: string): Promise<ApiKey[]>;
  getApiKeyByKey(key: string): Promise<ApiKey | undefined>;
  deleteApiKey(id: string): Promise<void>;
  updateApiKeyLastUsed(id: string): Promise<void>;

  // Session methods
  createSession(data: InsertWhatsappSession): Promise<WhatsappSession>;
  getSession(sessionId: string): Promise<WhatsappSession | undefined>;
  getSessionsBySessionIds(sessionIds: string[]): Promise<WhatsappSession[]>;
  getAllSessions(): Promise<WhatsappSession[]>;
  getSessionsByUser(userId: string): Promise<WhatsappSession[]>;
  getSessionsByOrganization(organizationId: string): Promise<WhatsappSession[]>;
  /** Official Cloud sessions whose device_info.apiPhoneNumberId matches (any user; includes soft-deleted). */
  getOfficialSessionsByApiPhoneNumberId(apiPhoneNumberId: string): Promise<WhatsappSession[]>;
  getOfficialSessionsByWabaId(wabaId: string): Promise<WhatsappSession[]>;
  countConnectedSessions(): Promise<number>;
  /** Webhook lookup: match Meta phone_number_id (and optional display number fallback) without loading all sessions. */
  getOfficialSessionsForWebhook(phoneNumberId: string, displayPhoneNumber?: string): Promise<WhatsappSession[]>;
  updateSession(sessionId: string, data: Partial<InsertWhatsappSession>): Promise<WhatsappSession | undefined>;
  deleteSession(sessionId: string): Promise<void>;

  // Contact methods
  createContact(data: InsertContact): Promise<Contact>;
  getContactsBySession(sessionId: string): Promise<Contact[]>;
  
  // Chat methods
  createChat(data: InsertChat): Promise<Chat>;
  getChatsBySession(sessionId: string): Promise<Chat[]>;
  getChat(chatId: string): Promise<Chat | undefined>;
  updateChat(chatId: string, data: Partial<InsertChat>): Promise<Chat | undefined>;
  
  // Message methods
  createMessage(data: InsertMessage): Promise<Message>;
  getMessagesByChat(chatId: string, limit?: number): Promise<Message[]>;
  /** Messages strictly older than (cursorTimestamp, cursorId); returns chronological order (oldest first in batch). */
  getMessagesByChatBeforeCursor(
    chatId: string,
    cursorTimestamp: Date,
    cursorId: string,
    limit: number
  ): Promise<Message[]>;
  /** Latest inbound message time for a chat (Cloud API customer care window), or null if none. */
  getLatestInboundMessageTimestamp(chatId: string): Promise<Date | null>;
  /** Latest message time for a chat (any direction), or null if none. */
  getLatestMessageTimestamp(chatId: string): Promise<Date | null>;
  /** Inbound messages not marked read/seen/failed — source of truth for inbox badge. */
  countUnreadInboundMessages(chatId: string): Promise<number>;
  countUnreadInboundByChatIds(chatIds: string[]): Promise<Map<string, number>>;
  /** Bulk mark inbound unread messages read — one UPDATE instead of loading full chat history. */
  markInboundMessagesReadInChat(chatId: string): Promise<number>;
  countMessagesInChat(chatId: string): Promise<number>;
  getMessageByIdOrWhatsAppId(messageId: string, userId: string, sessionId?: string): Promise<Message | undefined>;
  /** Indexed lookup — avoids loading full chat history (critical for webhook/campaign paths on RDS). */
  getMessageByWhatsAppIdInChat(chatId: string, whatsappMessageId: string): Promise<Message | undefined>;
  hasInboundMessagesInChat(chatId: string): Promise<boolean>;
  getRecentOutboundMessageForSession(sessionId: string, withinMinutes?: number): Promise<Message | undefined>;
  getMessagesByCampaignId(sessionId: string, campaignId: string): Promise<Message[]>;
  countMessagesInSession(sessionId: string): Promise<number>;
  countCampaignDeliveriesSince(sessionId: string, campaignId: string, since: Date): Promise<number>;
  updateMessage(messageId: string, data: Partial<InsertMessage>): Promise<Message | undefined>;
  updateMessageStatus(messageId: string, status: Message['status'], errorMessage?: string, errorCode?: string): Promise<Message | undefined>;

  // Webhook methods
  createWebhook(data: InsertWebhook): Promise<Webhook>;
  getWebhooksByUser(userId: string): Promise<Webhook[]>;
  getWebhooksByOrganization(organizationId: string): Promise<Webhook[]>;
  getWebhook(id: string): Promise<Webhook | undefined>;
  getActiveWebhooksByUserAndEvent(userId: string, event: string): Promise<Webhook[]>;
  updateWebhook(id: string, data: Partial<InsertWebhook>): Promise<Webhook | undefined>;
  deleteWebhook(id: string): Promise<void>;
  updateWebhookLastTriggered(id: string): Promise<void>;
  incrementWebhookFailureCount(id: string): Promise<void>;
  resetWebhookFailureCount(id: string): Promise<void>;

  // Plan methods
  createPlan(data: InsertPlan): Promise<Plan>;
  getAllPlans(): Promise<Plan[]>;
  getActivePlans(): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan | undefined>;
  updatePlan(id: string, data: Partial<InsertPlan>): Promise<Plan | undefined>;
  deletePlan(id: string): Promise<void>;
  // Subscription methods
  createSubscription(data: InsertSubscription): Promise<Subscription>;
  getSubscriptionByUser(userId: string): Promise<Subscription | undefined>;
  getActiveSubscriptionByUser(userId: string): Promise<Subscription | undefined>;
  /** For team members: returns owner's subscription and effectiveUserId (for usage). For owners: returns own subscription. */
  getEffectiveActiveSubscription(userId: string): Promise<{ subscription: Subscription | undefined; effectiveUserId: string }>;
  getSubscriptionsByUser(userId: string): Promise<Subscription[]>;
  updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  cancelOtherSubscriptionsForUser(userId: string, keepSubscriptionId: string): Promise<void>;
  addSubscriptionHistory(data: {
    userId: string;
    planId: string;
    subscriptionId: string;
    action: "assigned" | "upgraded" | "downgraded" | "renewed" | "expired" | "cancelled";
    periodStart: Date;
    periodEnd: Date;
    billingCycle: "monthly" | "quarterly" | "yearly";
  }): Promise<string | undefined>;
  getSubscriptionHistoryByUser(userId: string): Promise<(SubscriptionHistory & { plan?: Plan })[]>;

  // Payment methods
  createPayment(data: InsertPayment): Promise<Payment>;
  getPaymentsByUser(userId: string): Promise<Payment[]>;
  getPaymentsBySubscription(subscriptionId: string): Promise<Payment[]>;
  /** Pending panel SaaS subscription payment matched by Razorpay order id or subscription id on `gateway_order_id`. */
  getPendingSaasPaymentByGatewayOrderId(gatewayOrderId: string): Promise<Payment | undefined>;
  updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined>;

  // Usage tracking methods
  getOrCreateUsageTracking(userId: string, month: string): Promise<UsageTracking>;
  incrementMessagesSent(userId: string, month: string): Promise<void>;
  incrementApiCalls(userId: string, month: string): Promise<void>;
  updateActiveSessions(userId: string, month: string, count: number): Promise<void>;
  incrementWebhooksTriggered(userId: string, month: string): Promise<void>;

  // User settings methods
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createOrUpdateUserSettings(data: InsertUserSettings): Promise<UserSettings>;
  getSmtpSettings(userId: string): Promise<SmtpSettings | undefined>;
  createOrUpdateSmtpSettings(data: InsertSmtpSettings): Promise<SmtpSettings>;
  /**
   * Forgot-password only: `smtp_settings` for `is_saas_owner = true` if present;
   * otherwise the most recently updated `smtp_settings` row (owner may save SMTP under same account).
   */
  getForgotPasswordSmtpUserId(): Promise<string | undefined>;
  /** Subscriptions that may receive expiry / reactivation panel emails (active or expired rows). */
  getSubscriptionsEligibleForPanelReminders(): Promise<Subscription[]>;
  panelTransactionalEmailLogExists(dedupeKey: string): Promise<boolean>;
  insertPanelTransactionalEmailLog(data: {
    userId: string;
    dedupeKey: string;
    notificationKind: string;
  }): Promise<void>;
  getCountryDialCodes(): Promise<CountryDialCode[]>;

  // Organization methods
  createOrganization(data: InsertOrganization): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationsByUser(userId: string): Promise<Organization[]>;
  updateOrganization(id: string, data: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: string): Promise<void>;

  // Organization member methods
  addOrganizationMember(data: InsertOrganizationMember): Promise<OrganizationMember>;
  getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]>;
  getOrganizationMembersWithUsers(organizationId: string): Promise<
    Array<
      OrganizationMember & {
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
        user: {
          id: string;
          email: string | null;
          firstName: string | null;
          lastName: string | null;
        } | null;
      }
    >
  >;
  getOrganizationMember(organizationId: string, userId: string): Promise<OrganizationMember | undefined>;
  updateOrganizationMemberRole(id: string, role: OrganizationMember['role']): Promise<OrganizationMember | undefined>;
  updateOrganizationMemberPermissions(id: string, permissions: string[]): Promise<OrganizationMember | undefined>;
  removeOrganizationMember(id: string): Promise<void>;

  // Organization theme methods
  createOrUpdateOrganizationTheme(data: InsertOrganizationTheme): Promise<OrganizationTheme>;
  getOrganizationTheme(organizationId: string): Promise<OrganizationTheme | undefined>;
  deleteOrganizationTheme(organizationId: string): Promise<void>;

  // Website Builder / White-label
  getWebsiteBuilderPage(organizationId: string, pageKey: string): Promise<WebsiteBuilderPage | undefined>;
  setWebsiteBuilderPage(organizationId: string, pageKey: string, content: Record<string, unknown>): Promise<WebsiteBuilderPage>;
  getWebsiteBuilderConfigForOrg(organizationId: string): Promise<Record<string, Record<string, unknown>>>;

  // Admin methods
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<Pick<User, 'isSaaSOwner' | 'isActive' | 'firstName' | 'lastName' | 'email' | 'phone' | 'tenantId' | 'passwordHash' | 'emailVerified' | 'accountStatus' | 'profileImageUrl' | 'isTrialAccount' | 'trialExpiresAt'>>): Promise<User | undefined>;
  getAllOrganizations(): Promise<Organization[]>;

  // Managed contact methods
  createManagedContact(
    data: InsertManagedContact,
    opts?: import("./automation/contact-automation-guard").ManagedContactWriteOptions
  ): Promise<ManagedContact>;
  getManagedContactsByUser(userId: string, organizationId: string): Promise<ManagedContact[]>;
  countManagedContactsByOrganization(organizationId: string): Promise<number>;
  getManagedContactsWithFilters(userId: string, organizationId: string, filters: ManagedContactFilters): Promise<ManagedContact[]>;
  getManagedContactsWithFiltersByOrganization(organizationId: string, filters: ManagedContactFilters): Promise<ManagedContact[]>;
  listManagedContactsWithFiltersByOrganization(
    organizationId: string,
    filters: ManagedContactFilters,
    pagination: { limit: number; offset: number }
  ): Promise<{ items: ManagedContact[]; total: number; limit: number; offset: number }>;
  getManagedContact(id: string, userId: string, organizationId: string): Promise<ManagedContact | undefined>;
  getManagedContactByOrganization(contactId: string, organizationId: string): Promise<ManagedContact | undefined>;
  /** Match managed contact by digits-only phone (PostgreSQL regexp_replace). */
  findManagedContactByOrganizationAndPhoneDigits(organizationId: string, phoneDigits: string): Promise<ManagedContact | undefined>;
  updateManagedContact(
    id: string,
    userId: string,
    organizationId: string,
    data: Partial<InsertManagedContact>,
    opts?: import("./automation/contact-automation-guard").ManagedContactWriteOptions
  ): Promise<ManagedContact | undefined>;
  deleteManagedContact(id: string, userId: string, organizationId: string): Promise<void>;
  getManagedContactsByTags(userId: string, tagIds: string[], organizationId: string): Promise<ManagedContact[]>;
  /** Digits-only phone -> user id when CRM customFields.assignedTo is set (shared inbox visibility). */
  getPhoneToAssignedUserIdMapForOrganization(organizationId: string): Promise<Map<string, string>>;
  /** Minimal contact rows for inbox (tags, assignment, phone) — avoids full CRM list payload. */
  getInboxContactIndexByOrganization(organizationId: string): Promise<
    Array<{
      id: string;
      phoneNumber: string;
      name?: string;
      customFields: Record<string, string>;
      source?: string;
      tags: string[];
    }>
  >;

  // Contact tag methods
  createContactTag(data: InsertContactTag): Promise<ContactTag>;
  getContactTagsByUser(userId: string, organizationId: string): Promise<ContactTag[]>;
  getContactTagsByOrganization(organizationId: string): Promise<ContactTag[]>;
  getContactTag(id: string, userId: string, organizationId: string): Promise<ContactTag | undefined>;
  getContactTagByOrganization(id: string, organizationId: string): Promise<ContactTag | undefined>;
  updateContactTag(id: string, userId: string, organizationId: string, data: Partial<InsertContactTag>): Promise<ContactTag | undefined>;
  updateContactTagByOrganization(id: string, organizationId: string, data: Partial<InsertContactTag>): Promise<ContactTag | undefined>;
  deleteContactTag(id: string, userId: string, organizationId: string): Promise<void>;
  deleteContactTagByOrganization(id: string, organizationId: string): Promise<void>;
  assignTagToContact(contactId: string, tagId: string, userId: string, organizationId: string): Promise<void>;
  removeTagFromContact(contactId: string, tagId: string, userId: string, organizationId: string): Promise<void>;
  getContactTags(contactId: string, userId: string, organizationId: string): Promise<ContactTag[]>;
  getContactTagsBatch(contactIds: string[], userId: string, organizationId: string): Promise<Map<string, ContactTag[]>>;
  getContactTagsBatchByOrganization(contactIds: string[], organizationId: string): Promise<Map<string, ContactTag[]>>;

  // Contact activity log (who did what)
  createContactActivityLog(data: InsertContactActivityLog): Promise<ContactActivityLog>;
  getContactActivityLogs(contactId: string, userId: string, organizationId: string): Promise<(ContactActivityLog & { userFirstName?: string | null; userLastName?: string | null; userProfileImageUrl?: string | null })[]>;

  // Contact notes methods (getContactNotes returns notes with creator profile fields)
  getContactNotes(contactId: string, userId: string, organizationId: string): Promise<(ContactNote & { userFirstName?: string | null; userLastName?: string | null; userProfileImageUrl?: string | null })[]>;
  createContactNote(data: InsertContactNote): Promise<ContactNote>;
  updateContactNote(id: string, contactId: string, userId: string, organizationId: string, data: { message: string }): Promise<ContactNote | undefined>;
  deleteContactNote(id: string, contactId: string, userId: string, organizationId: string): Promise<void>;

  // Contact reminders methods (getContactReminders returns reminders with creator profile fields)
  getContactReminders(contactId: string, userId: string, organizationId: string): Promise<(ContactReminder & { userFirstName?: string | null; userLastName?: string | null; userProfileImageUrl?: string | null })[]>;
  getContactRemindersByOrganization(contactId: string, organizationId: string): Promise<(ContactReminder & { userFirstName?: string | null; userLastName?: string | null; userProfileImageUrl?: string | null })[]>;
  createContactReminder(data: InsertContactReminder): Promise<ContactReminder>;
  updateContactReminder(id: string, contactId: string, userId: string, organizationId: string, data: { title?: string | null; message?: string; notes?: string | null; reminderTo?: string; reminderAt?: Date; contactDisplayName?: string | null; templateName?: string | null; templateLanguage?: string | null; templateParams?: string[] | null; sessionId?: string | null; headerImageUrl?: string | null; headerImageId?: string | null; headerVideoUrl?: string | null; headerVideoId?: string | null; headerDocumentUrl?: string | null; headerDocumentId?: string | null; whatsappStatus?: "none" | "pending" | "sending" | "sent" | "failed"; whatsappSentAt?: Date | null; whatsappError?: string | null }): Promise<ContactReminder | undefined>;
  updateContactReminderByOrganization(reminderId: string, contactId: string, organizationId: string, data: { title?: string | null; message?: string; notes?: string | null; reminderTo?: string; reminderAt?: Date; contactDisplayName?: string | null; templateName?: string | null; templateLanguage?: string | null; templateParams?: string[] | null; sessionId?: string | null; headerImageUrl?: string | null; headerImageId?: string | null; headerVideoUrl?: string | null; headerVideoId?: string | null; headerDocumentUrl?: string | null; headerDocumentId?: string | null; whatsappStatus?: "none" | "pending" | "sending" | "sent" | "failed"; whatsappSentAt?: Date | null; whatsappError?: string | null }): Promise<ContactReminder | undefined>;
  deleteContactReminder(id: string, contactId: string, userId: string, organizationId: string): Promise<void>;
  deleteContactReminderByOrganization(reminderId: string, contactId: string, organizationId: string): Promise<void>;
  /** Claim due reminders that should auto-send a WhatsApp template */
  claimDueRemindersForWhatsApp(now: Date, limit?: number): Promise<ContactReminder[]>;
  markReminderWhatsAppSent(id: string): Promise<void>;
  markReminderWhatsAppFailed(id: string, error: string): Promise<void>;
  requeueFailedReminderWhatsAppSends(options?: {
    organizationId?: string;
    errorContains?: string;
    limit?: number;
  }): Promise<number>;
  requeueStuckReminderWhatsAppSends(olderThanMinutes?: number): Promise<number>;
  /** All reminders for a user (reminderTo = userId) with optional date range and search – for reminders list page */
  getAllRemindersForUser(
    userId: string,
    organizationId: string,
    filters?: { dateFrom?: string; dateTo?: string; search?: string }
  ): Promise<{ id: string; title?: string | null; message: string; reminderAt: Date; contactId: string; contactName: string }[]>;
  /** All reminders for a user across any org (fallback when org list empty, e.g. production session quirks) */
  getAllRemindersForUserAnyOrg(
    userId: string,
    filters?: { dateFrom?: string; dateTo?: string; search?: string }
  ): Promise<{ id: string; title?: string | null; message: string; reminderAt: Date; contactId: string; contactName: string }[]>;
  /** All reminders in org (for team members – org-scoped list) */
  getAllRemindersByOrganization(
    organizationId: string,
    filters?: { dateFrom?: string; dateTo?: string; search?: string; reminderTo?: string }
  ): Promise<{
    id: string;
    title?: string | null;
    message: string;
    reminderAt: Date;
    contactId: string;
    contactName: string;
    contactPhone: string;
    reminderTo: string;
    assigneeName: string;
    templateName?: string | null;
    templateLanguage?: string | null;
    templateParams?: string[] | null;
    sessionId?: string | null;
    whatsappStatus?: string | null;
  }[]>;
  getDueRemindersByOrganization(organizationId: string): Promise<{ id: string; title?: string | null; message: string; reminderAt: Date; contactId: string; contactName: string }[]>;
  getUpcomingRemindersByOrganization(organizationId: string): Promise<{ id: string; title?: string | null; message: string; reminderAt: Date; contactId: string; contactName: string }[]>;

  // Opt keywords methods
  getOptKeywords(userId: string, organizationId: string, type: 'opt_in' | 'opt_out'): Promise<OptKeyword[]>;
  getOptKeywordsByOrganization(organizationId: string, type: 'opt_in' | 'opt_out'): Promise<OptKeyword[]>;
  createOptKeyword(data: InsertOptKeyword): Promise<OptKeyword>;
  deleteOptKeyword(id: string, userId: string, organizationId: string): Promise<void>;
  updateOptKeywords(userId: string, organizationId: string, type: 'opt_in' | 'opt_out', keywords: string[]): Promise<OptKeyword[]>;
  updateOptKeywordsByOrganization(organizationId: string, type: 'opt_in' | 'opt_out', keywords: string[], userId: string): Promise<OptKeyword[]>;

  // Contact column methods
  createContactColumn(data: InsertContactColumn): Promise<ContactColumn>;
  getContactColumnsByUser(userId: string, organizationId: string): Promise<ContactColumn[]>;
  getContactColumnsByOrganization(organizationId: string): Promise<ContactColumn[]>;
  getContactColumn(id: string, userId: string, organizationId: string): Promise<ContactColumn | undefined>;
  getContactColumnByOrganization(id: string, organizationId: string): Promise<ContactColumn | undefined>;
  updateContactColumn(id: string, userId: string, organizationId: string, data: Partial<InsertContactColumn>): Promise<ContactColumn | undefined>;
  updateContactColumnByOrganization(id: string, organizationId: string, data: Partial<InsertContactColumn>): Promise<ContactColumn | undefined>;
  deleteContactColumn(id: string, userId: string, organizationId: string): Promise<void>;
  deleteContactColumnByOrganization(id: string, organizationId: string): Promise<void>;

  // Group methods
  createGroup(data: InsertGroup): Promise<Group>;
  getGroupsByUser(userId: string, organizationId: string): Promise<Group[]>;
  getGroupsByOrganization(organizationId: string): Promise<Group[]>;
  getGroup(id: string, userId: string, organizationId: string): Promise<Group | undefined>;
  getGroupByOrganization(id: string, organizationId: string): Promise<Group | undefined>;
  updateGroup(id: string, userId: string, organizationId: string, data: Partial<InsertGroup>): Promise<Group | undefined>;
  updateGroupByOrganization(id: string, organizationId: string, data: Partial<InsertGroup>): Promise<Group | undefined>;
  deleteGroup(id: string, userId: string, organizationId: string): Promise<void>;
  deleteGroupByOrganization(id: string, organizationId: string): Promise<void>;

  // Group member methods
  addGroupMember(data: InsertGroupMember, userId: string, organizationId: string): Promise<GroupMember>;
  addGroupMemberByOrganization(data: InsertGroupMember, organizationId: string): Promise<GroupMember>;
  getGroupMembers(groupId: string, userId: string, organizationId: string): Promise<GroupMember[]>;
  getGroupMembersByOrganization(groupId: string, organizationId: string): Promise<GroupMember[]>;
  removeGroupMember(id: string, userId: string, organizationId: string): Promise<void>;
  removeGroupMemberByOrganization(memberId: string, organizationId: string): Promise<void>;

  // Campaign methods
  createCampaign(data: InsertCampaign): Promise<Campaign>;
  getCampaignsByUser(userId: string, organizationId: string): Promise<Campaign[]>;
  getCampaignsByOrganization(organizationId: string): Promise<Campaign[]>;
  getCampaign(id: string, userId: string, organizationId: string): Promise<Campaign | undefined>;
  getDefaultTemplateHeaderImageUrl(organizationId: string, templateName: string): Promise<string | null>;
  getCampaignByOrganization(id: string, organizationId: string): Promise<Campaign | undefined>;
  updateCampaign(id: string, userId: string, organizationId: string, data: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  updateCampaignByOrganization(id: string, organizationId: string, data: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string, userId: string, organizationId: string): Promise<void>;
  deleteCampaignByOrganization(id: string, organizationId: string): Promise<void>;
  updateCampaignStats(id: string, userId: string, organizationId: string, stats: Partial<Pick<Campaign, 'sentCount' | 'deliveredCount' | 'readCount' | 'failedCount' | 'totalRecipients'>>): Promise<void>;
  updateCampaignExecution(id: string, userId: string, organizationId: string, data: Partial<Pick<Campaign, 'status' | 'startedAt' | 'completedAt' | 'sentCount' | 'failedCount' | 'retryNextAt' | 'retryAttemptCount'>>): Promise<Campaign | undefined>;
  updateCampaignExecutionByOrganization(id: string, organizationId: string, data: Partial<Pick<Campaign, 'status' | 'startedAt' | 'completedAt' | 'sentCount' | 'failedCount' | 'retryNextAt' | 'retryAttemptCount'>>): Promise<Campaign | undefined>;
  /** Atomically set failed_auto_retry_at if still null; returns true if this caller won the claim. */
  claimCampaignFailedAutoRetry(campaignId: string, userId: string, organizationId: string): Promise<boolean>;
  /** Claim a due configured retry (clears retryNextAt). Returns campaign if claimed. */
  claimDueCampaignRetry(campaignId: string): Promise<Campaign | undefined>;
  /** Campaigns with retry_next_at <= now. */
  getDueCampaignRetries(now?: Date): Promise<Campaign[]>;
  /** Schedule next configured retry pass after campaign completion. */
  scheduleCampaignConfiguredRetry(
    campaignId: string,
    userId: string,
    organizationId: string,
    nextAt: Date
  ): Promise<void>;

  // Campaign recipient methods
  addCampaignRecipient(data: InsertCampaignRecipient, userId: string, organizationId: string): Promise<CampaignRecipient>;
  addCampaignRecipientByOrganization(data: InsertCampaignRecipient, organizationId: string): Promise<CampaignRecipient>;
  /** Parse + insert many recipients in chunked DB writes (fast path for large audiences). */
  insertCampaignRecipientsBulk(
    campaignId: string,
    userId: string,
    organizationId: string,
    rawRecipients: unknown[]
  ): Promise<{ inserted: number; skipped: number }>;
  /** All managed contacts in org with id in ids (chunked IN queries). */
  getManagedContactsByIdsForOrganization(organizationId: string, ids: string[]): Promise<Map<string, ManagedContact>>;
  getCampaignRecipients(campaignId: string, userId: string, organizationId: string): Promise<CampaignRecipient[]>;
  getCampaignRecipientsByOrganization(campaignId: string, organizationId: string): Promise<CampaignRecipient[]>;
  /** Marks all still-pending recipients as failed (e.g. execution interrupted). Returns number of rows updated. */
  markCampaignPendingRecipientsFailed(campaignId: string, userId: string, organizationId: string, errorMessage: string): Promise<number>;
  updateCampaignRecipientStatus(id: string, userId: string, organizationId: string, status: CampaignRecipient['status'], messageId?: string, errorMessage?: string): Promise<void>;
  updateCampaignRecipientStatusByOrganization(recipientId: string, organizationId: string, status: CampaignRecipient['status'], messageId?: string): Promise<void>;
  updateCampaignRecipientStatusByWhatsAppMessageId(whatsappMessageId: string, status: CampaignRecipient['status'], errorMessage?: string): Promise<boolean>;
  recordCampaignButtonClick(whatsappMessageId: string, buttonId: string, buttonTitle: string): Promise<boolean>;
  getCampaignButtonClickCounts(campaignId: string): Promise<Array<{ buttonId: string; buttonTitle: string; count: number }>>;
  getCampaignButtonClickReport(campaignId: string): Promise<Array<{
    phoneNumber: string;
    name: string | null;
    buttonId: string;
    buttonTitle: string;
    clickedAt: Date;
  }>>;
  createTrackedUrl(data: {
    destinationUrl: string;
    organizationId?: string | null;
    userId?: string | null;
    campaignId?: string | null;
  }): Promise<{ id: string; code: string; destinationUrl: string }>;
  getTrackedUrlByCode(code: string): Promise<{
    id: string;
    code: string;
    destinationUrl: string;
    organizationId: string | null;
    campaignId: string | null;
  } | undefined>;
  recordTrackedUrlClick(trackedUrlId: string, meta?: { campaignId?: string | null; ip?: string; userAgent?: string }): Promise<void>;
  getCampaignUrlClickReport(campaignId: string, organizationId: string): Promise<Array<{
    destinationUrl: string;
    code: string;
    clickedAt: Date;
    ip: string | null;
  }>>;

  // Message template methods
  upsertMessageTemplate(data: InsertMessageTemplate): Promise<MessageTemplate>;
  getMessageTemplatesByUser(userId: string, organizationId?: string, phoneNumberId?: string): Promise<MessageTemplate[]>;
  getMessageTemplatesByOrganization(organizationId: string, phoneNumberId?: string): Promise<MessageTemplate[]>;
  backfillMessageTemplatesOrganizationForPhone(userId: string, phoneNumberId: string, organizationId: string): Promise<number>;
  getMessageTemplate(id: string, userId: string): Promise<MessageTemplate | undefined>;
  getMessageTemplateByOrganization(id: string, organizationId: string): Promise<MessageTemplate | undefined>;
  deleteMessageTemplate(id: string, userId: string): Promise<void>;
  deleteMessageTemplateByOrganization(id: string, organizationId: string): Promise<void>;
  syncMessageTemplates(userId: string, templates: any[], phoneNumberId?: string, organizationId?: string): Promise<void>;

  // Message activity log methods (for dashboard analytics)
  getMessageActivityForDateRange(userId: string, startDate: string, endDate: string): Promise<MessageActivityLog[]>;
  getMessageActivityForDateRangeByOrganization(organizationId: string, startDate: string, endDate: string): Promise<Array<{ date: string; messageCount: number }>>;
  logMessageActivity(data: InsertMessageActivityLog): Promise<void>;

  // Integration methods
  createIntegration(data: InsertIntegration): Promise<Integration>;
  getIntegrationsByUser(userId: string, organizationId?: string): Promise<Integration[]>;
  getIntegrationsByOrganization(organizationId: string): Promise<Integration[]>;
  getRecentConnectedWhatsAppIntegrations(withinMs: number, limit?: number): Promise<Integration[]>;
  getIntegration(id: string, userId: string): Promise<Integration | undefined>;
  getIntegrationById(id: string): Promise<Integration | undefined>;
  getAllIntegrationsByName(name: string): Promise<Integration[]>;
  getIntegrationByName(name: string, userId: string, organizationId?: string): Promise<Integration | undefined>;
  getWhatsAppChatWidgetByPublicId(publicId: string): Promise<Integration | undefined>;
  updateIntegration(id: string, userId: string, data: Partial<InsertIntegration>): Promise<Integration | undefined>;
  deleteIntegration(id: string, userId: string): Promise<void>;

  createContactPaymentRequest(data: InsertContactPaymentRequest): Promise<ContactPaymentRequestRow>;
  getContactPaymentRequestByToken(token: string): Promise<ContactPaymentRequestRow | undefined>;
  getContactPaymentRequestsByOrganization(
    organizationId: string,
    options?: { contactId?: string; limit?: number }
  ): Promise<ContactPaymentRequestRow[]>;
  listContactPaymentRequestsByOrganization(
    organizationId: string,
    query: { contactId?: string; search?: string; limit: number; offset: number }
  ): Promise<{ items: ContactPaymentRequestRow[]; total: number; limit: number; offset: number }>;

  // Integration OAuth state methods
  createOAuthState(data: InsertIntegrationOAuthState): Promise<IntegrationOAuthState>;
  getOAuthState(state: string): Promise<IntegrationOAuthState | undefined>;
  getLatestActiveOAuthState(userId: string, integrationName: string): Promise<IntegrationOAuthState | undefined>;
  updateOAuthState(state: string, data: Partial<Pick<IntegrationOAuthState, "codeVerifier">>): Promise<void>;
  deleteOAuthState(state: string): Promise<void>;
  cleanupExpiredOAuthStates(): Promise<void>;

  // Automation Flows methods (flow builder)
  createAutomationFlow(data: InsertAutomationFlow): Promise<AutomationFlow>;
  getAutomationFlow(id: string, userId: string, organizationId?: string): Promise<AutomationFlow | undefined>;
  /** Public flow webhook lookup (flow id is unguessable UUID). */
  getAutomationFlowById(id: string): Promise<AutomationFlow | undefined>;
  getAutomationFlowByOrganization(id: string, organizationId: string): Promise<AutomationFlow | undefined>;
  getAutomationFlowsByUser(userId: string, organizationId?: string): Promise<AutomationFlow[]>;
  getAutomationFlowsByOrganization(organizationId: string): Promise<AutomationFlow[]>;
  listAutomationFlowsByOrganization(
    organizationId: string,
    query: {
      search?: string;
      status?: "active" | "inactive";
      sort?: "newest" | "oldest" | "name";
      limit: number;
      offset: number;
    }
  ): Promise<{ items: Pick<AutomationFlow, "id" | "name" | "status" | "createdAt" | "updatedAt">[]; total: number; limit: number; offset: number }>;
  updateAutomationFlow(id: string, userId: string, organizationId: string | undefined, data: Partial<InsertAutomationFlow>): Promise<AutomationFlow | undefined>;
  updateAutomationFlowByOrganization(id: string, organizationId: string, data: Partial<InsertAutomationFlow>): Promise<AutomationFlow | undefined>;
  deleteAutomationFlow(id: string, userId: string, organizationId?: string): Promise<void>;
  deleteAutomationFlowByOrganization(id: string, organizationId: string): Promise<void>;
  getActiveFlowsByTrigger(triggerType: string, userId?: string, organizationId?: string): Promise<AutomationFlow[]>;
  getAllActiveAutomationFlows(): Promise<AutomationFlow[]>;
  createAutomationFlowScheduledRun(data: InsertAutomationFlowScheduledRun): Promise<AutomationFlowScheduledRun>;
  claimDueAutomationFlowScheduledRuns(now: Date, limit?: number): Promise<AutomationFlowScheduledRun[]>;
  completeAutomationFlowScheduledRun(id: string): Promise<void>;
  failAutomationFlowScheduledRun(id: string, error: string): Promise<void>;
  cancelAutomationFlowScheduledRun(id: string, reason: string): Promise<void>;
  createAutomationFlowRun(data: InsertAutomationFlowRun): Promise<AutomationFlowRun>;
  getAutomationFlowRunById(id: string): Promise<AutomationFlowRun | undefined>;
  updateAutomationFlowRunStatus(
    id: string,
    status: AutomationFlowRun["status"],
    lastError?: string | null
  ): Promise<void>;
  createAutomationFlowRunLog(data: InsertAutomationFlowRunLog): Promise<AutomationFlowRunLog>;
  getAutomationFlowRunLogs(runId: string, limit?: number): Promise<AutomationFlowRunLog[]>;
  getAutomationFlowRunsByFlow(flowId: string, limit?: number): Promise<AutomationFlowRun[]>;

  // WhatsApp Flows methods
  getWhatsAppFlows(userId: string, organizationId?: string, businessAccountId?: string): Promise<WhatsAppFlow[]>;
  getWhatsAppFlowsByOrganization(organizationId: string, businessAccountId?: string): Promise<WhatsAppFlow[]>;
  listWhatsAppFlowsByOrganization(
    organizationId: string,
    query: { businessAccountId?: string; search?: string; limit: number; offset: number }
  ): Promise<{ items: WhatsAppFlow[]; total: number; limit: number; offset: number }>;
  getWhatsAppFlow(flowId: string, userId: string, organizationId?: string): Promise<WhatsAppFlow | undefined>;
  getWhatsAppFlowByOrganization(flowId: string, organizationId: string): Promise<WhatsAppFlow | undefined>;
  createWhatsAppFlow(data: InsertWhatsAppFlow): Promise<WhatsAppFlow>;
  updateWhatsAppFlow(flowId: string, userId: string, organizationId: string | undefined, data: Partial<InsertWhatsAppFlow>): Promise<WhatsAppFlow | undefined>;
  updateWhatsAppFlowByOrganization(flowId: string, organizationId: string, data: Partial<InsertWhatsAppFlow>): Promise<WhatsAppFlow | undefined>;
  deleteWhatsAppFlow(flowId: string, userId: string, organizationId?: string): Promise<void>;
  deleteWhatsAppFlowByOrganization(flowId: string, organizationId: string): Promise<void>;
  createWhatsAppFlowResponse(data: InsertWhatsAppFlowResponse): Promise<WhatsAppFlowResponse>;
  getWhatsAppFlowResponses(
    flowId: string,
    organizationId: string,
    query: { page: number; limit: number; phone?: string }
  ): Promise<{ responses: WhatsAppFlowResponse[]; total: number }>;
  getAllWhatsAppFlowResponsesForOrganization(
    organizationId: string,
    query: { page: number; limit: number; phone?: string }
  ): Promise<{ responses: WhatsAppFlowResponse[]; total: number }>;
  getWhatsAppFlowResponseByWhatsAppMessageId(
    organizationId: string,
    whatsappMessageId: string
  ): Promise<WhatsAppFlowResponse | undefined>;
  getWhatsAppFlowResponsesByPhone(
    organizationId: string,
    phone: string,
    query?: { page?: number; limit?: number }
  ): Promise<{ responses: WhatsAppFlowResponse[]; total: number }>;

  // Chatbot methods
  getChatbots(userId: string, organizationId?: string): Promise<Chatbot[]>;
  getChatbotsByOrganization(organizationId: string): Promise<Chatbot[]>;
  getChatbot(id: string, userId: string, organizationId?: string): Promise<Chatbot | undefined>;
  getChatbotByOrganization(id: string, organizationId: string): Promise<Chatbot | undefined>;
  createChatbot(data: InsertChatbot): Promise<Chatbot>;
  updateChatbot(id: string, userId: string, organizationId: string | undefined, data: Partial<InsertChatbot>): Promise<Chatbot | undefined>;
  updateChatbotByOrganization(id: string, organizationId: string, data: Partial<InsertChatbot>): Promise<Chatbot | undefined>;
  deleteChatbot(id: string, userId: string, organizationId?: string): Promise<void>;
  deleteChatbotByOrganization(id: string, organizationId: string): Promise<void>;
  getChatbotNodes(chatbotId: string): Promise<ChatbotNode[]>;
  upsertChatbotNodes(chatbotId: string, nodes: InsertChatbotNode[]): Promise<ChatbotNode[]>;
  deleteChatbotNodes(chatbotId: string): Promise<void>;
  /** After a WhatsApp number is removed, drop its session from chatbot trigger/template node data. */
  removeWhatsAppSessionFromChatbots(args: {
    sessionId: string;
    phoneNumberId?: string;
    userId: string;
    organizationId?: string;
  }): Promise<void>;

  // AI Assistant methods
  getAiAssistants(userId: string, organizationId?: string): Promise<AiAssistant[]>;
  getAiAssistantsByOrganization(organizationId: string): Promise<AiAssistant[]>;
  getAiAssistant(id: string, userId: string, organizationId?: string): Promise<AiAssistant | undefined>;
  getAiAssistantByOrganization(id: string, organizationId: string): Promise<AiAssistant | undefined>;
  createAiAssistant(data: InsertAiAssistant): Promise<AiAssistant>;
  updateAiAssistant(id: string, userId: string, organizationId: string | undefined, data: Partial<InsertAiAssistant>): Promise<AiAssistant | undefined>;
  updateAiAssistantByOrganization(id: string, organizationId: string, data: Partial<InsertAiAssistant>): Promise<AiAssistant | undefined>;
  deleteAiAssistant(id: string, userId: string, organizationId?: string): Promise<void>;
  deleteAiAssistantByOrganization(id: string, organizationId: string): Promise<void>;
  getAiAssistantKnowledgeFiles(assistantId: string): Promise<AiAssistantKnowledgeFile[]>;
  getAiAssistantKnowledgeFile(fileId: string, assistantId: string): Promise<AiAssistantKnowledgeFile | undefined>;
  addAiAssistantKnowledgeFile(data: InsertAiAssistantKnowledgeFile): Promise<AiAssistantKnowledgeFile>;
  updateAiAssistantKnowledgeFile(
    fileId: string,
    assistantId: string,
    data: Partial<Pick<InsertAiAssistantKnowledgeFile, "fileName" | "content" | "sizeBytes" | "mimeType">>
  ): Promise<AiAssistantKnowledgeFile | undefined>;
  deleteAiAssistantKnowledgeFile(fileId: string, assistantId: string): Promise<void>;

  // FAQ Bot methods (org-scoped)
  getFaqItemsByOrganization(organizationId: string): Promise<FaqItem[]>;
  getFaqItemByOrganization(id: string, organizationId: string): Promise<FaqItem | undefined>;
  createFaqItem(data: InsertFaqItem): Promise<FaqItem>;
  updateFaqItemByOrganization(id: string, organizationId: string, data: Partial<InsertFaqItem>): Promise<FaqItem | undefined>;
  deleteFaqItemByOrganization(id: string, organizationId: string): Promise<void>;
  getFaqBotSettingsByOrganization(organizationId: string): Promise<FaqBotSettings | undefined>;
  upsertFaqBotSettingsByOrganization(organizationId: string, data: Partial<InsertFaqBotSettings>): Promise<FaqBotSettings>;
  getOrganizationLiveChatSettings(organizationId: string): Promise<OrganizationLiveChatSettings | undefined>;
  upsertOrganizationLiveChatSettings(
    organizationId: string,
    data: Partial<InsertOrganizationLiveChatSettings>
  ): Promise<OrganizationLiveChatSettings>;
  getLiveChatAutoReplyState(
    organizationId: string,
    sessionId: string,
    contactNumber: string
  ): Promise<LiveChatAutoReplyState | undefined>;
  upsertLiveChatAutoReplyState(
    organizationId: string,
    sessionId: string,
    contactNumber: string,
    lastKind: string
  ): Promise<LiveChatAutoReplyState>;

  getOrganizationCommerceSettings(organizationId: string): Promise<OrganizationCommerceSettings | undefined>;
  listOrganizationCommerceSettingsWithAutoSync(): Promise<OrganizationCommerceSettings[]>;
  upsertOrganizationCommerceSettings(
    organizationId: string,
    data: Partial<InsertOrganizationCommerceSettings>
  ): Promise<OrganizationCommerceSettings>;

  getOrganizationInvoiceSettings(organizationId: string): Promise<OrganizationInvoiceSettings | undefined>;
  upsertOrganizationInvoiceSettings(
    organizationId: string,
    data: Partial<InsertOrganizationInvoiceSettings>
  ): Promise<OrganizationInvoiceSettings>;

  createOrganizationInvoice(data: InsertOrganizationInvoice): Promise<OrganizationInvoice>;
  getOrganizationInvoiceById(id: string, organizationId: string): Promise<OrganizationInvoice | undefined>;
  listOrganizationInvoices(
    organizationId: string,
    query: {
      search?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      /** When true, only invoices with amountPending > 0 (due / partially paid). */
      pendingOnly?: boolean;
      limit: number;
      offset: number;
    },
  ): Promise<{ items: OrganizationInvoice[]; total: number }>;
  updateOrganizationInvoice(
    id: string,
    organizationId: string,
    data: Partial<InsertOrganizationInvoice>,
  ): Promise<OrganizationInvoice | undefined>;
  deleteOrganizationInvoice(id: string, organizationId: string): Promise<boolean>;

  createOrganizationLead(data: InsertOrganizationLead): Promise<OrganizationLead>;
  getOrganizationLeadByPhone(organizationId: string, phoneDigits: string): Promise<OrganizationLead | undefined>;
  getOrganizationLeadById(id: string, organizationId: string): Promise<OrganizationLead | undefined>;
  listOrganizationLeads(
    organizationId: string,
    query: {
      search?: string;
      status?: string;
      priority?: string;
      category?: string;
      source?: string;
      assignedTo?: string;
      dateFrom?: string;
      dateTo?: string;
      limit: number;
      offset: number;
    },
  ): Promise<{ items: OrganizationLead[]; total: number }>;
  updateOrganizationLead(
    id: string,
    organizationId: string,
    data: Partial<InsertOrganizationLead>,
  ): Promise<OrganizationLead | undefined>;
  reorderOrganizationLeads(
    organizationId: string,
    statusSlug: string,
    orderedIds: string[],
  ): Promise<OrganizationLead[]>;
  deleteOrganizationLead(id: string, organizationId: string): Promise<boolean>;
  deleteOrganizationLeads(ids: string[], organizationId: string): Promise<number>;

  listOrganizationLeadStatuses(organizationId: string): Promise<OrganizationLeadStatus[]>;
  getOrganizationLeadStatusById(id: string, organizationId: string): Promise<OrganizationLeadStatus | undefined>;
  getOrganizationLeadStatusBySlug(organizationId: string, slug: string): Promise<OrganizationLeadStatus | undefined>;
  createOrganizationLeadStatus(data: InsertOrganizationLeadStatus): Promise<OrganizationLeadStatus>;
  updateOrganizationLeadStatus(
    id: string,
    organizationId: string,
    data: Partial<InsertOrganizationLeadStatus>,
  ): Promise<OrganizationLeadStatus | undefined>;
  deleteOrganizationLeadStatus(id: string, organizationId: string): Promise<boolean>;
  reorderOrganizationLeadStatuses(organizationId: string, orderedIds: string[]): Promise<OrganizationLeadStatus[]>;
  countLeadsByStatusSlug(organizationId: string, slug: string): Promise<number>;

  // Canned messages (org-scoped; sync across devices)
  getCannedMessagesByOrganization(organizationId: string): Promise<CannedMessageRow[]>;
  getCannedMessageByOrganization(id: string, organizationId: string): Promise<CannedMessageRow | undefined>;
  createCannedMessage(data: InsertCannedMessage): Promise<CannedMessageRow>;
  updateCannedMessageByOrganization(id: string, organizationId: string, data: Partial<InsertCannedMessage>): Promise<CannedMessageRow | undefined>;
  deleteCannedMessageByOrganization(id: string, organizationId: string): Promise<void>;

  /** Whitelabel: single-row upstream master settings (SaaS owner). */
  getPlatformMasterSettings(): Promise<PlatformMasterSettingsRow | undefined>;
  getActivePanelTemplateId(): Promise<string>;
  setActivePanelTemplateId(panelTemplateId: string): Promise<PlatformMasterSettingsRow>;
  setSubscriptionDataRetentionMonths(months: 1 | 2 | 3): Promise<PlatformMasterSettingsRow>;
  clearUserSubscriptionDataPurgedAt(userId: string): Promise<void>;
  recordPlatformMasterUpstreamSync(
    upstreamPayload: Record<string, unknown>,
    lastSyncStatus: string,
    lastSyncError: string | null
  ): Promise<PlatformMasterSettingsRow>;
  countUsersCreatedBefore(createdAt: Date, userId: string): Promise<number>;
  countOnboardingBillableUsersCreatedBefore(createdAt: Date, userId: string): Promise<number>;
  userOwnsAnyOrganization(userId: string): Promise<boolean>;
  listOnboardingBillableEndCustomerUsers(): Promise<User[]>;
  clearAllWhitelabelOnboardingBillingData(): Promise<{ feesDeleted: number; settlementsDeleted: number }>;
  clearUnpaidWhitelabelOnboardingFees(): Promise<{ feesDeleted: number; feesPreserved: number }>;
  resetOnboardingSchedulesForRecalculate(): Promise<void>;
  getOnboardingFeesRecalculateUsedAt(): Promise<string | null>;
  markOnboardingFeesRecalculateUsed(): Promise<void>;
  insertWhitelabelOnboardingFee(data: InsertWhitelabelOnboardingFee): Promise<WhitelabelOnboardingFeeRow>;
  listWhitelabelOnboardingFeesForUser(userId: string): Promise<WhitelabelOnboardingFeeRow[]>;
  getWhitelabelOnboardingFeesForAdmin(filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ fees: (WhitelabelOnboardingFeeRow & { user?: User })[]; total: number }>;
  setWhitelabelOnboardingFeeGatewayOrder(ids: string[], gatewayOrderId: string): Promise<void>;
  markWhitelabelOnboardingFeesPaid(
    ids: string[],
    gatewayPaymentId: string,
    meta?: { paymentGateway: "razorpay" | "cashfree"; gatewayPayload?: Record<string, unknown> | null }
  ): Promise<void>;
  getWhitelabelOnboardingFeesByGatewayOrderId(orderId: string): Promise<WhitelabelOnboardingFeeRow[]>;
  getWhitelabelOnboardingFeesByIds(ids: string[]): Promise<WhitelabelOnboardingFeeRow[]>;
  /** Sum of amount_minor for pending + failed onboarding fee rows (unpaid licensor bill). */
  getTotalOutstandingWhitelabelOnboardingMinor(): Promise<number>;
  insertWhitelabelOnboardingSettlement(
    data: InsertWhitelabelOnboardingSettlement
  ): Promise<WhitelabelOnboardingSettlementRow>;
  getWhitelabelOnboardingSettlementByGatewayOrderId(
    gatewayOrderId: string
  ): Promise<WhitelabelOnboardingSettlementRow | undefined>;
  markWhitelabelOnboardingSettlementPaid(
    gatewayOrderId: string,
    gatewayPaymentId: string,
    paidPayload: Record<string, unknown> | null
  ): Promise<void>;
  getWhitelabelOnboardingSettlementsForAdmin(filters?: {
    limit?: number;
    offset?: number;
  }): Promise<{ settlements: WhitelabelOnboardingSettlementRow[]; total: number }>;
  /** Users who need onboarding schedule init or a monthly fee row (active accounts only). */
  getUsersDueForWhitelabelOnboardingMonthly(before: Date): Promise<User[]>;
  updateUserOnboardingSchedule(
    userId: string,
    data: { onboardingNextChargeAt?: Date | null; onboardingMonthlyWaived?: boolean }
  ): Promise<void>;
  // Support tickets (per organization)
  getSupportTicketById(id: string): Promise<SupportTicket | undefined>;
  getSupportTicketByIdForOrganization(id: string, organizationId: string): Promise<SupportTicket | undefined>;
  getSupportTicketByAccessToken(accessToken: string): Promise<SupportTicket | undefined>;
  listSupportTicketsForOrganization(organizationId: string): Promise<SupportTicket[]>;
  listAllSupportTickets(): Promise<SupportTicket[]>;
  listSupportTicketsForCustomer(userId: string, emailLower: string): Promise<SupportTicket[]>;
  createSupportTicketRow(data: InsertSupportTicket): Promise<SupportTicket>;
  createSupportMessageRow(data: InsertSupportMessage): Promise<SupportMessage>;
  createSupportAttachmentRow(data: InsertSupportAttachment): Promise<SupportAttachment>;
  updateSupportTicketByOrganization(
    id: string,
    organizationId: string,
    data: Partial<
      Pick<
        SupportTicket,
        | "status"
        | "assignedToUserId"
        | "updatedAt"
        | "transferredToTechnical"
        | "transferredToTechnicalAt"
        | "technicalTicketId"
      >
    >
  ): Promise<SupportTicket | undefined>;
  updateSupportTicketById(
    id: string,
    data: Partial<
      Pick<
        SupportTicket,
        | "status"
        | "assignedToUserId"
        | "updatedAt"
        | "transferredToTechnical"
        | "transferredToTechnicalAt"
        | "technicalTicketId"
      >
    >
  ): Promise<SupportTicket | undefined>;
  getSupportMessagesByTicketId(ticketId: string): Promise<SupportMessage[]>;
  getSupportAttachmentsByTicketId(ticketId: string): Promise<SupportAttachment[]>;
  getSupportAttachmentsByMessageIds(messageIds: string[]): Promise<SupportAttachment[]>;
  createSupportTicketWithInitialMessage(
    input: {
      organizationId: string;
      accessToken: string;
      subject: string;
      description: string;
      customerEmail: string;
      customerName: string;
      customerPhone?: string | null;
      customerUserId?: string | null;
    },
    attachment?: {
      fileName: string;
      filePath: string;
      mimeType: string;
      sizeBytes: number;
    }
  ): Promise<{ ticket: SupportTicket; firstMessage: SupportMessage; attachment?: SupportAttachment }>;
}

function buildManagedContactFilterConditions(
  organizationId: string,
  filters: ManagedContactFilters,
  options?: { userId?: string }
) {
  const conditions = options?.userId
    ? [eq(managedContacts.userId, options.userId), eq(managedContacts.organizationId, organizationId)]
    : [eq(managedContacts.organizationId, organizationId)];

  if (filters.search?.trim()) {
    const raw = filters.search.trim();
    const q = `%${raw.replace(/%/g, "\\%")}%`;
    const digitOnly = raw.replace(/\D/g, "");
    const searchParts = [
      ilike(managedContacts.name, q),
      ilike(managedContacts.phoneNumber, q),
      sql`(COALESCE(${managedContacts.email}, '')::text ILIKE ${q})`,
    ];
    if (digitOnly.length > 0) {
      const digitQ = `%${digitOnly}%`;
      searchParts.push(
        sql`regexp_replace(coalesce(${managedContacts.phoneNumber}, ''), '[^0-9]', '', 'g') ILIKE ${digitQ}`
      );
    }
    conditions.push(or(...searchParts)!);
  }
  if (filters.email?.trim()) {
    const emailQ = `%${filters.email.trim().replace(/%/g, "\\%")}%`;
    conditions.push(sql`(COALESCE(${managedContacts.email}, '')::text ILIKE ${emailQ})`);
  }
  if (filters.createdDateFrom) conditions.push(gte(managedContacts.createdAt, new Date(filters.createdDateFrom)));
  if (filters.createdDateTo) {
    const to = new Date(filters.createdDateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(managedContacts.createdAt, to));
  }
  if (filters.updatedDateFrom) conditions.push(gte(managedContacts.updatedAt, new Date(filters.updatedDateFrom)));
  if (filters.updatedDateTo) {
    const to = new Date(filters.updatedDateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(managedContacts.updatedAt, to));
  }
  if (filters.source) conditions.push(eq(managedContacts.source ?? "manual", filters.source));
  if (filters.unassignedOnly) {
    conditions.push(
      or(
        sql`${managedContacts.customFields}->>'assignedTo' IS NULL`,
        sql`${managedContacts.customFields}->>'assignedTo' = ''`
      )!
    );
  }
  if (filters.assignedTo?.length) {
    conditions.push(or(...filters.assignedTo.map((id) => sql`${managedContacts.customFields}->>'assignedTo' = ${id}`))!);
  }
  if (filters.assignedDateFrom) {
    conditions.push(sql`(${managedContacts.customFields}->>'assignedAt')::timestamptz >= ${new Date(filters.assignedDateFrom)}`);
  }
  if (filters.assignedDateTo) {
    const to = new Date(filters.assignedDateTo);
    to.setDate(to.getDate() + 1);
    conditions.push(sql`(${managedContacts.customFields}->>'assignedAt')::timestamptz < ${to}`);
  }
  if (filters.reminderDateFrom) {
    conditions.push(sql`(${managedContacts.customFields}->>'reminderDate')::date >= ${filters.reminderDateFrom}`);
  }
  if (filters.reminderDateTo) {
    conditions.push(sql`(${managedContacts.customFields}->>'reminderDate')::date <= ${filters.reminderDateTo}`);
  }
  if (filters.optInStatus && filters.optInStatus !== "all") {
    if (filters.optInStatus === "opted_in") {
      conditions.push(sql`${managedContacts.customFields}->>'optIn' = 'true'`);
    } else {
      conditions.push(or(sql`${managedContacts.customFields}->>'optIn' IS NULL`, sql`${managedContacts.customFields}->>'optIn' != 'true'`)!);
    }
  }
  if (filters.duplicate && filters.duplicate !== "all") {
    if (filters.duplicate === "duplicates") {
      conditions.push(sql`${managedContacts.customFields}->>'isDuplicate' = 'true'`);
    } else {
      conditions.push(or(sql`${managedContacts.customFields}->>'isDuplicate' IS NULL`, sql`${managedContacts.customFields}->>'isDuplicate' != 'true'`)!);
    }
  }
  if (filters.customFieldFilters && Object.keys(filters.customFieldFilters).length > 0) {
    for (const [columnId, searchVal] of Object.entries(filters.customFieldFilters)) {
      if (typeof searchVal !== "string" || !searchVal.trim()) continue;
      const q = `%${searchVal.trim().replace(/%/g, "\\%")}%`;
      conditions.push(sql`(${managedContacts.customFields}->>${columnId})::text ILIKE ${q}`);
    }
  }
  if (filters.tagIds?.length) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${contactTagAssignments} cta
        INNER JOIN ${contactTags} ct ON ct.id = cta.tag_id
        WHERE cta.contact_id = ${managedContacts.id}
        AND ct.organization_id = ${organizationId}
        AND cta.tag_id IN (${sql.join(filters.tagIds.map((id) => sql`${id}`), sql`, `)})
      )`
    );
  }
  if (filters.noTagsOnly) {
    conditions.push(
      sql`NOT EXISTS (
        SELECT 1 FROM ${contactTagAssignments} cta
        INNER JOIN ${contactTags} ct ON ct.id = cta.tag_id
        WHERE cta.contact_id = ${managedContacts.id}
        AND ct.organization_id = ${organizationId}
      )`
    );
  }

  return conditions;
}

class PostgresStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getSaasOwnerUser(): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.isSaaSOwner, true))
      .limit(1);
    return user;
  }

  async getSaasOwnerRazorpayForOrgSubscription(): Promise<Integration | undefined> {
    const owner = await this.getSaasOwnerUser();
    if (!owner) return undefined;
    const list = await this.getIntegrationsByUser(owner.id);
    const candidates = list.filter(
      (i) =>
        i.name === "razorpay" &&
        i.status === "connected" &&
        (i.config as Record<string, unknown> | null | undefined)?.useForOrgSubscription === true
    );
    return candidates[0];
  }

  async getSaasOwnerStripeForOrgSubscription(): Promise<Integration | undefined> {
    const owner = await this.getSaasOwnerUser();
    if (!owner) return undefined;
    const list = await this.getIntegrationsByUser(owner.id);
    const candidates = list.filter(
      (i) =>
        i.name === "stripe" &&
        i.status === "connected" &&
        (i.config as Record<string, unknown> | null | undefined)?.useForOrgSubscription === true
    );
    return candidates[0];
  }

  async getSaasOwnerSmtpIntegration(): Promise<Integration | undefined> {
    const owner = await this.getSaasOwnerUser();
    if (!owner) return undefined;
    const list = await this.getIntegrationsByUser(owner.id);
    const smtps = list.filter((i) => i.name === "smtp" && i.status === "connected" && i.credentials);
    smtps.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return smtps[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // API Key methods
  async createApiKey(data: InsertApiKey): Promise<ApiKey> {
    const [apiKey] = await db.insert(apiKeys).values(data).returning();
    return apiKey;
  }

  async getApiKeysByUser(userId: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async getApiKeyByKey(key: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.key, key))
      .limit(1);
    return apiKey;
  }

  async deleteApiKey(id: string): Promise<void> {
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ lastUsed: new Date() })
      .where(eq(apiKeys.id, id));
  }

  // Session methods
  async createSession(data: InsertWhatsappSession): Promise<WhatsappSession> {
    const [session] = await db.insert(whatsappSessions).values(data as any).returning();
    return session;
  }

  async getSession(sessionId: string): Promise<WhatsappSession | undefined> {
    const [session] = await db
      .select()
      .from(whatsappSessions)
      .where(eq(whatsappSessions.sessionId, sessionId))
      .limit(1);
    return session;
  }

  async getSessionsBySessionIds(sessionIds: string[]): Promise<WhatsappSession[]> {
    const ids = [...new Set(sessionIds.filter(Boolean))];
    if (ids.length === 0) return [];
    return db.select().from(whatsappSessions).where(inArray(whatsappSessions.sessionId, ids));
  }

  async getAllSessions(): Promise<WhatsappSession[]> {
    return await db
      .select()
      .from(whatsappSessions)
      .orderBy(desc(whatsappSessions.createdAt));
  }

  async getSessionsByUser(userId: string): Promise<WhatsappSession[]> {
    return await db
      .select()
      .from(whatsappSessions)
      .where(eq(whatsappSessions.userId, userId))
      .orderBy(desc(whatsappSessions.createdAt));
  }

  async getSessionsByOrganization(organizationId: string): Promise<WhatsappSession[]> {
    const org = await this.getOrganization(organizationId);
    const scoped = await db
      .select()
      .from(whatsappSessions)
      .where(
        or(
          eq(whatsappSessions.organizationId, organizationId),
          org?.ownerId
            ? and(isNull(whatsappSessions.organizationId), eq(whatsappSessions.userId, org.ownerId))
            : sql`false`
        )
      )
      .orderBy(desc(whatsappSessions.createdAt));
    return scoped;
  }

  async getOfficialSessionsByApiPhoneNumberId(apiPhoneNumberId: string): Promise<WhatsappSession[]> {
    if (!apiPhoneNumberId) return [];
    return await db
      .select()
      .from(whatsappSessions)
      .where(
        and(
          eq(whatsappSessions.connectionType, "official"),
          sql`${whatsappSessions.deviceInfo}->>'apiPhoneNumberId' = ${apiPhoneNumberId}`
        )
      )
      .orderBy(desc(whatsappSessions.createdAt));
  }

  async getOfficialSessionsByWabaId(wabaId: string): Promise<WhatsappSession[]> {
    const id = String(wabaId || "").trim();
    if (!id) return [];
    return await db
      .select()
      .from(whatsappSessions)
      .where(
        and(
          eq(whatsappSessions.connectionType, "official"),
          isNull(whatsappSessions.deletedAt),
          or(
            sql`${whatsappSessions.deviceInfo}->>'wabaId' = ${id}`,
            sql`${whatsappSessions.deviceInfo}->>'businessAccountId' = ${id}`
          )
        )
      )
      .orderBy(desc(whatsappSessions.createdAt));
  }

  async countConnectedSessions(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappSessions)
      .where(and(eq(whatsappSessions.status, "connected"), isNull(whatsappSessions.deletedAt)));
    return row?.count ?? 0;
  }

  async getOfficialSessionsForWebhook(
    phoneNumberId: string,
    displayPhoneNumber?: string
  ): Promise<WhatsappSession[]> {
    const phoneIdStr = String(phoneNumberId || "").trim();
    if (!phoneIdStr) return [];

    let rows = await db
      .select()
      .from(whatsappSessions)
      .where(
        and(
          eq(whatsappSessions.connectionType, "official"),
          isNull(whatsappSessions.deletedAt),
          or(
            sql`${whatsappSessions.deviceInfo}->>'apiPhoneNumberId' = ${phoneIdStr}`,
            sql`${whatsappSessions.deviceInfo}->>'phoneNumberId' = ${phoneIdStr}`
          )
        )
      )
      .orderBy(desc(whatsappSessions.createdAt));

    if (rows.length === 0 && displayPhoneNumber) {
      const displayNorm = displayPhoneNumber.replace(/\D/g, "");
      if (displayNorm) {
        rows = await db
          .select()
          .from(whatsappSessions)
          .where(
            and(
              eq(whatsappSessions.connectionType, "official"),
              isNull(whatsappSessions.deletedAt),
              or(
                sql`regexp_replace(COALESCE(${whatsappSessions.deviceInfo}->>'displayPhoneNumber', ''), '\\D', '', 'g') = ${displayNorm}`,
                sql`regexp_replace(COALESCE(${whatsappSessions.deviceInfo}->>'phoneNumber', ''), '\\D', '', 'g') = ${displayNorm}`
              )
            )
          )
          .orderBy(desc(whatsappSessions.createdAt));
      }
    }

    return rows;
  }

  async updateSession(sessionId: string, data: Partial<InsertWhatsappSession>): Promise<WhatsappSession | undefined> {
    const [updated] = await db
      .update(whatsappSessions)
      .set({ ...data, lastActive: new Date() } as any)
      .where(eq(whatsappSessions.sessionId, sessionId))
      .returning();
    return updated;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await db
      .delete(whatsappSessions)
      .where(eq(whatsappSessions.sessionId, sessionId));
  }

  // Contact methods
  async createContact(data: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(data).returning();
    return contact;
  }

  async getContactsBySession(sessionId: string): Promise<Contact[]> {
    return await db
      .select()
      .from(contacts)
      .where(eq(contacts.sessionId, sessionId));
  }

  // Chat methods
  async createChat(data: InsertChat): Promise<Chat> {
    const [chat] = await db.insert(chats).values(data).returning();
    return chat;
  }

  async getChatsBySession(sessionId: string): Promise<Chat[]> {
    return await db
      .select()
      .from(chats)
      .where(eq(chats.sessionId, sessionId))
      .orderBy(desc(chats.lastMessageTime));
  }

  async getChat(chatId: string): Promise<Chat | undefined> {
    const [chat] = await db
      .select()
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);
    return chat;
  }

  async updateChat(chatId: string, data: Partial<InsertChat>): Promise<Chat | undefined> {
    const [updated] = await db
      .update(chats)
      .set(data)
      .where(eq(chats.id, chatId))
      .returning();
    return updated;
  }

  // Message methods
  async createMessage(data: InsertMessage): Promise<Message> {
    // organizationId is now supported in the messages table
    // Filter to only include valid fields
    const cleanData: any = {};
    const validFields = [
      'sessionId', 'chatId', 'organizationId', 'body', 'fromMe', 'type', 'status', 'mediaUrl',
      'senderName', 'senderNumber', 'latitude', 'longitude', 'address', 'vcard',
      'footer', 'footerButtonType', 'footerButtonText', 'footerButtonUrl', 'footerButtonPhone',
      'whatsappMessageId', 'campaignId', 'timestamp', 'sentAt', 'deliveredAt', 'readAt', 'failedAt',
      'errorMessage', 'errorCode', 'templateName', 'templateLanguage', 'templateType',
      'headerText', 'templateParams', 'carouselCardMediaUrls', 'reactions',
      'replyToMessageId', 'quotedBody', 'quotedFromMe'
    ];
    
    for (const field of validFields) {
      if (field in data) {
        cleanData[field] = (data as any)[field];
      }
    }
    
    try {
      const [message] = await db.insert(messages).values(cleanData as InsertMessage).returning();
      return message;
    } catch (error: any) {
      console.error('[Storage] createMessage: Database error:', error);
      console.error('[Storage] createMessage: Error message:', error.message);
      console.error('[Storage] createMessage: Error code:', error.code);
      console.error('[Storage] createMessage: Error detail:', error.detail);
      console.error('[Storage] createMessage: Clean data keys:', Object.keys(cleanData));
      console.error('[Storage] createMessage: Clean data sample:', {
        sessionId: cleanData.sessionId,
        chatId: cleanData.chatId,
        body: cleanData.body?.substring(0, 50),
        type: cleanData.type,
        hasOrganizationId: 'organizationId' in cleanData,
      });
      
      // If the error mentions organization_id, it's likely a database trigger or view
      if (error.message?.includes('organization_id') || error.message?.includes('organizationId')) {
        console.error('[Storage] createMessage: ⚠️  ERROR MENTIONS organization_id!');
        console.error('[Storage] createMessage: This suggests a database trigger, view, or function is trying to access organization_id');
        console.error('[Storage] createMessage: Please run: migrations/check_database_triggers.sql to diagnose');
      }
      
      throw error;
    }
  }

  async getMessagesByChat(chatId: string, limit?: number): Promise<Message[]> {
    if (limit != null && limit > 0) {
      // Fetch last N messages (most recent) to reduce memory - return chronological
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, chatId))
        .orderBy(desc(messages.timestamp))
        .limit(limit);
      return rows.reverse();
    }
    return await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.timestamp);
  }

  async getMessagesByChatBeforeCursor(
    chatId: string,
    cursorTimestamp: Date,
    cursorId: string,
    limit: number
  ): Promise<Message[]> {
    const rows = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.chatId, chatId),
          sql`(${messages.timestamp}, ${messages.id}) < (${cursorTimestamp}::timestamptz, ${cursorId})`
        )
      )
      .orderBy(desc(messages.timestamp), desc(messages.id))
      .limit(limit);
    return rows.reverse();
  }

  async getLatestInboundMessageTimestamp(chatId: string): Promise<Date | null> {
    const [row] = await db
      .select({ timestamp: messages.timestamp })
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.fromMe, false)))
      .orderBy(desc(messages.timestamp))
      .limit(1);
    if (!row?.timestamp) return null;
    const t = row.timestamp;
    return t instanceof Date ? t : new Date(t as string);
  }

  async countUnreadInboundMessages(chatId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.chatId, chatId),
          eq(messages.fromMe, false),
          sql`${messages.status} NOT IN ('read', 'seen', 'failed')`
        )
      );
    return Number(row?.count ?? 0);
  }

  async countUnreadInboundByChatIds(chatIds: string[]): Promise<Map<string, number>> {
    if (!chatIds.length) return new Map();
    const rows = await db
      .select({
        chatId: messages.chatId,
        count: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(
        and(
          inArray(messages.chatId, chatIds),
          eq(messages.fromMe, false),
          sql`${messages.status} NOT IN ('read', 'seen', 'failed')`
        )
      )
      .groupBy(messages.chatId);
    return new Map(rows.map((r) => [r.chatId, Number(r.count ?? 0)]));
  }

  async markInboundMessagesReadInChat(chatId: string): Promise<number> {
    const now = new Date();
    const updated = await db
      .update(messages)
      .set({ status: "read", readAt: now })
      .where(
        and(
          eq(messages.chatId, chatId),
          eq(messages.fromMe, false),
          sql`${messages.status} NOT IN ('read', 'seen', 'failed')`
        )
      )
      .returning({ id: messages.id });
    return updated.length;
  }

  async countMessagesInChat(chatId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(eq(messages.chatId, chatId));
    return Number(row?.count ?? 0);
  }

  async getLatestMessageTimestamp(chatId: string): Promise<Date | null> {
    const [row] = await db
      .select({ timestamp: messages.timestamp })
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(desc(messages.timestamp))
      .limit(1);
    if (!row?.timestamp) return null;
    const t = row.timestamp;
    return t instanceof Date ? t : new Date(t as string);
  }

  async getMessageByIdOrWhatsAppId(messageId: string, userId: string, sessionId?: string): Promise<Message | undefined> {
    const userSessions = await db
      .select({ sessionId: whatsappSessions.sessionId })
      .from(whatsappSessions)
      .where(eq(whatsappSessions.userId, userId));
    const sessionIds = userSessions.map((s) => s.sessionId);
    if (sessionIds.length === 0) return undefined;

    const conditions = [
      or(eq(messages.id, messageId), eq(messages.whatsappMessageId, messageId)),
      inArray(messages.sessionId, sessionIds),
    ];
    if (sessionId) {
      conditions.push(eq(messages.sessionId, sessionId));
    }
    const [msg] = await db
      .select()
      .from(messages)
      .where(and(...conditions))
      .limit(1);
    return msg;
  }

  async getMessageByWhatsAppIdInChat(chatId: string, whatsappMessageId: string): Promise<Message | undefined> {
    const [msg] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.whatsappMessageId, whatsappMessageId)))
      .limit(1);
    return msg;
  }

  async hasInboundMessagesInChat(chatId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.fromMe, false)))
      .limit(1);
    return !!row;
  }

  async getRecentOutboundMessageForSession(
    sessionId: string,
    withinMinutes = 10
  ): Promise<Message | undefined> {
    const since = new Date(Date.now() - withinMinutes * 60 * 1000);
    const [msg] = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.sessionId, sessionId),
          eq(messages.fromMe, true),
          gte(messages.timestamp, since)
        )
      )
      .orderBy(desc(messages.timestamp))
      .limit(1);
    return msg;
  }

  async getMessagesByCampaignId(sessionId: string, campaignId: string): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(and(eq(messages.sessionId, sessionId), eq(messages.campaignId, campaignId)));
  }

  async countMessagesInSession(sessionId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(eq(messages.sessionId, sessionId));
    return row?.count ?? 0;
  }

  async countCampaignDeliveriesSince(
    sessionId: string,
    campaignId: string,
    since: Date
  ): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.sessionId, sessionId),
          eq(messages.campaignId, campaignId),
          isNotNull(messages.whatsappMessageId),
          isNotNull(messages.deliveredAt),
          gte(messages.deliveredAt, since)
        )
      );
    return row?.count ?? 0;
  }

  async updateMessage(messageId: string, data: Partial<InsertMessage>): Promise<Message | undefined> {
    const [updated] = await db
      .update(messages)
      .set(data)
      .where(eq(messages.id, messageId))
      .returning();
    return updated;
  }

  async updateMessageStatus(messageId: string, status: Message['status'], errorMessage?: string, errorCode?: string): Promise<Message | undefined> {
    const updateData: any = { status };
    
    // Set timestamps based on status
    const now = new Date();
    if (status === 'sent') {
      updateData.sentAt = now;
    } else if (status === 'delivered') {
      updateData.deliveredAt = now;
    } else if (status === 'read') {
      updateData.readAt = now;
    } else if (status === 'failed') {
      updateData.failedAt = now;
      if (errorMessage) updateData.errorMessage = errorMessage;
      if (errorCode) updateData.errorCode = errorCode;
    }
    
    const [updated] = await db
      .update(messages)
      .set(updateData)
      .where(eq(messages.id, messageId))
      .returning();
    return updated;
  }

  // Webhook methods
  async createWebhook(data: InsertWebhook): Promise<Webhook> {
    const [webhook] = await db.insert(webhooks).values(data as any).returning();
    return webhook;
  }

  async getWebhooksByUser(userId: string, organizationId?: string): Promise<Webhook[]> {
    return await db
      .select()
      .from(webhooks)
      .where(
        organizationId
          ? and(eq(webhooks.userId, userId), eq(webhooks.organizationId, organizationId))
          : eq(webhooks.userId, userId)
      )
      .orderBy(desc(webhooks.createdAt));
  }

  async getWebhooksByOrganization(organizationId: string): Promise<Webhook[]> {
    if (!organizationId) return [];
    return await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.organizationId, organizationId))
      .orderBy(desc(webhooks.createdAt));
  }

  async listWebhooksByOrganization(
    organizationId: string,
    query: { search?: string; limit: number; offset: number }
  ) {
    if (!organizationId) {
      return { items: [], total: 0, limit: query.limit, offset: query.offset };
    }
    const conditions = [eq(webhooks.organizationId, organizationId)];
    if (query.search?.trim()) {
      const q = `%${query.search.trim().replace(/%/g, "\\%")}%`;
      conditions.push(ilike(webhooks.url, q));
    }
    const whereClause = and(...conditions);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(webhooks)
      .where(whereClause);
    const items = await db
      .select()
      .from(webhooks)
      .where(whereClause)
      .orderBy(desc(webhooks.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, total: Number(count) || 0, limit: query.limit, offset: query.offset };
  }

  async getWebhook(id: string): Promise<Webhook | undefined> {
    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);
    return webhook;
  }

  async getActiveWebhooksByUserAndEvent(userId: string, event: string): Promise<Webhook[]> {
    const allWebhooks = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.userId, userId),
          eq(webhooks.status, 'active')
        )
      );
    
    // Filter webhooks that listen to this event (exact match, "messages" = all message.*, "contacts" = all contact.*, "app_events" = all app integration events)
    return allWebhooks.filter(webhook => {
      if (!webhook.events || webhook.events.length === 0) return false;
      if (webhook.events.includes(event as any)) return true;
      if (event.startsWith('message.') && webhook.events.includes('messages' as any)) return true;
      if (event.startsWith('form.') && webhook.events.includes('forms' as any)) return true;
      if (event.startsWith('contact.') && webhook.events.includes('contacts' as any)) return true;
      if ((event.startsWith('calendly.') || event.startsWith('google_calendar.') || event.startsWith('shopify.') || event.startsWith('facebook_lead_ads.')) && webhook.events.includes('app_events' as any)) return true;
      return false;
    });
  }

  async updateWebhook(id: string, data: Partial<InsertWebhook>): Promise<Webhook | undefined> {
    const [updated] = await db
      .update(webhooks)
      .set(data as any)
      .where(eq(webhooks.id, id))
      .returning();
    return updated;
  }

  async deleteWebhook(id: string): Promise<void> {
    await db.delete(webhooks).where(eq(webhooks.id, id));
  }

  async updateWebhookLastTriggered(id: string): Promise<void> {
    await db
      .update(webhooks)
      .set({ lastTriggeredAt: new Date() })
      .where(eq(webhooks.id, id));
  }

  async incrementWebhookFailureCount(id: string): Promise<void> {
    const webhook = await this.getWebhook(id);
    if (webhook) {
      const newCount = (webhook.failureCount || 0) + 1;
      await db
        .update(webhooks)
        .set({ 
          failureCount: newCount,
          // Disable webhook after 10 consecutive failures
          status: newCount >= 10 ? 'inactive' : webhook.status
        })
        .where(eq(webhooks.id, id));
    }
  }

  async resetWebhookFailureCount(id: string): Promise<void> {
    await db
      .update(webhooks)
      .set({ failureCount: 0 })
      .where(eq(webhooks.id, id));
  }

  // Plan methods
  async createPlan(data: InsertPlan): Promise<Plan> {
    const [plan] = await db.insert(plans).values(data).returning();
    return plan;
  }

  async getAllPlans(): Promise<Plan[]> {
    const rows = await db.select().from(plans).orderBy(plans.priceMonthly);
    // System Free / default first so it is always visible in Admin → Plans
    return rows.sort((a, b) => {
      const aSys = (a as any).isSystemDefault ? 0 : 1;
      const bSys = (b as any).isSystemDefault ? 0 : 1;
      if (aSys !== bSys) return aSys - bSys;
      return (a.priceMonthly ?? 0) - (b.priceMonthly ?? 0);
    });
  }

  /** Active plans shown on /billing and checkout: published (or legacy null status) and active. */
  async getActivePlans(): Promise<Plan[]> {
    return await db
      .select()
      .from(plans)
      .where(
        and(
          eq(plans.isActive, true),
          or(eq(plans.status, "published"), isNull(plans.status))
        )
      )
      .orderBy(plans.priceMonthly);
  }

  async getPlan(id: string): Promise<Plan | undefined> {
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, id))
      .limit(1);
    return plan;
  }

  async getAutoAssignPlan(): Promise<Plan | undefined> {
    const all = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(plans.priceMonthly);
    // Prefer locked system Free plan (default for every new signup)
    const systemDefault = all.find((p: any) => p.isSystemDefault === true);
    if (systemDefault) return systemDefault;
    const autoPlan = all.find((p: any) => p.autoAssignOnSignup === true);
    return autoPlan ?? undefined;
  }

  async updatePlan(id: string, data: Partial<InsertPlan>): Promise<Plan | undefined> {
    const [updated] = await db
      .update(plans)
      .set(data)
      .where(eq(plans.id, id))
      .returning();
    return updated;
  }

  async deletePlan(id: string): Promise<void> {
    // Remove subscription_history rows that reference this plan so the FK constraint doesn't block deletion
    await db.delete(subscriptionHistory).where(eq(subscriptionHistory.planId, id));
    // Prevent deleting a plan that is still in use by active subscriptions
    const [sub] = await db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.planId, id)).limit(1);
    if (sub) {
      throw new Error("Cannot delete plan: it is referenced by active subscriptions. Remove or reassign those subscriptions first.");
    }
    await db.delete(plans).where(eq(plans.id, id));
  }

  async isPlanInUse(id: string): Promise<boolean> {
    const [sub] = await db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.planId, id)).limit(1);
    if (sub) return true;
    const [hist] = await db.select({ id: subscriptionHistory.id }).from(subscriptionHistory).where(eq(subscriptionHistory.planId, id)).limit(1);
    return !!hist;
  }

  // Subscription methods
  async createSubscription(data: InsertSubscription): Promise<Subscription> {
    const [subscription] = await db.insert(subscriptions).values(data).returning();
    if (data.userId && data.status === "active") {
      await this.clearUserSubscriptionDataPurgedAt(data.userId);
    }
    return subscription;
  }

  async getSubscriptionByUser(userId: string): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    return subscription;
  }

  /** Active subscription for usage limits: status active and period end date still after “today” on the business calendar (default IST). */
  async getActiveSubscriptionByUser(userId: string): Promise<Subscription | undefined> {
    const now = new Date();
    const rows = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
      .orderBy(desc(subscriptions.createdAt))
      .limit(8);
    return rows.find((r) => isSubscriptionPeriodActiveByCalendarDay(r.currentPeriodEnd, now));
  }

  /** For team members: returns owner's subscription and effectiveUserId (for usage). For owners: returns own subscription. */
  async getEffectiveActiveSubscription(userId: string): Promise<{ subscription: Subscription | undefined; effectiveUserId: string }> {
    const own = await this.getActiveSubscriptionByUser(userId);
    if (own) return { subscription: own, effectiveUserId: userId };
    const orgs = await this.getOrganizationsByUser(userId);
    for (const org of orgs) {
      const ownerSub = await this.getActiveSubscriptionByUser(org.ownerId);
      if (ownerSub) return { subscription: ownerSub, effectiveUserId: org.ownerId };
    }
    return { subscription: undefined, effectiveUserId: userId };
  }

  async getSubscriptionsByUser(userId: string): Promise<Subscription[]> {
    return await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));
  }

  async cancelOtherSubscriptionsForUser(userId: string, keepSubscriptionId: string): Promise<void> {
    await db
      .update(subscriptions)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(
        eq(subscriptions.userId, userId),
        ne(subscriptions.id, keepSubscriptionId)
      ));
  }

  async updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const [updated] = await db
      .update(subscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    if (updated?.userId && data.status === "active") {
      await this.clearUserSubscriptionDataPurgedAt(updated.userId);
    }
    return updated;
  }

  // Payment methods
  async createPayment(data: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(data).returning();
    return payment;
  }

  async getPaymentsByUser(userId: string): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt));
  }

  async getPaymentsBySubscription(subscriptionId: string): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.subscriptionId, subscriptionId))
      .orderBy(desc(payments.createdAt));
  }

  async getPendingSaasPaymentByGatewayOrderId(gatewayOrderId: string): Promise<Payment | undefined> {
    const [row] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.gatewayOrderId, gatewayOrderId), eq(payments.status, "pending")))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    return row;
  }

  async updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [updated] = await db
      .update(payments)
      .set(data)
      .where(eq(payments.id, id))
      .returning();
    return updated;
  }

  async getAllPaymentsForAdmin(filters?: {
    search?: string;
    status?: string;
    itemName?: string;
    createdFrom?: string;
    createdTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ payments: (Payment & { user?: User; plan?: Plan; orgNo?: string })[]; total: number }> {
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    let allPayments = await db
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt));
    const results: (Payment & { user?: User; plan?: Plan; orgNo?: string })[] = [];
    for (const p of allPayments) {
      const [user] = await db.select().from(users).where(eq(users.id, p.userId)).limit(1);
      const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, p.subscriptionId)).limit(1);
      const plan = sub ? (await db.select().from(plans).where(eq(plans.id, sub.planId)).limit(1))[0] : undefined;
      const orgs = user ? await db.select().from(organizations).where(eq(organizations.ownerId, user.id)).limit(1) : [];
      const orgNo = orgs[0]?.id?.slice(-4) ?? "";
      let include = true;
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        const match =
          user?.email?.toLowerCase().includes(s) ||
          user?.firstName?.toLowerCase().includes(s) ||
          user?.lastName?.toLowerCase().includes(s) ||
          user?.phone?.toLowerCase().includes(s) ||
          orgNo.includes(s);
        if (!match) include = false;
      }
      if (filters?.status && p.status !== filters.status) include = false;
      if (filters?.itemName && plan) {
        const name = (plan.displayName || plan.name || "").toLowerCase();
        if (!name.includes((filters.itemName || "").toLowerCase())) include = false;
      }
      if (filters?.createdFrom) {
        const from = new Date(filters.createdFrom).getTime();
        if (new Date(p.createdAt).getTime() < from) include = false;
      }
      if (filters?.createdTo) {
        const to = new Date(filters.createdTo).getTime();
        if (new Date(p.createdAt).getTime() > to) include = false;
      }
      if (include) results.push({ ...p, user, plan, orgNo });
    }
    const total = results.length;
    const paginated = results.slice(offset, offset + limit);
    return { payments: paginated, total };
  }

  async addSubscriptionHistory(data: {
    userId: string;
    planId: string;
    subscriptionId: string;
    action: "assigned" | "upgraded" | "downgraded" | "renewed" | "expired" | "cancelled";
    periodStart: Date;
    periodEnd: Date;
    billingCycle: "monthly" | "quarterly" | "yearly";
  }): Promise<string | undefined> {
    const [row] = await db.insert(subscriptionHistory).values(data).returning({ id: subscriptionHistory.id });
    return row?.id;
  }

  async getSubscriptionHistoryByUser(userId: string): Promise<(typeof subscriptionHistory.$inferSelect & { plan?: Plan })[]> {
    const rows = await db
      .select()
      .from(subscriptionHistory)
      .where(eq(subscriptionHistory.userId, userId))
      .orderBy(desc(subscriptionHistory.createdAt));
    const result: (typeof subscriptionHistory.$inferSelect & { plan?: Plan })[] = [];
    for (const r of rows) {
      const [plan] = await db.select().from(plans).where(eq(plans.id, r.planId)).limit(1);
      result.push({ ...r, plan });
    }
    return result;
  }

  // Add-ons methods
  async getAllAddons(): Promise<Addon[]> {
    return await db.select().from(addons).where(eq(addons.isActive, true)).orderBy(addons.name);
  }

  async getAllAddonsAdmin(): Promise<Addon[]> {
    return await db.select().from(addons).orderBy(desc(addons.createdAt));
  }

  async getAddonsByUser(userId: string): Promise<(UserAddon & { addon: Addon })[]> {
    const uas = await db.select().from(userAddons).where(eq(userAddons.userId, userId)).orderBy(desc(userAddons.assignedAt));
    const result: (UserAddon & { addon: Addon })[] = [];
    for (const ua of uas) {
      const [addon] = await db.select().from(addons).where(eq(addons.id, ua.addonId)).limit(1);
      if (addon) result.push({ ...ua, addon });
    }
    return result;
  }

  /**
   * Effective sidebar flags from assigned add-ons (OR). If user has no add-on assignments,
   * flags are false — Chatbot / Flows / Webhook Events / Drip Campaigns stay hidden until an add-on grants them.
   */
  async getAddonMenuFeatureFlagsForUser(userId: string): Promise<{
    webhookEvents: boolean;
    chatbot: boolean;
    flows: boolean;
    dripCampaigns: boolean;
    hasAssignments: boolean;
  }> {
    const rows = await this.getAddonsByUser(userId);
    if (rows.length === 0) {
      return {
        webhookEvents: false,
        chatbot: false,
        flows: false,
        dripCampaigns: false,
        hasAssignments: false,
      };
    }
    return {
      hasAssignments: true,
      webhookEvents: rows.some((r) => !!r.addon.featureWebhookEvents),
      chatbot: rows.some((r) => !!r.addon.featureChatbot),
      flows: rows.some((r) => !!r.addon.featureFlows),
      dripCampaigns: rows.some((r) => !!r.addon.featureDripCampaigns),
    };
  }

  async assignAddonToUser(userId: string, addonId: string): Promise<UserAddon> {
    const [row] = await db.insert(userAddons).values({ userId, addonId }).returning();
    return row;
  }

  async removeAddonFromUser(userId: string, addonId: string): Promise<void> {
    await db.delete(userAddons).where(and(eq(userAddons.userId, userId), eq(userAddons.addonId, addonId)));
  }

  // Coupon methods
  async getAllCoupons(): Promise<Coupon[]> {
    return await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }

  async getCoupon(id: string): Promise<Coupon | undefined> {
    const [c] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
    return c;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [c] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase().trim())).limit(1);
    return c;
  }

  async createCoupon(data: InsertCoupon): Promise<Coupon> {
    const [c] = await db.insert(coupons).values({ ...data, code: (data.code || "").toUpperCase().trim() } as any).returning();
    return c;
  }

  async updateCoupon(id: string, data: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const updates: any = { ...data, updatedAt: new Date() };
    if (updates.code) updates.code = updates.code.toUpperCase().trim();
    const [c] = await db.update(coupons).set(updates).where(eq(coupons.id, id)).returning();
    return c;
  }

  async incrementCouponUsedCount(id: string): Promise<void> {
    const [c] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
    if (c) {
      await db.update(coupons).set({ usedCount: c.usedCount + 1, updatedAt: new Date() }).where(eq(coupons.id, id));
    }
  }

  async deleteCoupon(id: string): Promise<void> {
    await db.delete(coupons).where(eq(coupons.id, id));
  }

  // Usage tracking methods
  async getOrCreateUsageTracking(userId: string, month: string): Promise<UsageTracking> {
    const [existing] = await db
      .select()
      .from(usageTracking)
      .where(
        and(
          eq(usageTracking.userId, userId),
          eq(usageTracking.month, month)
        )
      )
      .limit(1);

    if (existing) return existing;

    const [created] = await db
      .insert(usageTracking)
      .values({ userId, month })
      .returning();
    return created;
  }

  async incrementMessagesSent(userId: string, month: string): Promise<void> {
    const usage = await this.getOrCreateUsageTracking(userId, month);
    await db
      .update(usageTracking)
      .set({ 
        messagesSent: (usage.messagesSent || 0) + 1,
        updatedAt: new Date()
      })
      .where(eq(usageTracking.id, usage.id));
  }

  async incrementApiCalls(userId: string, month: string): Promise<void> {
    const usage = await this.getOrCreateUsageTracking(userId, month);
    await db
      .update(usageTracking)
      .set({ 
        apiCalls: (usage.apiCalls || 0) + 1,
        updatedAt: new Date()
      })
      .where(eq(usageTracking.id, usage.id));
  }

  async updateActiveSessions(userId: string, month: string, count: number): Promise<void> {
    const usage = await this.getOrCreateUsageTracking(userId, month);
    await db
      .update(usageTracking)
      .set({ 
        activeSessions: count,
        updatedAt: new Date()
      })
      .where(eq(usageTracking.id, usage.id));
  }

  async incrementWebhooksTriggered(userId: string, month: string): Promise<void> {
    const usage = await this.getOrCreateUsageTracking(userId, month);
    await db
      .update(usageTracking)
      .set({ 
        webhooksTriggered: (usage.webhooksTriggered || 0) + 1,
        updatedAt: new Date()
      })
      .where(eq(usageTracking.id, usage.id));
  }

  // User settings methods
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    
    if (!settings) return undefined;
    
    return {
      ...settings,
      razorpayCredentials: settings.razorpayCredentials ? decryptCredentials(settings.razorpayCredentials) : null,
      stripeCredentials: settings.stripeCredentials ? decryptCredentials(settings.stripeCredentials) : null,
      whatsappBusinessCredentials: settings.whatsappBusinessCredentials ? decryptCredentials(settings.whatsappBusinessCredentials) : null,
    };
  }

  async createOrUpdateUserSettings(data: InsertUserSettings): Promise<UserSettings> {
    const encryptedData = {
      ...data,
      razorpayCredentials: data.razorpayCredentials ? encryptCredentials(data.razorpayCredentials) : null,
      stripeCredentials: data.stripeCredentials ? encryptCredentials(data.stripeCredentials) : null,
      whatsappBusinessCredentials: data.whatsappBusinessCredentials ? encryptCredentials(data.whatsappBusinessCredentials) : null,
    };
    
    const [settings] = await db
      .insert(userSettings)
      .values(encryptedData as any)
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          ...encryptedData,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    return {
      ...settings,
      razorpayCredentials: settings.razorpayCredentials ? decryptCredentials(settings.razorpayCredentials) : null,
      stripeCredentials: settings.stripeCredentials ? decryptCredentials(settings.stripeCredentials) : null,
      whatsappBusinessCredentials: settings.whatsappBusinessCredentials ? decryptCredentials(settings.whatsappBusinessCredentials) : null,
    };
  }

  async getSmtpSettings(userId: string): Promise<SmtpSettings | undefined> {
    const [settings] = await db
      .select()
      .from(smtpSettings)
      .where(eq(smtpSettings.userId, userId))
      .limit(1);

    if (!settings) return undefined;

    const decrypted = decryptCredentials({ smtpPass: settings.smtpPass });

    return {
      ...settings,
      smtpPass: decrypted?.smtpPass || settings.smtpPass,
    };
  }

  async createOrUpdateSmtpSettings(data: InsertSmtpSettings): Promise<SmtpSettings> {
    const encryptedPassword = encryptCredentials({ smtpPass: data.smtpPass })?.smtpPass || data.smtpPass;
    const encryptedData = {
      ...data,
      smtpPass: encryptedPassword,
    };

    const [settings] = await db
      .insert(smtpSettings)
      .values(encryptedData as any)
      .onConflictDoUpdate({
        target: smtpSettings.userId,
        set: {
          ...encryptedData,
          updatedAt: new Date(),
        },
      })
      .returning();

    const decrypted = decryptCredentials({ smtpPass: settings.smtpPass });

    return {
      ...settings,
      smtpPass: decrypted?.smtpPass || settings.smtpPass,
    };
  }

  async getForgotPasswordSmtpUserId(): Promise<string | undefined> {
    const [saasRow] = await db
      .select({ userId: smtpSettings.userId })
      .from(smtpSettings)
      .innerJoin(users, eq(smtpSettings.userId, users.id))
      .where(eq(users.isSaaSOwner, true))
      .limit(1);
    if (saasRow?.userId) return saasRow.userId;

    const [latest] = await db
      .select({ userId: smtpSettings.userId })
      .from(smtpSettings)
      .orderBy(desc(smtpSettings.updatedAt))
      .limit(1);
    if (latest?.userId) {
      console.warn(
        "[Email] Forgot password: no smtp_settings row for a SaaS owner (is_saas_owner=true); using latest smtp_settings row."
      );
    }
    return latest?.userId;
  }

  async getSubscriptionsEligibleForPanelReminders(): Promise<Subscription[]> {
    return await db
      .select()
      .from(subscriptions)
      .where(or(eq(subscriptions.status, "active"), eq(subscriptions.status, "expired")));
  }

  async panelTransactionalEmailLogExists(dedupeKey: string): Promise<boolean> {
    const [row] = await db
      .select({ id: panelTransactionalEmailLog.id })
      .from(panelTransactionalEmailLog)
      .where(eq(panelTransactionalEmailLog.dedupeKey, dedupeKey))
      .limit(1);
    return !!row;
  }

  async insertPanelTransactionalEmailLog(data: {
    userId: string;
    dedupeKey: string;
    notificationKind: string;
  }): Promise<void> {
    await db.insert(panelTransactionalEmailLog).values({
      userId: data.userId,
      dedupeKey: data.dedupeKey,
      notificationKind: data.notificationKind,
    });
  }

  async getCountryDialCodes(): Promise<CountryDialCode[]> {
    return db.select().from(countryDialCodes).orderBy(asc(countryDialCodes.countryName));
  }

  // Organization methods
  async createOrganization(data: InsertOrganization): Promise<Organization> {
    const [org] = await db.insert(organizations).values(data).returning();
    return org;
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return org;
  }

  async getOrganizationsByUser(userId: string): Promise<Organization[]> {
    const memberships = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));
    
    if (memberships.length === 0) return [];
    
    const orgIds = memberships.map(m => m.organizationId);
    return await db
      .select()
      .from(organizations)
      .where(inArray(organizations.id, orgIds));
  }

  async updateOrganization(id: string, data: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [updated] = await db
      .update(organizations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return updated;
  }

  async deleteOrganization(id: string): Promise<void> {
    await db.delete(organizations).where(eq(organizations.id, id));
  }

  // Organization member methods
  async addOrganizationMember(data: InsertOrganizationMember): Promise<OrganizationMember> {
    const [member] = await db.insert(organizationMembers).values(data).returning();
    return member;
  }

  async getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    return await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));
  }

  /** Org members with joined user profile (name/email) for assignee pickers. */
  async getOrganizationMembersWithUsers(organizationId: string): Promise<
    Array<
      OrganizationMember & {
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
        user: {
          id: string;
          email: string | null;
          firstName: string | null;
          lastName: string | null;
        } | null;
      }
    >
  > {
    const rows = await db
      .select({
        id: organizationMembers.id,
        organizationId: organizationMembers.organizationId,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        permissions: organizationMembers.permissions,
        invitedBy: organizationMembers.invitedBy,
        joinedAt: organizationMembers.joinedAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(organizationMembers)
      .leftJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, organizationId));

    return rows.map((r) => {
      const user = r.userId
        ? {
            id: r.userId,
            email: r.userEmail ?? null,
            firstName: r.userFirstName ?? null,
            lastName: r.userLastName ?? null,
          }
        : null;
      return {
        id: r.id,
        organizationId: r.organizationId,
        userId: r.userId,
        role: r.role,
        permissions: r.permissions,
        invitedBy: r.invitedBy,
        joinedAt: r.joinedAt,
        // Flat fields so clients that don't read nested `user` still resolve names
        firstName: r.userFirstName ?? null,
        lastName: r.userLastName ?? null,
        email: r.userEmail ?? null,
        user,
      } as OrganizationMember & {
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
        user: {
          id: string;
          email: string | null;
          firstName: string | null;
          lastName: string | null;
        } | null;
      };
    });
  }

  async getOrganizationMember(organizationId: string, userId: string): Promise<OrganizationMember | undefined> {
    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId)
        )
      )
      .limit(1);
    return member;
  }

  async updateOrganizationMemberRole(id: string, role: OrganizationMember['role']): Promise<OrganizationMember | undefined> {
    const [updated] = await db
      .update(organizationMembers)
      .set({ role })
      .where(eq(organizationMembers.id, id))
      .returning();
    return updated;
  }

  async updateOrganizationMemberPermissions(id: string, permissions: string[]): Promise<OrganizationMember | undefined> {
    const [updated] = await db
      .update(organizationMembers)
      .set({ permissions: permissions || [] })
      .where(eq(organizationMembers.id, id))
      .returning();
    return updated;
  }

  async removeOrganizationMember(id: string): Promise<void> {
    await db.delete(organizationMembers).where(eq(organizationMembers.id, id));
  }

  // Organization theme methods
  async createOrUpdateOrganizationTheme(data: InsertOrganizationTheme): Promise<OrganizationTheme> {
    const existing = await db
      .select()
      .from(organizationThemes)
      .where(eq(organizationThemes.organizationId, data.organizationId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(organizationThemes)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(organizationThemes.organizationId, data.organizationId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(organizationThemes).values(data).returning();
      return created;
    }
  }

  async getOrganizationTheme(organizationId: string): Promise<OrganizationTheme | undefined> {
    const [theme] = await db
      .select()
      .from(organizationThemes)
      .where(eq(organizationThemes.organizationId, organizationId))
      .limit(1);
    return theme;
  }

  async deleteOrganizationTheme(organizationId: string): Promise<void> {
    await db.delete(organizationThemes).where(eq(organizationThemes.organizationId, organizationId));
  }

  async getWebsiteBuilderPage(organizationId: string, pageKey: string): Promise<WebsiteBuilderPage | undefined> {
    const [row] = await db
      .select()
      .from(websiteBuilderPages)
      .where(and(eq(websiteBuilderPages.organizationId, organizationId), eq(websiteBuilderPages.pageKey, pageKey)))
      .limit(1);
    return row;
  }

  async setWebsiteBuilderPage(organizationId: string, pageKey: string, content: Record<string, unknown>): Promise<WebsiteBuilderPage> {
    const existing = await this.getWebsiteBuilderPage(organizationId, pageKey);
    const now = new Date();
    if (existing) {
      const [updated] = await db
        .update(websiteBuilderPages)
        .set({ content, updatedAt: now })
        .where(eq(websiteBuilderPages.id, existing.id))
        .returning();
      return updated!;
    }
    const [created] = await db
      .insert(websiteBuilderPages)
      .values({ organizationId, pageKey, content })
      .returning();
    return created!;
  }

  async getWebsiteBuilderConfigForOrg(organizationId: string): Promise<Record<string, Record<string, unknown>>> {
    const rows = await db
      .select()
      .from(websiteBuilderPages)
      .where(eq(websiteBuilderPages.organizationId, organizationId));
    const config: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      config[row.pageKey] = (row.content || {}) as Record<string, unknown>;
    }
    return config;
  }

  // Admin methods
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, data: Partial<Pick<User, 'isSaaSOwner' | 'isActive' | 'firstName' | 'lastName' | 'email' | 'phone' | 'tenantId' | 'passwordHash' | 'emailVerified' | 'accountStatus' | 'profileImageUrl' | 'isTrialAccount' | 'trialExpiresAt'>>): Promise<User | undefined> {
    const [prev] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (prev && updated) {
      void import("./onboarding-monthly-scheduler")
        .then((m) => m.onUserUpdatedForOnboardingBilling(prev, updated))
        .catch((e: unknown) => console.error("[OnboardingMonthly] user update hook:", e));
    }
    return updated;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations).orderBy(desc(organizations.createdAt));
  }

  // Managed contact methods
  async createManagedContact(
    data: InsertManagedContact,
    opts?: import("./automation/contact-automation-guard").ManagedContactWriteOptions
  ): Promise<ManagedContact> {
    const now = new Date();
    const [contact] = await db
      .insert(managedContacts)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();
    if (contact && !opts?.skipAutomation && process.env.AUTOMATION_FLOWS_ENABLED !== "false") {
      void import("./automation/dispatch-runner")
        .then((m) => m.onManagedContactCreated(contact as unknown as Record<string, unknown>))
        .catch((e: unknown) => console.error("[Automation] contact.created:", e));
    }
    if (contact && !opts?.skipAutomation) {
      void import("./drip-campaigns/enrollment")
        .then(({ maybeEnrollNewContact }) => maybeEnrollNewContact(contact))
        .catch(() => {});
    }
    return contact;
  }

  async getManagedContactsByUser(userId: string, organizationId: string): Promise<ManagedContact[]> {
    return this.getManagedContactsWithFilters(userId, organizationId, {});
  }

  async getManagedContactsByOrganization(organizationId: string): Promise<ManagedContact[]> {
    return await db
      .select()
      .from(managedContacts)
      .where(eq(managedContacts.organizationId, organizationId));
  }

  async countManagedContactsByOrganization(organizationId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(managedContacts)
      .where(eq(managedContacts.organizationId, organizationId));
    return Number(row?.count ?? 0);
  }

  async getPhoneToAssignedUserIdMapForOrganization(organizationId: string): Promise<Map<string, string>> {
    const rows = await db
      .select({ phoneNumber: managedContacts.phoneNumber, customFields: managedContacts.customFields })
      .from(managedContacts)
      .where(eq(managedContacts.organizationId, organizationId));
    const map = new Map<string, string>();
    for (const row of rows) {
      const cf = row.customFields as Record<string, unknown> | null | undefined;
      const assigned = cf?.assignedTo;
      if (typeof assigned === "string" && assigned.trim() !== "") {
        const key = String(row.phoneNumber ?? "").replace(/\D/g, "");
        if (key) map.set(key, assigned.trim());
      }
    }
    return map;
  }

  async getInboxContactIndexByOrganization(organizationId: string): Promise<
    Array<{
      id: string;
      phoneNumber: string;
      name?: string;
      customFields: Record<string, string>;
      source?: string;
      tags: string[];
    }>
  > {
    const rows = await db
      .select({
        id: managedContacts.id,
        phoneNumber: managedContacts.phoneNumber,
        name: managedContacts.name,
        customFields: managedContacts.customFields,
        source: managedContacts.source,
      })
      .from(managedContacts)
      .where(eq(managedContacts.organizationId, organizationId));

    const contactIds = rows.map((r) => r.id);
    const tagsMap = await this.getContactTagsBatchByOrganization(contactIds, organizationId);

    return rows.map((row) => {
      const cf = (row.customFields as Record<string, string> | null) ?? {};
      return {
        id: row.id,
        phoneNumber: row.phoneNumber,
        name: row.name ?? undefined,
        customFields: cf,
        source: row.source ?? undefined,
        tags: (tagsMap.get(row.id) || []).map((t) => t.id),
      };
    });
  }

  async getManagedContactsWithFilters(userId: string, organizationId: string, filters: ManagedContactFilters): Promise<ManagedContact[]> {
    const conditions = buildManagedContactFilterConditions(organizationId, filters, { userId });
    return db
      .select()
      .from(managedContacts)
      .where(and(...conditions))
      .orderBy(desc(managedContacts.createdAt));
  }

  async getManagedContactsWithFiltersByOrganization(organizationId: string, filters: ManagedContactFilters): Promise<ManagedContact[]> {
    const conditions = buildManagedContactFilterConditions(organizationId, filters);
    return db
      .select()
      .from(managedContacts)
      .where(and(...conditions))
      .orderBy(desc(managedContacts.createdAt));
  }

  async listManagedContactsWithFiltersByOrganization(
    organizationId: string,
    filters: ManagedContactFilters,
    pagination: { limit: number; offset: number }
  ) {
    const conditions = buildManagedContactFilterConditions(organizationId, filters);
    const whereClause = and(...conditions);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(managedContacts)
      .where(whereClause);
    const items = await db
      .select()
      .from(managedContacts)
      .where(whereClause)
      .orderBy(desc(managedContacts.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);
    return { items, total: Number(count) || 0, limit: pagination.limit, offset: pagination.offset };
  }

  async getContactTagsBatchByOrganization(contactIds: string[], organizationId: string): Promise<Map<string, ContactTag[]>> {
    if (contactIds.length === 0) return new Map();
    const assignments = await db
      .select()
      .from(contactTagAssignments)
      .where(inArray(contactTagAssignments.contactId, contactIds));
    if (assignments.length === 0) {
      const result = new Map<string, ContactTag[]>();
      contactIds.forEach(id => result.set(id, []));
      return result;
    }
    const tagIds = [...new Set(assignments.map(a => a.tagId))];
    const tags = await db
      .select()
      .from(contactTags)
      .where(and(
        inArray(contactTags.id, tagIds),
        eq(contactTags.organizationId, organizationId)
      ));
    const tagMap = new Map(tags.map(tag => [tag.id, tag]));
    const result = new Map<string, ContactTag[]>();
    contactIds.forEach(id => result.set(id, []));
    assignments.forEach(assignment => {
      const tag = tagMap.get(assignment.tagId);
      if (tag) {
        const list = result.get(assignment.contactId) || [];
        list.push(tag);
        result.set(assignment.contactId, list);
      }
    });
    return result;
  }

  async getManagedContact(id: string, userId: string, organizationId: string): Promise<ManagedContact | undefined> {
    const [contact] = await db
      .select()
      .from(managedContacts)
      .where(and(
        eq(managedContacts.id, id),
        eq(managedContacts.userId, userId),
        eq(managedContacts.organizationId, organizationId)
      ))
      .limit(1);
    return contact;
  }

  async getManagedContactByOrganization(contactId: string, organizationId: string): Promise<ManagedContact | undefined> {
    const [contact] = await db
      .select()
      .from(managedContacts)
      .where(and(eq(managedContacts.id, contactId), eq(managedContacts.organizationId, organizationId)))
      .limit(1);
    return contact;
  }

  async findManagedContactByOrganizationAndPhoneDigits(
    organizationId: string,
    phoneDigits: string
  ): Promise<ManagedContact | undefined> {
    const norm = phoneDigits.replace(/\D/g, "");
    if (!norm) return undefined;
    const [contact] = await db
      .select()
      .from(managedContacts)
      .where(
        and(
          eq(managedContacts.organizationId, organizationId),
          sql`regexp_replace(coalesce(${managedContacts.phoneNumber}, ''), '[^0-9]', '', 'g') = ${norm}`
        )
      )
      .orderBy(desc(managedContacts.updatedAt))
      .limit(1);
    return contact;
  }

  async updateManagedContact(
    id: string,
    userId: string,
    organizationId: string,
    data: Partial<InsertManagedContact>,
    opts?: import("./automation/contact-automation-guard").ManagedContactWriteOptions
  ): Promise<ManagedContact | undefined> {
    const [before] = await db
      .select()
      .from(managedContacts)
      .where(
        and(
          eq(managedContacts.id, id),
          eq(managedContacts.userId, userId),
          eq(managedContacts.organizationId, organizationId)
        )
      )
      .limit(1);

    const [updated] = await db
      .update(managedContacts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(managedContacts.id, id),
        eq(managedContacts.userId, userId),
        eq(managedContacts.organizationId, organizationId)
      ))
      .returning();

    if (
      updated &&
      before &&
      !opts?.skipAutomation &&
      process.env.AUTOMATION_FLOWS_ENABLED !== "false"
    ) {
      void import("./automation/contact-automation-guard")
        .then(({ isMeaningfulManagedContactUpdate }) => {
          if (!isMeaningfulManagedContactUpdate(before, data as Record<string, unknown>)) {
            console.log(
              `[Automation] contact-updated skipped for ${id} (no meaningful field change)`
            );
            return;
          }
          return import("./automation/dispatch-runner").then((m) =>
            m.onManagedContactUpdated(updated as unknown as Record<string, unknown>)
          );
        })
        .catch((e: unknown) => console.error("[Automation] contact.updated:", e));
    }
    return updated;
  }

  async deleteManagedContact(id: string, userId: string, organizationId: string): Promise<void> {
    await db.delete(managedContacts).where(and(
      eq(managedContacts.id, id),
      eq(managedContacts.userId, userId),
      eq(managedContacts.organizationId, organizationId)
    ));
  }

  async getManagedContactsByTags(userId: string, tagIds: string[], organizationId: string): Promise<ManagedContact[]> {
    // First, verify all tags belong to the user and organization
    const validTags = await db
      .select()
      .from(contactTags)
      .where(and(
        eq(contactTags.userId, userId),
        eq(contactTags.organizationId, organizationId),
        inArray(contactTags.id, tagIds)
      ));
    
    // Only proceed if we found tags that match the security criteria
    if (validTags.length === 0) return [];
    
    const validTagIds = validTags.map(t => t.id);
    const assignments = await db
      .select()
      .from(contactTagAssignments)
      .where(inArray(contactTagAssignments.tagId, validTagIds));
    
    if (assignments.length === 0) return [];
    
    const contactIds = assignments.map(a => a.contactId);
    return await db
      .select()
      .from(managedContacts)
      .where(and(
        eq(managedContacts.userId, userId),
        eq(managedContacts.organizationId, organizationId),
        inArray(managedContacts.id, contactIds)
      ));
  }

  // Contact tag methods
  async createContactTag(data: InsertContactTag): Promise<ContactTag> {
    const [tag] = await db.insert(contactTags).values(data).returning();
    return tag;
  }

  async getContactTagsByUser(userId: string, organizationId: string): Promise<ContactTag[]> {
    return await db
      .select()
      .from(contactTags)
      .where(and(
        eq(contactTags.userId, userId),
        eq(contactTags.organizationId, organizationId)
      ))
      .orderBy(desc(contactTags.createdAt));
  }

  async getContactTagsByOrganization(organizationId: string): Promise<ContactTag[]> {
    return await db
      .select()
      .from(contactTags)
      .where(eq(contactTags.organizationId, organizationId))
      .orderBy(desc(contactTags.createdAt));
  }

  async listContactTagsByOrganization(
    organizationId: string,
    query: { search?: string; limit: number; offset: number }
  ) {
    const conditions = [eq(contactTags.organizationId, organizationId)];
    if (query.search?.trim()) {
      const q = `%${query.search.trim().replace(/%/g, "\\%")}%`;
      conditions.push(ilike(contactTags.name, q));
    }
    const whereClause = and(...conditions);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactTags)
      .where(whereClause);
    const items = await db
      .select()
      .from(contactTags)
      .where(whereClause)
      .orderBy(desc(contactTags.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, total: Number(count) || 0, limit: query.limit, offset: query.offset };
  }

  async getContactTag(id: string, userId: string, organizationId: string): Promise<ContactTag | undefined> {
    const [tag] = await db
      .select()
      .from(contactTags)
      .where(and(
        eq(contactTags.id, id),
        eq(contactTags.userId, userId),
        eq(contactTags.organizationId, organizationId)
      ))
      .limit(1);
    return tag;
  }

  async getContactTagByOrganization(id: string, organizationId: string): Promise<ContactTag | undefined> {
    const [tag] = await db
      .select()
      .from(contactTags)
      .where(and(
        eq(contactTags.id, id),
        eq(contactTags.organizationId, organizationId)
      ))
      .limit(1);
    return tag;
  }

  async updateContactTag(id: string, userId: string, organizationId: string, data: Partial<InsertContactTag>): Promise<ContactTag | undefined> {
    const [updated] = await db
      .update(contactTags)
      .set(data)
      .where(and(
        eq(contactTags.id, id),
        eq(contactTags.userId, userId),
        eq(contactTags.organizationId, organizationId)
      ))
      .returning();
    return updated;
  }

  async updateContactTagByOrganization(id: string, organizationId: string, data: Partial<InsertContactTag>): Promise<ContactTag | undefined> {
    const [updated] = await db
      .update(contactTags)
      .set(data)
      .where(and(
        eq(contactTags.id, id),
        eq(contactTags.organizationId, organizationId)
      ))
      .returning();
    return updated;
  }

  async deleteContactTag(id: string, userId: string, organizationId: string): Promise<void> {
    await db.delete(contactTags).where(and(
      eq(contactTags.id, id),
      eq(contactTags.userId, userId),
      eq(contactTags.organizationId, organizationId)
    ));
  }

  async deleteContactTagByOrganization(id: string, organizationId: string): Promise<void> {
    await db.delete(contactTags).where(and(
      eq(contactTags.id, id),
      eq(contactTags.organizationId, organizationId)
    ));
  }

  async assignTagToContact(contactId: string, tagId: string, userId: string, organizationId: string): Promise<void> {
    // Verify contact belongs to user+org and tag belongs to organization
    const contact = await this.getManagedContact(contactId, userId, organizationId);
    const tag = await this.getContactTagByOrganization(tagId, organizationId);
    
    if (!contact || !tag) {
      throw new Error('Contact or tag not found');
    }
    
    // Both are already verified to belong to organizationId, so they match
    await db.insert(contactTagAssignments).values({ contactId, tagId });
    if (organizationId) {
      import("./drip-campaigns/enrollment")
        .then(({ tryEnrollContactForDripTrigger }) =>
          tryEnrollContactForDripTrigger({
            organizationId,
            contactId,
            trigger: "label_added",
            labelId: tagId,
          }),
        )
        .catch(() => {});
    }
  }

  async removeTagFromContact(contactId: string, tagId: string, userId: string, organizationId: string): Promise<void> {
    // Verify contact belongs to user+org and tag belongs to organization
    const contact = await this.getManagedContact(contactId, userId, organizationId);
    const tag = await this.getContactTagByOrganization(tagId, organizationId);
    
    if (!contact || !tag) return;
    
    await db.delete(contactTagAssignments).where(
      and(
        eq(contactTagAssignments.contactId, contactId),
        eq(contactTagAssignments.tagId, tagId)
      )
    );
  }

  async getContactTags(contactId: string, userId: string, organizationId: string): Promise<ContactTag[]> {
    // Verify contact ownership
    const contact = await this.getManagedContact(contactId, userId, organizationId);
    if (!contact) return [];
    
    const assignments = await db
      .select()
      .from(contactTagAssignments)
      .where(eq(contactTagAssignments.contactId, contactId));
    
    if (assignments.length === 0) return [];
    
    const tagIds = assignments.map(a => a.tagId);
    return await db
      .select()
      .from(contactTags)
      .where(and(
        inArray(contactTags.id, tagIds),
        eq(contactTags.userId, userId),
        eq(contactTags.organizationId, organizationId)
      ));
  }

  async getContactTagsBatch(contactIds: string[], userId: string, organizationId: string): Promise<Map<string, ContactTag[]>> {
    if (contactIds.length === 0) return new Map();
    
    // Fetch all tag assignments for these contacts in one query
    const assignments = await db
      .select()
      .from(contactTagAssignments)
      .where(inArray(contactTagAssignments.contactId, contactIds));
    
    if (assignments.length === 0) {
      // Return empty map with empty arrays for each contact
      const result = new Map<string, ContactTag[]>();
      contactIds.forEach(id => result.set(id, []));
      return result;
    }
    
    // Get unique tag IDs
    const tagIds = [...new Set(assignments.map(a => a.tagId))];
    
    // Fetch all tags in one query
    const tags = await db
      .select()
      .from(contactTags)
      .where(and(
        inArray(contactTags.id, tagIds),
        eq(contactTags.userId, userId),
        organizationId ? eq(contactTags.organizationId, organizationId) : undefined
      ));
    
    // Create a map of tagId -> tag for quick lookup
    const tagMap = new Map(tags.map(tag => [tag.id, tag]));
    
    // Group assignments by contactId
    const result = new Map<string, ContactTag[]>();
    contactIds.forEach(id => result.set(id, []));
    
    assignments.forEach(assignment => {
      const tag = tagMap.get(assignment.tagId);
      if (tag) {
        const contactTags = result.get(assignment.contactId) || [];
        contactTags.push(tag);
        result.set(assignment.contactId, contactTags);
      }
    });
    
    return result;
  }

  // Contact notes methods (with creator profile)
  async getContactNotes(contactId: string, userId: string, organizationId: string): Promise<(ContactNote & { userFirstName?: string | null; userLastName?: string | null; userProfileImageUrl?: string | null })[]> {
    const contact = await this.getManagedContact(contactId, userId, organizationId);
    if (!contact) return [];
    const rows = await db
      .select({
        id: contactNotes.id,
        contactId: contactNotes.contactId,
        userId: contactNotes.userId,
        organizationId: contactNotes.organizationId,
        message: contactNotes.message,
        createdAt: contactNotes.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userProfileImageUrl: users.profileImageUrl,
      })
      .from(contactNotes)
      .leftJoin(users, eq(contactNotes.userId, users.id))
      .where(eq(contactNotes.contactId, contactId))
      .orderBy(desc(contactNotes.createdAt));
    return rows as (ContactNote & { userFirstName?: string | null; userLastName?: string | null; userProfileImageUrl?: string | null })[];
  }

  async createContactNote(data: InsertContactNote): Promise<ContactNote> {
    const [note] = await db.insert(contactNotes).values(data).returning();
    return note;
  }

  async updateContactNote(id: string, contactId: string, userId: string, organizationId: string, data: { message: string }): Promise<ContactNote | undefined> {
    const contact = await this.getManagedContact(contactId, userId, organizationId);
    if (!contact) return undefined;
    const [updated] = await db
      .update(contactNotes)
      .set({ message: data.message })
      .where(and(eq(contactNotes.id, id), eq(contactNotes.contactId, contactId)))
      .returning();
    return updated;
  }

  async deleteContactNote(id: string, contactId: string, userId: string, organizationId: string): Promise<void> {
    const contact = await this.getManagedContact(contactId, userId, organizationId);
    if (!contact) return;
    await db
      .delete(contactNotes)
      .where(and(eq(contactNotes.id, id), eq(contactNotes.contactId, contactId)));
  }

  // Contact activity log
  async createContactActivityLog(data: InsertContactActivityLog): Promise<ContactActivityLog> {
    const [log] = await db.insert(contactActivityLog).values(data).returning();
    return log;
  }

  async getContactActivityLogs(contactId: string, userId: string, organizationId: string): Promise<(ContactActivityLog & { userFirstName?: string | null; userLastName?: string | null; userProfileImageUrl?: string | null })[]> {
    const contact = await this.getManagedContact(contactId, userId, organizationId);
    if (!contact) return [];
    const rows = await db
      .select({
        id: contactActivityLog.id,
        contactId: contactActivityLog.contactId,
        userId: contactActivityLog.userId,
        organizationId: contactActivityLog.organizationId,
        action: contactActivityLog.action,
        metadata: contactActivityLog.metadata,
        createdAt: contactActivityLog.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userProfileImageUrl: users.profileImageUrl,
      })
      .from(contactActivityLog)
      .leftJoin(users, eq(contactActivityLog.userId, users.id))
      .where(eq(contactActivityLog.contactId, contactId))
      .orderBy(desc(contactActivityLog.createdAt));
    return rows as (ContactActivityLog & { userFirstName?: string | null; userLastName?: string | null; userProfileImageUrl?: string | null })[];
  }

  // Contact reminders methods (with creator profile)
  async getContactReminders(contactId: string, userId: string, organizationId: string): Promise<(ContactReminder & { userFirstName?: string | null; userLastName?: string | null; userProfileImageUrl?: string | null })[]> {
    const contact = await this.getManagedContact(contactId, userId, organizationId);
    if (!contact) return [];
    return this.getContactRemindersForContact(contactId);
  }

  async getContactRemindersByOrganization(contactId: string, organizationId: string): Promise<(ContactReminder & { userFirstName?: string | null; userLastName?: string | null; userProfileImageUrl?: string | null })[]> {
    const contact = await this.getManagedContactByOrganization(contactId, organizationId);
    if (!contact) return [];
    return this.getContactRemindersForContact(contactId);
  }

  private async getContactRemindersForContact(contactId: string): Promise<(ContactReminder & {
    userFirstName?: string | null;
    userLastName?: string | null;
    userProfileImageUrl?: string | null;
    assigneeFirstName?: string | null;
    assigneeLastName?: string | null;
    assigneeEmail?: string | null;
  })[]> {
    const assigneeUsers = alias(users, "reminder_assignee_users");
    const rows = await db
      .select({
        id: contactReminders.id,
        contactId: contactReminders.contactId,
        userId: contactReminders.userId,
        organizationId: contactReminders.organizationId,
        reminderTo: contactReminders.reminderTo,
        title: contactReminders.title,
        message: contactReminders.message,
        reminderAt: contactReminders.reminderAt,
        contactDisplayName: contactReminders.contactDisplayName,
        templateName: contactReminders.templateName,
        templateLanguage: contactReminders.templateLanguage,
        templateParams: contactReminders.templateParams,
        sessionId: contactReminders.sessionId,
        headerImageUrl: contactReminders.headerImageUrl,
        headerImageId: contactReminders.headerImageId,
        headerVideoUrl: contactReminders.headerVideoUrl,
        headerVideoId: contactReminders.headerVideoId,
        headerDocumentUrl: contactReminders.headerDocumentUrl,
        headerDocumentId: contactReminders.headerDocumentId,
        whatsappStatus: contactReminders.whatsappStatus,
        whatsappSentAt: contactReminders.whatsappSentAt,
        whatsappError: contactReminders.whatsappError,
        createdAt: contactReminders.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userProfileImageUrl: users.profileImageUrl,
        assigneeFirstName: assigneeUsers.firstName,
        assigneeLastName: assigneeUsers.lastName,
        assigneeEmail: assigneeUsers.email,
      })
      .from(contactReminders)
      .leftJoin(users, eq(contactReminders.userId, users.id))
      .leftJoin(assigneeUsers, eq(contactReminders.reminderTo, assigneeUsers.id))
      .where(eq(contactReminders.contactId, contactId))
      .orderBy(asc(contactReminders.reminderAt));
    return rows as (ContactReminder & {
      userFirstName?: string | null;
      userLastName?: string | null;
      userProfileImageUrl?: string | null;
      assigneeFirstName?: string | null;
      assigneeLastName?: string | null;
      assigneeEmail?: string | null;
    })[];
  }

  async updateContactReminderByOrganization(reminderId: string, contactId: string, organizationId: string, data: { title?: string | null; message?: string; notes?: string | null; reminderTo?: string; reminderAt?: Date; contactDisplayName?: string | null; templateName?: string | null; templateLanguage?: string | null; templateParams?: string[] | null; sessionId?: string | null; headerImageUrl?: string | null; headerImageId?: string | null; headerVideoUrl?: string | null; headerVideoId?: string | null; headerDocumentUrl?: string | null; headerDocumentId?: string | null; whatsappStatus?: "none" | "pending" | "sending" | "sent" | "failed"; whatsappSentAt?: Date | null; whatsappError?: string | null }): Promise<ContactReminder | undefined> {
    const contact = await this.getManagedContactByOrganization(contactId, organizationId);
    if (!contact) return undefined;
    const reminder = await db.select().from(contactReminders).where(and(eq(contactReminders.id, reminderId), eq(contactReminders.contactId, contactId), eq(contactReminders.organizationId, organizationId))).limit(1);
    if (!reminder.length) return undefined;
    const setData: Record<string, unknown> = {};
    if (data.title !== undefined) setData.title = data.title;
    if (data.message !== undefined) setData.message = data.message;
    if (data.notes !== undefined) setData.notes = data.notes;
    if (data.reminderTo !== undefined) setData.reminderTo = data.reminderTo;
    if (data.reminderAt !== undefined) setData.reminderAt = data.reminderAt;
    if (data.contactDisplayName !== undefined) setData.contactDisplayName = data.contactDisplayName;
    if (data.templateName !== undefined) setData.templateName = data.templateName;
    if (data.templateLanguage !== undefined) setData.templateLanguage = data.templateLanguage;
    if (data.templateParams !== undefined) setData.templateParams = data.templateParams;
    if (data.sessionId !== undefined) setData.sessionId = data.sessionId;
    if (data.headerImageUrl !== undefined) setData.headerImageUrl = data.headerImageUrl;
    if (data.headerImageId !== undefined) setData.headerImageId = data.headerImageId;
    if (data.headerVideoUrl !== undefined) setData.headerVideoUrl = data.headerVideoUrl;
    if (data.headerVideoId !== undefined) setData.headerVideoId = data.headerVideoId;
    if (data.headerDocumentUrl !== undefined) setData.headerDocumentUrl = data.headerDocumentUrl;
    if (data.headerDocumentId !== undefined) setData.headerDocumentId = data.headerDocumentId;
    if (data.whatsappStatus !== undefined) setData.whatsappStatus = data.whatsappStatus;
    if (data.whatsappSentAt !== undefined) setData.whatsappSentAt = data.whatsappSentAt;
    if (data.whatsappError !== undefined) setData.whatsappError = data.whatsappError;
    if (Object.keys(setData).length === 0) return reminder[0];
    const [updated] = await db.update(contactReminders).set(setData).where(and(eq(contactReminders.id, reminderId), eq(contactReminders.contactId, contactId))).returning();
    return updated;
  }

  async deleteContactReminderByOrganization(reminderId: string, contactId: string, organizationId: string): Promise<void> {
    const contact = await this.getManagedContactByOrganization(contactId, organizationId);
    if (!contact) return;
    await db.delete(contactReminders).where(and(eq(contactReminders.id, reminderId), eq(contactReminders.contactId, contactId), eq(contactReminders.organizationId, organizationId)));
  }

  async createContactReminder(data: InsertContactReminder): Promise<ContactReminder> {
    const [reminder] = await db.insert(contactReminders).values(data).returning();
    return reminder;
  }

  async updateContactReminder(id: string, contactId: string, userId: string, organizationId: string, data: { title?: string | null; message?: string; notes?: string | null; reminderTo?: string; reminderAt?: Date; contactDisplayName?: string | null; templateName?: string | null; templateLanguage?: string | null; templateParams?: string[] | null; sessionId?: string | null; headerImageUrl?: string | null; headerImageId?: string | null; headerVideoUrl?: string | null; headerVideoId?: string | null; headerDocumentUrl?: string | null; headerDocumentId?: string | null; whatsappStatus?: "none" | "pending" | "sending" | "sent" | "failed"; whatsappSentAt?: Date | null; whatsappError?: string | null }): Promise<ContactReminder | undefined> {
    const contact = await this.getManagedContact(contactId, userId, organizationId);
    if (!contact) return undefined;
    const setData: Record<string, unknown> = {};
    if (data.title !== undefined) setData.title = data.title;
    if (data.message !== undefined) setData.message = data.message;
    if (data.notes !== undefined) setData.notes = data.notes;
    if (data.reminderTo !== undefined) setData.reminderTo = data.reminderTo;
    if (data.reminderAt !== undefined) setData.reminderAt = data.reminderAt;
    if (data.contactDisplayName !== undefined) setData.contactDisplayName = data.contactDisplayName;
    if (data.templateName !== undefined) setData.templateName = data.templateName;
    if (data.templateLanguage !== undefined) setData.templateLanguage = data.templateLanguage;
    if (data.templateParams !== undefined) setData.templateParams = data.templateParams;
    if (data.sessionId !== undefined) setData.sessionId = data.sessionId;
    if (data.headerImageUrl !== undefined) setData.headerImageUrl = data.headerImageUrl;
    if (data.headerImageId !== undefined) setData.headerImageId = data.headerImageId;
    if (data.headerVideoUrl !== undefined) setData.headerVideoUrl = data.headerVideoUrl;
    if (data.headerVideoId !== undefined) setData.headerVideoId = data.headerVideoId;
    if (data.headerDocumentUrl !== undefined) setData.headerDocumentUrl = data.headerDocumentUrl;
    if (data.headerDocumentId !== undefined) setData.headerDocumentId = data.headerDocumentId;
    if (data.whatsappStatus !== undefined) setData.whatsappStatus = data.whatsappStatus;
    if (data.whatsappSentAt !== undefined) setData.whatsappSentAt = data.whatsappSentAt;
    if (data.whatsappError !== undefined) setData.whatsappError = data.whatsappError;
    if (Object.keys(setData).length === 0) return (await this.getContactReminders(contactId, userId, organizationId)).find((r) => r.id === id);
    const [updated] = await db
      .update(contactReminders)
      .set(setData)
      .where(and(eq(contactReminders.id, id), eq(contactReminders.contactId, contactId)))
      .returning();
    return updated;
  }

  async claimDueRemindersForWhatsApp(now: Date, limit = 20): Promise<ContactReminder[]> {
    // Reset rows stuck in "sending" (crash / DB timeout mid-send) before claiming.
    // Only reclaim sends that are at least 2 minutes overdue so an in-flight send isn't stolen.
    const stuckBefore = new Date(now.getTime() - 2 * 60 * 1000);
    await db
      .update(contactReminders)
      .set({ whatsappStatus: "pending", whatsappError: null })
      .where(
        and(
          eq(contactReminders.whatsappStatus, "sending"),
          lte(contactReminders.reminderAt, stuckBefore)
        )
      );

    // Compare against DB NOW() so due checks are timezone-safe with timestamptz.
    const due = await db
      .select()
      .from(contactReminders)
      .where(
        and(
          eq(contactReminders.whatsappStatus, "pending"),
          sql`${contactReminders.reminderAt} <= NOW()`,
          sql`${contactReminders.sessionId} IS NOT NULL AND TRIM(${contactReminders.sessionId}) <> ''`,
          or(
            sql`${contactReminders.templateName} IS NOT NULL AND TRIM(${contactReminders.templateName}) <> ''`,
            sql`TRIM(${contactReminders.message}) <> ''`
          )
        )
      )
      .orderBy(asc(contactReminders.reminderAt))
      .limit(limit);

    const claimed: ContactReminder[] = [];
    for (const row of due) {
      const [updated] = await db
        .update(contactReminders)
        .set({ whatsappStatus: "sending" })
        .where(
          and(
            eq(contactReminders.id, row.id),
            eq(contactReminders.whatsappStatus, "pending")
          )
        )
        .returning();
      if (updated) claimed.push(updated);
    }
    return claimed;
  }

  /** Reset stuck "sending" rows back to pending (e.g. after process restart). */
  async requeueStuckReminderWhatsAppSends(olderThanMinutes = 2): Promise<number> {
    const cutoff = new Date(Date.now() - Math.max(1, olderThanMinutes) * 60 * 1000);
    const updated = await db
      .update(contactReminders)
      .set({ whatsappStatus: "pending", whatsappError: null })
      .where(
        and(
          eq(contactReminders.whatsappStatus, "sending"),
          lte(contactReminders.reminderAt, cutoff)
        )
      )
      .returning({ id: contactReminders.id });
    return updated.length;
  }

  async markReminderWhatsAppSent(id: string): Promise<void> {
    await db
      .update(contactReminders)
      .set({
        whatsappStatus: "sent",
        whatsappSentAt: new Date(),
        whatsappError: null,
      })
      .where(eq(contactReminders.id, id));
  }

  async markReminderWhatsAppFailed(id: string, error: string): Promise<void> {
    await db
      .update(contactReminders)
      .set({
        whatsappStatus: "failed",
        whatsappError: error.slice(0, 500),
      })
      .where(eq(contactReminders.id, id));
  }

  /** Re-queue failed/stuck template reminders so the scheduler can send them again. */
  async requeueFailedReminderWhatsAppSends(options?: {
    organizationId?: string;
    errorContains?: string;
    /** Only requeue reminders whose due time has arrived */
    onlyDue?: boolean;
    limit?: number;
  }): Promise<number> {
    const limit = options?.limit ?? 50;
    const conditions = [
      eq(contactReminders.whatsappStatus, "failed"),
      sql`${contactReminders.sessionId} IS NOT NULL AND TRIM(${contactReminders.sessionId}) <> ''`,
      or(
        sql`${contactReminders.templateName} IS NOT NULL AND TRIM(${contactReminders.templateName}) <> ''`,
        sql`TRIM(${contactReminders.message}) <> ''`
      ),
    ];
    if (options?.organizationId) {
      conditions.push(eq(contactReminders.organizationId, options.organizationId));
    }
    if (options?.errorContains?.trim()) {
      const term = `%${options.errorContains.trim()}%`;
      conditions.push(sql`${contactReminders.whatsappError} ILIKE ${term}`);
    }
    if (options?.onlyDue) {
      conditions.push(sql`${contactReminders.reminderAt} <= NOW()`);
    }
    const due = await db
      .select({ id: contactReminders.id })
      .from(contactReminders)
      .where(and(...conditions))
      .orderBy(asc(contactReminders.reminderAt))
      .limit(limit);

    let count = 0;
    for (const row of due) {
      const [updated] = await db
        .update(contactReminders)
        .set({
          whatsappStatus: "pending",
          whatsappError: null,
          whatsappSentAt: null,
        })
        .where(and(eq(contactReminders.id, row.id), eq(contactReminders.whatsappStatus, "failed")))
        .returning({ id: contactReminders.id });
      if (updated) count += 1;
    }
    return count;
  }

  async deleteContactReminder(id: string, contactId: string, userId: string, organizationId: string): Promise<boolean> {
    if (!organizationId) return false;
    const contact = await this.getManagedContact(contactId, userId, organizationId);
    if (!contact) return false;
    await db
      .delete(contactReminders)
      .where(and(eq(contactReminders.id, id), eq(contactReminders.contactId, contactId)));
    return true;
  }

  /** Reminders due for a user (reminderTo = userId) in the last 24h window, for notification display */
  async getDueRemindersForUser(userId: string, organizationId: string): Promise<{ id: string; message: string; reminderAt: Date; contactId: string; contactName: string }[]> {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        id: contactReminders.id,
        message: contactReminders.message,
        reminderAt: contactReminders.reminderAt,
        contactId: contactReminders.contactId,
        contactDisplayName: contactReminders.contactDisplayName,
        managedContactName: managedContacts.name,
      })
      .from(contactReminders)
      .innerJoin(managedContacts, eq(contactReminders.contactId, managedContacts.id))
      .where(
        and(
          eq(contactReminders.reminderTo, userId),
          eq(contactReminders.organizationId, organizationId),
          gte(contactReminders.reminderAt, from),
          lte(contactReminders.reminderAt, now)
        )
      )
      .orderBy(asc(contactReminders.reminderAt));
    return rows.map((r) => ({
      id: r.id,
      message: r.message,
      reminderAt: r.reminderAt,
      contactId: r.contactId,
      contactName: (r.contactDisplayName && r.contactDisplayName.trim()) ? r.contactDisplayName.trim() : (r.managedContactName ?? "Contact"),
    }));
  }

  /** Upcoming reminders for a user (reminderTo = userId) for today/tomorrow – for the reminder panel everywhere */
  async getUpcomingRemindersForUser(userId: string, organizationId: string): Promise<{ id: string; message: string; reminderAt: Date; contactId: string; contactName: string }[]> {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const rows = await db
      .select({
        id: contactReminders.id,
        message: contactReminders.message,
        reminderAt: contactReminders.reminderAt,
        contactId: contactReminders.contactId,
        contactDisplayName: contactReminders.contactDisplayName,
        managedContactName: managedContacts.name,
      })
      .from(contactReminders)
      .innerJoin(managedContacts, eq(contactReminders.contactId, managedContacts.id))
      .where(
        and(
          eq(contactReminders.reminderTo, userId),
          eq(contactReminders.organizationId, organizationId),
          gte(contactReminders.reminderAt, from),
          lte(contactReminders.reminderAt, to)
        )
      )
      .orderBy(asc(contactReminders.reminderAt));
    return rows.map((r) => ({
      id: r.id,
      message: r.message,
      reminderAt: r.reminderAt,
      contactId: r.contactId,
      contactName: (r.contactDisplayName && r.contactDisplayName.trim()) ? r.contactDisplayName.trim() : (r.managedContactName ?? "Contact"),
    }));
  }

  /** All reminders for a user with optional date range and search (message or contact name) */
  async getAllRemindersForUser(
    userId: string,
    organizationId: string,
    filters?: { dateFrom?: string; dateTo?: string; search?: string }
  ): Promise<{ id: string; title?: string | null; message: string; reminderAt: Date; contactId: string; contactName: string }[]> {
    const conditions = [
      eq(contactReminders.reminderTo, userId),
      eq(contactReminders.organizationId, organizationId),
    ];
    if (filters?.dateFrom) {
      conditions.push(gte(contactReminders.reminderAt, new Date(filters.dateFrom)));
    }
    if (filters?.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      conditions.push(lte(contactReminders.reminderAt, to));
    }
    if (filters?.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        sql`(${contactReminders.message} ILIKE ${term} OR COALESCE(${contactReminders.title}, '')::text ILIKE ${term} OR COALESCE(${contactReminders.contactDisplayName}, '')::text ILIKE ${term} OR ${managedContacts.name} ILIKE ${term})`
      );
    }
    const rows = await db
      .select({
        id: contactReminders.id,
        title: contactReminders.title,
        message: contactReminders.message,
        reminderAt: contactReminders.reminderAt,
        contactId: contactReminders.contactId,
        contactDisplayName: contactReminders.contactDisplayName,
        managedContactName: managedContacts.name,
      })
      .from(contactReminders)
      .innerJoin(managedContacts, eq(contactReminders.contactId, managedContacts.id))
      .where(and(...conditions))
      .orderBy(desc(contactReminders.reminderAt));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      reminderAt: r.reminderAt,
      contactId: r.contactId,
      contactName: (r.contactDisplayName && r.contactDisplayName.trim()) ? r.contactDisplayName.trim() : (r.managedContactName ?? "Contact"),
    }));
  }

  /** All reminders for user (reminderTo = userId) across any org – fallback when getOrganizationsByUser returns [] */
  async getAllRemindersForUserAnyOrg(
    userId: string,
    filters?: { dateFrom?: string; dateTo?: string; search?: string }
  ): Promise<{ id: string; title?: string | null; message: string; reminderAt: Date; contactId: string; contactName: string }[]> {
    const conditions = [eq(contactReminders.reminderTo, userId)];
    if (filters?.dateFrom) {
      conditions.push(gte(contactReminders.reminderAt, new Date(filters.dateFrom)));
    }
    if (filters?.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      conditions.push(lte(contactReminders.reminderAt, to));
    }
    if (filters?.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        sql`(${contactReminders.message} ILIKE ${term} OR COALESCE(${contactReminders.title}, '')::text ILIKE ${term} OR COALESCE(${contactReminders.contactDisplayName}, '')::text ILIKE ${term} OR ${managedContacts.name} ILIKE ${term})`
      );
    }
    const rows = await db
      .select({
        id: contactReminders.id,
        title: contactReminders.title,
        message: contactReminders.message,
        reminderAt: contactReminders.reminderAt,
        contactId: contactReminders.contactId,
        contactDisplayName: contactReminders.contactDisplayName,
        managedContactName: managedContacts.name,
      })
      .from(contactReminders)
      .innerJoin(managedContacts, eq(contactReminders.contactId, managedContacts.id))
      .where(and(...conditions))
      .orderBy(desc(contactReminders.reminderAt));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      reminderAt: r.reminderAt,
      contactId: r.contactId,
      contactName: (r.contactDisplayName && r.contactDisplayName.trim()) ? r.contactDisplayName.trim() : (r.managedContactName ?? "Contact"),
    }));
  }

  async getAllRemindersByOrganization(
    organizationId: string,
    filters?: { dateFrom?: string; dateTo?: string; search?: string; reminderTo?: string }
  ): Promise<{
    id: string;
    title?: string | null;
    message: string;
    notes?: string | null;
    reminderAt: Date;
    contactId: string;
    contactName: string;
    contactPhone: string;
    reminderTo: string;
    assigneeName: string;
    templateName?: string | null;
    templateLanguage?: string | null;
    templateParams?: string[] | null;
    sessionId?: string | null;
    whatsappStatus?: string | null;
  }[]> {
    const assigneeUsers = alias(users, "assignee_users");
    const conditions = [eq(contactReminders.organizationId, organizationId)];
    if (filters?.dateFrom) conditions.push(gte(contactReminders.reminderAt, new Date(filters.dateFrom)));
    if (filters?.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      conditions.push(lte(contactReminders.reminderAt, to));
    }
    if (filters?.reminderTo) {
      conditions.push(eq(contactReminders.reminderTo, filters.reminderTo));
    }
    if (filters?.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        sql`(${contactReminders.message} ILIKE ${term} OR COALESCE(${contactReminders.notes}, '')::text ILIKE ${term} OR COALESCE(${contactReminders.title}, '')::text ILIKE ${term} OR COALESCE(${contactReminders.contactDisplayName}, '')::text ILIKE ${term} OR ${managedContacts.name} ILIKE ${term} OR ${managedContacts.phoneNumber} ILIKE ${term} OR COALESCE(${assigneeUsers.firstName}, '')::text ILIKE ${term} OR COALESCE(${assigneeUsers.lastName}, '')::text ILIKE ${term})`
      );
    }
    const rows = await db
      .select({
        id: contactReminders.id,
        title: contactReminders.title,
        message: contactReminders.message,
        notes: contactReminders.notes,
        reminderAt: contactReminders.reminderAt,
        contactId: contactReminders.contactId,
        contactDisplayName: contactReminders.contactDisplayName,
        managedContactName: managedContacts.name,
        managedContactPhone: managedContacts.phoneNumber,
        reminderTo: contactReminders.reminderTo,
        assigneeFirstName: assigneeUsers.firstName,
        assigneeLastName: assigneeUsers.lastName,
        templateName: contactReminders.templateName,
        templateLanguage: contactReminders.templateLanguage,
        templateParams: contactReminders.templateParams,
        sessionId: contactReminders.sessionId,
        headerImageUrl: contactReminders.headerImageUrl,
        headerImageId: contactReminders.headerImageId,
        headerVideoUrl: contactReminders.headerVideoUrl,
        headerVideoId: contactReminders.headerVideoId,
        headerDocumentUrl: contactReminders.headerDocumentUrl,
        headerDocumentId: contactReminders.headerDocumentId,
        whatsappStatus: contactReminders.whatsappStatus,
      })
      .from(contactReminders)
      .innerJoin(managedContacts, eq(contactReminders.contactId, managedContacts.id))
      .leftJoin(assigneeUsers, eq(contactReminders.reminderTo, assigneeUsers.id))
      .where(and(...conditions))
      .orderBy(desc(contactReminders.reminderAt));
    return rows.map((r) => {
      const assigneeName = [r.assigneeFirstName, r.assigneeLastName].filter(Boolean).join(" ").trim();
      const phone = (r.managedContactPhone || "").trim();
      const displayName = (r.contactDisplayName && r.contactDisplayName.trim())
        ? r.contactDisplayName.trim()
        : (r.managedContactName?.trim() || phone || "Contact");
      // Prefer real name for Associated Contacts when display name is just the phone
      const contactName =
        r.managedContactName?.trim() && r.managedContactName.trim() !== phone
          ? r.managedContactName.trim()
          : displayName;
      return {
        id: r.id,
        title: r.title,
        message: r.message,
        notes: r.notes,
        reminderAt: r.reminderAt,
        contactId: r.contactId,
        contactName,
        contactPhone: phone,
        reminderTo: r.reminderTo,
        assigneeName: assigneeName || "Unassigned",
        templateName: r.templateName,
        templateLanguage: r.templateLanguage,
        templateParams: r.templateParams,
        sessionId: r.sessionId,
        headerImageUrl: r.headerImageUrl,
        headerImageId: r.headerImageId,
        headerVideoUrl: r.headerVideoUrl,
        headerVideoId: r.headerVideoId,
        headerDocumentUrl: r.headerDocumentUrl,
        headerDocumentId: r.headerDocumentId,
        whatsappStatus: r.whatsappStatus,
      };
    });
  }

  async getDueRemindersByOrganization(organizationId: string): Promise<{ id: string; message: string; reminderAt: Date; contactId: string; contactName: string }[]> {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        id: contactReminders.id,
        message: contactReminders.message,
        reminderAt: contactReminders.reminderAt,
        contactId: contactReminders.contactId,
        contactDisplayName: contactReminders.contactDisplayName,
        managedContactName: managedContacts.name,
      })
      .from(contactReminders)
      .innerJoin(managedContacts, eq(contactReminders.contactId, managedContacts.id))
      .where(and(
        eq(contactReminders.organizationId, organizationId),
        gte(contactReminders.reminderAt, from),
        lte(contactReminders.reminderAt, now)
      ))
      .orderBy(asc(contactReminders.reminderAt));
    return rows.map((r) => ({
      id: r.id,
      message: r.message,
      reminderAt: r.reminderAt,
      contactId: r.contactId,
      contactName: (r.contactDisplayName && r.contactDisplayName.trim()) ? r.contactDisplayName.trim() : (r.managedContactName ?? "Contact"),
    }));
  }

  async getUpcomingRemindersByOrganization(organizationId: string): Promise<{ id: string; message: string; reminderAt: Date; contactId: string; contactName: string }[]> {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const rows = await db
      .select({
        id: contactReminders.id,
        message: contactReminders.message,
        reminderAt: contactReminders.reminderAt,
        contactId: contactReminders.contactId,
        contactDisplayName: contactReminders.contactDisplayName,
        managedContactName: managedContacts.name,
      })
      .from(contactReminders)
      .innerJoin(managedContacts, eq(contactReminders.contactId, managedContacts.id))
      .where(and(
        eq(contactReminders.organizationId, organizationId),
        gte(contactReminders.reminderAt, from),
        lte(contactReminders.reminderAt, to)
      ))
      .orderBy(asc(contactReminders.reminderAt));
    return rows.map((r) => ({
      id: r.id,
      message: r.message,
      reminderAt: r.reminderAt,
      contactId: r.contactId,
      contactName: (r.contactDisplayName && r.contactDisplayName.trim()) ? r.contactDisplayName.trim() : (r.managedContactName ?? "Contact"),
    }));
  }

  // Opt keywords methods
  async getOptKeywords(userId: string, organizationId: string, type: 'opt_in' | 'opt_out'): Promise<OptKeyword[]> {
    return await db
      .select()
      .from(optKeywords)
      .where(and(
        eq(optKeywords.userId, userId),
        eq(optKeywords.organizationId, organizationId),
        eq(optKeywords.type, type)
      ))
      .orderBy(asc(optKeywords.createdAt));
  }

  async getOptKeywordsByOrganization(organizationId: string, type: 'opt_in' | 'opt_out'): Promise<OptKeyword[]> {
    if (!organizationId) return [];
    return await db
      .select()
      .from(optKeywords)
      .where(and(
        eq(optKeywords.organizationId, organizationId),
        eq(optKeywords.type, type)
      ))
      .orderBy(asc(optKeywords.createdAt));
  }

  async createOptKeyword(data: InsertOptKeyword): Promise<OptKeyword> {
    const [keyword] = await db
      .insert(optKeywords)
      .values(data)
      .returning();
    return keyword;
  }

  async deleteOptKeyword(id: string, userId: string, organizationId: string): Promise<void> {
    await db
      .delete(optKeywords)
      .where(and(
        eq(optKeywords.id, id),
        eq(optKeywords.userId, userId),
        eq(optKeywords.organizationId, organizationId)
      ));
  }

  async updateOptKeywords(userId: string, organizationId: string, type: 'opt_in' | 'opt_out', keywords: string[]): Promise<OptKeyword[]> {
    // Delete existing keywords of this type
    await db
      .delete(optKeywords)
      .where(and(
        eq(optKeywords.userId, userId),
        eq(optKeywords.organizationId, organizationId),
        eq(optKeywords.type, type)
      ));

    // Insert new keywords
    if (keywords.length > 0) {
      const newKeywords = keywords.map(keyword => ({
        userId,
        organizationId,
        type,
        keyword: keyword.trim(),
      }));

      const inserted = await db
        .insert(optKeywords)
        .values(newKeywords)
        .returning();
      
      return inserted;
    }

    return [];
  }

  async updateOptKeywordsByOrganization(organizationId: string, type: 'opt_in' | 'opt_out', keywords: string[], userId: string): Promise<OptKeyword[]> {
    if (!organizationId) return [];
    // Delete existing keywords for this org+type (any userId)
    await db
      .delete(optKeywords)
      .where(and(
        eq(optKeywords.organizationId, organizationId),
        eq(optKeywords.type, type)
      ));

    if (keywords.length > 0) {
      const newKeywords = keywords.map(keyword => ({
        userId,
        organizationId,
        type,
        keyword: keyword.trim(),
      }));

      const inserted = await db
        .insert(optKeywords)
        .values(newKeywords)
        .returning();
      return inserted;
    }

    return [];
  }

  // Contact Column methods
  async createContactColumn(data: InsertContactColumn): Promise<ContactColumn> {
    const [column] = await db.insert(contactColumns).values({
      ...data,
      updatedAt: new Date(),
    }).returning();
    return column;
  }

  async getContactColumnsByUser(userId: string, organizationId: string): Promise<ContactColumn[]> {
    return await db
      .select()
      .from(contactColumns)
      .where(and(
        eq(contactColumns.userId, userId),
        organizationId ? eq(contactColumns.organizationId, organizationId) : undefined
      ))
      .orderBy(contactColumns.order, contactColumns.createdAt);
  }

  async getContactColumnsByOrganization(organizationId: string): Promise<ContactColumn[]> {
    if (!organizationId) return [];
    return await db
      .select()
      .from(contactColumns)
      .where(eq(contactColumns.organizationId, organizationId))
      .orderBy(contactColumns.order, contactColumns.createdAt);
  }

  async listContactColumnsByOrganization(
    organizationId: string,
    query: { search?: string; limit: number; offset: number }
  ) {
    if (!organizationId) {
      return { items: [], total: 0, limit: query.limit, offset: query.offset };
    }
    const conditions = [eq(contactColumns.organizationId, organizationId)];
    if (query.search?.trim()) {
      const q = `%${query.search.trim().replace(/%/g, "\\%")}%`;
      conditions.push(ilike(contactColumns.label, q));
    }
    const whereClause = and(...conditions);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactColumns)
      .where(whereClause);
    const items = await db
      .select()
      .from(contactColumns)
      .where(whereClause)
      .orderBy(contactColumns.order, contactColumns.createdAt)
      .limit(query.limit)
      .offset(query.offset);
    return { items, total: Number(count) || 0, limit: query.limit, offset: query.offset };
  }

  async getContactColumn(id: string, userId: string, organizationId: string): Promise<ContactColumn | undefined> {
    const [column] = await db
      .select()
      .from(contactColumns)
      .where(and(
        eq(contactColumns.id, id),
        eq(contactColumns.userId, userId),
        organizationId ? eq(contactColumns.organizationId, organizationId) : undefined
      ))
      .limit(1);
    return column;
  }

  async updateContactColumn(id: string, userId: string, organizationId: string, data: Partial<InsertContactColumn>): Promise<ContactColumn | undefined> {
    const [updated] = await db
      .update(contactColumns)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(contactColumns.id, id),
        eq(contactColumns.userId, userId),
        organizationId ? eq(contactColumns.organizationId, organizationId) : undefined
      ))
      .returning();
    return updated;
  }

  async updateContactColumnByOrganization(id: string, organizationId: string, data: Partial<InsertContactColumn>): Promise<ContactColumn | undefined> {
    if (!organizationId) return undefined;
    const [updated] = await db
      .update(contactColumns)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(contactColumns.id, id),
        eq(contactColumns.organizationId, organizationId)
      ))
      .returning();
    return updated;
  }

  async deleteContactColumn(id: string, userId: string, organizationId: string): Promise<void> {
    await db.delete(contactColumns).where(and(
      eq(contactColumns.id, id),
      eq(contactColumns.userId, userId),
      organizationId ? eq(contactColumns.organizationId, organizationId) : undefined
    ));
  }

  async deleteContactColumnByOrganization(id: string, organizationId: string): Promise<void> {
    if (!organizationId) return;
    await db.delete(contactColumns).where(and(
      eq(contactColumns.id, id),
      eq(contactColumns.organizationId, organizationId)
    ));
  }

  // Group methods
  async createGroup(data: InsertGroup): Promise<Group> {
    const [group] = await db.insert(groups).values(data).returning();
    return group;
  }

  async getGroupsByUser(userId: string, organizationId: string): Promise<Group[]> {
    return await db
      .select()
      .from(groups)
      .where(and(
        eq(groups.userId, userId),
        eq(groups.organizationId, organizationId)
      ))
      .orderBy(desc(groups.createdAt));
  }

  async getGroupsByOrganization(organizationId: string): Promise<Group[]> {
    return await db
      .select()
      .from(groups)
      .where(eq(groups.organizationId, organizationId))
      .orderBy(desc(groups.createdAt));
  }

  async listGroupsByOrganization(
    organizationId: string,
    query: { search?: string; limit: number; offset: number }
  ) {
    const conditions = [eq(groups.organizationId, organizationId)];
    if (query.search?.trim()) {
      const q = `%${query.search.trim().replace(/%/g, "\\%")}%`;
      conditions.push(
        or(ilike(groups.name, q), sql`COALESCE(${groups.description}, '') ILIKE ${q}`)!
      );
    }
    const whereClause = and(...conditions);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(groups)
      .where(whereClause);
    const items = await db
      .select()
      .from(groups)
      .where(whereClause)
      .orderBy(desc(groups.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, total: Number(count) || 0, limit: query.limit, offset: query.offset };
  }

  async getGroup(id: string, userId: string, organizationId: string): Promise<Group | undefined> {
    const [group] = await db
      .select()
      .from(groups)
      .where(and(
        eq(groups.id, id),
        eq(groups.userId, userId),
        eq(groups.organizationId, organizationId)
      ))
      .limit(1);
    return group;
  }

  async getGroupByOrganization(id: string, organizationId: string): Promise<Group | undefined> {
    if (!organizationId) return undefined;
    const [group] = await db
      .select()
      .from(groups)
      .where(and(
        eq(groups.id, id),
        eq(groups.organizationId, organizationId)
      ))
      .limit(1);
    return group;
  }

  async updateGroup(id: string, userId: string, organizationId: string, data: Partial<InsertGroup>): Promise<Group | undefined> {
    const [updated] = await db
      .update(groups)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(groups.id, id),
        eq(groups.userId, userId),
        eq(groups.organizationId, organizationId)
      ))
      .returning();
    return updated;
  }

  async updateGroupByOrganization(id: string, organizationId: string, data: Partial<InsertGroup>): Promise<Group | undefined> {
    if (!organizationId) return undefined;
    const [updated] = await db
      .update(groups)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(groups.id, id),
        eq(groups.organizationId, organizationId)
      ))
      .returning();
    return updated;
  }

  async deleteGroup(id: string, userId: string, organizationId: string): Promise<void> {
    await db.delete(groups).where(and(
      eq(groups.id, id),
      eq(groups.userId, userId),
      eq(groups.organizationId, organizationId)
    ));
  }

  async deleteGroupByOrganization(id: string, organizationId: string): Promise<void> {
    if (!organizationId) return;
    await db.delete(groups).where(and(
      eq(groups.id, id),
      eq(groups.organizationId, organizationId)
    ));
  }

  // Group member methods
  async addGroupMember(data: InsertGroupMember, userId: string, organizationId: string): Promise<GroupMember> {
    // Verify group ownership with org isolation
    const group = await db
      .select()
      .from(groups)
      .where(and(
        eq(groups.id, data.groupId),
        eq(groups.userId, userId),
        eq(groups.organizationId, organizationId)
      ))
      .limit(1);
    
    if (!group.length) {
      throw new Error('Group not found or access denied');
    }
    
    const [member] = await db.insert(groupMembers).values(data).returning();
    return member;
  }

  async addGroupMemberByOrganization(data: InsertGroupMember, organizationId: string): Promise<GroupMember> {
    const group = await this.getGroupByOrganization(data.groupId, organizationId);
    if (!group) throw new Error('Group not found or access denied');
    const [member] = await db.insert(groupMembers).values(data).returning();
    return member;
  }

  async getGroupMembers(groupId: string, userId: string, organizationId: string): Promise<GroupMember[]> {
    // Verify group ownership with org isolation
    const group = await db
      .select()
      .from(groups)
      .where(and(
        eq(groups.id, groupId),
        eq(groups.userId, userId),
        eq(groups.organizationId, organizationId)
      ))
      .limit(1);
    
    if (!group.length) return [];
    
    return await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
  }

  async getGroupMembersByOrganization(groupId: string, organizationId: string): Promise<GroupMember[]> {
    const group = await this.getGroupByOrganization(groupId, organizationId);
    if (!group) return [];
    return await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
  }

  async removeGroupMember(id: string, userId: string, organizationId: string): Promise<void> {
    // Verify ownership via group with org isolation
    const member = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.id, id))
      .limit(1);
    
    if (!member.length) return;
    
    const group = await db
      .select()
      .from(groups)
      .where(and(
        eq(groups.id, member[0].groupId),
        eq(groups.userId, userId),
        eq(groups.organizationId, organizationId)
      ))
      .limit(1);
    
    if (!group.length) return;
    
    await db.delete(groupMembers).where(eq(groupMembers.id, id));
  }

  async removeGroupMemberByOrganization(memberId: string, organizationId: string): Promise<void> {
    const [member] = await db.select().from(groupMembers).where(eq(groupMembers.id, memberId)).limit(1);
    if (!member) return;
    const group = await this.getGroupByOrganization(member.groupId, organizationId);
    if (!group) return;
    await db.delete(groupMembers).where(eq(groupMembers.id, memberId));
  }

  // Campaign methods
  async createCampaign(data: InsertCampaign): Promise<Campaign> {
    const [campaign] = await db.insert(campaigns).values(data).returning();
    return campaign;
  }

  async getCampaignsByUser(userId: string, organizationId: string): Promise<Campaign[]> {
    return await db
      .select()
      .from(campaigns)
      .where(and(
        eq(campaigns.userId, userId),
        eq(campaigns.organizationId, organizationId)
      ))
      .orderBy(desc(campaigns.createdAt));
  }

  async getCampaignsByOrganization(organizationId: string): Promise<Campaign[]> {
    return await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.organizationId, organizationId))
      .orderBy(desc(campaigns.createdAt));
  }

  async listCampaignsByOrganization(
    organizationId: string,
    query: { search?: string; limit: number; offset: number }
  ) {
    const conditions = [eq(campaigns.organizationId, organizationId)];
    if (query.search?.trim()) {
      const q = `%${query.search.trim().replace(/%/g, "\\%")}%`;
      conditions.push(or(ilike(campaigns.name, q), ilike(campaigns.messageTemplate, q))!);
    }
    const whereClause = and(...conditions);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaigns)
      .where(whereClause);
    const items = await db
      .select()
      .from(campaigns)
      .where(whereClause)
      .orderBy(desc(campaigns.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, total: Number(count) || 0, limit: query.limit, offset: query.offset };
  }

  async getCampaign(id: string, userId: string, organizationId: string): Promise<Campaign | undefined> {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(
        eq(campaigns.id, id),
        eq(campaigns.userId, userId),
        eq(campaigns.organizationId, organizationId)
      ))
      .limit(1);
    return campaign;
  }

  async getCampaignByOrganization(id: string, organizationId: string): Promise<Campaign | undefined> {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, organizationId)))
      .limit(1);
    return campaign;
  }

  /** Reuse a gallery header URL from a past campaign for the same template (flow automation fallback). */
  async getDefaultTemplateHeaderImageUrl(
    organizationId: string,
    templateName: string
  ): Promise<string | null> {
    const name = templateName.trim();
    if (!name) return null;
    const [row] = await db
      .select({ url: campaigns.headerImageUrl })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.organizationId, organizationId),
          isNotNull(campaigns.headerImageUrl),
          or(
            ilike(campaigns.messageTemplate, name),
            ilike(campaigns.templateId, name)
          )
        )
      )
      .orderBy(desc(campaigns.startedAt), desc(campaigns.createdAt))
      .limit(1);
    const url = row?.url?.trim();
    return url || null;
  }

  async updateCampaign(id: string, userId: string, organizationId: string, data: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const [updated] = await db
      .update(campaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(campaigns.id, id),
        eq(campaigns.userId, userId),
        eq(campaigns.organizationId, organizationId)
      ))
      .returning();
    return updated;
  }

  async deleteCampaign(id: string, userId: string, organizationId: string): Promise<void> {
    await db.delete(campaigns).where(and(
      eq(campaigns.id, id),
      eq(campaigns.userId, userId),
      eq(campaigns.organizationId, organizationId)
    ));
  }

  async updateCampaignByOrganization(id: string, organizationId: string, data: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const [updated] = await db
      .update(campaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, organizationId)))
      .returning();
    return updated;
  }

  async deleteCampaignByOrganization(id: string, organizationId: string): Promise<void> {
    await db
      .delete(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, organizationId)));
  }

  async updateCampaignStats(id: string, userId: string, organizationId: string | undefined, stats: Partial<Pick<Campaign, 'sentCount' | 'deliveredCount' | 'readCount' | 'failedCount' | 'totalRecipients'>>): Promise<void> {
    const conditions = [
      eq(campaigns.id, id),
      eq(campaigns.userId, userId),
    ];
    if (organizationId) {
      conditions.push(eq(campaigns.organizationId, organizationId));
    }
    await db
      .update(campaigns)
      .set({ ...stats, updatedAt: new Date() })
      .where(and(...conditions));
  }

  async updateCampaignExecution(id: string, userId: string, organizationId: string, data: Partial<Pick<Campaign, 'status' | 'startedAt' | 'completedAt' | 'sentCount' | 'failedCount' | 'retryNextAt' | 'retryAttemptCount'>>): Promise<Campaign | undefined> {
    const [updated] = await db
      .update(campaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(campaigns.id, id),
        eq(campaigns.userId, userId),
        eq(campaigns.organizationId, organizationId)
      ))
      .returning();
    
    return updated;
  }

  async updateCampaignExecutionByOrganization(id: string, organizationId: string, data: Partial<Pick<Campaign, 'status' | 'startedAt' | 'completedAt' | 'sentCount' | 'failedCount' | 'retryNextAt' | 'retryAttemptCount'>>): Promise<Campaign | undefined> {
    const [updated] = await db
      .update(campaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, organizationId)))
      .returning();
    return updated;
  }

  async claimCampaignFailedAutoRetry(campaignId: string, userId: string, organizationId: string): Promise<boolean> {
    const orgMatch =
      organizationId && organizationId.trim() !== ''
        ? eq(campaigns.organizationId, organizationId)
        : isNull(campaigns.organizationId);
    const [updated] = await db
      .update(campaigns)
      .set({ failedAutoRetryAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.userId, userId),
          orgMatch,
          isNull(campaigns.failedAutoRetryAt)
        )
      )
      .returning();
    return !!updated;
  }

  async getDueCampaignRetries(now: Date = new Date()): Promise<Campaign[]> {
    return db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.retryEnabled, true),
          isNotNull(campaigns.retryNextAt),
          lte(campaigns.retryNextAt, now),
          or(eq(campaigns.status, "completed"), eq(campaigns.status, "failed"))
        )
      )
      .orderBy(campaigns.retryNextAt);
  }

  async claimDueCampaignRetry(campaignId: string): Promise<Campaign | undefined> {
    const now = new Date();
    const [updated] = await db
      .update(campaigns)
      .set({
        retryNextAt: null,
        retryAttemptCount: sql`${campaigns.retryAttemptCount} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.retryEnabled, true),
          isNotNull(campaigns.retryNextAt),
          lte(campaigns.retryNextAt, now)
        )
      )
      .returning();
    return updated;
  }

  async scheduleCampaignConfiguredRetry(
    campaignId: string,
    userId: string,
    organizationId: string,
    nextAt: Date
  ): Promise<void> {
    const orgMatch =
      organizationId && organizationId.trim() !== ""
        ? eq(campaigns.organizationId, organizationId)
        : isNull(campaigns.organizationId);
    await db
      .update(campaigns)
      .set({ retryNextAt: nextAt, updatedAt: new Date() })
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId), orgMatch));
  }

  // Campaign recipient methods
  async addCampaignRecipient(data: InsertCampaignRecipient, userId: string, organizationId: string): Promise<CampaignRecipient> {
    // Verify campaign ownership with org isolation
    const campaign = await db
      .select()
      .from(campaigns)
      .where(and(
        eq(campaigns.id, data.campaignId),
        eq(campaigns.userId, userId),
        eq(campaigns.organizationId, organizationId)
      ))
      .limit(1);
    
    if (!campaign.length) {
      throw new Error('Campaign not found or access denied');
    }
    
    const [recipient] = await db.insert(campaignRecipients).values(data).returning();
    return recipient;
  }

  async addCampaignRecipientByOrganization(data: InsertCampaignRecipient, organizationId: string): Promise<CampaignRecipient> {
    const campaign = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, data.campaignId), eq(campaigns.organizationId, organizationId)))
      .limit(1);
    if (!campaign.length) throw new Error('Campaign not found or access denied');
    const [recipient] = await db.insert(campaignRecipients).values(data).returning();
    return recipient;
  }

  async insertCampaignRecipientsBulk(
    campaignId: string,
    userId: string,
    organizationId: string,
    rawRecipients: unknown[]
  ): Promise<{ inserted: number; skipped: number }> {
    const campaign = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.userId, userId),
          eq(campaigns.organizationId, organizationId)
        )
      )
      .limit(1);
    if (!campaign.length) {
      throw new Error("Campaign not found or access denied");
    }

    const rows: InsertCampaignRecipient[] = [];
    let skipped = 0;
    for (const raw of rawRecipients) {
      if (!raw || typeof raw !== "object") {
        skipped++;
        continue;
      }
      const o = raw as Record<string, unknown>;
      const phone = String(o.phoneNumber ?? o.phone ?? "").trim();
      if (!phone) {
        skipped++;
        continue;
      }
      const nameRaw = o.name;
      const name =
        nameRaw != null && String(nameRaw).trim() ? String(nameRaw).trim().slice(0, 512) : undefined;
      const contactId =
        typeof o.contactId === "string" && o.contactId.trim() ? o.contactId.trim().slice(0, 128) : undefined;

      const parsed = insertCampaignRecipientSchema.safeParse({
        campaignId,
        phoneNumber: phone,
        name,
        contactId,
        status: "pending" as const,
      });
      if (!parsed.success) {
        skipped++;
        continue;
      }
      rows.push(parsed.data);
    }

    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      if (chunk.length === 0) continue;
      await db.insert(campaignRecipients).values(chunk as InsertCampaignRecipient[]);
      inserted += chunk.length;
    }

    if (skipped > 0) {
      console.warn(
        `[Campaign] Bulk insert: ${inserted} inserted, ${skipped} skipped (invalid/missing phone or schema)`
      );
    }
    return { inserted, skipped };
  }

  async getManagedContactsByIdsForOrganization(
    organizationId: string,
    ids: string[]
  ): Promise<Map<string, ManagedContact>> {
    const out = new Map<string, ManagedContact>();
    if (!organizationId) return out;
    const unique = [...new Set(ids.filter(Boolean))];
    const CHUNK = 400;
    for (let i = 0; i < unique.length; i += CHUNK) {
      const slice = unique.slice(i, i + CHUNK);
      if (slice.length === 0) continue;
      const list = await db
        .select()
        .from(managedContacts)
        .where(and(eq(managedContacts.organizationId, organizationId), inArray(managedContacts.id, slice)));
      for (const c of list) {
        out.set(c.id, c);
      }
    }
    return out;
  }

  async getCampaignRecipients(campaignId: string, userId: string, organizationId: string): Promise<CampaignRecipient[]> {
    // Verify campaign ownership with org isolation
    const campaign = await db
      .select()
      .from(campaigns)
      .where(and(
        eq(campaigns.id, campaignId),
        eq(campaigns.userId, userId),
        eq(campaigns.organizationId, organizationId)
      ))
      .limit(1);
    
    if (!campaign.length) return [];
    
    return await db
      .select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, campaignId));
  }

  async getCampaignRecipientsByOrganization(campaignId: string, organizationId: string): Promise<CampaignRecipient[]> {
    const campaign = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.organizationId, organizationId)))
      .limit(1);
    if (!campaign.length) return [];
    return await db
      .select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, campaignId));
  }

  async markCampaignPendingRecipientsFailed(
    campaignId: string,
    userId: string,
    organizationId: string,
    errorMessage: string
  ): Promise<number> {
    const campaign = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.userId, userId),
          eq(campaigns.organizationId, organizationId)
        )
      )
      .limit(1);
    if (!campaign.length) return 0;
    const msg = errorMessage.slice(0, 2000);
    const updated = await db
      .update(campaignRecipients)
      .set({ status: 'failed', errorMessage: msg })
      .where(and(eq(campaignRecipients.campaignId, campaignId), eq(campaignRecipients.status, 'pending')))
      .returning();
    return updated.length;
  }

  async updateCampaignRecipientStatus(id: string, userId: string, organizationId: string, status: CampaignRecipient['status'], messageId?: string, errorMessage?: string): Promise<void> {
    // Verify ownership via campaign with org isolation
    const recipient = await db
      .select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.id, id))
      .limit(1);
    
    if (!recipient.length) return;
    
    const campaign = await db
      .select()
      .from(campaigns)
      .where(and(
        eq(campaigns.id, recipient[0].campaignId),
        eq(campaigns.userId, userId),
        eq(campaigns.organizationId, organizationId)
      ))
      .limit(1);
    
    if (!campaign.length) return;
    
    const updateData: any = { status };
    if (messageId) updateData.messageId = messageId;
    if (status === 'sent') updateData.sentAt = new Date();
    if (status === 'delivered') updateData.deliveredAt = new Date();
    if (status === 'read') updateData.readAt = new Date();
    if (status === 'failed' && errorMessage) updateData.errorMessage = errorMessage.slice(0, 2000);
    if (status === 'sent' || status === 'delivered' || status === 'read') updateData.errorMessage = null;

    await db
      .update(campaignRecipients)
      .set(updateData)
      .where(eq(campaignRecipients.id, id));
  }

  async updateCampaignRecipientStatusByOrganization(recipientId: string, organizationId: string, status: CampaignRecipient['status'], messageId?: string): Promise<void> {
    const recipient = await db
      .select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.id, recipientId))
      .limit(1);
    if (!recipient.length) return;
    const campaign = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, recipient[0].campaignId), eq(campaigns.organizationId, organizationId)))
      .limit(1);
    if (!campaign.length) return;
    const updateData: any = { status };
    if (messageId) updateData.messageId = messageId;
    if (status === 'sent') updateData.sentAt = new Date();
    if (status === 'delivered') updateData.deliveredAt = new Date();
    if (status === 'read') updateData.readAt = new Date();
    await db.update(campaignRecipients).set(updateData).where(eq(campaignRecipients.id, recipientId));
  }

  async updateCampaignRecipientStatusByWhatsAppMessageId(whatsappMessageId: string, status: CampaignRecipient['status'], errorMessage?: string): Promise<boolean> {
    if (!whatsappMessageId) return false;
    const recipient = await db
      .select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.messageId, whatsappMessageId))
      .limit(1);
    if (!recipient.length) return false;
    const campaign = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, recipient[0].campaignId))
      .limit(1);
    if (!campaign.length) return false;
    const updateData: any = { status };
    if (status === 'sent') updateData.sentAt = new Date();
    if (status === 'delivered') updateData.deliveredAt = new Date();
    if (status === 'read') updateData.readAt = new Date();
    if (status === 'failed' && errorMessage) updateData.errorMessage = errorMessage;
    await db
      .update(campaignRecipients)
      .set(updateData)
      .where(eq(campaignRecipients.id, recipient[0].id));
    return true;
  }

  async recordCampaignButtonClick(whatsappMessageId: string, buttonId: string, buttonTitle: string): Promise<boolean> {
    if (!whatsappMessageId || !buttonId) return false;
    // Look up by exact ID first; WhatsApp may send context.id with or without "wamid." prefix
    let recipient = await db
      .select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.messageId, whatsappMessageId))
      .limit(1);
    if (!recipient.length && whatsappMessageId.startsWith('wamid.')) {
      recipient = await db
        .select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.messageId, whatsappMessageId.slice(6)))
        .limit(1);
    }
    if (!recipient.length && !whatsappMessageId.startsWith('wamid.')) {
      recipient = await db
        .select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.messageId, 'wamid.' + whatsappMessageId))
        .limit(1);
    }
    if (!recipient.length) return false;
    const campaignRecipientId = recipient[0].id;
    const campaignId = recipient[0].campaignId;
    // Only record first click per recipient (CTA report counts unique recipients; repeat clicks don't increase count)
    const existing = await db
      .select({ id: campaignRecipientButtonClicks.id })
      .from(campaignRecipientButtonClicks)
      .where(eq(campaignRecipientButtonClicks.campaignRecipientId, campaignRecipientId))
      .limit(1);
    if (existing.length > 0) return true; // Already counted for this recipient
    await db.insert(campaignRecipientButtonClicks).values({
      campaignRecipientId,
      campaignId,
      buttonId,
      buttonTitle: buttonTitle || buttonId,
    });
    return true;
  }

  async getCampaignButtonClickCounts(campaignId: string): Promise<Array<{ buttonId: string; buttonTitle: string; count: number }>> {
    const rows = await db
      .select({
        buttonId: campaignRecipientButtonClicks.buttonId,
        buttonTitle: campaignRecipientButtonClicks.buttonTitle,
        count: sql<number>`count(*)::int`,
      })
      .from(campaignRecipientButtonClicks)
      .where(eq(campaignRecipientButtonClicks.campaignId, campaignId))
      .groupBy(campaignRecipientButtonClicks.buttonId, campaignRecipientButtonClicks.buttonTitle)
      .orderBy(sql`count(*) desc`);
    return rows;
  }

  async getCampaignButtonClickReport(campaignId: string): Promise<Array<{
    phoneNumber: string;
    name: string | null;
    buttonId: string;
    buttonTitle: string;
    clickedAt: Date;
  }>> {
    const rows = await db
      .select({
        phoneNumber: campaignRecipients.phoneNumber,
        name: campaignRecipients.name,
        buttonId: campaignRecipientButtonClicks.buttonId,
        buttonTitle: campaignRecipientButtonClicks.buttonTitle,
        clickedAt: campaignRecipientButtonClicks.clickedAt,
      })
      .from(campaignRecipientButtonClicks)
      .innerJoin(campaignRecipients, eq(campaignRecipientButtonClicks.campaignRecipientId, campaignRecipients.id))
      .where(eq(campaignRecipientButtonClicks.campaignId, campaignId))
      .orderBy(desc(campaignRecipientButtonClicks.clickedAt));
    return rows;
  }

  async createTrackedUrl(data: {
    destinationUrl: string;
    organizationId?: string | null;
    userId?: string | null;
    campaignId?: string | null;
  }): Promise<{ id: string; code: string; destinationUrl: string }> {
    const code = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 12);
    const [row] = await db.insert(trackedUrls).values({
      code,
      destinationUrl: data.destinationUrl,
      organizationId: data.organizationId || null,
      userId: data.userId || null,
      campaignId: data.campaignId || null,
    }).returning();
    return { id: row.id, code: row.code, destinationUrl: row.destinationUrl };
  }

  async getTrackedUrlByCode(code: string): Promise<{
    id: string;
    code: string;
    destinationUrl: string;
    organizationId: string | null;
    campaignId: string | null;
  } | undefined> {
    const [row] = await db.select().from(trackedUrls).where(eq(trackedUrls.code, code)).limit(1);
    if (!row) return undefined;
    return {
      id: row.id,
      code: row.code,
      destinationUrl: row.destinationUrl,
      organizationId: row.organizationId,
      campaignId: row.campaignId,
    };
  }

  async recordTrackedUrlClick(trackedUrlId: string, meta?: { campaignId?: string | null; ip?: string; userAgent?: string }): Promise<void> {
    await db.insert(trackedUrlClicks).values({
      trackedUrlId,
      campaignId: meta?.campaignId || null,
      ip: meta?.ip || null,
      userAgent: meta?.userAgent || null,
    });
  }

  async getCampaignUrlClickReport(campaignId: string, organizationId: string): Promise<Array<{
    destinationUrl: string;
    code: string;
    clickedAt: Date;
    ip: string | null;
  }>> {
    const rows = await db
      .select({
        destinationUrl: trackedUrls.destinationUrl,
        code: trackedUrls.code,
        clickedAt: trackedUrlClicks.clickedAt,
        ip: trackedUrlClicks.ip,
      })
      .from(trackedUrlClicks)
      .innerJoin(trackedUrls, eq(trackedUrlClicks.trackedUrlId, trackedUrls.id))
      .where(
        or(
          eq(trackedUrlClicks.campaignId, campaignId),
          eq(trackedUrls.campaignId, campaignId),
          eq(trackedUrls.organizationId, organizationId)
        )
      )
      .orderBy(desc(trackedUrlClicks.clickedAt));
    return rows;
  }

  async getCampaignUniqueButtonClickRecipients(campaignId: string): Promise<string[]> {
    // Get unique campaign recipient IDs who clicked any button (count once per recipient)
    const rows = await db
      .select({
        campaignRecipientId: campaignRecipientButtonClicks.campaignRecipientId,
      })
      .from(campaignRecipientButtonClicks)
      .where(eq(campaignRecipientButtonClicks.campaignId, campaignId));
    // Get unique recipient IDs (remove duplicates)
    const uniqueIds = [...new Set(rows.map(r => r.campaignRecipientId))];
    return uniqueIds;
  }

  async getCampaignRecipientButtonClickTimestamps(campaignId: string): Promise<Map<string, string>> {
    // Get first button click timestamp per recipient (earliest click for each recipient)
    const rows = await db
      .select({
        campaignRecipientId: campaignRecipientButtonClicks.campaignRecipientId,
        clickedAt: campaignRecipientButtonClicks.clickedAt,
      })
      .from(campaignRecipientButtonClicks)
      .where(eq(campaignRecipientButtonClicks.campaignId, campaignId))
      .orderBy(asc(campaignRecipientButtonClicks.clickedAt));
    
    // Map recipient ID to their first click timestamp
    const timestampMap = new Map<string, string>();
    for (const row of rows) {
      if (!timestampMap.has(row.campaignRecipientId) && row.clickedAt) {
        timestampMap.set(row.campaignRecipientId, row.clickedAt.toISOString());
      }
    }
    return timestampMap;
  }

  // Message activity log methods (for dashboard analytics)
  async getMessageActivityForDateRange(userId: string, startDate: string, endDate: string): Promise<MessageActivityLog[]> {
    return await db
      .select()
      .from(messageActivityLog)
      .where(and(
        eq(messageActivityLog.userId, userId),
        gte(messageActivityLog.date, startDate),
        lte(messageActivityLog.date, endDate)
      ))
      .orderBy(messageActivityLog.date);
  }

  async getMessageActivityForDateRangeByOrganization(organizationId: string, startDate: string, endDate: string): Promise<Array<{ date: string; messageCount: number }>> {
    const rows = await db
      .select({
        date: messageActivityLog.date,
        messageCount: sql<number>`sum(${messageActivityLog.messageCount})::int`,
      })
      .from(messageActivityLog)
      .where(and(
        eq(messageActivityLog.organizationId, organizationId),
        gte(messageActivityLog.date, startDate),
        lte(messageActivityLog.date, endDate)
      ))
      .groupBy(messageActivityLog.date)
      .orderBy(messageActivityLog.date);
    return rows.map((r) => ({ date: r.date, messageCount: Number(r.messageCount) || 0 }));
  }

  async logMessageActivity(data: InsertMessageActivityLog): Promise<void> {
    // Upsert: if record for this user+org+date exists, increment count; otherwise create new
    const whereConditions = [
      eq(messageActivityLog.userId, data.userId),
      eq(messageActivityLog.date, data.date)
    ];
    
    if (data.organizationId) {
      whereConditions.push(eq(messageActivityLog.organizationId, data.organizationId));
    }

    const existing = await db
      .select()
      .from(messageActivityLog)
      .where(and(...whereConditions))
      .limit(1);

    if (existing.length > 0) {
      // Increment existing count
      const incrementBy = data.messageCount || 0;
      await db
        .update(messageActivityLog)
        .set({ messageCount: existing[0].messageCount + incrementBy })
        .where(eq(messageActivityLog.id, existing[0].id));
    } else {
      // Create new record
      await db.insert(messageActivityLog).values(data);
    }
  }

  // Message template methods
  async upsertMessageTemplate(data: InsertMessageTemplate): Promise<MessageTemplate> {
    const existing = await db
      .select()
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.userId, data.userId),
          eq(messageTemplates.templateId, data.templateId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(messageTemplates)
        .set({
          ...data,
          updatedAt: new Date(),
          syncedAt: new Date(),
        })
        .where(eq(messageTemplates.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [inserted] = await db
        .insert(messageTemplates)
        .values({
          ...data,
          syncedAt: new Date(),
        })
        .returning();
      return inserted;
    }
  }

  async getMessageTemplatesByUser(userId: string, organizationId?: string, phoneNumberId?: string): Promise<MessageTemplate[]> {
    const conditions = [eq(messageTemplates.userId, userId)];
    if (organizationId) {
      conditions.push(eq(messageTemplates.organizationId, organizationId));
    }
    if (phoneNumberId) {
      conditions.push(eq(messageTemplates.phoneNumberId, phoneNumberId));
    }
    return await db
      .select()
      .from(messageTemplates)
      .where(and(...conditions))
      .orderBy(desc(messageTemplates.createdAt), desc(messageTemplates.syncedAt));
  }

  async getMessageTemplatesByOrganization(organizationId: string, phoneNumberId?: string): Promise<MessageTemplate[]> {
    // Include templates for this org OR legacy templates (organization_id IS NULL) so previously synced templates still show
    const orgCondition = eq(messageTemplates.organizationId, organizationId);
    const conditions = phoneNumberId
      ? [orgCondition, eq(messageTemplates.phoneNumberId, phoneNumberId)]
      : [orgCondition];
    return await db
      .select()
      .from(messageTemplates)
      .where(and(...conditions))
      .orderBy(desc(messageTemplates.createdAt), desc(messageTemplates.syncedAt));
  }

  async backfillMessageTemplatesOrganizationForPhone(userId: string, phoneNumberId: string, organizationId: string): Promise<number> {
    const updated = await db
      .update(messageTemplates)
      .set({
        organizationId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(messageTemplates.userId, userId),
          eq(messageTemplates.phoneNumberId, phoneNumberId),
          or(isNull(messageTemplates.organizationId), ne(messageTemplates.organizationId, organizationId))
        )
      )
      .returning({ id: messageTemplates.id });
    return updated.length;
  }

  async getMessageTemplate(id: string, userId: string): Promise<MessageTemplate | undefined> {
    const [template] = await db
      .select()
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.id, id),
          eq(messageTemplates.userId, userId)
        )
      )
      .limit(1);
    return template;
  }

  async getMessageTemplateByOrganization(id: string, organizationId: string): Promise<MessageTemplate | undefined> {
    const [template] = await db
      .select()
      .from(messageTemplates)
      .where(and(eq(messageTemplates.id, id), eq(messageTemplates.organizationId, organizationId)))
      .limit(1);
    return template;
  }

  async deleteMessageTemplate(id: string, userId: string): Promise<void> {
    await db
      .delete(messageTemplates)
      .where(
        and(
          eq(messageTemplates.id, id),
          eq(messageTemplates.userId, userId)
        )
      );
  }

  async deleteMessageTemplateByOrganization(id: string, organizationId: string): Promise<void> {
    await db
      .delete(messageTemplates)
      .where(and(eq(messageTemplates.id, id), eq(messageTemplates.organizationId, organizationId)));
  }

  async syncMessageTemplates(userId: string, templates: any[], phoneNumberId?: string, organizationId?: string): Promise<void> {
    // Delete templates that are no longer in Meta (only for this phone number if specified)
    const existingTemplates = await this.getMessageTemplatesByUser(userId, organizationId);
    const metaTemplateIds = new Set(templates.map(t => String(t.id || t.name)));
    const toDelete = existingTemplates.filter(t => {
      const matchesPhoneNumber = !phoneNumberId || t.phoneNumberId === phoneNumberId;
      return matchesPhoneNumber && !metaTemplateIds.has(String(t.templateId));
    });
    
    for (const template of toDelete) {
      if (organizationId) await this.deleteMessageTemplateByOrganization(template.id, organizationId);
      else await this.deleteMessageTemplate(template.id, userId);
    }

    // Upsert all templates from Meta
    for (const template of templates) {
      const templateId = String(template.id || template.name);
      const existing = await db
        .select()
        .from(messageTemplates)
        .where(
          and(
            eq(messageTemplates.userId, userId),
            eq(messageTemplates.templateId, templateId)
          )
        )
        .limit(1);

      // Extract components from Meta template format
      const components = template.components || [];

      const formattedComponents = components.map((comp: any) => {
        const row: any = {
          type: comp.type,
          text: comp.text || comp.format || '',
          format: comp.format,
          buttons: comp.buttons?.map((btn: any) => ({
            type: btn.type,
            text: btn.text,
            url: btn.url,
            phone_number: btn.phone_number,
            otp_type: btn.otp_type,
          })),
          example: comp.example,
        };
        if (Array.isArray(comp.cards)) {
          row.cards = comp.cards;
        }
        return row;
      });

      await this.upsertMessageTemplate({
        userId,
        organizationId: organizationId ?? null,
        templateId,
        name: template.name,
        language: template.language || 'en',
        status: template.status || 'PENDING',
        category: template.category || 'MARKETING',
        phoneNumberId: phoneNumberId,
        components: formattedComponents,
        metaData: {
          ...(existing[0]?.metaData || {}),
          qualityScore: template.quality_score,
          lastApprovedDate: template.last_approved_date,
          lastRejectedDate: template.last_rejected_date,
          rejectionReason: template.rejection_reason,
        },
      });
    }
  }

  // Message sync request methods
  async createMessageSyncRequest(data: InsertMessageSyncRequest): Promise<MessageSyncRequest> {
    const [request] = await db
      .insert(messageSyncRequests)
      .values(data)
      .returning();
    return request;
  }

  async getMessageSyncRequestsByUser(userId: string, organizationId?: string): Promise<MessageSyncRequest[]> {
    const conditions = [eq(messageSyncRequests.userId, userId)];
    if (organizationId) {
      conditions.push(eq(messageSyncRequests.organizationId, organizationId));
    }
    return await db
      .select()
      .from(messageSyncRequests)
      .where(and(...conditions))
      .orderBy(desc(messageSyncRequests.requestedAt));
  }

  async getMessageSyncRequest(id: string, userId: string): Promise<MessageSyncRequest | undefined> {
    const [request] = await db
      .select()
      .from(messageSyncRequests)
      .where(
        and(
          eq(messageSyncRequests.id, id),
          eq(messageSyncRequests.userId, userId)
        )
      )
      .limit(1);
    return request;
  }

  async updateMessageSyncRequest(id: string, userId: string, data: Partial<InsertMessageSyncRequest>): Promise<MessageSyncRequest | undefined> {
    const [updated] = await db
      .update(messageSyncRequests)
      .set(data)
      .where(
        and(
          eq(messageSyncRequests.id, id),
          eq(messageSyncRequests.userId, userId)
        )
      )
      .returning();
    return updated;
  }

  async getMessageSyncRequestsByStatus(status: MessageSyncRequest['status']): Promise<MessageSyncRequest[]> {
    return await db
      .select()
      .from(messageSyncRequests)
      .where(eq(messageSyncRequests.status, status))
      .orderBy(desc(messageSyncRequests.requestedAt));
  }

  // Integration methods
  async createIntegration(data: InsertIntegration): Promise<Integration> {
    // Encrypt credentials if provided
    const encryptedData = { ...data };
    if (data.credentials) {
      encryptedData.credentials = encryptCredentials(data.credentials);
    }
    const [integration] = await db.insert(integrations).values(encryptedData as any).returning();
    return integration;
  }

  async getIntegrationsByUser(userId: string, organizationId?: string): Promise<Integration[]> {
    const conditions = [eq(integrations.userId, userId)];
    if (organizationId) {
      // Include both org-specific and user-level (null org) integrations so OpenAI connections show in AI assistant, flows, etc.
      conditions.push(or(eq(integrations.organizationId, organizationId), isNull(integrations.organizationId)));
    }
    const results = await db
      .select()
      .from(integrations)
      .where(and(...conditions))
      .orderBy(desc(integrations.createdAt));
    
    // Decrypt credentials
    return results.map(integration => ({
      ...integration,
      credentials: integration.credentials ? decryptCredentials(integration.credentials) : null,
    }));
  }

  async getIntegrationsByOrganization(organizationId: string): Promise<Integration[]> {
    const results = await db
      .select()
      .from(integrations)
      .where(eq(integrations.organizationId, organizationId))
      .orderBy(desc(integrations.createdAt));
    return results.map(integration => ({
      ...integration,
      credentials: integration.credentials ? decryptCredentials(integration.credentials) : null,
    }));
  }

  async getRecentConnectedWhatsAppIntegrations(withinMs: number, limit = 25): Promise<Integration[]> {
    const since = new Date(Date.now() - withinMs);
    const results = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.name, "whatsapp-business"),
          eq(integrations.status, "connected"),
          gte(integrations.createdAt, since)
        )
      )
      .orderBy(desc(integrations.createdAt))
      .limit(limit);
    return results.map((integration) => ({
      ...integration,
      credentials: integration.credentials ? decryptCredentials(integration.credentials) : null,
    }));
  }

  async getIntegrationById(id: string): Promise<Integration | undefined> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, id))
      .limit(1);
    if (!integration) return undefined;
    return {
      ...integration,
      credentials: integration.credentials ? decryptCredentials(integration.credentials) : null,
    };
  }

  async getAllIntegrationsByName(name: string): Promise<Integration[]> {
    const results = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.name, name), eq(integrations.status, "connected")));
    return results.map((i) => ({
      ...i,
      credentials: i.credentials ? decryptCredentials(i.credentials) : null,
    }));
  }

  async getIntegration(id: string, userId: string): Promise<Integration | undefined> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.userId, userId)))
      .limit(1);
    
    if (!integration) return undefined;
    
    return {
      ...integration,
      credentials: integration.credentials ? decryptCredentials(integration.credentials) : null,
    };
  }

  async getIntegrationByName(name: string, userId: string, organizationId?: string): Promise<Integration | undefined> {
    const conditions = [
      eq(integrations.name, name),
      eq(integrations.userId, userId)
    ];
    if (organizationId) {
      conditions.push(eq(integrations.organizationId, organizationId));
    }
    const [integration] = await db
      .select()
      .from(integrations)
      .where(and(...conditions))
      .limit(1);
    
    if (!integration) return undefined;
    
    return {
      ...integration,
      credentials: integration.credentials ? decryptCredentials(integration.credentials) : null,
    };
  }

  async getWhatsAppChatWidgetByPublicId(publicId: string): Promise<Integration | undefined> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.name, "whatsapp-chat-widget"),
          sql`${integrations.config}->>'widgetPublicId' = ${publicId}`,
        ),
      )
      .limit(1);

    if (!integration) return undefined;

    return {
      ...integration,
      credentials: integration.credentials ? decryptCredentials(integration.credentials) : null,
    };
  }

  async updateIntegration(id: string, userId: string, data: Partial<InsertIntegration>): Promise<Integration | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    
    // Encrypt credentials if provided
    if (data.credentials) {
      updateData.credentials = encryptCredentials(data.credentials);
    }
    
    const [updated] = await db
      .update(integrations)
      .set(updateData)
      .where(and(eq(integrations.id, id), eq(integrations.userId, userId)))
      .returning();
    
    if (!updated) return undefined;
    
    return {
      ...updated,
      credentials: updated.credentials ? decryptCredentials(updated.credentials) : null,
    };
  }

  async deleteIntegration(id: string, userId: string): Promise<void> {
    await db
      .delete(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.userId, userId)));
  }

  async createContactPaymentRequest(data: InsertContactPaymentRequest): Promise<ContactPaymentRequestRow> {
    const [row] = await db.insert(contactPaymentRequests).values(data as any).returning();
    if (!row) throw new Error("Failed to create contact payment request");
    return row;
  }

  async getContactPaymentRequestByToken(token: string): Promise<ContactPaymentRequestRow | undefined> {
    const [row] = await db
      .select()
      .from(contactPaymentRequests)
      .where(eq(contactPaymentRequests.token, token))
      .limit(1);
    return row;
  }

  async getContactPaymentRequestsByOrganization(
    organizationId: string,
    options?: { contactId?: string; limit?: number }
  ): Promise<ContactPaymentRequestRow[]> {
    const lim = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const conds = [eq(contactPaymentRequests.organizationId, organizationId)];
    if (options?.contactId) conds.push(eq(contactPaymentRequests.contactId, options.contactId));
    return db
      .select()
      .from(contactPaymentRequests)
      .where(and(...conds))
      .orderBy(desc(contactPaymentRequests.createdAt))
      .limit(lim);
  }

  async listContactPaymentRequestsByOrganization(
    organizationId: string,
    query: { contactId?: string; search?: string; limit: number; offset: number }
  ) {
    const conditions = [eq(contactPaymentRequests.organizationId, organizationId)];
    if (query.contactId) {
      conditions.push(eq(contactPaymentRequests.contactId, query.contactId));
    }
    if (query.search?.trim()) {
      const q = `%${query.search.trim().replace(/%/g, "\\%")}%`;
      conditions.push(
        or(
          ilike(contactPaymentRequests.customerPhone, q),
          ilike(contactPaymentRequests.status, q),
          ilike(contactPaymentRequests.gateway, q),
          ilike(contactPaymentRequests.gatewayPaymentId, q),
          ilike(contactPaymentRequests.description, q),
          ilike(contactPaymentRequests.currency, q),
          sql`cast(${contactPaymentRequests.amountMinor} as text) like ${q}`
        )!
      );
    }
    const whereClause = and(...conditions);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactPaymentRequests)
      .where(whereClause);
    const items = await db
      .select()
      .from(contactPaymentRequests)
      .where(whereClause)
      .orderBy(desc(contactPaymentRequests.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, total: Number(count) || 0, limit: query.limit, offset: query.offset };
  }

  // Integration OAuth state methods
  async createOAuthState(data: InsertIntegrationOAuthState): Promise<IntegrationOAuthState> {
    const [state] = await db.insert(integrationOAuthStates).values(data as any).returning();
    return state;
  }

  async getOAuthState(state: string): Promise<IntegrationOAuthState | undefined> {
    const [oauthState] = await db
      .select()
      .from(integrationOAuthStates)
      .where(eq(integrationOAuthStates.state, state))
      .limit(1);
    return oauthState;
  }

  async getLatestActiveOAuthState(
    userId: string,
    integrationName: string
  ): Promise<IntegrationOAuthState | undefined> {
    const [oauthState] = await db
      .select()
      .from(integrationOAuthStates)
      .where(
        and(
          eq(integrationOAuthStates.userId, userId),
          eq(integrationOAuthStates.integrationName, integrationName),
          gt(integrationOAuthStates.expiresAt, new Date())
        )
      )
      .orderBy(desc(integrationOAuthStates.createdAt))
      .limit(1);
    return oauthState;
  }

  async updateOAuthState(
    state: string,
    data: Partial<Pick<IntegrationOAuthState, "codeVerifier">>
  ): Promise<void> {
    await db
      .update(integrationOAuthStates)
      .set(data as any)
      .where(eq(integrationOAuthStates.state, state));
  }

  async deleteOAuthState(state: string): Promise<void> {
    await db.delete(integrationOAuthStates).where(eq(integrationOAuthStates.state, state));
  }

  async cleanupExpiredOAuthStates(): Promise<void> {
    await db
      .delete(integrationOAuthStates)
      .where(lte(integrationOAuthStates.expiresAt, new Date()));
  }

  // WhatsApp Flows methods
  async getWhatsAppFlows(userId: string, organizationId?: string, businessAccountId?: string): Promise<WhatsAppFlow[]> {
    const conditions = [eq(whatsappFlows.userId, userId)];
    if (organizationId) {
      conditions.push(eq(whatsappFlows.organizationId, organizationId));
    }
    if (businessAccountId) {
      conditions.push(eq(whatsappFlows.businessAccountId, businessAccountId));
    }
    return await db
      .select()
      .from(whatsappFlows)
      .where(and(...conditions))
      .orderBy(desc(whatsappFlows.createdAt));
  }

  async getWhatsAppFlowsByOrganization(organizationId: string, businessAccountId?: string): Promise<WhatsAppFlow[]> {
    if (!organizationId) return [];
    const conditions = [eq(whatsappFlows.organizationId, organizationId)];
    if (businessAccountId) {
      conditions.push(eq(whatsappFlows.businessAccountId, businessAccountId));
    }
    return await db
      .select()
      .from(whatsappFlows)
      .where(and(...conditions))
      .orderBy(desc(whatsappFlows.createdAt));
  }

  async listWhatsAppFlowsByOrganization(
    organizationId: string,
    query: { businessAccountId?: string; search?: string; limit: number; offset: number }
  ) {
    if (!organizationId) {
      return { items: [], total: 0, limit: query.limit, offset: query.offset };
    }
    const conditions = [eq(whatsappFlows.organizationId, organizationId)];
    if (query.businessAccountId) {
      conditions.push(eq(whatsappFlows.businessAccountId, query.businessAccountId));
    }
    if (query.search?.trim()) {
      const q = `%${query.search.trim().replace(/%/g, "\\%")}%`;
      conditions.push(or(ilike(whatsappFlows.name, q), ilike(whatsappFlows.flowId, q))!);
    }
    const whereClause = and(...conditions);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappFlows)
      .where(whereClause);
    const items = await db
      .select()
      .from(whatsappFlows)
      .where(whereClause)
      .orderBy(desc(whatsappFlows.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, total: Number(count) || 0, limit: query.limit, offset: query.offset };
  }

  async getWhatsAppFlow(flowId: string, userId: string, organizationId?: string): Promise<WhatsAppFlow | undefined> {
    const conditions = [
      eq(whatsappFlows.id, flowId),
      eq(whatsappFlows.userId, userId),
    ];
    if (organizationId) {
      conditions.push(eq(whatsappFlows.organizationId, organizationId));
    }
    const [flow] = await db
      .select()
      .from(whatsappFlows)
      .where(and(...conditions))
      .limit(1);
    return flow;
  }

  async getWhatsAppFlowByOrganization(flowId: string, organizationId: string): Promise<WhatsAppFlow | undefined> {
    if (!organizationId) return undefined;
    const [flow] = await db
      .select()
      .from(whatsappFlows)
      .where(and(eq(whatsappFlows.id, flowId), eq(whatsappFlows.organizationId, organizationId)))
      .limit(1);
    return flow;
  }

  async createWhatsAppFlow(data: InsertWhatsAppFlow): Promise<WhatsAppFlow> {
    const [flow] = await db
      .insert(whatsappFlows)
      .values({
        ...data,
        flowId: data.flowId || `flow_${Date.now()}_${data.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      })
      .returning();
    return flow;
  }

  async updateWhatsAppFlow(flowId: string, userId: string, organizationId: string | undefined, data: Partial<InsertWhatsAppFlow>): Promise<WhatsAppFlow | undefined> {
    const conditions = [
      eq(whatsappFlows.id, flowId),
      eq(whatsappFlows.userId, userId),
    ];
    if (organizationId) {
      conditions.push(eq(whatsappFlows.organizationId, organizationId));
    }
    const [updated] = await db
      .update(whatsappFlows)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning();
    return updated;
  }

  async updateWhatsAppFlowByOrganization(flowId: string, organizationId: string, data: Partial<InsertWhatsAppFlow>): Promise<WhatsAppFlow | undefined> {
    if (!organizationId) return undefined;
    const [updated] = await db
      .update(whatsappFlows)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(whatsappFlows.id, flowId), eq(whatsappFlows.organizationId, organizationId)))
      .returning();
    return updated;
  }

  async deleteWhatsAppFlow(flowId: string, userId: string, organizationId?: string): Promise<void> {
    const conditions = [
      eq(whatsappFlows.id, flowId),
      eq(whatsappFlows.userId, userId),
    ];
    if (organizationId) {
      conditions.push(eq(whatsappFlows.organizationId, organizationId));
    }
    await db
      .delete(whatsappFlows)
      .where(and(...conditions));
  }

  async deleteWhatsAppFlowByOrganization(flowId: string, organizationId: string): Promise<void> {
    if (!organizationId) return;
    await db
      .delete(whatsappFlows)
      .where(and(eq(whatsappFlows.id, flowId), eq(whatsappFlows.organizationId, organizationId)));
  }

  async createWhatsAppFlowResponse(data: InsertWhatsAppFlowResponse): Promise<WhatsAppFlowResponse> {
    const [row] = await db.insert(whatsappFlowResponses).values(data).returning();
    if (!row) throw new Error("Failed to store flow response");
    return row;
  }

  async getWhatsAppFlowResponses(
    flowId: string,
    organizationId: string,
    query: { page: number; limit: number; phone?: string }
  ): Promise<{ responses: WhatsAppFlowResponse[]; total: number }> {
    const [flow] = await db
      .select({ id: whatsappFlows.id, flowId: whatsappFlows.flowId, name: whatsappFlows.name })
      .from(whatsappFlows)
      .where(and(eq(whatsappFlows.id, flowId), eq(whatsappFlows.organizationId, organizationId)))
      .limit(1);

    const tokenCandidates = [flowId, flow?.flowId].filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0
    );

    const tokenMatchers =
      tokenCandidates.length > 0
        ? tokenCandidates.flatMap((token) => [
            sql`${whatsappFlowResponses.responseData}->>'flow_token' = ${token}`,
            sql`${whatsappFlowResponses.responseData}->>'flowToken' = ${token}`,
          ])
        : [];

    // Linked to this flow OR unmatched orphans for the org (older submissions often had no flow link).
    const matchClause = or(
      eq(whatsappFlowResponses.flowId, flowId),
      isNull(whatsappFlowResponses.flowId),
      ...(tokenMatchers.length ? tokenMatchers : []),
    );

    const conditions = [
      eq(whatsappFlowResponses.organizationId, organizationId),
      matchClause!,
    ];
    if (query.phone?.trim()) {
      const phone = query.phone.trim().replace(/\D/g, "");
      conditions.push(sql`regexp_replace(${whatsappFlowResponses.phone}, '[^0-9]', '', 'g') LIKE ${"%" + phone + "%"}`);
    }
    const whereClause = and(...conditions);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappFlowResponses)
      .where(whereClause);
    const offset = (query.page - 1) * query.limit;
    const responses = await db
      .select()
      .from(whatsappFlowResponses)
      .where(whereClause)
      .orderBy(sql`${whatsappFlowResponses.submittedAt} DESC`)
      .limit(query.limit)
      .offset(offset);

    return { responses, total: Number(count || 0) };
  }

  async getAllWhatsAppFlowResponsesForOrganization(
    organizationId: string,
    query: { page: number; limit: number; phone?: string }
  ): Promise<{ responses: WhatsAppFlowResponse[]; total: number }> {
    const conditions = [eq(whatsappFlowResponses.organizationId, organizationId)];
    if (query.phone?.trim()) {
      const phone = query.phone.trim().replace(/\D/g, "");
      conditions.push(sql`regexp_replace(${whatsappFlowResponses.phone}, '[^0-9]', '', 'g') LIKE ${"%" + phone + "%"}`);
    }
    const whereClause = and(...conditions);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappFlowResponses)
      .where(whereClause);
    const offset = (query.page - 1) * query.limit;
    const responses = await db
      .select()
      .from(whatsappFlowResponses)
      .where(whereClause)
      .orderBy(sql`${whatsappFlowResponses.submittedAt} DESC`)
      .limit(query.limit)
      .offset(offset);
    return { responses, total: Number(count || 0) };
  }

  async getWhatsAppFlowResponseByWhatsAppMessageId(
    organizationId: string,
    whatsappMessageId: string
  ): Promise<WhatsAppFlowResponse | undefined> {
    const id = whatsappMessageId?.trim();
    if (!id) return undefined;
    const [row] = await db
      .select()
      .from(whatsappFlowResponses)
      .where(
        and(
          eq(whatsappFlowResponses.organizationId, organizationId),
          eq(whatsappFlowResponses.whatsappMessageId, id)
        )
      )
      .limit(1);
    return row;
  }

  async getWhatsAppFlowResponsesByPhone(
    organizationId: string,
    phone: string,
    query: { page?: number; limit?: number } = {}
  ): Promise<{ responses: WhatsAppFlowResponse[]; total: number }> {
    const digits = phone.replace(/\D/g, "");
    if (!digits) return { responses: [], total: 0 };
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const whereClause = and(
      eq(whatsappFlowResponses.organizationId, organizationId),
      sql`regexp_replace(${whatsappFlowResponses.phone}, '[^0-9]', '', 'g') LIKE ${"%" + digits + "%"}`
    );
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappFlowResponses)
      .where(whereClause);
    const responses = await db
      .select()
      .from(whatsappFlowResponses)
      .where(whereClause)
      .orderBy(sql`${whatsappFlowResponses.submittedAt} DESC`)
      .limit(limit)
      .offset((page - 1) * limit);
    return { responses, total: Number(count || 0) };
  }

  // Automation Flows methods (flow builder)
  async createAutomationFlow(data: InsertAutomationFlow): Promise<AutomationFlow> {
    const [flow] = await db.insert(automationFlows).values(data).returning();
    if (!flow) throw new Error("Failed to create automation flow");
    return flow;
  }

  async getAutomationFlow(id: string, userId: string, organizationId?: string): Promise<AutomationFlow | undefined> {
    const conditions = [eq(automationFlows.id, id), eq(automationFlows.userId, userId)];
    if (organizationId) {
      conditions.push(eq(automationFlows.organizationId, organizationId));
    }
    const [flow] = await db
      .select()
      .from(automationFlows)
      .where(and(...conditions))
      .limit(1);
    return flow;
  }

  async getAutomationFlowByOrganization(id: string, organizationId: string): Promise<AutomationFlow | undefined> {
    const [flow] = await db
      .select()
      .from(automationFlows)
      .where(and(eq(automationFlows.id, id), eq(automationFlows.organizationId, organizationId)))
      .limit(1);
    return flow;
  }

  async getAutomationFlowById(id: string): Promise<AutomationFlow | undefined> {
    const [flow] = await db
      .select()
      .from(automationFlows)
      .where(eq(automationFlows.id, id))
      .limit(1);
    return flow;
  }

  async getAutomationFlowsByUser(userId: string, organizationId?: string): Promise<AutomationFlow[]> {
    const conditions = [eq(automationFlows.userId, userId)];
    if (organizationId) {
      conditions.push(eq(automationFlows.organizationId, organizationId));
    }
    return await db
      .select()
      .from(automationFlows)
      .where(and(...conditions))
      .orderBy(desc(automationFlows.updatedAt));
  }

  async getAutomationFlowsByOrganization(organizationId: string): Promise<AutomationFlow[]> {
    return await db
      .select()
      .from(automationFlows)
      .where(eq(automationFlows.organizationId, organizationId))
      .orderBy(desc(automationFlows.updatedAt));
  }

  async listAutomationFlowsByOrganization(
    organizationId: string,
    query: {
      search?: string;
      status?: "active" | "inactive";
      sort?: "newest" | "oldest" | "name";
      limit: number;
      offset: number;
    }
  ) {
    const conditions = [eq(automationFlows.organizationId, organizationId)];
    if (query.search?.trim()) {
      const q = `%${query.search.trim().replace(/%/g, "\\%")}%`;
      conditions.push(ilike(automationFlows.name, q));
    }
    if (query.status === "active" || query.status === "inactive") {
      conditions.push(eq(automationFlows.status, query.status));
    }
    const whereClause = and(...conditions);
    const sort = query.sort ?? "newest";
    const orderBy =
      sort === "name"
        ? asc(automationFlows.name)
        : sort === "oldest"
          ? asc(automationFlows.updatedAt)
          : desc(automationFlows.updatedAt);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(automationFlows)
      .where(whereClause);
    const items = await db
      .select({
        id: automationFlows.id,
        name: automationFlows.name,
        status: automationFlows.status,
        createdAt: automationFlows.createdAt,
        updatedAt: automationFlows.updatedAt,
      })
      .from(automationFlows)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(query.limit)
      .offset(query.offset);
    return { items, total: Number(count) || 0, limit: query.limit, offset: query.offset };
  }

  async updateAutomationFlow(id: string, userId: string, organizationId: string | undefined, data: Partial<InsertAutomationFlow>): Promise<AutomationFlow | undefined> {
    const conditions = [eq(automationFlows.id, id), eq(automationFlows.userId, userId)];
    if (organizationId) {
      conditions.push(eq(automationFlows.organizationId, organizationId));
    }
    const [updated] = await db
      .update(automationFlows)
      .set({ ...data, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return updated;
  }

  async updateAutomationFlowByOrganization(id: string, organizationId: string, data: Partial<InsertAutomationFlow>): Promise<AutomationFlow | undefined> {
    const [updated] = await db
      .update(automationFlows)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(automationFlows.id, id), eq(automationFlows.organizationId, organizationId)))
      .returning();
    return updated;
  }

  async deleteAutomationFlow(id: string, userId: string, organizationId?: string): Promise<void> {
    const conditions = [eq(automationFlows.id, id), eq(automationFlows.userId, userId)];
    if (organizationId) {
      conditions.push(eq(automationFlows.organizationId, organizationId));
    }
    await db.delete(automationFlows).where(and(...conditions));
  }

  async deleteAutomationFlowByOrganization(id: string, organizationId: string): Promise<void> {
    await db
      .delete(automationFlows)
      .where(and(eq(automationFlows.id, id), eq(automationFlows.organizationId, organizationId)));
  }

  async getActiveFlowsByTrigger(triggerType: string, userId?: string, organizationId?: string): Promise<AutomationFlow[]> {
    const conditions = [eq(automationFlows.status, 'active')];
    if (organizationId) {
      conditions.push(eq(automationFlows.organizationId, organizationId));
    } else if (userId) {
      conditions.push(eq(automationFlows.userId, userId));
    }
    const flows = await db
      .select()
      .from(automationFlows)
      .where(and(...conditions))
      .orderBy(desc(automationFlows.updatedAt));
    return flows.filter((f) => {
      const nodes = (f.nodes as Array<{ type?: string; data?: { selectedTrigger?: string } }>) ?? [];
      const triggerNodes = nodes.filter((n) => n.type === "trigger");
      if (triggerNodes.some((n) => n.data?.selectedTrigger === triggerType)) {
        return true;
      }
      const lf = f.linearFlow;
      if (lf && isLinearFlowDefinition(lf)) {
        const v2 = toLinearFlowV2ForEdit(lf);
        if (allCanvasSelectedTriggersFromLinearFlow(v2).includes(triggerType)) {
          return true;
        }
      }
      return false;
    });
  }

  async getAllActiveAutomationFlows(): Promise<AutomationFlow[]> {
    return await db
      .select()
      .from(automationFlows)
      .where(eq(automationFlows.status, "active"))
      .orderBy(desc(automationFlows.updatedAt));
  }

  async createAutomationFlowScheduledRun(
    data: InsertAutomationFlowScheduledRun
  ): Promise<AutomationFlowScheduledRun> {
    const [run] = await db.insert(automationFlowScheduledRuns).values(data).returning();
    return run;
  }

  async claimDueAutomationFlowScheduledRuns(
    now: Date,
    limit = 20
  ): Promise<AutomationFlowScheduledRun[]> {
    const due = await db
      .select()
      .from(automationFlowScheduledRuns)
      .where(
        and(
          eq(automationFlowScheduledRuns.status, "pending"),
          lte(automationFlowScheduledRuns.resumeAt, now)
        )
      )
      .orderBy(automationFlowScheduledRuns.resumeAt)
      .limit(limit);

    const claimed: AutomationFlowScheduledRun[] = [];
    for (const row of due) {
      const [updated] = await db
        .update(automationFlowScheduledRuns)
        .set({ status: "running", updatedAt: new Date() })
        .where(
          and(
            eq(automationFlowScheduledRuns.id, row.id),
            eq(automationFlowScheduledRuns.status, "pending")
          )
        )
        .returning();
      if (updated) claimed.push(updated);
    }
    return claimed;
  }

  async completeAutomationFlowScheduledRun(id: string): Promise<void> {
    await db
      .update(automationFlowScheduledRuns)
      .set({ status: "completed", updatedAt: new Date(), lastError: null })
      .where(eq(automationFlowScheduledRuns.id, id));
  }

  async failAutomationFlowScheduledRun(id: string, error: string): Promise<void> {
    await db
      .update(automationFlowScheduledRuns)
      .set({
        status: "failed",
        lastError: error.slice(0, 2000),
        updatedAt: new Date(),
      })
      .where(eq(automationFlowScheduledRuns.id, id));
  }

  async cancelAutomationFlowScheduledRun(id: string, reason: string): Promise<void> {
    await db
      .update(automationFlowScheduledRuns)
      .set({
        status: "cancelled",
        lastError: reason.slice(0, 2000),
        updatedAt: new Date(),
      })
      .where(eq(automationFlowScheduledRuns.id, id));
  }

  async createAutomationFlowRun(data: InsertAutomationFlowRun): Promise<AutomationFlowRun> {
    const [run] = await db.insert(automationFlowRuns).values(data).returning();
    return run;
  }

  async getAutomationFlowRunById(id: string): Promise<AutomationFlowRun | undefined> {
    const [run] = await db
      .select()
      .from(automationFlowRuns)
      .where(eq(automationFlowRuns.id, id))
      .limit(1);
    return run;
  }

  async updateAutomationFlowRunStatus(
    id: string,
    status: AutomationFlowRun["status"],
    lastError?: string | null
  ): Promise<void> {
    await db
      .update(automationFlowRuns)
      .set({
        status,
        lastError: lastError != null ? lastError.slice(0, 2000) : null,
        completedAt:
          status === "completed" || status === "failed" || status === "cancelled"
            ? new Date()
            : undefined,
      })
      .where(eq(automationFlowRuns.id, id));
  }

  async createAutomationFlowRunLog(data: InsertAutomationFlowRunLog): Promise<AutomationFlowRunLog> {
    const [log] = await db.insert(automationFlowRunLogs).values(data).returning();
    return log;
  }

  async getAutomationFlowRunLogs(runId: string, limit = 200): Promise<AutomationFlowRunLog[]> {
    return await db
      .select()
      .from(automationFlowRunLogs)
      .where(eq(automationFlowRunLogs.runId, runId))
      .orderBy(automationFlowRunLogs.createdAt)
      .limit(limit);
  }

  async getAutomationFlowRunsByFlow(flowId: string, limit = 50): Promise<AutomationFlowRun[]> {
    return await db
      .select()
      .from(automationFlowRuns)
      .where(eq(automationFlowRuns.flowId, flowId))
      .orderBy(desc(automationFlowRuns.startedAt))
      .limit(limit);
  }

  // Chatbot methods
  async getChatbots(userId: string, organizationId?: string): Promise<Chatbot[]> {
    const conditions = [eq(chatbots.userId, userId)];
    if (organizationId) {
      conditions.push(eq(chatbots.organizationId, organizationId));
    }
    return await db
      .select()
      .from(chatbots)
      .where(and(...conditions))
      .orderBy(desc(chatbots.createdAt));
  }

  async getChatbotsByOrganization(organizationId: string): Promise<Chatbot[]> {
    if (!organizationId) return [];
    return await db
      .select()
      .from(chatbots)
      .where(eq(chatbots.organizationId, organizationId))
      .orderBy(desc(chatbots.createdAt));
  }

  async getChatbot(id: string, userId: string, organizationId?: string): Promise<Chatbot | undefined> {
    const conditions = [
      eq(chatbots.id, id),
      eq(chatbots.userId, userId),
    ];
    if (organizationId) {
      conditions.push(eq(chatbots.organizationId, organizationId));
    }
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(...conditions))
      .limit(1);
    return chatbot;
  }

  async getChatbotByOrganization(id: string, organizationId: string): Promise<Chatbot | undefined> {
    if (!organizationId) return undefined;
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.organizationId, organizationId)))
      .limit(1);
    return chatbot;
  }

  async createChatbot(data: InsertChatbot): Promise<Chatbot> {
    const [chatbot] = await db
      .insert(chatbots)
      .values(data)
      .returning();
    return chatbot;
  }

  async updateChatbot(id: string, userId: string, organizationId: string | undefined, data: Partial<InsertChatbot>): Promise<Chatbot | undefined> {
    const conditions = [
      eq(chatbots.id, id),
      eq(chatbots.userId, userId),
    ];
    if (organizationId) {
      conditions.push(eq(chatbots.organizationId, organizationId));
    }
    const [updated] = await db
      .update(chatbots)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning();
    return updated;
  }

  async updateChatbotByOrganization(id: string, organizationId: string, data: Partial<InsertChatbot>): Promise<Chatbot | undefined> {
    if (!organizationId) return undefined;
    const [updated] = await db
      .update(chatbots)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(chatbots.id, id), eq(chatbots.organizationId, organizationId)))
      .returning();
    return updated;
  }

  async deleteChatbot(id: string, userId: string, organizationId?: string): Promise<void> {
    const conditions = [
      eq(chatbots.id, id),
      eq(chatbots.userId, userId),
    ];
    if (organizationId) {
      conditions.push(eq(chatbots.organizationId, organizationId));
    }
    await db
      .delete(chatbots)
      .where(and(...conditions));
  }

  async deleteChatbotByOrganization(id: string, organizationId: string): Promise<void> {
    if (!organizationId) return;
    await db.delete(chatbots).where(and(eq(chatbots.id, id), eq(chatbots.organizationId, organizationId)));
  }

  // Chatbot Node methods
  async getChatbotNodes(chatbotId: string): Promise<ChatbotNode[]> {
    return await db
      .select()
      .from(chatbotNodes)
      .where(eq(chatbotNodes.chatbotId, chatbotId))
      .orderBy(chatbotNodes.createdAt);
  }

  async upsertChatbotNodes(chatbotId: string, nodes: InsertChatbotNode[]): Promise<ChatbotNode[]> {
    // Delete existing nodes
    await db
      .delete(chatbotNodes)
      .where(eq(chatbotNodes.chatbotId, chatbotId));
    
    // Insert new nodes
    if (nodes.length > 0) {
      const inserted = await db
        .insert(chatbotNodes)
        .values(nodes.map(node => ({ ...node, chatbotId })))
        .returning();
      return inserted;
    }
    return [];
  }

  async deleteChatbotNodes(chatbotId: string): Promise<void> {
    await db
      .delete(chatbotNodes)
      .where(eq(chatbotNodes.chatbotId, chatbotId));
  }

  async removeWhatsAppSessionFromChatbots(args: {
    sessionId: string;
    phoneNumberId?: string;
    userId: string;
    organizationId?: string;
  }): Promise<void> {
    const { sessionId, phoneNumberId, userId, organizationId } = args;
    if (!sessionId) return;

    const sessionMatches = (id: unknown): boolean => {
      if (typeof id !== "string" || !id) return false;
      if (id === sessionId) return true;
      if (
        phoneNumberId &&
        id.startsWith("wb_") &&
        id.split("_")[1] === String(phoneNumberId)
      ) {
        return true;
      }
      return false;
    };

    const bots = organizationId
      ? await this.getChatbotsByOrganization(organizationId)
      : await this.getChatbots(userId, organizationId);

    for (const bot of bots) {
      if (bot.sessionId && sessionMatches(bot.sessionId)) {
        if (organizationId) {
          await this.updateChatbotByOrganization(bot.id, organizationId, { sessionId: null } as any);
        } else {
          await this.updateChatbot(bot.id, userId, organizationId, { sessionId: null } as any);
        }
      }

      const nodes = await this.getChatbotNodes(bot.id);
      for (const node of nodes) {
        const data = (node.data || {}) as Record<string, any>;
        let changed = false;
        const nextData = { ...data };

        const rawIds: string[] = Array.isArray(data.triggerSessionIds)
          ? data.triggerSessionIds.filter(Boolean)
          : data.triggerSessionId
            ? [data.triggerSessionId]
            : [];
        if (rawIds.length > 0) {
          const filtered = rawIds.filter((id) => !sessionMatches(id));
          if (filtered.length !== rawIds.length) {
            changed = true;
            nextData.triggerSessionIds = filtered;
            nextData.triggerSessionId = filtered.length === 1 ? filtered[0] : "";
            if (filtered.length === 0) {
              nextData.triggerPhoneNumberId = "";
              nextData.triggerDisplayPhoneNumber = "";
              nextData.triggerConnectionType = "";
            }
          }
        }

        if (data.sessionId && sessionMatches(data.sessionId)) {
          changed = true;
          nextData.sessionId = "";
        }

        if (changed) {
          await db
            .update(chatbotNodes)
            .set({ data: nextData, updatedAt: new Date() })
            .where(eq(chatbotNodes.id, node.id));
        }
      }
    }
  }

  async getAiAssistants(userId: string, organizationId?: string): Promise<AiAssistant[]> {
    const conditions = [eq(aiAssistants.userId, userId)];
    if (organizationId) {
      conditions.push(eq(aiAssistants.organizationId, organizationId));
    }
    return db
      .select()
      .from(aiAssistants)
      .where(and(...conditions))
      .orderBy(desc(aiAssistants.createdAt));
  }

  async getAiAssistantsByOrganization(organizationId: string): Promise<AiAssistant[]> {
    if (!organizationId) return [];
    return db
      .select()
      .from(aiAssistants)
      .where(eq(aiAssistants.organizationId, organizationId))
      .orderBy(desc(aiAssistants.createdAt));
  }

  async getAiAssistant(id: string, userId: string, organizationId?: string): Promise<AiAssistant | undefined> {
    const conditions = [eq(aiAssistants.id, id), eq(aiAssistants.userId, userId)];
    if (organizationId) {
      conditions.push(eq(aiAssistants.organizationId, organizationId));
    }
    const [row] = await db.select().from(aiAssistants).where(and(...conditions));
    return row;
  }

  async getAiAssistantByOrganization(id: string, organizationId: string): Promise<AiAssistant | undefined> {
    if (!organizationId) return undefined;
    const [row] = await db
      .select()
      .from(aiAssistants)
      .where(and(eq(aiAssistants.id, id), eq(aiAssistants.organizationId, organizationId)));
    return row;
  }

  async createAiAssistant(data: InsertAiAssistant): Promise<AiAssistant> {
    const [created] = await db.insert(aiAssistants).values(data).returning();
    if (!created) throw new Error("Failed to create AI assistant");
    return created;
  }

  async updateAiAssistant(id: string, userId: string, organizationId: string | undefined, data: Partial<InsertAiAssistant>): Promise<AiAssistant | undefined> {
    const conditions = [eq(aiAssistants.id, id), eq(aiAssistants.userId, userId)];
    if (organizationId) {
      conditions.push(eq(aiAssistants.organizationId, organizationId));
    }
    const [updated] = await db
      .update(aiAssistants)
      .set({ ...data, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return updated;
  }

  async updateAiAssistantByOrganization(id: string, organizationId: string, data: Partial<InsertAiAssistant>): Promise<AiAssistant | undefined> {
    if (!organizationId) return undefined;
    const [updated] = await db
      .update(aiAssistants)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(aiAssistants.id, id), eq(aiAssistants.organizationId, organizationId)))
      .returning();
    return updated;
  }

  async deleteAiAssistant(id: string, userId: string, organizationId?: string): Promise<void> {
    const conditions = [eq(aiAssistants.id, id), eq(aiAssistants.userId, userId)];
    if (organizationId) {
      conditions.push(eq(aiAssistants.organizationId, organizationId));
    }
    await db.delete(aiAssistants).where(and(...conditions));
  }

  async deleteAiAssistantByOrganization(id: string, organizationId: string): Promise<void> {
    if (!organizationId) return;
    await db.delete(aiAssistants).where(and(eq(aiAssistants.id, id), eq(aiAssistants.organizationId, organizationId)));
  }

  async getAiAssistantKnowledgeFiles(assistantId: string): Promise<AiAssistantKnowledgeFile[]> {
    return db
      .select()
      .from(aiAssistantKnowledgeFiles)
      .where(eq(aiAssistantKnowledgeFiles.assistantId, assistantId))
      .orderBy(aiAssistantKnowledgeFiles.createdAt);
  }

  async getAiAssistantKnowledgeFile(fileId: string, assistantId: string): Promise<AiAssistantKnowledgeFile | undefined> {
    const [file] = await db
      .select()
      .from(aiAssistantKnowledgeFiles)
      .where(and(eq(aiAssistantKnowledgeFiles.id, fileId), eq(aiAssistantKnowledgeFiles.assistantId, assistantId)))
      .limit(1);
    return file;
  }

  async addAiAssistantKnowledgeFile(data: InsertAiAssistantKnowledgeFile): Promise<AiAssistantKnowledgeFile> {
    const [file] = await db.insert(aiAssistantKnowledgeFiles).values(data).returning();
    if (!file) throw new Error("Failed to add knowledge file");
    return file;
  }

  async updateAiAssistantKnowledgeFile(
    fileId: string,
    assistantId: string,
    data: Partial<Pick<InsertAiAssistantKnowledgeFile, "fileName" | "content" | "sizeBytes" | "mimeType">>
  ): Promise<AiAssistantKnowledgeFile | undefined> {
    const [file] = await db
      .update(aiAssistantKnowledgeFiles)
      .set(data)
      .where(and(eq(aiAssistantKnowledgeFiles.id, fileId), eq(aiAssistantKnowledgeFiles.assistantId, assistantId)))
      .returning();
    return file;
  }

  async deleteAiAssistantKnowledgeFile(fileId: string, assistantId: string): Promise<void> {
    await db
      .delete(aiAssistantKnowledgeFiles)
      .where(and(eq(aiAssistantKnowledgeFiles.id, fileId), eq(aiAssistantKnowledgeFiles.assistantId, assistantId)));
  }

  // FAQ Bot methods (org-scoped)
  async getFaqItemsByOrganization(organizationId: string): Promise<FaqItem[]> {
    if (!organizationId) return [];
    return db
      .select()
      .from(faqItems)
      .where(eq(faqItems.organizationId, organizationId))
      .orderBy(asc(faqItems.createdAt));
  }

  async getFaqItemByOrganization(id: string, organizationId: string): Promise<FaqItem | undefined> {
    if (!organizationId) return undefined;
    const [row] = await db
      .select()
      .from(faqItems)
      .where(and(eq(faqItems.id, id), eq(faqItems.organizationId, organizationId)));
    return row;
  }

  async createFaqItem(data: InsertFaqItem): Promise<FaqItem> {
    const [created] = await db.insert(faqItems).values({ ...data, updatedAt: new Date() }).returning();
    if (!created) throw new Error("Failed to create FAQ item");
    return created;
  }

  async updateFaqItemByOrganization(id: string, organizationId: string, data: Partial<InsertFaqItem>): Promise<FaqItem | undefined> {
    if (!organizationId) return undefined;
    const [updated] = await db
      .update(faqItems)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(faqItems.id, id), eq(faqItems.organizationId, organizationId)))
      .returning();
    return updated;
  }

  async deleteFaqItemByOrganization(id: string, organizationId: string): Promise<void> {
    if (!organizationId) return;
    await db.delete(faqItems).where(and(eq(faqItems.id, id), eq(faqItems.organizationId, organizationId)));
  }

  async getFaqBotSettingsByOrganization(organizationId: string): Promise<FaqBotSettings | undefined> {
    if (!organizationId) return undefined;
    const [row] = await db.select().from(faqBotSettings).where(eq(faqBotSettings.organizationId, organizationId));
    return row;
  }

  async upsertFaqBotSettingsByOrganization(organizationId: string, data: Partial<InsertFaqBotSettings>): Promise<FaqBotSettings> {
    if (!organizationId) throw new Error("organizationId required");
    const [upserted] = await db
      .insert(faqBotSettings)
      .values({ organizationId, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: faqBotSettings.organizationId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    if (!upserted) throw new Error("Failed to upsert FAQ bot settings");
    return upserted;
  }

  async getOrganizationLiveChatSettings(
    organizationId: string
  ): Promise<OrganizationLiveChatSettings | undefined> {
    if (!organizationId) return undefined;
    const [row] = await db
      .select()
      .from(organizationLiveChatSettings)
      .where(eq(organizationLiveChatSettings.organizationId, organizationId));
    return row;
  }

  async upsertOrganizationLiveChatSettings(
    organizationId: string,
    data: Partial<InsertOrganizationLiveChatSettings>
  ): Promise<OrganizationLiveChatSettings> {
    if (!organizationId) throw new Error("organizationId required");
    const [upserted] = await db
      .insert(organizationLiveChatSettings)
      .values({ organizationId, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: organizationLiveChatSettings.organizationId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    if (!upserted) throw new Error("Failed to upsert live chat settings");
    return upserted;
  }

  async getLiveChatAutoReplyState(
    organizationId: string,
    sessionId: string,
    contactNumber: string
  ): Promise<LiveChatAutoReplyState | undefined> {
    if (!organizationId || !sessionId || !contactNumber) return undefined;
    const [row] = await db
      .select()
      .from(liveChatAutoReplyState)
      .where(
        and(
          eq(liveChatAutoReplyState.organizationId, organizationId),
          eq(liveChatAutoReplyState.sessionId, sessionId),
          eq(liveChatAutoReplyState.contactNumber, contactNumber)
        )
      );
    return row;
  }

  async upsertLiveChatAutoReplyState(
    organizationId: string,
    sessionId: string,
    contactNumber: string,
    lastKind: string
  ): Promise<LiveChatAutoReplyState> {
    if (!organizationId) throw new Error("organizationId required");
    const now = new Date();
    const [upserted] = await db
      .insert(liveChatAutoReplyState)
      .values({
        organizationId,
        sessionId,
        contactNumber,
        lastKind,
        lastSentAt: now,
      })
      .onConflictDoUpdate({
        target: [
          liveChatAutoReplyState.organizationId,
          liveChatAutoReplyState.sessionId,
          liveChatAutoReplyState.contactNumber,
        ],
        set: { lastKind, lastSentAt: now },
      })
      .returning();
    if (!upserted) throw new Error("Failed to upsert live chat auto-reply state");
    return upserted;
  }

  async getOrganizationCommerceSettings(
    organizationId: string
  ): Promise<OrganizationCommerceSettings | undefined> {
    if (!organizationId) return undefined;
    const [row] = await db
      .select()
      .from(organizationCommerceSettings)
      .where(eq(organizationCommerceSettings.organizationId, organizationId));
    return row;
  }

  async listOrganizationCommerceSettingsWithAutoSync(): Promise<OrganizationCommerceSettings[]> {
    return db
      .select()
      .from(organizationCommerceSettings)
      .where(
        and(
          isNotNull(organizationCommerceSettings.metaCatalogId),
          or(
            eq(organizationCommerceSettings.shopifySyncEnabled, true),
            eq(organizationCommerceSettings.woocommerceSyncEnabled, true)
          )
        )
      );
  }

  async upsertOrganizationCommerceSettings(
    organizationId: string,
    data: Partial<InsertOrganizationCommerceSettings>
  ): Promise<OrganizationCommerceSettings> {
    if (!organizationId) throw new Error("organizationId required");
    const [upserted] = await db
      .insert(organizationCommerceSettings)
      .values({ organizationId, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: organizationCommerceSettings.organizationId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    if (!upserted) throw new Error("Failed to upsert commerce settings");
    return upserted;
  }

  async getOrganizationInvoiceSettings(
    organizationId: string
  ): Promise<OrganizationInvoiceSettings | undefined> {
    if (!organizationId) return undefined;
    const [row] = await db
      .select()
      .from(organizationInvoiceSettings)
      .where(eq(organizationInvoiceSettings.organizationId, organizationId));
    return row;
  }

  async upsertOrganizationInvoiceSettings(
    organizationId: string,
    data: Partial<InsertOrganizationInvoiceSettings>
  ): Promise<OrganizationInvoiceSettings> {
    if (!organizationId) throw new Error("organizationId required");
    const [upserted] = await db
      .insert(organizationInvoiceSettings)
      .values({ organizationId, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: organizationInvoiceSettings.organizationId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    if (!upserted) throw new Error("Failed to upsert invoice settings");
    return upserted;
  }

  async createOrganizationInvoice(data: InsertOrganizationInvoice): Promise<OrganizationInvoice> {
    const [row] = await db.insert(organizationInvoices).values(data).returning();
    if (!row) throw new Error("Failed to create invoice record");
    return row;
  }

  async getOrganizationInvoiceById(
    id: string,
    organizationId: string,
  ): Promise<OrganizationInvoice | undefined> {
    const [row] = await db
      .select()
      .from(organizationInvoices)
      .where(and(eq(organizationInvoices.id, id), eq(organizationInvoices.organizationId, organizationId)));
    return row;
  }

  async listOrganizationInvoices(
    organizationId: string,
    query: {
      search?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      pendingOnly?: boolean;
      limit: number;
      offset: number;
    },
  ): Promise<{ items: OrganizationInvoice[]; total: number }> {
    if (!organizationId) return { items: [], total: 0 };
    const conditions = [eq(organizationInvoices.organizationId, organizationId)];
    const status = query.status?.trim().toLowerCase();
    if (status && status !== "all") {
      conditions.push(eq(organizationInvoices.invoiceStatus, status));
    }
    if (query.pendingOnly) {
      conditions.push(sql`COALESCE(${organizationInvoices.amountPending}, 0) > 0`);
    }
    if (query.dateFrom) {
      const from = new Date(query.dateFrom);
      if (!Number.isNaN(from.getTime())) conditions.push(gte(organizationInvoices.invoiceDate, from));
    }
    if (query.dateTo) {
      const to = new Date(query.dateTo);
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        conditions.push(lte(organizationInvoices.invoiceDate, to));
      }
    }
    const search = query.search?.trim();
    if (search) {
      const q = `%${search.replace(/%/g, "\\%")}%`;
      conditions.push(
        or(
          ilike(organizationInvoices.invoiceNo, q),
          ilike(organizationInvoices.customerName, q),
          ilike(organizationInvoices.customerPhone, q),
          ilike(organizationInvoices.companyName, q),
          ilike(organizationInvoices.createdByName, q),
        )!,
      );
    }
    const whereClause = and(...conditions);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationInvoices)
      .where(whereClause);
    const items = await db
      .select()
      .from(organizationInvoices)
      .where(whereClause)
      .orderBy(desc(organizationInvoices.invoiceDate))
      .limit(query.limit)
      .offset(query.offset);
    return { items, total: Number(count) || 0 };
  }

  async updateOrganizationInvoice(
    id: string,
    organizationId: string,
    data: Partial<InsertOrganizationInvoice>,
  ): Promise<OrganizationInvoice | undefined> {
    const [row] = await db
      .update(organizationInvoices)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(organizationInvoices.id, id), eq(organizationInvoices.organizationId, organizationId)))
      .returning();
    return row;
  }

  async deleteOrganizationInvoice(id: string, organizationId: string): Promise<boolean> {
    const existing = await this.getOrganizationInvoiceById(id, organizationId);
    if (!existing) return false;
    if (existing.isLocked) {
      throw new Error("This invoice is locked and cannot be deleted");
    }
    await db
      .delete(organizationInvoices)
      .where(and(eq(organizationInvoices.id, id), eq(organizationInvoices.organizationId, organizationId)));
    return true;
  }

  async createOrganizationLead(data: InsertOrganizationLead): Promise<OrganizationLead> {
    const phone = data.phoneNumber.replace(/[^\d]/g, "");
    const status = data.status ?? "new";
    const sortOrder =
      data.sortOrder ??
      (await this.getNextLeadSortOrder(data.organizationId, status));
    const [row] = await db
      .insert(organizationLeads)
      .values({ ...data, phoneNumber: phone, status, sortOrder })
      .returning();
    if (!row) throw new Error("Failed to create lead");
    return row;
  }

  async getNextLeadSortOrder(organizationId: string, statusSlug: string): Promise<number> {
    await db
      .update(organizationLeads)
      .set({ sortOrder: sql`${organizationLeads.sortOrder} + 1` })
      .where(
        and(eq(organizationLeads.organizationId, organizationId), eq(organizationLeads.status, statusSlug)),
      );
    return 0;
  }

  async getOrganizationLeadByPhone(
    organizationId: string,
    phoneDigits: string,
  ): Promise<OrganizationLead | undefined> {
    if (!organizationId) return undefined;
    const phone = phoneDigits.replace(/[^\d]/g, "");
    const [row] = await db
      .select()
      .from(organizationLeads)
      .where(and(eq(organizationLeads.organizationId, organizationId), eq(organizationLeads.phoneNumber, phone)));
    return row;
  }

  async getOrganizationLeadById(id: string, organizationId: string): Promise<OrganizationLead | undefined> {
    const [row] = await db
      .select()
      .from(organizationLeads)
      .where(and(eq(organizationLeads.id, id), eq(organizationLeads.organizationId, organizationId)));
    return row;
  }

  async listOrganizationLeads(
    organizationId: string,
    query: {
      search?: string;
      status?: string;
      priority?: string;
      category?: string;
      source?: string;
      assignedTo?: string;
      dateFrom?: string;
      dateTo?: string;
      limit: number;
      offset: number;
    },
  ): Promise<{ items: OrganizationLead[]; total: number }> {
    if (!organizationId) return { items: [], total: 0 };
    const conditions = [eq(organizationLeads.organizationId, organizationId)];
    const status = query.status?.trim().toLowerCase();
    if (status && status !== "all") {
      conditions.push(eq(organizationLeads.status, status));
    }
    const priority = query.priority?.trim().toLowerCase();
    if (priority && priority !== "all") {
      conditions.push(eq(organizationLeads.priority, priority));
    }
    const category = query.category?.trim();
    if (category && category !== "all") {
      conditions.push(eq(organizationLeads.category, category));
    }
    const source = query.source?.trim().toLowerCase();
    if (source && source !== "all") {
      conditions.push(eq(organizationLeads.source, source));
    }
    const assignedTo = query.assignedTo?.trim();
    if (assignedTo && assignedTo !== "all") {
      conditions.push(eq(organizationLeads.assignedToUserId, assignedTo));
    }
    if (query.dateFrom) {
      const from = new Date(query.dateFrom);
      if (!Number.isNaN(from.getTime())) conditions.push(gte(organizationLeads.createdAt, from));
    }
    if (query.dateTo) {
      const to = new Date(query.dateTo);
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        conditions.push(lte(organizationLeads.createdAt, to));
      }
    }
    const search = query.search?.trim();
    if (search) {
      const q = `%${search.replace(/%/g, "\\%")}%`;
      conditions.push(
        or(
          ilike(organizationLeads.name, q),
          ilike(organizationLeads.phoneNumber, q),
          ilike(organizationLeads.email, q),
          ilike(organizationLeads.source, q),
          ilike(organizationLeads.firstMessagePreview, q),
        )!,
      );
    }
    const whereClause = and(...conditions);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationLeads)
      .where(whereClause);
    const items = await db
      .select()
      .from(organizationLeads)
      .where(whereClause)
      .orderBy(asc(organizationLeads.sortOrder), desc(organizationLeads.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, total: Number(count) || 0 };
  }

  async updateOrganizationLead(
    id: string,
    organizationId: string,
    data: Partial<InsertOrganizationLead>,
  ): Promise<OrganizationLead | undefined> {
    const existing = await this.getOrganizationLeadById(id, organizationId);
    if (!existing) return undefined;

    const patch: Partial<InsertOrganizationLead> = { ...data };
    if (patch.phoneNumber) {
      patch.phoneNumber = patch.phoneNumber.replace(/[^\d]/g, "");
    }
    if (patch.status && patch.status !== existing.status && patch.sortOrder == null) {
      patch.sortOrder = await this.getNextLeadSortOrder(organizationId, patch.status);
    }
    const [row] = await db
      .update(organizationLeads)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(organizationLeads.id, id), eq(organizationLeads.organizationId, organizationId)))
      .returning();
    if (row && patch.status && patch.status !== existing.status) {
      try {
        const { enrollLeadOnStatusChange } = await import("./drip-campaigns/enrollment");
        await enrollLeadOnStatusChange({
          organizationId,
          userId: row.userId || existing.userId || null,
          statusSlug: row.status,
          lead: {
            id: row.id,
            contactId: row.contactId,
            phoneNumber: row.phoneNumber,
            name: row.name,
            email: row.email,
            source: row.source,
            sessionId: row.sessionId || existing.sessionId || null,
          },
        });
      } catch (err: unknown) {
        console.error("[Drip] Lead status enrollment failed:", err);
      }
    }
    return row;
  }

  async reorderOrganizationLeads(
    organizationId: string,
    statusSlug: string,
    orderedIds: string[],
  ): Promise<OrganizationLead[]> {
    if (!organizationId || orderedIds.length === 0) return [];
    const uniqueIds = [...new Set(orderedIds.map(String))];
    const statusChangedLeads: OrganizationLead[] = [];

    for (let i = 0; i < uniqueIds.length; i++) {
      const leadId = uniqueIds[i];
      const existing = await this.getOrganizationLeadById(leadId, organizationId);
      const previousStatus = existing?.status;
      await db
        .update(organizationLeads)
        .set({ sortOrder: i, status: statusSlug, updatedAt: new Date() })
        .where(
          and(eq(organizationLeads.id, leadId), eq(organizationLeads.organizationId, organizationId)),
        );
      if (existing && previousStatus !== statusSlug) {
        statusChangedLeads.push({ ...existing, status: statusSlug, sortOrder: i });
      }
    }

    // Kanban drag uses reorder — must enroll drip campaigns when status actually changes
    for (const lead of statusChangedLeads) {
      try {
        const { enrollLeadOnStatusChange } = await import("./drip-campaigns/enrollment");
        await enrollLeadOnStatusChange({
          organizationId,
          userId: lead.userId || null,
          statusSlug,
          lead: {
            id: lead.id,
            contactId: lead.contactId,
            phoneNumber: lead.phoneNumber,
            name: lead.name,
            email: lead.email,
            source: lead.source,
            sessionId: lead.sessionId || null,
          },
        });
      } catch (err: unknown) {
        console.error("[Drip] Lead reorder enrollment failed:", err);
      }
    }

    return db
      .select()
      .from(organizationLeads)
      .where(
        and(eq(organizationLeads.organizationId, organizationId), inArray(organizationLeads.id, uniqueIds)),
      )
      .orderBy(asc(organizationLeads.sortOrder));
  }

  async deleteOrganizationLead(id: string, organizationId: string): Promise<boolean> {
    const existing = await this.getOrganizationLeadById(id, organizationId);
    if (!existing) return false;
    await db
      .delete(organizationLeads)
      .where(and(eq(organizationLeads.id, id), eq(organizationLeads.organizationId, organizationId)));
    return true;
  }

  async deleteOrganizationLeads(ids: string[], organizationId: string): Promise<number> {
    if (!organizationId || !ids.length) return 0;
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) return 0;
    const result = await db
      .delete(organizationLeads)
      .where(
        and(eq(organizationLeads.organizationId, organizationId), inArray(organizationLeads.id, uniqueIds)),
      )
      .returning({ id: organizationLeads.id });
    return result.length;
  }

  async listOrganizationLeadStatuses(organizationId: string): Promise<OrganizationLeadStatus[]> {
    if (!organizationId) return [];
    return db
      .select()
      .from(organizationLeadStatuses)
      .where(eq(organizationLeadStatuses.organizationId, organizationId))
      .orderBy(asc(organizationLeadStatuses.sortOrder), asc(organizationLeadStatuses.createdAt));
  }

  async getOrganizationLeadStatusById(
    id: string,
    organizationId: string,
  ): Promise<OrganizationLeadStatus | undefined> {
    const [row] = await db
      .select()
      .from(organizationLeadStatuses)
      .where(and(eq(organizationLeadStatuses.id, id), eq(organizationLeadStatuses.organizationId, organizationId)));
    return row;
  }

  async getOrganizationLeadStatusBySlug(
    organizationId: string,
    slug: string,
  ): Promise<OrganizationLeadStatus | undefined> {
    const [row] = await db
      .select()
      .from(organizationLeadStatuses)
      .where(
        and(eq(organizationLeadStatuses.organizationId, organizationId), eq(organizationLeadStatuses.slug, slug)),
      );
    return row;
  }

  async createOrganizationLeadStatus(data: InsertOrganizationLeadStatus): Promise<OrganizationLeadStatus> {
    const [row] = await db.insert(organizationLeadStatuses).values(data).returning();
    if (!row) throw new Error("Failed to create lead status");
    return row;
  }

  async updateOrganizationLeadStatus(
    id: string,
    organizationId: string,
    data: Partial<InsertOrganizationLeadStatus>,
  ): Promise<OrganizationLeadStatus | undefined> {
    const patch = { ...data, updatedAt: new Date() };
    if (data.isDefault === true) {
      await db
        .update(organizationLeadStatuses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(organizationLeadStatuses.organizationId, organizationId));
    }
    const [row] = await db
      .update(organizationLeadStatuses)
      .set(patch)
      .where(and(eq(organizationLeadStatuses.id, id), eq(organizationLeadStatuses.organizationId, organizationId)))
      .returning();
    return row;
  }

  async deleteOrganizationLeadStatus(id: string, organizationId: string): Promise<boolean> {
    const existing = await this.getOrganizationLeadStatusById(id, organizationId);
    if (!existing) return false;
    await db
      .delete(organizationLeadStatuses)
      .where(and(eq(organizationLeadStatuses.id, id), eq(organizationLeadStatuses.organizationId, organizationId)));
    return true;
  }

  async reorderOrganizationLeadStatuses(
    organizationId: string,
    orderedIds: string[],
  ): Promise<OrganizationLeadStatus[]> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(organizationLeadStatuses)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(
          and(eq(organizationLeadStatuses.id, orderedIds[i]), eq(organizationLeadStatuses.organizationId, organizationId)),
        );
    }
    return this.listOrganizationLeadStatuses(organizationId);
  }

  async countLeadsByStatusSlug(organizationId: string, slug: string): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationLeads)
      .where(and(eq(organizationLeads.organizationId, organizationId), eq(organizationLeads.status, slug)));
    return Number(count) || 0;
  }

  // Canned messages (org-scoped)
  async getCannedMessagesByOrganization(organizationId: string): Promise<CannedMessageRow[]> {
    if (!organizationId) return [];
    return db
      .select()
      .from(cannedMessages)
      .where(eq(cannedMessages.organizationId, organizationId))
      .orderBy(desc(cannedMessages.createdAt));
  }

  async listCannedMessagesByOrganization(
    organizationId: string,
    query: { search?: string; limit: number; offset: number }
  ) {
    if (!organizationId) {
      return { items: [], total: 0, limit: query.limit, offset: query.offset };
    }
    const conditions = [eq(cannedMessages.organizationId, organizationId)];
    if (query.search?.trim()) {
      const q = `%${query.search.trim().replace(/%/g, "\\%")}%`;
      conditions.push(or(ilike(cannedMessages.name, q), ilike(cannedMessages.text, q))!);
    }
    const whereClause = and(...conditions);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cannedMessages)
      .where(whereClause);
    const items = await db
      .select()
      .from(cannedMessages)
      .where(whereClause)
      .orderBy(desc(cannedMessages.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, total: Number(count) || 0, limit: query.limit, offset: query.offset };
  }

  async getCannedMessageByOrganization(id: string, organizationId: string): Promise<CannedMessageRow | undefined> {
    if (!organizationId) return undefined;
    const [row] = await db
      .select()
      .from(cannedMessages)
      .where(and(eq(cannedMessages.id, id), eq(cannedMessages.organizationId, organizationId)));
    return row;
  }

  async createCannedMessage(data: InsertCannedMessage): Promise<CannedMessageRow> {
    const [created] = await db.insert(cannedMessages).values(data).returning();
    if (!created) throw new Error("Failed to create canned message");
    return created;
  }

  async updateCannedMessageByOrganization(id: string, organizationId: string, data: Partial<InsertCannedMessage>): Promise<CannedMessageRow | undefined> {
    if (!organizationId) return undefined;
    const [updated] = await db
      .update(cannedMessages)
      .set(data)
      .where(and(eq(cannedMessages.id, id), eq(cannedMessages.organizationId, organizationId)))
      .returning();
    return updated;
  }

  async deleteCannedMessageByOrganization(id: string, organizationId: string): Promise<void> {
    if (!organizationId) return;
    await db.delete(cannedMessages).where(and(eq(cannedMessages.id, id), eq(cannedMessages.organizationId, organizationId)));
  }

  private static readonly PLATFORM_MASTER_ID = "singleton" as const;

  async getPlatformMasterSettings(): Promise<PlatformMasterSettingsRow | undefined> {
    const [row] = await db
      .select()
      .from(platformMasterSettings)
      .where(eq(platformMasterSettings.id, PostgresStorage.PLATFORM_MASTER_ID));
    return row;
  }

  async getActivePanelTemplateId(): Promise<string> {
    const row = await this.getPlatformMasterSettings();
    return row?.activePanelTemplateId ?? "default";
  }

  async setActivePanelTemplateId(panelTemplateId: string): Promise<PlatformMasterSettingsRow> {
    const now = new Date();
    const [row] = await db
      .insert(platformMasterSettings)
      .values({
        id: PostgresStorage.PLATFORM_MASTER_ID,
        activePanelTemplateId: panelTemplateId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: platformMasterSettings.id,
        set: {
          activePanelTemplateId: panelTemplateId,
          updatedAt: now,
        },
      })
      .returning();
    if (!row) throw new Error("Failed to set active panel template");
    return row;
  }

  async setSubscriptionDataRetentionMonths(months: 1 | 2 | 3): Promise<PlatformMasterSettingsRow> {
    const now = new Date();
    const [row] = await db
      .insert(platformMasterSettings)
      .values({
        id: PostgresStorage.PLATFORM_MASTER_ID,
        subscriptionDataRetentionMonths: months,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: platformMasterSettings.id,
        set: {
          subscriptionDataRetentionMonths: months,
          updatedAt: now,
        },
      })
      .returning();
    if (!row) throw new Error("Failed to set subscription data retention months");
    return row;
  }

  async clearUserSubscriptionDataPurgedAt(userId: string): Promise<void> {
    if (!userId) return;
    await db
      .update(users)
      .set({ subscriptionDataPurgedAt: null, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async recordPlatformMasterUpstreamSync(
    upstreamPayload: Record<string, unknown>,
    lastSyncStatus: string,
    lastSyncError: string | null
  ): Promise<PlatformMasterSettingsRow> {
    const now = new Date();
    const [row] = await db
      .insert(platformMasterSettings)
      .values({
        id: PostgresStorage.PLATFORM_MASTER_ID,
        upstreamPayload,
        lastSyncAt: now,
        lastSyncStatus,
        lastSyncError,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: platformMasterSettings.id,
        set: {
          upstreamPayload,
          lastSyncAt: now,
          lastSyncStatus,
          lastSyncError,
          updatedAt: now,
        },
      })
      .returning();
    if (!row) throw new Error("Failed to record platform master sync");
    return row;
  }

  async countUsersCreatedBefore(createdAt: Date, userId: string): Promise<number> {
    const [{ c }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(users)
      .where(or(lt(users.createdAt, createdAt), and(eq(users.createdAt, createdAt), lt(users.id, userId))));
    return Number(c) || 0;
  }

  /** Org owners only (end customers), excluding SaaS / WL admin accounts. */
  async countOnboardingBillableUsersCreatedBefore(createdAt: Date, userId: string): Promise<number> {
    const [{ c }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(users)
      .where(
        and(
          eq(users.isSaaSOwner, false),
          sql`exists (select 1 from ${organizations} o where o.owner_id = ${users.id})`,
          or(lt(users.createdAt, createdAt), and(eq(users.createdAt, createdAt), lt(users.id, userId)))
        )
      );
    return Number(c) || 0;
  }

  async userOwnsAnyOrganization(userId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.ownerId, userId))
      .limit(1);
    return !!row;
  }

  async listOnboardingBillableEndCustomerUsers(): Promise<User[]> {
    const ownerRows = await db.select({ ownerId: organizations.ownerId }).from(organizations);
    const ownerIds = [...new Set(ownerRows.map((r) => r.ownerId).filter(Boolean))];
    if (ownerIds.length === 0) return [];
    return await db
      .select()
      .from(users)
      .where(
        and(
          inArray(users.id, ownerIds),
          eq(users.isSaaSOwner, false),
          eq(users.isActive, true),
          eq(users.accountStatus, "active")
        )
      );
  }

  async clearAllWhitelabelOnboardingBillingData(): Promise<{
    feesDeleted: number;
    settlementsDeleted: number;
  }> {
    const feeRows = await db.select({ id: whitelabelOnboardingFees.id }).from(whitelabelOnboardingFees);
    const settlementRows = await db
      .select({ id: whitelabelOnboardingSettlements.id })
      .from(whitelabelOnboardingSettlements);
    if (feeRows.length) {
      await db.delete(whitelabelOnboardingFees);
    }
    if (settlementRows.length) {
      await db.delete(whitelabelOnboardingSettlements);
    }
    return { feesDeleted: feeRows.length, settlementsDeleted: settlementRows.length };
  }

  async clearUnpaidWhitelabelOnboardingFees(): Promise<{ feesDeleted: number; feesPreserved: number }> {
    const unpaidStatuses = ["pending", "failed", "cancelled"] as const;
    const unpaidRows = await db
      .select({ id: whitelabelOnboardingFees.id })
      .from(whitelabelOnboardingFees)
      .where(inArray(whitelabelOnboardingFees.status, [...unpaidStatuses]));
    if (unpaidRows.length) {
      await db
        .delete(whitelabelOnboardingFees)
        .where(inArray(whitelabelOnboardingFees.status, [...unpaidStatuses]));
    }
    const preservedRows = await db.select({ id: whitelabelOnboardingFees.id }).from(whitelabelOnboardingFees);
    return { feesDeleted: unpaidRows.length, feesPreserved: preservedRows.length };
  }

  async resetOnboardingSchedulesForRecalculate(): Promise<void> {
    await db
      .update(users)
      .set({
        onboardingNextChargeAt: null,
        onboardingMonthlyWaived: false,
        updatedAt: new Date(),
      })
      .where(eq(users.isSaaSOwner, false));
  }

  async getOnboardingFeesRecalculateUsedAt(): Promise<string | null> {
    const row = await this.getPlatformMasterSettings();
    const local = row?.revenueShareLocal;
    if (!local || typeof local !== "object" || Array.isArray(local)) return null;
    const v = (local as Record<string, unknown>).onboarding_fees_recalculate_used_at;
    return typeof v === "string" && v.trim() ? v.trim() : null;
  }

  async markOnboardingFeesRecalculateUsed(): Promise<void> {
    const row = await this.getPlatformMasterSettings();
    const prev =
      row?.revenueShareLocal && typeof row.revenueShareLocal === "object" && !Array.isArray(row.revenueShareLocal)
        ? (row.revenueShareLocal as Record<string, unknown>)
        : {};
    const revenueShareLocal = {
      ...prev,
      onboarding_fees_recalculate_used_at: new Date().toISOString(),
    };
    await db
      .insert(platformMasterSettings)
      .values({
        id: "singleton",
        revenueShareLocal,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: platformMasterSettings.id,
        set: { revenueShareLocal, updatedAt: new Date() },
      });
  }

  async insertWhitelabelOnboardingFee(data: InsertWhitelabelOnboardingFee): Promise<WhitelabelOnboardingFeeRow> {
    const [row] = await db.insert(whitelabelOnboardingFees).values(data).returning();
    if (!row) throw new Error("Failed to insert whitelabel onboarding fee");
    return row;
  }

  async listWhitelabelOnboardingFeesForUser(userId: string): Promise<WhitelabelOnboardingFeeRow[]> {
    return await db
      .select()
      .from(whitelabelOnboardingFees)
      .where(eq(whitelabelOnboardingFees.userId, userId))
      .orderBy(desc(whitelabelOnboardingFees.createdAt));
  }

  async getWhitelabelOnboardingFeesForAdmin(filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ fees: (WhitelabelOnboardingFeeRow & { user?: User })[]; total: number }> {
    const limit = filters?.limit ?? 100;
    const offset = filters?.offset ?? 0;
    let rows = await db
      .select()
      .from(whitelabelOnboardingFees)
      .orderBy(desc(whitelabelOnboardingFees.createdAt));
    if (filters?.status && filters.status !== "all") {
      rows = rows.filter((r) => r.status === filters.status);
    }
    const total = rows.length;
    const slice = rows.slice(offset, offset + limit);
    const fees: (WhitelabelOnboardingFeeRow & { user?: User })[] = [];
    for (const f of slice) {
      const [user] = await db.select().from(users).where(eq(users.id, f.userId)).limit(1);
      fees.push({ ...f, user });
    }
    return { fees, total };
  }

  async setWhitelabelOnboardingFeeGatewayOrder(ids: string[], gatewayOrderId: string): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(whitelabelOnboardingFees)
      .set({ gatewayOrderId })
      .where(inArray(whitelabelOnboardingFees.id, ids));
  }

  async markWhitelabelOnboardingFeesPaid(
    ids: string[],
    gatewayPaymentId: string,
    meta?: { paymentGateway: "razorpay" | "cashfree"; gatewayPayload?: Record<string, unknown> | null }
  ): Promise<void> {
    if (ids.length === 0) return;
    const now = new Date();
    await db
      .update(whitelabelOnboardingFees)
      .set({
        status: "paid",
        paidAt: now,
        gatewayPaymentId,
        ...(meta?.paymentGateway ? { paymentGateway: meta.paymentGateway } : {}),
        ...(meta?.gatewayPayload !== undefined ? { gatewayPayload: meta.gatewayPayload } : {}),
      })
      .where(inArray(whitelabelOnboardingFees.id, ids));
  }

  async getWhitelabelOnboardingFeesByGatewayOrderId(orderId: string): Promise<WhitelabelOnboardingFeeRow[]> {
    return await db.select().from(whitelabelOnboardingFees).where(eq(whitelabelOnboardingFees.gatewayOrderId, orderId));
  }

  async getWhitelabelOnboardingFeesByIds(ids: string[]): Promise<WhitelabelOnboardingFeeRow[]> {
    if (ids.length === 0) return [];
    return await db.select().from(whitelabelOnboardingFees).where(inArray(whitelabelOnboardingFees.id, ids));
  }

  async getTotalOutstandingWhitelabelOnboardingMinor(): Promise<number> {
    const [row] = await db
      .select({
        total: sql<number>`coalesce(sum(${whitelabelOnboardingFees.amountMinor}), 0)::int`,
      })
      .from(whitelabelOnboardingFees)
      .where(inArray(whitelabelOnboardingFees.status, ["pending", "failed"]));
    return Number(row?.total) || 0;
  }

  async insertWhitelabelOnboardingSettlement(
    data: InsertWhitelabelOnboardingSettlement
  ): Promise<WhitelabelOnboardingSettlementRow> {
    const [row] = await db.insert(whitelabelOnboardingSettlements).values(data).returning();
    if (!row) throw new Error("Failed to insert whitelabel onboarding settlement");
    return row;
  }

  async getWhitelabelOnboardingSettlementByGatewayOrderId(
    gatewayOrderId: string
  ): Promise<WhitelabelOnboardingSettlementRow | undefined> {
    const [row] = await db
      .select()
      .from(whitelabelOnboardingSettlements)
      .where(eq(whitelabelOnboardingSettlements.gatewayOrderId, gatewayOrderId))
      .limit(1);
    return row;
  }

  async markWhitelabelOnboardingSettlementPaid(
    gatewayOrderId: string,
    gatewayPaymentId: string,
    paidPayload: Record<string, unknown> | null
  ): Promise<void> {
    const [row] = await db
      .select()
      .from(whitelabelOnboardingSettlements)
      .where(eq(whitelabelOnboardingSettlements.gatewayOrderId, gatewayOrderId))
      .limit(1);
    if (!row) return;
    const prevRaw =
      row?.rawGatewayResponse && typeof row.rawGatewayResponse === "object" && !Array.isArray(row.rawGatewayResponse)
        ? (row.rawGatewayResponse as Record<string, unknown>)
        : {};
    const merged: Record<string, unknown> = {
      ...prevRaw,
      ...(paidPayload && typeof paidPayload === "object" ? paidPayload : {}),
      gateway_payment_id: gatewayPaymentId,
      settlement_marked_paid_at: new Date().toISOString(),
    };
    await db
      .update(whitelabelOnboardingSettlements)
      .set({
        status: "paid",
        gatewayPaymentId,
        rawGatewayResponse: merged,
        paidAt: new Date(),
      })
      .where(eq(whitelabelOnboardingSettlements.gatewayOrderId, gatewayOrderId));
  }

  async getWhitelabelOnboardingSettlementsForAdmin(filters?: {
    limit?: number;
    offset?: number;
  }): Promise<{ settlements: WhitelabelOnboardingSettlementRow[]; total: number }> {
    const limit = Math.min(filters?.limit ?? 100, 500);
    const offset = filters?.offset ?? 0;
    const rows = await db
      .select()
      .from(whitelabelOnboardingSettlements)
      .orderBy(desc(whitelabelOnboardingSettlements.createdAt));
    const total = rows.length;
    return { settlements: rows.slice(offset, offset + limit), total };
  }

  async getUsersDueForWhitelabelOnboardingMonthly(before: Date): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.isSaaSOwner, false),
          eq(users.isActive, true),
          eq(users.accountStatus, "active"),
          eq(users.onboardingMonthlyWaived, false),
          or(isNull(users.onboardingNextChargeAt), lte(users.onboardingNextChargeAt, before))
        )
      );
  }

  async updateUserOnboardingSchedule(
    userId: string,
    data: { onboardingNextChargeAt?: Date | null; onboardingMonthlyWaived?: boolean }
  ): Promise<void> {
    await db
      .update(users)
      .set({
        ...(data.onboardingNextChargeAt !== undefined
          ? { onboardingNextChargeAt: data.onboardingNextChargeAt }
          : {}),
        ...(data.onboardingMonthlyWaived !== undefined
          ? { onboardingMonthlyWaived: data.onboardingMonthlyWaived }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getSupportTicketById(id: string): Promise<SupportTicket | undefined> {
    const [row] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return row;
  }

  async getSupportTicketByIdForOrganization(id: string, organizationId: string): Promise<SupportTicket | undefined> {
    const [row] = await db
      .select()
      .from(supportTickets)
      .where(and(eq(supportTickets.id, id), eq(supportTickets.organizationId, organizationId)));
    return row;
  }

  async getSupportTicketByAccessToken(accessToken: string): Promise<SupportTicket | undefined> {
    if (!accessToken) return undefined;
    const [row] = await db.select().from(supportTickets).where(eq(supportTickets.accessToken, accessToken));
    return row;
  }

  async listSupportTicketsForOrganization(organizationId: string): Promise<SupportTicket[]> {
    if (!organizationId) return [];
    return db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.organizationId, organizationId))
      .orderBy(desc(supportTickets.updatedAt));
  }

  async listAllSupportTickets(): Promise<SupportTicket[]> {
    return db
      .select()
      .from(supportTickets)
      .orderBy(desc(supportTickets.updatedAt));
  }

  async listSupportTicketsForCustomer(userId: string, emailLower: string): Promise<SupportTicket[]> {
    const byUser = eq(supportTickets.customerUserId, userId);
    if (emailLower?.trim()) {
      const byEmail = sql`lower(${supportTickets.customerEmail}) = ${emailLower.trim().toLowerCase()}`;
      return db
        .select()
        .from(supportTickets)
        .where(or(byUser, byEmail))
        .orderBy(desc(supportTickets.updatedAt));
    }
    return db
      .select()
      .from(supportTickets)
      .where(byUser)
      .orderBy(desc(supportTickets.updatedAt));
  }

  async createSupportTicketRow(data: InsertSupportTicket): Promise<SupportTicket> {
    const [created] = await db.insert(supportTickets).values({ ...data, updatedAt: new Date() }).returning();
    if (!created) throw new Error("Failed to create support ticket");
    return created;
  }

  async createSupportMessageRow(data: InsertSupportMessage): Promise<SupportMessage> {
    const [created] = await db.insert(supportMessages).values(data).returning();
    if (!created) throw new Error("Failed to create support message");
    return created;
  }

  async createSupportAttachmentRow(data: InsertSupportAttachment): Promise<SupportAttachment> {
    const [created] = await db.insert(supportAttachments).values(data).returning();
    if (!created) throw new Error("Failed to create support attachment");
    return created;
  }

  async updateSupportTicketByOrganization(
    id: string,
    organizationId: string,
    data: Partial<
      Pick<
        SupportTicket,
        | "status"
        | "assignedToUserId"
        | "updatedAt"
        | "transferredToTechnical"
        | "transferredToTechnicalAt"
        | "technicalTicketId"
      >
    >
  ): Promise<SupportTicket | undefined> {
    if (!organizationId) return undefined;
    const [updated] = await db
      .update(supportTickets)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(supportTickets.id, id), eq(supportTickets.organizationId, organizationId)))
      .returning();
    return updated;
  }

  async updateSupportTicketById(
    id: string,
    data: Partial<
      Pick<
        SupportTicket,
        | "status"
        | "assignedToUserId"
        | "updatedAt"
        | "transferredToTechnical"
        | "transferredToTechnicalAt"
        | "technicalTicketId"
      >
    >
  ): Promise<SupportTicket | undefined> {
    const [updated] = await db
      .update(supportTickets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }

  async getSupportMessagesByTicketId(ticketId: string): Promise<SupportMessage[]> {
    if (!ticketId) return [];
    return db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(asc(supportMessages.createdAt));
  }

  async getSupportAttachmentsByTicketId(ticketId: string): Promise<SupportAttachment[]> {
    if (!ticketId) return [];
    return db.select().from(supportAttachments).where(eq(supportAttachments.ticketId, ticketId));
  }

  async getSupportAttachmentsByMessageIds(messageIds: string[]): Promise<SupportAttachment[]> {
    if (messageIds.length === 0) return [];
    return db.select().from(supportAttachments).where(inArray(supportAttachments.messageId, messageIds));
  }

  async createSupportTicketWithInitialMessage(
    input: {
      organizationId: string;
      accessToken: string;
      subject: string;
      description: string;
      customerEmail: string;
      customerName: string;
      customerPhone?: string | null;
      customerUserId?: string | null;
    },
    attachment?: {
      fileName: string;
      filePath: string;
      mimeType: string;
      sizeBytes: number;
    }
  ): Promise<{ ticket: SupportTicket; firstMessage: SupportMessage; attachment?: SupportAttachment }> {
    // Neon HTTP driver does not support db.transaction(); use sequential writes + retry on ticket_number conflict.
    const maxAttempts = 5;
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const [maxRow] = await db
        .select({ n: max(supportTickets.ticketNumber) })
        .from(supportTickets)
        .where(eq(supportTickets.organizationId, input.organizationId));
      const ticketNumber = (maxRow?.n ?? 0) + 1;
      const now = new Date();
      let ticket: SupportTicket | undefined;
      try {
        const [inserted] = await db
          .insert(supportTickets)
          .values({
            organizationId: input.organizationId,
            ticketNumber,
            accessToken: input.accessToken,
            subject: input.subject,
            description: input.description,
            status: "open",
            customerEmail: input.customerEmail,
            customerName: input.customerName,
            customerPhone: input.customerPhone || null,
            customerUserId: input.customerUserId || null,
            updatedAt: now,
          })
          .returning();
        ticket = inserted;
      } catch (e: any) {
        lastErr = e;
        const code = e?.code ?? e?.cause?.code;
        const msg = String(e?.message ?? "");
        if (code === "23505" || msg.includes("unique") || msg.includes("duplicate")) {
          continue;
        }
        throw e;
      }
      if (!ticket) {
        throw new Error("Failed to create support ticket");
      }
      try {
        const [firstMessage] = await db
          .insert(supportMessages)
          .values({
            ticketId: ticket.id,
            body: input.description,
            authorType: "customer",
            authorUserId: input.customerUserId || null,
          })
          .returning();
        if (!firstMessage) {
          throw new Error("Failed to create first message");
        }
        if (attachment) {
          const [att] = await db
            .insert(supportAttachments)
            .values({
              ticketId: ticket.id,
              messageId: firstMessage.id,
              fileName: attachment.fileName,
              filePath: attachment.filePath,
              mimeType: attachment.mimeType,
              sizeBytes: attachment.sizeBytes,
              uploadedBy: "customer",
              uploadedByUserId: input.customerUserId || null,
            })
            .returning();
          return { ticket, firstMessage, attachment: att };
        }
        return { ticket, firstMessage };
      } catch (e) {
        await db.delete(supportTickets).where(eq(supportTickets.id, ticket.id));
        throw e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Could not allocate ticket number");
  }
}

import { isMongoEnabled } from "../db/mongo";
import { createMongoStorage } from "./mongo-storage";

export const storage: IStorage = isMongoEnabled()
  ? createMongoStorage()
  : new PostgresStorage();

