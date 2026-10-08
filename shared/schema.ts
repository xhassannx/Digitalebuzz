import { sql } from 'drizzle-orm';
import { pgTable, pgSequence, varchar, timestamp, text, boolean, integer, jsonb, index, serial, uniqueIndex, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { LinearFlowDefinition } from "./linear-flow";
import type {
  DripCampaignStep,
  DripTriggerConfig,
  DripDuplicateStrategy,
  DripCampaignStatus,
  DripEnrollmentStatus,
  DripWeekday,
  DripCampaignGoal,
  DripEntryTrigger,
} from "./drip-campaigns";

/**
 * Owned by `_helicoptic_sql_migrations` (SQL migration runner), which is excluded from
 * drizzle push via tablesFilter. drizzle-kit still sees SERIAL sequences and tries to
 * DROP them — that fails with 2BP01 when the table default still depends on the sequence.
 *
 * Postgres may name the owned sequence `_helicoptic_sql_migrations_id_seq` or
 * `_helicoptic_sql_migrations_id_seq1` (suffix when the base name was already taken).
 * Declare both so push does not try to drop whichever the live DB is using.
 *
 * Options must match a Postgres SERIAL sequence (integer, max 2147483647). Bare
 * `pgSequence(name)` defaults to bigint MAXVALUE and push fails with:
 * "MAXVALUE (9223372036854775807) is out of range for sequence data type integer".
 * @see https://github.com/drizzle-team/drizzle-orm/issues/3320
 */
const helicopticSqlMigrationsSeqOpts = {
  startWith: 1,
  increment: 1,
  minValue: 1,
  maxValue: 2147483647,
  cache: 1,
  cycle: false,
} as const;

export const helicopticSqlMigrationsIdSeq = pgSequence(
  "_helicoptic_sql_migrations_id_seq",
  helicopticSqlMigrationsSeqOpts,
);
export const helicopticSqlMigrationsIdSeq1 = pgSequence(
  "_helicoptic_sql_migrations_id_seq1",
  helicopticSqlMigrationsSeqOpts,
);

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"), // For local authentication (optional - OIDC users won't have this)
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  tenantId: varchar("tenant_id"), // External CRM tenant identifier
  profileImageUrl: varchar("profile_image_url"),
  isSaaSOwner: boolean("is_saas_owner").notNull().default(false), // SaaS platform owner/admin
  isActive: boolean("is_active").notNull().default(true), // User activation status
  emailVerified: boolean("email_verified").notNull().default(false),
  accountStatus: varchar("account_status", { enum: ['active', 'suspended', 'blocked'] }).notNull().default('active'),
  /** Explicit trial account (e.g. free-trial signup or admin-created trial). */
  isTrialAccount: boolean("is_trial_account").notNull().default(false),
  trialExpiresAt: timestamp("trial_expires_at", { withTimezone: true }),
  /** Next time to create a monthly licensor onboarding fee row (background scheduler). */
  onboardingNextChargeAt: timestamp("onboarding_next_charge_at", { withTimezone: true }),
  /** First N customers per contract `included_users` are never charged. */
  onboardingMonthlyWaived: boolean("onboarding_monthly_waived").notNull().default(false),
  /**
   * When business data was last purged after subscription expiry (account kept).
   * Auto-purge skips users already marked; cleared when they get a new active plan.
   */
  subscriptionDataPurgedAt: timestamp("subscription_data_purged_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Signup schema (for local authentication)
export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  organizationName: z.string().min(1, "Organization name is required"),
  phone: z.string().min(10, "Valid mobile number is required (min 10 digits)").regex(/^[0-9+\-\s()]+$/, "Invalid mobile number format"),
});

export type SignupInput = z.infer<typeof signupSchema>;

/** Guest or existing customer: buy subscription from public /subscribe (no session). */
export const publicSubscriptionCheckoutSchema = signupSchema.extend({
  planId: z.string().min(1, "Plan is required"),
  billingCycle: z.enum(["monthly", "quarterly", "yearly"]),
  paymentGateway: z.enum(["razorpay", "stripe", "wallet"]),
});

export type PublicSubscriptionCheckoutInput = z.infer<typeof publicSubscriptionCheckoutSchema>;

export const publicRazorpaySubscriptionVerifySchema = z.object({
  razorpay_order_id: z.string().optional(),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  razorpay_subscription_id: z.string().optional(),
});

export type PublicRazorpaySubscriptionVerifyInput = z.infer<typeof publicRazorpaySubscriptionVerifySchema>;

// CRM register schema (no password – system generates one; phone and tenant_id optional)
export const crmRegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  tenant_id: z.string().optional().nullable(), // CRM tenant identifier; can be null
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  organizationName: z.string().min(1, "Organization name is required"),
  phone: z.string().optional().refine((v) => !v || v.length >= 10, "Phone must be at least 10 digits").refine((v) => !v || /^[0-9+\-\s()]+$/.test(v), "Invalid phone format"),
});

export type CrmRegisterInput = z.infer<typeof crmRegisterSchema>;

// Login schema (for local authentication)
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Forgot password schema
export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// Reset password schema
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// API Keys Table for programmatic access
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id"), // Organization scope for multi-tenant API access
  name: varchar("name").notNull(),
  key: varchar("key").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsed: timestamp("last_used"),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsed: true,
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

// WhatsApp Sessions Table - now scoped to users
export const whatsappSessions = pgTable("whatsapp_sessions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'set null' }),
  sessionId: varchar("session_id").notNull().unique(),
  connectionType: varchar("connection_type", { enum: ['unofficial', 'official'] }).notNull().default('unofficial'),
  status: varchar("status", { enum: ['disconnected', 'connecting', 'qr', 'connected'] }).notNull().default('disconnected'),
  qrCode: text("qr_code"),
  /** When set, session is "deleted" from connect panel but preserved for chat history on reconnect */
  deletedAt: timestamp("deleted_at"),
  deviceInfo: jsonb("device_info").$type<{
    platform?: string;
    phoneNumber?: string;
    name?: string;
    // For official WhatsApp Business API
    apiPhoneNumberId?: string;
    businessAccountId?: string;
    businessAccountName?: string;
    wabaId?: string; // WhatsApp Business Account ID
    wabaName?: string;
    qualityRating?: string;
    codeVerificationStatus?: string;
    displayPhoneNumber?: string;
    verifiedName?: string;
    /** Integration ID that owns this session (for multiple Meta/WhatsApp accounts) */
    integrationId?: string;
  }>(),
  lastActive: timestamp("last_active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWhatsappSessionSchema = createInsertSchema(whatsappSessions).omit({
  id: true,
  createdAt: true,
  lastActive: true,
});

export type WhatsappSession = typeof whatsappSessions.$inferSelect;
export type InsertWhatsappSession = z.infer<typeof insertWhatsappSessionSchema>;

// Contacts Table
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: varchar("session_id").notNull().references(() => whatsappSessions.sessionId, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  number: varchar("number").notNull(),
  profilePic: text("profile_pic"),
  isGroup: boolean("is_group").notNull().default(false),
  lastSeen: timestamp("last_seen"),
});

export const insertContactSchema = createInsertSchema(contacts).omit({ id: true });

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

// Chats Table
export const chats = pgTable("chats", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: varchar("session_id").notNull().references(() => whatsappSessions.sessionId, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: 'cascade' }),
  contactName: varchar("contact_name").notNull(),
  contactNumber: varchar("contact_number").notNull(),
  contactProfilePic: text("contact_profile_pic"),
  lastMessage: text("last_message"),
  lastMessageTime: timestamp("last_message_time"),
  unreadCount: integer("unread_count").notNull().default(0),
  isGroup: boolean("is_group").notNull().default(false),
}, (table) => [
  index("idx_chats_session_last_message").on(table.sessionId, table.lastMessageTime),
  index("idx_chats_session_contact").on(table.sessionId, table.contactNumber),
]);

export const insertChatSchema = createInsertSchema(chats).omit({ id: true });

export type Chat = typeof chats.$inferSelect;
export type InsertChat = z.infer<typeof insertChatSchema>;

// Messages Table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: varchar("session_id").notNull().references(() => whatsappSessions.sessionId, { onDelete: 'cascade' }),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }), // Organization scope for multi-tenant support
  body: text("body").notNull(),
  fromMe: boolean("from_me").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  type: varchar("type", { enum: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'template'] }).notNull().default('text'),
  mediaUrl: text("media_url"),
  status: varchar("status", { enum: ['pending', 'sent', 'delivered', 'read', 'failed'] }).notNull().default('pending'),
  senderName: varchar("sender_name"),
  senderNumber: varchar("sender_number"),
  // Location message fields
  latitude: varchar("latitude"),
  longitude: varchar("longitude"),
  address: text("address"),
  // Contact message fields (vCard)
  vcard: text("vcard"),
  // Footer and button fields
  footer: text("footer"),
  footerButtonType: varchar("footer_button_type", { enum: ['NONE', 'QUICK_REPLY', 'URL', 'PHONE_NUMBER'] }),
  footerButtonText: text("footer_button_text"),
  footerButtonUrl: text("footer_button_url"),
  footerButtonPhone: varchar("footer_button_phone"),
  // WhatsApp Business API fields
  whatsappMessageId: varchar("whatsapp_message_id"), // WhatsApp API message ID (e.g., wamid.HBgM...)
  campaignId: varchar("campaign_id"), // Link to campaign if sent via campaign (FK added via migration)
  // Status timestamps
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  failedAt: timestamp("failed_at"),
  // Error tracking
  errorMessage: text("error_message"),
  errorCode: varchar("error_code"),
  // Template message fields
  templateName: varchar("template_name"),
  templateLanguage: varchar("template_language"),
  templateType: varchar("template_type", { enum: ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'] }),
  headerText: text("header_text"), // For TEXT header templates
  templateParams: jsonb("template_params").$type<string[]>(), // Array of template parameters used
  /** Per-card media URLs actually sent for MEDIA_CARD_CAROUSEL (panel display; same order as template mediaCards) */
  carouselCardMediaUrls: jsonb("carousel_card_media_urls").$type<string[] | null>(),
  // Reactions: array of { emoji, fromMe } (one entry per participant; latest reaction wins per fromMe)
  reactions: jsonb("reactions").$type<Array<{ emoji: string; fromMe: boolean }>>().default([]),
  // Reply: when this message is a reply, reference and preview of the quoted message (WhatsApp-style)
  replyToMessageId: varchar("reply_to_message_id"), // Our internal message id
  quotedBody: text("quoted_body"), // Preview text of the message being replied to
  quotedFromMe: boolean("quoted_from_me"), // Whether the quoted message was from me
}, (table) => [
  index("idx_messages_chat_timestamp").on(table.chatId, table.timestamp),
  index("idx_messages_session_id").on(table.sessionId),
  index("idx_messages_session_fromme").on(table.sessionId, table.fromMe),
  index("idx_messages_session_timestamp").on(table.sessionId, table.timestamp),
  index("idx_messages_whatsapp_id").on(table.whatsappMessageId),
  index("idx_messages_campaign").on(table.campaignId),
  index("idx_messages_status").on(table.status),
]);

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Send Message Request Schemas
// Button schema for footer buttons
const footerButtonSchema = z.object({
  type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']),
  text: z.string().min(1, "Button text is required"),
  url: z.string().optional(),
  phoneNumber: z.string().optional(),
}).refine((data) => {
  if (data.type === 'URL' && !data.url) {
    return false;
  }
  if (data.type === 'PHONE_NUMBER' && !data.phoneNumber) {
    return false;
  }
  return true;
}, {
  message: "URL or Phone Number is required based on button type",
  path: ["url", "phoneNumber"],
});

export const sendTextMessageSchema = z.object({
  sessionId: z.string(),
  to: z.string(),
  message: z.string().optional(), // Made optional - required only when not using templates
  replyToMessageId: z.string().optional(), // Our internal id of the message being replied to
  quotedBody: z.string().optional(), // Preview of quoted message for display
  quotedFromMe: z.boolean().optional(), // Whether the quoted message was from me
  footer: z.string().optional(),
  // Support both old single button format and new multiple buttons format
  footerButtonType: z.enum(['NONE', 'QUICK_REPLY', 'URL', 'PHONE_NUMBER']).optional().default('NONE'),
  footerButtonText: z.string().optional(),
  footerButtonUrl: z.string().optional(),
  footerButtonPhone: z.string().optional(),
  // New multiple buttons format
  footerButtons: z.array(footerButtonSchema).optional(),
  // Template message fields (for WhatsApp Business API)
  templateName: z.string().optional(),
  templateLanguage: z.string().optional().default('en'),
  templateParams: z.array(z.string()).optional(),
  headerImageId: z.string().optional(), // For templates with IMAGE header (WhatsApp media ID)
  headerImageUrl: z.string().optional(), // For templates with IMAGE header (local file path, URL, or gallery file ID)
  headerVideoId: z.string().optional(), // For templates with VIDEO header (WhatsApp media ID)
  headerVideoUrl: z.string().optional(), // For templates with VIDEO header (local file path, URL, or gallery file ID)
  headerDocumentId: z.string().optional(), // For templates with DOCUMENT header (WhatsApp media ID)
  headerDocumentUrl: z.string().optional(), // For templates with DOCUMENT header (local file path, URL, or gallery file ID)
  /** Display name for DOCUMENT template headers (avoids WhatsApp "Untitled") */
  headerDocumentFilename: z.string().optional(),
  /** Per-card media URLs for MEDIA_CARD_CAROUSEL (send-time only; same order as template metaData.mediaCards) */
  carouselCardMediaUrls: z.array(z.string().min(1)).optional(),
}).refine((data) => {
  // Message is required only if not using a template
  if (!data.templateName) {
    return !!data.message;
  }
  // If using template, message is optional
  return true;
}, {
  message: "Either 'message' or 'templateName' must be provided",
  path: ["message"],
});

export type SendTextMessage = z.infer<typeof sendTextMessageSchema>;

export const sendReactionMessageSchema = z.object({
  sessionId: z.string(),
  messageId: z.string(), // WhatsApp message ID (whatsappMessageId from our messages table)
  emoji: z.string().min(1, 'Emoji is required'),
});

export type SendReactionMessage = z.infer<typeof sendReactionMessageSchema>;

export const sendMediaMessageSchema = z.object({
  sessionId: z.string(),
  to: z.string(),
  caption: z.string().optional(),
  mediaType: z.enum(['image', 'video', 'audio', 'document']),
  footer: z.string().optional(),
  // Support both old single button format and new multiple buttons format
  footerButtonType: z.enum(['NONE', 'QUICK_REPLY', 'URL', 'PHONE_NUMBER']).optional().default('NONE'),
  footerButtonText: z.string().optional(),
  footerButtonUrl: z.string().optional(),
  footerButtonPhone: z.string().optional(),
  // New multiple buttons format
  footerButtons: z.array(footerButtonSchema).optional(),
});

export type SendMediaMessage = z.infer<typeof sendMediaMessageSchema>;

export const sendLocationMessageSchema = z.object({
  sessionId: z.string(),
  to: z.string(),
  latitude: z.string().regex(/^-?([1-8]?[0-9]\.{1}\d+|90\.{1}0+)$/, "Invalid latitude"),
  longitude: z.string().regex(/^-?((1[0-7][0-9]|[1-9]?[0-9])\.{1}\d+|180\.{1}0+)$/, "Invalid longitude"),
  address: z.string().optional(),
  footer: z.string().optional(),
  // Support both old single button format and new multiple buttons format
  footerButtonType: z.enum(['NONE', 'QUICK_REPLY', 'URL', 'PHONE_NUMBER']).optional().default('NONE'),
  footerButtonText: z.string().optional(),
  footerButtonUrl: z.string().optional(),
  footerButtonPhone: z.string().optional(),
  // New multiple buttons format
  footerButtons: z.array(footerButtonSchema).optional(),
});

export type SendLocationMessage = z.infer<typeof sendLocationMessageSchema>;

export const sendContactMessageSchema = z.object({
  sessionId: z.string(),
  to: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().email().optional(),
  footer: z.string().optional(),
  // Support both old single button format and new multiple buttons format
  footerButtonType: z.enum(['NONE', 'QUICK_REPLY', 'URL', 'PHONE_NUMBER']).optional().default('NONE'),
  footerButtonText: z.string().optional(),
  footerButtonUrl: z.string().optional(),
  footerButtonPhone: z.string().optional(),
  // New multiple buttons format
  footerButtons: z.array(footerButtonSchema).optional(),
});

export type SendContactMessage = z.infer<typeof sendContactMessageSchema>;

// Webhooks Table for user notifications
export const webhooks = pgTable("webhooks", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  url: varchar("url").notNull(),
  events: text("events").array().notNull().$type<Array<'message.received' | 'message.sent' | 'message.status_updated' | 'session.connected' | 'session.disconnected' | 'chat.new' | 'messages' | 'contact.created' | 'contact.updated' | 'contact.deleted' | 'contact.tag_added' | 'contact.tag_removed' | 'contacts' | 'calendly.invitee_created' | 'calendly.invitee_canceled' | 'calendly.routing_form_submission' | 'google_calendar.event_created' | 'google_calendar.event_updated' | 'google_calendar.event_deleted' | 'shopify.order_created' | 'shopify.order_updated' | 'shopify.customer_created' | 'facebook_lead_ads.lead_received' | 'app_events'>>(),
  secret: varchar("secret").notNull(),
  status: varchar("status", { enum: ['active', 'inactive'] }).notNull().default('active'),
  lastTriggeredAt: timestamp("last_triggered_at"),
  failureCount: integer("failure_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_webhooks_user").on(table.userId),
  index("idx_webhooks_org").on(table.organizationId),
]);

export const insertWebhookSchema = createInsertSchema(webhooks).omit({
  id: true,
  createdAt: true,
  lastTriggeredAt: true,
  failureCount: true,
});

export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;

// API Endpoint Schema (frontend only, no DB table)
export const apiEndpoint = z.object({
  method: z.string(),
  path: z.string(),
  description: z.string(),
  example: z.string().optional(),
  curlExample: z.string().optional(),
  requestBody: z.any().optional(),
  responseExample: z.any().optional(),
  parameters: z.array(z.object({
    name: z.string(),
    in: z.enum(['path', 'query', 'body']),
    required: z.boolean().optional(),
    type: z.string().optional(),
    description: z.string().optional(),
  })).optional(),
  authHeader: z.string().optional(), // e.g. "X-API-Key" or "Authorization: Bearer"
});

export type ApiEndpoint = z.infer<typeof apiEndpoint>;

// Subscription Plans Table
export const plans = pgTable("plans", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name").notNull().unique(),
  displayName: varchar("display_name").notNull(),
  description: text("description"),
  priceMonthly: integer("price_monthly").notNull(), // in cents
  priceQuarterly: integer("price_quarterly").notNull(), // in cents
  priceYearly: integer("price_yearly").notNull(), // in cents
  features: jsonb("features").$type<{
    maxSessions: number;
    maxMessagesPerMonth: number;
    maxApiCallsPerMinute: number;
    maxWebhooks: number;
    maxContacts?: number;
    maxTeamMembers?: number;
    maxWorkflows?: number;
    maxChatbots?: number;
    maxWabaNumbers?: number;
    hasWhatsappBusinessApi: boolean;
    hasAnalytics: boolean;
    hasPrioritySupport: boolean;
    hasMessageHistorySync: boolean;
    messageHistorySyncPricePerMB?: number;
    maxMessageHistorySyncMB?: number;
  }>().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  status: varchar("status", { enum: ['published', 'draft'] }).default('published'),
  isPopular: boolean("is_popular").default(false),
  isInternational: boolean("is_international").default(false),
  gstType: varchar("gst_type").default('inclusive'), // inclusive, exclusive
  gstPercent: integer("gst_percent").default(0),
  /** Convenience / service fee — % of base plan price for the billing cycle */
  serviceChargePercent: integer("service_charge_percent").default(0),
  /** Fixed convenience fee in minor units (paise/cents) per billing cycle charge */
  serviceChargeFixed: integer("service_charge_fixed").default(0),
  currency: varchar("currency").default('INR'),
  defaultBillingCycle: varchar("default_billing_cycle", { enum: ['monthly', 'quarterly', 'yearly'] }).default('monthly'),
  planFeatures: jsonb("plan_features").$type<string[]>().default([]), // Marketing bullet points
  autoAssignOnSignup: boolean("auto_assign_on_signup").default(false),
  autoAssignTrialDays: integer("auto_assign_trial_days").default(7), // Days for free trial when auto-assigned
  /** Locked Free plan: not editable/deletable; default for every new signup. */
  isSystemDefault: boolean("is_system_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlanSchema = createInsertSchema(plans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isSystemDefault: true, // set only by ensureSystemFreePlan — not via admin API
});

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;

// Subscriptions Table
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: varchar("plan_id").notNull().references(() => plans.id),
  status: varchar("status", { enum: ['active', 'cancelled', 'expired', 'pending'] }).notNull().default('pending'),
  billingCycle: varchar("billing_cycle", { enum: ['monthly', 'quarterly', 'yearly'] }).notNull(),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  paymentGateway: varchar("payment_gateway", { enum: ['razorpay', 'stripe', 'manual', 'wallet'] }),
  gatewaySubscriptionId: varchar("gateway_subscription_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

// Payments Table
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subscriptionId: varchar("subscription_id").notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer("amount").notNull(), // in cents
  currency: varchar("currency").notNull().default('INR'),
  status: varchar("status", { enum: ['pending', 'completed', 'failed', 'refunded'] }).notNull().default('pending'),
  paymentGateway: varchar("payment_gateway", { enum: ['razorpay', 'stripe', 'manual', 'wallet'] }).notNull(),
  gatewayOrderId: varchar("gateway_order_id"),
  gatewayPaymentId: varchar("gateway_payment_id"),
  gatewaySignature: varchar("gateway_signature"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

// Subscription/Plan history (tracks plan changes per user)
export const subscriptionHistory = pgTable("subscription_history", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: varchar("plan_id").notNull().references(() => plans.id),
  subscriptionId: varchar("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  action: varchar("action", { enum: ["assigned", "upgraded", "downgraded", "renewed", "expired", "cancelled"] }).notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  billingCycle: varchar("billing_cycle", { enum: ["monthly", "quarterly", "yearly"] }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SubscriptionHistory = typeof subscriptionHistory.$inferSelect;

/**
 * One batch checkout (Razorpay order or Cashfree link) paying multiple onboarding fee line items.
 * Separate from subscription `payments` — listed only under onboarding fee payments in admin.
 */
export const whitelabelOnboardingSettlements = pgTable(
  "whitelabel_onboarding_settlements",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    gateway: varchar("gateway", { enum: ["razorpay", "cashfree"] }).notNull(),
    gatewayOrderId: varchar("gateway_order_id").notNull().unique(),
    gatewayPaymentId: varchar("gateway_payment_id"),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("INR"),
    feeIds: jsonb("fee_ids").notNull().$type<string[]>(),
    status: varchar("status", { enum: ["pending", "paid", "failed"] })
      .notNull()
      .default("pending"),
    rawGatewayResponse: jsonb("raw_gateway_response").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (table) => [index("idx_onboarding_settlements_status_created").on(table.status, table.createdAt)]
);

export type WhitelabelOnboardingSettlementRow = typeof whitelabelOnboardingSettlements.$inferSelect;
export type InsertWhitelabelOnboardingSettlement = typeof whitelabelOnboardingSettlements.$inferInsert;

/** Per end-customer onboarding fee owed by whitelabel to licensor (contract from /api/customer sync). */
export const whitelabelOnboardingFees = pgTable("whitelabel_onboarding_fees", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: varchar("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  subscriptionHistoryId: varchar("subscription_history_id").references(() => subscriptionHistory.id, {
    onDelete: "set null",
  }),
  trigger: varchar("trigger", {
    enum: ["assigned", "purchased", "renewed", "upgraded", "monthly"],
  }).notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("INR"),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  status: varchar("status", {
    enum: ["pending", "paid", "waived", "failed", "cancelled"],
  })
    .notNull()
    .default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  gatewayOrderId: varchar("gateway_order_id"),
  gatewayPaymentId: varchar("gateway_payment_id"),
  paymentGateway: varchar("payment_gateway", { length: 32 }),
  gatewayPayload: jsonb("gateway_payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WhitelabelOnboardingFeeRow = typeof whitelabelOnboardingFees.$inferSelect;
export type InsertWhitelabelOnboardingFee = typeof whitelabelOnboardingFees.$inferInsert;

// Add-ons catalog (admin-defined)
export const addons = pgTable("addons", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name").notNull(),
  displayName: varchar("display_name"), // Optional display name
  description: text("description"),
  type: varchar("type").default('custom'), // team, workflow, chatbot, waba, custom
  price: integer("price").notNull(), // in cents
  currency: varchar("currency").default('INR'),
  billingCycle: varchar("billing_cycle", { enum: ['monthly', 'quarterly', 'yearly'] }).default('monthly'),
  billingType: varchar("billing_type", { enum: ['recurring', 'onetime'] }).default('recurring'),
  isActive: boolean("is_active").notNull().default(true),
  /** When add-on is assigned to a user, grant these sidebar areas (OR across assignments). */
  featureWebhookEvents: boolean("feature_webhook_events").notNull().default(false),
  featureChatbot: boolean("feature_chatbot").notNull().default(false),
  featureFlows: boolean("feature_flows").notNull().default(false),
  featureDripCampaigns: boolean("feature_drip_campaigns").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Addon = typeof addons.$inferSelect;
export type InsertAddon = typeof addons.$inferInsert;

// User add-ons (assignments)
export const userAddons = pgTable("user_addons", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  addonId: varchar("addon_id").notNull().references(() => addons.id, { onDelete: 'cascade' }),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
}, (table) => [
  index("idx_user_addons_user").on(table.userId),
  index("idx_user_addons_addon").on(table.addonId),
]);

export type UserAddon = typeof userAddons.$inferSelect;
export type InsertUserAddon = typeof userAddons.$inferInsert;

// Coupons Table (admin-defined discount coupons)
export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: varchar("code").notNull().unique(),
  name: varchar("name").notNull(),
  description: text("description"),
  discountType: varchar("discount_type", { enum: ['percent', 'fixed'] }).notNull().default('percent'),
  discountValue: integer("discount_value").notNull(), // percent (0-100) or cents
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  expiryDate: timestamp("expiry_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("idx_coupons_code").on(table.code)]);

export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = typeof coupons.$inferInsert;

// Usage Tracking Table
export const usageTracking = pgTable("usage_tracking", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  month: varchar("month").notNull(), // Format: YYYY-MM
  messagesSent: integer("messages_sent").notNull().default(0),
  apiCalls: integer("api_calls").notNull().default(0),
  activeSessions: integer("active_sessions").notNull().default(0),
  webhooksTriggered: integer("webhooks_triggered").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_usage_user_month").on(table.userId, table.month),
]);

export type UsageTracking = typeof usageTracking.$inferSelect;
export type InsertUsageTracking = typeof usageTracking.$inferInsert;

// User Settings Table for API credentials
export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  razorpayCredentials: jsonb("razorpay_credentials").$type<{
    keyId?: string;
    keySecret?: string;
  }>(),
  stripeCredentials: jsonb("stripe_credentials").$type<{
    publishableKey?: string;
    secretKey?: string;
  }>(),
  whatsappBusinessCredentials: jsonb("whatsapp_business_credentials").$type<{
    phoneNumberId?: string;
    accessToken?: string;
    businessAccountId?: string;
  }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;

// SMTP Settings Table (per-user)
export const smtpSettings = pgTable("smtp_settings", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  smtpHost: varchar("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull().default(587),
  smtpSecure: boolean("smtp_secure").notNull().default(false),
  smtpUser: varchar("smtp_user").notNull(),
  smtpPass: text("smtp_pass").notNull(),
  fromEmail: varchar("from_email").notNull(),
  fromName: varchar("from_name").notNull().default("WhatsApp SaaS Platform"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_smtp_settings_user").on(table.userId),
]);

export const insertSmtpSettingsSchema = createInsertSchema(smtpSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SmtpSettings = typeof smtpSettings.$inferSelect;
export type InsertSmtpSettings = z.infer<typeof insertSmtpSettingsSchema>;

/** Dedupes panel-wide transactional emails (welcome, subscription reminders). */
export const panelTransactionalEmailLog = pgTable(
  "panel_transactional_email_log",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    dedupeKey: varchar("dedupe_key", { length: 512 }).notNull(),
    notificationKind: varchar("notification_kind", { length: 64 }).notNull(),
    sentAt: timestamp("sent_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("panel_transactional_email_log_dedupe_key_unique").on(table.dedupeKey),
    index("idx_panel_transactional_email_log_user").on(table.userId),
  ],
);

export type PanelTransactionalEmailLog = typeof panelTransactionalEmailLog.$inferSelect;

/** International dialing prefixes for template PHONE_NUMBER buttons (reference data). */
export const countryDialCodes = pgTable(
  "country_dial_codes",
  {
    id: serial("id").primaryKey(),
    isoCode: varchar("iso_code", { length: 2 }).notNull(),
    countryName: text("country_name").notNull(),
    dialPrefix: varchar("dial_prefix", { length: 32 }).notNull(),
  },
  (table) => [
    uniqueIndex("country_dial_codes_entry_unique").on(table.isoCode, table.dialPrefix, table.countryName),
  ],
);

export type CountryDialCode = typeof countryDialCodes.$inferSelect;

// Organizations Table for multi-tenant support
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name").notNull(),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  logo: text("logo"),
  industry: varchar("industry"),
  website: text("website"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

// Organization Members Table
export const organizationMembers = pgTable("organization_members", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar("role", { enum: ['owner', 'admin', 'member'] }).notNull().default('member'),
  permissions: jsonb("permissions").$type<string[]>().default([]),
  invitedBy: varchar("invited_by").references(() => users.id),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertOrganizationMemberSchema = createInsertSchema(organizationMembers).omit({
  id: true,
  joinedAt: true,
});

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;

// Organization Themes Table for SaaS theme customization
export const organizationThemes = pgTable("organization_themes", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }).unique(),
  // Theme mode: 'light' only
  themeMode: varchar("theme_mode", { enum: ['light'] }).default('light'),
  // Accent color: 'grey', 'pink', 'red', 'orange', 'green', 'blue', 'yellow', 'purple'
  accentColor: varchar("accent_color", { enum: ['grey', 'pink', 'red', 'orange', 'green', 'blue', 'yellow', 'purple'] }).default('orange'),
  /** Full panel UI package id — maps to client/src/panel-templates/{id}/ */
  panelTemplateId: varchar("panel_template_id").default('default'),
  // Light theme colors (HSL format)
  lightPrimary: varchar("light_primary"), // e.g., "142 76% 38%"
  lightPrimaryForeground: varchar("light_primary_foreground"), // e.g., "0 0% 100%"
  lightSecondary: varchar("light_secondary"),
  lightSecondaryForeground: varchar("light_secondary_foreground"),
  lightAccent: varchar("light_accent"),
  lightAccentForeground: varchar("light_accent_foreground"),
  lightBackground: varchar("light_background"),
  lightForeground: varchar("light_foreground"),
  lightCard: varchar("light_card"),
  lightCardForeground: varchar("light_card_foreground"),
  lightBorder: varchar("light_border"),
  // Dark theme colors (HSL format) - typically darker variations
  darkPrimary: varchar("dark_primary"),
  darkPrimaryForeground: varchar("dark_primary_foreground"),
  darkSecondary: varchar("dark_secondary"),
  darkSecondaryForeground: varchar("dark_secondary_foreground"),
  darkAccent: varchar("dark_accent"),
  darkAccentForeground: varchar("dark_accent_foreground"),
  darkBackground: varchar("dark_background"), // Usually black or very dark
  darkForeground: varchar("dark_foreground"),
  darkCard: varchar("dark_card"),
  darkCardForeground: varchar("dark_card_foreground"),
  darkBorder: varchar("dark_border"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_org_themes_org").on(table.organizationId),
]);

export const insertOrganizationThemeSchema = createInsertSchema(organizationThemes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OrganizationTheme = typeof organizationThemes.$inferSelect;
export type InsertOrganizationTheme = z.infer<typeof insertOrganizationThemeSchema>;

// Website Builder / White-label pages (per-organization dynamic content)
export const websiteBuilderPages = pgTable("website_builder_pages", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  pageKey: varchar("page_key").notNull(), // e.g. company-profile, homepage, features, testimonials, pricing, theme, etc.
  content: jsonb("content").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_website_builder_org_key").on(table.organizationId, table.pageKey),
]);

export const insertWebsiteBuilderPageSchema = createInsertSchema(websiteBuilderPages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WebsiteBuilderPage = typeof websiteBuilderPages.$inferSelect;
export type InsertWebsiteBuilderPage = z.infer<typeof insertWebsiteBuilderPageSchema>;

// Enhanced Contacts Table (user-scoped)
export const managedContacts = pgTable("managed_contacts", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  email: varchar("email"),
  source: varchar("source").default('manual'), // 'manual', 'whatsapp', 'import', etc.
  customFields: jsonb("custom_fields").$type<Record<string, string>>(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_contacts_user").on(table.userId),
  index("idx_contacts_org").on(table.organizationId),
  index("idx_managed_contacts_org_source").on(table.organizationId, table.source),
  index("idx_managed_contacts_org_phone").on(table.organizationId, table.phoneNumber),
]);

export const insertManagedContactSchema = createInsertSchema(managedContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ManagedContact = typeof managedContacts.$inferSelect;
export type InsertManagedContact = z.infer<typeof insertManagedContactSchema>;

// Contact Tags Table
export const contactTags = pgTable("contact_tags", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  color: varchar("color").notNull().default('#3b82f6'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_tags_user").on(table.userId),
  index("idx_tags_org").on(table.organizationId),
]);

export const insertContactTagSchema = createInsertSchema(contactTags).omit({
  id: true,
  createdAt: true,
});

export type ContactTag = typeof contactTags.$inferSelect;
export type InsertContactTag = z.infer<typeof insertContactTagSchema>;

// Contact Notes Table (per-contact note entries)
export const contactNotes = pgTable("contact_notes", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  contactId: varchar("contact_id").notNull().references(() => managedContacts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_contact_notes_contact").on(table.contactId),
  index("idx_contact_notes_org").on(table.organizationId),
]);

export const insertContactNoteSchema = createInsertSchema(contactNotes).omit({ id: true, createdAt: true });
export type ContactNote = typeof contactNotes.$inferSelect;
export type InsertContactNote = z.infer<typeof insertContactNoteSchema>;

// Contact Reminders Table
export const contactReminders = pgTable("contact_reminders", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  contactId: varchar("contact_id").notNull().references(() => managedContacts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  reminderTo: varchar("reminder_to").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** Short label shown in list Title column; optional for legacy rows that only have message */
  title: varchar("title"),
  message: text("message").notNull(),
  /** Internal notes for the team; not sent on WhatsApp */
  notes: text("notes"),
  reminderAt: timestamp("reminder_at", { withTimezone: true }).notNull(),
  /** Display name when reminder was created (e.g. from chat) so dropdown shows correct name even if managed contact name differs */
  contactDisplayName: varchar("contact_display_name"),
  /** When set, WhatsApp template is auto-sent to the contact at reminderAt */
  templateName: varchar("template_name"),
  templateLanguage: varchar("template_language"),
  templateParams: jsonb("template_params").$type<string[]>(),
  sessionId: varchar("session_id"),
  headerImageUrl: text("header_image_url"),
  headerImageId: varchar("header_image_id"),
  headerVideoUrl: text("header_video_url"),
  headerVideoId: varchar("header_video_id"),
  headerDocumentUrl: text("header_document_url"),
  headerDocumentId: varchar("header_document_id"),
  /** none = no WhatsApp send; pending/sending/sent/failed = template or text message delivery */
  whatsappStatus: varchar("whatsapp_status", {
    enum: ["none", "pending", "sending", "sent", "failed"],
  })
    .notNull()
    .default("none"),
  whatsappSentAt: timestamp("whatsapp_sent_at", { withTimezone: true }),
  whatsappError: text("whatsapp_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_contact_reminders_contact").on(table.contactId),
  index("idx_contact_reminders_org").on(table.organizationId),
  index("idx_contact_reminders_at").on(table.reminderAt),
  index("idx_contact_reminders_wa_status").on(table.whatsappStatus, table.reminderAt),
]);

export const insertContactReminderSchema = createInsertSchema(contactReminders).omit({ id: true, createdAt: true });
export type ContactReminder = typeof contactReminders.$inferSelect;
export type InsertContactReminder = z.infer<typeof insertContactReminderSchema>;

// Contact Columns Table (for custom fields)
export const contactColumns = pgTable("contact_columns", {
  id: varchar("id").primaryKey().$defaultFn(() => sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  label: varchar("label").notNull(),
  type: varchar("type", { enum: ['text', 'email', 'number', 'textarea', 'phone', 'select', 'date'] }).notNull().default('text'),
  options: jsonb("options").$type<string[]>(), // For SELECT type
  visible: boolean("visible").notNull().default(true),
  required: boolean("required").notNull().default(false),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_columns_user").on(table.userId),
  index("idx_columns_org").on(table.organizationId),
]);

export const insertContactColumnSchema = createInsertSchema(contactColumns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ContactColumn = typeof contactColumns.$inferSelect;
export type InsertContactColumn = z.infer<typeof insertContactColumnSchema>;

// Contact-Tag Junction Table
export const contactTagAssignments = pgTable("contact_tag_assignments", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  contactId: varchar("contact_id").notNull().references(() => managedContacts.id, { onDelete: 'cascade' }),
  tagId: varchar("tag_id").notNull().references(() => contactTags.id, { onDelete: 'cascade' }),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

export type ContactTagAssignment = typeof contactTagAssignments.$inferSelect;
export type InsertContactTagAssignment = typeof contactTagAssignments.$inferInsert;

// Contact Activity Log (who did what: tag add/remove, note, reminder)
export const contactActivityLog = pgTable("contact_activity_log", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  contactId: varchar("contact_id").notNull().references(() => managedContacts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  action: varchar("action", { enum: ["tag_added", "tag_removed", "note_added", "reminder_added"] }).notNull(),
  metadata: jsonb("metadata").$type<{ tagId?: string; tagName?: string }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_contact_activity_contact").on(table.contactId),
  index("idx_contact_activity_org").on(table.organizationId),
  index("idx_contact_activity_created").on(table.createdAt),
]);

export type ContactActivityLog = typeof contactActivityLog.$inferSelect;
export type InsertContactActivityLog = typeof contactActivityLog.$inferInsert;

// Groups Table
export const groups = pgTable("groups", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  description: text("description"),
  whatsappGroupId: varchar("whatsapp_group_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;

// Group Members Table
export const groupMembers = pgTable("group_members", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  groupId: varchar("group_id").notNull().references(() => groups.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").references(() => managedContacts.id, { onDelete: 'cascade' }),
  phoneNumber: varchar("phone_number").notNull(),
  name: varchar("name"),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export const insertGroupMemberSchema = createInsertSchema(groupMembers).omit({
  id: true,
  addedAt: true,
});

export type GroupMember = typeof groupMembers.$inferSelect;
export type InsertGroupMember = z.infer<typeof insertGroupMemberSchema>;

// Campaigns Table
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  sessionId: varchar("session_id").notNull().references(() => whatsappSessions.sessionId, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  messageTemplate: text("message_template").notNull(), // Template name for template messages, or message text for regular messages
  // Template message fields
  templateId: varchar("template_id"), // WhatsApp template ID
  templateLanguage: varchar("template_language"), // Template language code (e.g., 'en', 'en_US')
  templateParameters: jsonb("template_parameters").$type<Array<{ column?: string; fallback?: string }>>(), // Parameter mapping configuration
  headerImageId: varchar("header_image_id"), // WhatsApp media ID for template header image
  headerImageUrl: text("header_image_url"), // URL for template header image (for preview/storage)
  headerVideoId: varchar("header_video_id"), // WhatsApp media ID for template header video
  headerVideoUrl: text("header_video_url"), // URL for template header video
  headerDocumentId: varchar("header_document_id"), // WhatsApp media ID for template header document
  headerDocumentUrl: text("header_document_url"), // URL for template header document
  /** Send-time media URLs for MEDIA_CARD_CAROUSEL (one per card); server uploads per send / campaign batch */
  carouselCardMediaUrls: jsonb("carousel_card_media_urls").$type<string[] | null>(),
  status: varchar("status", { enum: ['draft', 'scheduled', 'running', 'completed', 'failed'] }).notNull().default('draft'),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalRecipients: integer("total_recipients").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  readCount: integer("read_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  /** Set when the one-time automatic "retry failed recipients" pass has been claimed (prevents duplicate auto runs). */
  failedAutoRetryAt: timestamp("failed_auto_retry_at"),
  /** User-configured AiSensy-style retries for failed sends (up to 3 delayed passes). */
  retryEnabled: boolean("retry_enabled").notNull().default(false),
  /** Delays for each retry pass: retry[0] after campaign completion, retry[n] after previous retry. */
  retrySteps: jsonb("retry_steps").$type<Array<{ hours: number; minutes: number }> | null>(),
  /** Number of configured retry passes that have been started. */
  retryAttemptCount: integer("retry_attempt_count").notNull().default(0),
  /** When the next configured retry pass should run (durable schedule). */
  retryNextAt: timestamp("retry_next_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_campaigns_user").on(table.userId),
  index("idx_campaigns_status").on(table.status),
]);

export const campaignRetryStepSchema = z.object({
  hours: z.number().int().min(0).max(24 * 30),
  minutes: z.number().int().min(0).max(59),
}).refine((s) => s.hours > 0 || s.minutes > 0, {
  message: "Retry delay must be at least 1 minute",
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
  failedAutoRetryAt: true,
  retryAttemptCount: true,
  retryNextAt: true,
}).extend({
  scheduledAt: z.union([
    z.date(),
    z.string().datetime().transform((str) => new Date(str)),
    z.string().transform((str) => {
      const date = new Date(str);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date string');
      }
      return date;
    }),
    z.null(),
    z.undefined(),
  ]).optional(),
  retryEnabled: z.boolean().optional(),
  retrySteps: z.array(campaignRetryStepSchema).max(3).nullable().optional(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

// Campaign Recipients Table
export const campaignRecipients = pgTable("campaign_recipients", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").references(() => managedContacts.id, { onDelete: 'set null' }),
  phoneNumber: varchar("phone_number").notNull(),
  name: varchar("name"),
  status: varchar("status", { enum: ['pending', 'sent', 'delivered', 'read', 'failed'] }).notNull().default('pending'),
  messageId: varchar("message_id"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_campaign_recipients_campaign").on(table.campaignId),
  index("idx_campaign_recipients_status").on(table.status),
]);

export const insertCampaignRecipientSchema = createInsertSchema(campaignRecipients).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  deliveredAt: true,
  readAt: true,
});

export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type InsertCampaignRecipient = z.infer<typeof insertCampaignRecipientSchema>;

// Campaign recipient button clicks (template button click tracking)
export const campaignRecipientButtonClicks = pgTable("campaign_recipient_button_clicks", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  campaignRecipientId: varchar("campaign_recipient_id").notNull().references(() => campaignRecipients.id, { onDelete: "cascade" }),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  buttonId: varchar("button_id").notNull(),
  buttonTitle: varchar("button_title").notNull(),
  clickedAt: timestamp("clicked_at").notNull().defaultNow(),
}, (table) => [
  index("idx_campaign_button_clicks_campaign").on(table.campaignId),
  index("idx_campaign_button_clicks_recipient").on(table.campaignRecipientId),
]);

export type CampaignRecipientButtonClick = typeof campaignRecipientButtonClicks.$inferSelect;
export type InsertCampaignRecipientButtonClick = typeof campaignRecipientButtonClicks.$inferInsert;

/** Short-link redirect used for WhatsApp template URL click tracking */
export const trackedUrls = pgTable("tracked_urls", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: varchar("code").notNull().unique(),
  destinationUrl: text("destination_url").notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_tracked_urls_org").on(table.organizationId),
  index("idx_tracked_urls_campaign").on(table.campaignId),
]);

export const trackedUrlClicks = pgTable("tracked_url_clicks", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  trackedUrlId: varchar("tracked_url_id").notNull().references(() => trackedUrls.id, { onDelete: "cascade" }),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  ip: varchar("ip"),
  userAgent: text("user_agent"),
  clickedAt: timestamp("clicked_at").notNull().defaultNow(),
}, (table) => [
  index("idx_tracked_url_clicks_url").on(table.trackedUrlId),
  index("idx_tracked_url_clicks_campaign").on(table.campaignId),
]);

export type TrackedUrl = typeof trackedUrls.$inferSelect;
export type InsertTrackedUrl = typeof trackedUrls.$inferInsert;
export type TrackedUrlClick = typeof trackedUrlClicks.$inferSelect;

// Message Activity Log Table (for dashboard analytics)
export const messageActivityLog = pgTable("message_activity_log", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: varchar("date").notNull(), // Format: YYYY-MM-DD
  messageCount: integer("message_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_message_activity_org_date").on(table.organizationId, table.date),
  index("idx_message_activity_user_date").on(table.userId, table.date),
]);

export const insertMessageActivityLogSchema = createInsertSchema(messageActivityLog).omit({
  id: true,
  createdAt: true,
});

export type MessageActivityLog = typeof messageActivityLog.$inferSelect;
export type InsertMessageActivityLog = z.infer<typeof insertMessageActivityLogSchema>;

// Message Templates Table (for Meta WhatsApp Business API templates)
export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  templateId: varchar("template_id").notNull(), // Meta template ID
  name: varchar("name").notNull(),
  language: varchar("language").notNull().default('en'),
  status: varchar("status", { enum: ['APPROVED', 'PENDING', 'REJECTED', 'PENDING_DELETION'] }).notNull(),
  category: varchar("category", { enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'] }).notNull(),
  phoneNumberId: varchar("phone_number_id"), // WhatsApp Business phone number ID this template belongs to
  components: jsonb("components").$type<Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    text?: string;
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    buttons?: Array<{
      type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
      text?: string;
      url?: string;
      phone_number?: string;
    }>;
    example?: {
      header_text?: string[];
      body_text?: string[][];
    };
  }>>().notNull(),
  metaData: jsonb("meta_data").$type<{
    qualityScore?: string;
    lastApprovedDate?: string;
    lastRejectedDate?: string;
    rejectionReason?: string;
  }>(),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_templates_user").on(table.userId),
  index("idx_templates_org").on(table.organizationId),
  index("idx_templates_template_id").on(table.templateId),
  index("idx_templates_phone_number_id").on(table.phoneNumberId),
]);

export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  syncedAt: true,
});

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;

// WhatsApp Flows Table (for WhatsApp Business API flows/forms)
export const whatsappFlows = pgTable("whatsapp_flows", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  flowId: varchar("flow_id"), // Meta flow ID (if published)
  name: varchar("name").notNull(),
  businessAccountId: varchar("business_account_id").notNull(),
  category: varchar("category").default('other'),
  status: varchar("status", { enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] }).notNull().default('DRAFT'),
  validation: varchar("validation", { enum: ['Valid', 'Invalid'] }).notNull().default('Valid'),
  screens: jsonb("screens").$type<Array<{
    id: string;
    title: string;
    terminal?: boolean;
    success?: boolean;
    layout?: {
      type: string;
      children: Array<{
        type: string;
        name?: string;
        children?: Array<{
          type: string;
          text?: string;
          label?: string;
          name?: string;
          required?: boolean;
          "input-type"?: string;
          "data-source"?: Array<{
            id: string;
            title: string;
          }>;
          "on-click-action"?: {
            name: string;
            payload?: Record<string, string>;
          };
          [key: string]: any;
        }>;
        [key: string]: any;
      }>;
    };
    // Legacy format support (flat fields structure)
    fields?: Array<{
      id: string;
      type: string;
      label?: string;
      placeholder?: string;
      instructions?: string;
      required?: boolean;
      options?: string[];
      inputType?: string;
      textType?: string;
      name?: string;
      [key: string]: any;
    }>;
    footerButton?: {
      text: string;
      action?: string;
    };
  }>>().notNull(),
  metadata: jsonb("meta_data").$type<{
    metaFlowId?: string;
    createdVia?: string;
    submittedAt?: string;
    phoneNumberId?: string;
    publishedAt?: string;
  }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_flows_user").on(table.userId),
  index("idx_flows_org").on(table.organizationId),
  index("idx_flows_business_account").on(table.businessAccountId),
  index("idx_flows_flow_id").on(table.flowId),
]);

export const insertWhatsAppFlowSchema = createInsertSchema(whatsappFlows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WhatsAppFlow = typeof whatsappFlows.$inferSelect;
export type InsertWhatsAppFlow = z.infer<typeof insertWhatsAppFlowSchema>;

// WhatsApp Flow form submissions (nfm_reply responses)
export const whatsappFlowResponses = pgTable("whatsapp_flow_responses", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  flowId: varchar("flow_id").references(() => whatsappFlows.id, { onDelete: 'set null' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: varchar("session_id"),
  phone: varchar("phone").notNull(),
  flowName: varchar("flow_name"),
  responseData: jsonb("response_data").$type<Record<string, unknown>>().notNull().default({}),
  whatsappMessageId: varchar("whatsapp_message_id"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
}, (table) => [
  index("idx_flow_responses_flow").on(table.flowId),
  index("idx_flow_responses_org").on(table.organizationId),
  index("idx_flow_responses_phone").on(table.phone),
  index("idx_flow_responses_submitted").on(table.submittedAt),
]);

export const insertWhatsAppFlowResponseSchema = createInsertSchema(whatsappFlowResponses).omit({
  id: true,
  submittedAt: true,
});

export type WhatsAppFlowResponse = typeof whatsappFlowResponses.$inferSelect;
export type InsertWhatsAppFlowResponse = z.infer<typeof insertWhatsAppFlowResponseSchema>;

// Message Sync Requests Table (for premium old message syncing feature)
export const messageSyncRequests = pgTable("message_sync_requests", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  sessionId: varchar("session_id").notNull().references(() => whatsappSessions.sessionId, { onDelete: 'cascade' }),
  status: varchar("status", { enum: ['pending', 'approved', 'rejected', 'processing', 'completed', 'failed'] }).notNull().default('pending'),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
  completedAt: timestamp("completed_at"),
  estimatedMessageCount: integer("estimated_message_count"),
  actualMessageCount: integer("actual_message_count"),
  estimatedStorageSize: integer("estimated_storage_size"), // in bytes
  actualStorageSize: integer("actual_storage_size"), // in bytes
  price: integer("price"), // in cents
  paymentId: varchar("payment_id").references(() => payments.id),
  notes: text("notes"),
  errorMessage: text("error_message"),
}, (table) => [
  index("idx_sync_requests_user").on(table.userId),
  index("idx_sync_requests_session").on(table.sessionId),
  index("idx_sync_requests_status").on(table.status),
]);

export const insertMessageSyncRequestSchema = createInsertSchema(messageSyncRequests).omit({
  id: true,
  requestedAt: true,
  approvedAt: true,
  completedAt: true,
});

export type MessageSyncRequest = typeof messageSyncRequests.$inferSelect;
export type InsertMessageSyncRequest = z.infer<typeof insertMessageSyncRequestSchema>;

// Opt-In/Opt-Out Keywords Table
export const optKeywords = pgTable("opt_keywords", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  type: varchar("type", { enum: ['opt_in', 'opt_out'] }).notNull(),
  keyword: varchar("keyword").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_opt_keywords_user").on(table.userId),
  index("idx_opt_keywords_org").on(table.organizationId),
  index("idx_opt_keywords_type").on(table.type),
]);

export const insertOptKeywordSchema = createInsertSchema(optKeywords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OptKeyword = typeof optKeywords.$inferSelect;
export type InsertOptKeyword = typeof optKeywords.$inferInsert;

// FAQ Bot: items (Q&A) and settings per organization
export const FAQ_ANSWER_TYPES = ["text", "image", "video", "document", "audio"] as const;
export type FaqAnswerType = (typeof FAQ_ANSWER_TYPES)[number];

export const faqItems = pgTable("faq_items", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  question: text("question").notNull(),
  answer: text("answer").notNull().default(""),
  answerType: varchar("answer_type", { length: 20 }).notNull().default("text"),
  mediaUrl: text("media_url"),
  mediaFileName: varchar("media_file_name", { length: 255 }),
  keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_faq_items_org").on(table.organizationId),
]);

export const insertFaqItemSchema = createInsertSchema(faqItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FaqItem = typeof faqItems.$inferSelect;
export type InsertFaqItem = z.infer<typeof insertFaqItemSchema>;

export const faqBotSettings = pgTable("faq_bot_settings", {
  organizationId: varchar("organization_id").primaryKey().references(() => organizations.id, { onDelete: 'cascade' }),
  enabled: boolean("enabled").notNull().default(false),
  welcomeMessage: text("welcome_message").notNull().default("Hello! How can I help you today?"),
  fallbackMessage: text("fallback_message").notNull().default("I'm sorry, I don't have an answer for that. Please contact support."),
  autoReply: boolean("auto_reply").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFaqBotSettingsSchema = createInsertSchema(faqBotSettings).omit({
  updatedAt: true,
});

export type FaqBotSettings = typeof faqBotSettings.$inferSelect;
export type InsertFaqBotSettings = z.infer<typeof insertFaqBotSettingsSchema>;

/** Per-org live chat auto-replies: welcome / off-hours messages + day-wise working hours. */
export const organizationLiveChatSettings = pgTable("organization_live_chat_settings", {
  organizationId: varchar("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  welcomeEnabled: boolean("welcome_enabled").notNull().default(false),
  welcomeMessage: text("welcome_message").notNull().default(""),
  offHoursEnabled: boolean("off_hours_enabled").notNull().default(false),
  offHoursMessage: text("off_hours_message").notNull().default(""),
  workingHours: jsonb("working_hours").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrganizationLiveChatSettingsSchema = createInsertSchema(
  organizationLiveChatSettings
).omit({
  updatedAt: true,
});

export type OrganizationLiveChatSettings = typeof organizationLiveChatSettings.$inferSelect;
export type InsertOrganizationLiveChatSettings = z.infer<
  typeof insertOrganizationLiveChatSettingsSchema
>;

/** Tracks last live-chat auto-reply per contact so we only greet on first query (24h window). */
export const liveChatAutoReplyState = pgTable(
  "live_chat_auto_reply_state",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id").notNull(),
    contactNumber: varchar("contact_number", { length: 32 }).notNull(),
    lastKind: varchar("last_kind", { length: 16 }).notNull(),
    lastSentAt: timestamp("last_sent_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("live_chat_auto_reply_state_org_session_contact").on(
      table.organizationId,
      table.sessionId,
      table.contactNumber
    ),
    index("idx_live_chat_auto_reply_org").on(table.organizationId),
  ]
);

export type LiveChatAutoReplyState = typeof liveChatAutoReplyState.$inferSelect;

/** WhatsApp Commerce: Meta catalog ID + Shopify/Woo sync state per organization. */
export const organizationCommerceSettings = pgTable("organization_commerce_settings", {
  organizationId: varchar("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  metaCatalogId: varchar("meta_catalog_id"),
  metaCatalogName: varchar("meta_catalog_name"),
  shopifySyncEnabled: boolean("shopify_sync_enabled").notNull().default(false),
  woocommerceSyncEnabled: boolean("woocommerce_sync_enabled").notNull().default(false),
  shopifyLastSyncAt: timestamp("shopify_last_sync_at"),
  woocommerceLastSyncAt: timestamp("woocommerce_last_sync_at"),
  shopifyLastSyncStatus: varchar("shopify_last_sync_status", { length: 32 }),
  woocommerceLastSyncStatus: varchar("woocommerce_last_sync_status", { length: 32 }),
  shopifyLastSyncError: text("shopify_last_sync_error"),
  woocommerceLastSyncError: text("woocommerce_last_sync_error"),
  shopifyCheckoutEnabled: boolean("shopify_checkout_enabled").notNull().default(false),
  woocommerceCheckoutEnabled: boolean("woocommerce_checkout_enabled").notNull().default(false),
  lastCartCheckoutAt: timestamp("last_cart_checkout_at"),
  lastCartCheckoutStatus: varchar("last_cart_checkout_status", { length: 32 }),
  lastCartCheckoutError: text("last_cart_checkout_error"),
  whatsappNativePayEnabled: boolean("whatsapp_native_pay_enabled").notNull().default(false),
  metaPaymentConfigurationName: varchar("meta_payment_configuration_name", { length: 128 }),
  metaPaymentGateway: varchar("meta_payment_gateway", { length: 32 }).default("razorpay"),
  waPayCatalogCheckoutEnabled: boolean("wa_pay_catalog_checkout_enabled").notNull().default(false),
  waPayOrderType: varchar("wa_pay_order_type", { length: 32 }).notNull().default("physical-goods"),
  lastWaPayCheckoutAt: timestamp("last_wa_pay_checkout_at"),
  lastWaPayCheckoutStatus: varchar("last_wa_pay_checkout_status", { length: 32 }),
  lastWaPayCheckoutError: text("last_wa_pay_checkout_error"),
  shopifyCollectionProductSets: jsonb("shopify_collection_product_sets")
    .$type<Record<string, { productSetId: string; title: string; syncedAt: string }>>()
    .default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrganizationCommerceSettingsSchema = createInsertSchema(
  organizationCommerceSettings
).omit({
  updatedAt: true,
});

export type OrganizationCommerceSettings = typeof organizationCommerceSettings.$inferSelect;
export type InsertOrganizationCommerceSettings = z.infer<
  typeof insertOrganizationCommerceSettingsSchema
>;

/** GST / Non-GST invoice template settings per organization. */
export const organizationInvoiceSettings = pgTable("organization_invoice_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  invoiceBusinessName: varchar("invoice_business_name"),
  invoiceCompanyAddress: text("invoice_company_address"),
  invoiceCompanyPhone: varchar("invoice_company_phone"),
  invoiceCompanyGstNo: varchar("invoice_company_gst_no"),
  gstSignatureUrl: text("gst_signature_url"),
  gstSignatureSizePx: integer("gst_signature_size_px").default(48),
  gstInvoicePrefix: varchar("gst_invoice_prefix"),
  gstInvoiceStart: integer("gst_invoice_start").default(1),
  gstPercentage: integer("gst_percentage").default(18),
  gstBankName: varchar("gst_bank_name"),
  gstAccountNo: varchar("gst_account_no"),
  gstIfscCode: varchar("gst_ifsc_code"),
  gstPaymentUpiId: varchar("gst_payment_upi_id"),
  gstEmailId: varchar("gst_email_id"),
  gstTermsAndConditions: text("gst_terms_and_conditions"),
  nonGstSignatureUrl: text("non_gst_signature_url"),
  nonGstSignatureSizePx: integer("non_gst_signature_size_px").default(48),
  nonGstInvoicePrefix: varchar("non_gst_invoice_prefix"),
  nonGstInvoiceStart: integer("non_gst_invoice_start").default(1),
  nonGstBankName: varchar("non_gst_bank_name"),
  nonGstAccountNo: varchar("non_gst_account_no"),
  nonGstIfscCode: varchar("non_gst_ifsc_code"),
  nonGstPaymentUpiId: varchar("non_gst_payment_upi_id"),
  nonGstEmailId: varchar("non_gst_email_id"),
  nonGstTermsAndConditions: text("non_gst_terms_and_conditions"),
  invoiceCurrency: varchar("invoice_currency").default("INR"),
  hsnCode: varchar("hsn_code"),
  emailAutomation: boolean("email_automation").notNull().default(false),
  whatsappAutomation: boolean("whatsapp_automation").notNull().default(false),
  selectedTemplateId: integer("selected_template_id").default(1),
  /** Custom invoice header banner; null/empty = default partner banner; "none" = hidden. */
  invoiceBannerUrl: text("invoice_banner_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrganizationInvoiceSettingsSchema = createInsertSchema(
  organizationInvoiceSettings
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateOrganizationInvoiceSettingsSchema = insertOrganizationInvoiceSettingsSchema
  .omit({ organizationId: true })
  .partial();

export type OrganizationInvoiceSettings = typeof organizationInvoiceSettings.$inferSelect;
export type InsertOrganizationInvoiceSettings = z.infer<
  typeof insertOrganizationInvoiceSettingsSchema
>;
export type UpdateOrganizationInvoiceSettings = z.infer<
  typeof updateOrganizationInvoiceSettingsSchema
>;

/** Sent contact invoices (one row per generated invoice). */
export const organizationInvoices = pgTable(
  "organization_invoices",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: varchar("contact_id").references(() => managedContacts.id, { onDelete: "set null" }),
    invoiceNo: varchar("invoice_no").notNull(),
    companyName: varchar("company_name"),
    customerName: varchar("customer_name"),
    customerPhone: varchar("customer_phone"),
    customerEmail: varchar("customer_email"),
    invoiceDate: timestamp("invoice_date").notNull().defaultNow(),
    gstType: varchar("gst_type"),
    invoiceStatus: varchar("invoice_status").default("due"),
    currency: varchar("currency").default("INR"),
    totalAmount: real("total_amount"),
    amountPaid: real("amount_paid"),
    amountPending: real("amount_pending"),
    pdfUrl: text("pdf_url"),
    lineItems: jsonb("line_items"),
    invoiceTo: jsonb("invoice_to"),
    emailAutomation: boolean("email_automation").notNull().default(false),
    whatsappAutomation: boolean("whatsapp_automation").notNull().default(false),
    isLocked: boolean("is_locked").notNull().default(false),
    createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdByName: varchar("created_by_name"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_org_invoices_org").on(table.organizationId),
    index("idx_org_invoices_date").on(table.organizationId, table.invoiceDate),
    uniqueIndex("idx_org_invoices_org_no").on(table.organizationId, table.invoiceNo),
  ],
);

export const insertOrganizationInvoiceSchema = createInsertSchema(organizationInvoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OrganizationInvoice = typeof organizationInvoices.$inferSelect;
export type InsertOrganizationInvoice = z.infer<typeof insertOrganizationInvoiceSchema>;

/** CRM leads — first-time inbound messages and manual entries per organization. */
export const organizationLeads = pgTable(
  "organization_leads",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    phoneNumber: varchar("phone_number").notNull(),
    name: varchar("name"),
    email: varchar("email"),
    source: varchar("source").notNull().default("whatsapp"),
    companyName: varchar("company_name"),
    leadDate: timestamp("lead_date"),
    label: varchar("label"),
    estimateAmount: real("estimate_amount"),
    reference: varchar("reference"),
    address: text("address"),
    comment: text("comment"),
    category: varchar("category"),
    score: integer("score").notNull().default(50),
    priority: varchar("priority").notNull().default("medium"),
    status: varchar("status").notNull().default("new"),
    sortOrder: integer("sort_order").notNull().default(0),
    assignedToUserId: varchar("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    contactId: varchar("contact_id").references(() => managedContacts.id, { onDelete: "set null" }),
    sessionId: varchar("session_id"),
    firstMessagePreview: text("first_message_preview"),
    convertedAt: timestamp("converted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_org_leads_org_phone").on(table.organizationId, table.phoneNumber),
    index("idx_org_leads_org_created").on(table.organizationId, table.createdAt),
    index("idx_org_leads_status").on(table.organizationId, table.status),
    index("idx_org_leads_status_sort").on(table.organizationId, table.status, table.sortOrder),
  ],
);

export const insertOrganizationLeadSchema = createInsertSchema(organizationLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  leadDate: z
    .union([
      z.date(),
      z.string().datetime().transform((str) => new Date(str)),
      z.string().transform((str) => {
        const date = new Date(str);
        if (isNaN(date.getTime())) {
          throw new Error("Invalid date string");
        }
        return date;
      }),
      z.null(),
      z.undefined(),
    ])
    .optional(),
  convertedAt: z
    .union([
      z.date(),
      z.string().datetime().transform((str) => new Date(str)),
      z.string().transform((str) => {
        const date = new Date(str);
        if (isNaN(date.getTime())) {
          throw new Error("Invalid date string");
        }
        return date;
      }),
      z.null(),
      z.undefined(),
    ])
    .optional(),
  email: z.union([z.string().email(), z.literal(""), z.null(), z.undefined()]).optional(),
  score: z.number().int().optional(),
  priority: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateOrganizationLeadSchema = insertOrganizationLeadSchema
  .partial()
  .omit({ organizationId: true });

export type OrganizationLead = typeof organizationLeads.$inferSelect;
export type InsertOrganizationLead = z.infer<typeof insertOrganizationLeadSchema>;
export type UpdateOrganizationLead = z.infer<typeof updateOrganizationLeadSchema>;

/** Configurable lead pipeline statuses (Kanban columns). */
export const organizationLeadStatuses = pgTable(
  "organization_lead_statuses",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name").notNull(),
    slug: varchar("slug").notNull(),
    color: varchar("color").notNull().default("#dbeafe"),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_org_lead_statuses_org_slug").on(table.organizationId, table.slug),
    index("idx_org_lead_statuses_sort").on(table.organizationId, table.sortOrder),
  ],
);

export const insertOrganizationLeadStatusSchema = createInsertSchema(organizationLeadStatuses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateOrganizationLeadStatusSchema = insertOrganizationLeadStatusSchema
  .partial()
  .omit({ organizationId: true, slug: true });

export type OrganizationLeadStatus = typeof organizationLeadStatuses.$inferSelect;
export type InsertOrganizationLeadStatus = z.infer<typeof insertOrganizationLeadStatusSchema>;
export type UpdateOrganizationLeadStatus = z.infer<typeof updateOrganizationLeadStatusSchema>;

/** WhatsApp native pay orders (order_details → payment webhook → order_status). */
export const waPayOrders = pgTable(
  "wa_pay_orders",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id").notNull(),
    customerWaId: varchar("customer_wa_id", { length: 64 }).notNull(),
    referenceId: varchar("reference_id", { length: 35 }).notNull(),
    paymentConfigurationName: varchar("payment_configuration_name", { length: 128 }).notNull(),
    paymentGateway: varchar("payment_gateway", { length: 32 }).notNull().default("razorpay"),
    orderType: varchar("order_type", { length: 32 }).notNull().default("physical-goods"),
    catalogId: varchar("catalog_id", { length: 64 }),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("INR"),
    paymentStatus: varchar("payment_status", { length: 32 }).notNull().default("pending"),
    orderStatus: varchar("order_status", { length: 32 }).notNull().default("pending"),
    orderDetailsMessageId: varchar("order_details_message_id", { length: 255 }),
    pgOrderId: varchar("pg_order_id", { length: 255 }),
    pgTransactionId: varchar("pg_transaction_id", { length: 255 }),
    paymentMethod: varchar("payment_method", { length: 32 }),
    lineItems: jsonb("line_items").$type<unknown[]>().notNull().default([]),
    lastPaymentPayload: jsonb("last_payment_payload"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_wa_pay_orders_reference").on(table.organizationId, table.referenceId),
    index("idx_wa_pay_orders_org_created").on(table.organizationId, table.createdAt),
  ]
);

export const insertWaPayOrderSchema = createInsertSchema(waPayOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WaPayOrder = typeof waPayOrders.$inferSelect;
export type InsertWaPayOrder = z.infer<typeof insertWaPayOrderSchema>;

// Canned Messages (org-scoped; sync across devices when same org/user logs in)
export const cannedMessages = pgTable("canned_messages", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }),
  name: varchar("name").notNull(),
  type: varchar("type", { enum: ['TEXT', 'IMAGE'] }).notNull().default('TEXT'),
  text: text("text").notNull().default(''),
  imageUrl: varchar("image_url"),
  fileName: varchar("file_name"),
  favourite: boolean("favourite").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_canned_messages_org").on(table.organizationId),
]);

export const insertCannedMessageSchema = createInsertSchema(cannedMessages).omit({
  id: true,
  createdAt: true,
});

export type CannedMessageRow = typeof cannedMessages.$inferSelect;
export type InsertCannedMessage = z.infer<typeof insertCannedMessageSchema>;

/** Meta conversation category for wallet debits (Tech Partner passthrough). */
export type WalletMetaCategory = "marketing" | "utility" | "authentication" | "service";

export type WalletBillingConfig = {
  enabled?: boolean;
  /** When true, official API sends use wallet instead of requiring SaaS subscription for messages. */
  skipSaasSubscriptionForOfficialMessages?: boolean;
  currency?: string;
  metaRatesMinor?: Partial<Record<WalletMetaCategory, number>>;
  markupEnabled?: boolean;
  markupMode?: "fixed_minor" | "percent";
  markupByCategory?: Partial<Record<WalletMetaCategory, number>>;
  lowBalanceThresholdMinor?: number;
  allowNegativeBalance?: boolean;
  lowBalanceEmailEnabled?: boolean;
  /** Prefer wallet_meta_rate_versions over flat metaRatesMinor when true. */
  useCountryRateVersions?: boolean;
  defaultCountryIso?: string;
};

/** Per-org: self_pay = customer/Meta direct; credit_line = supplier middleware for template sends + wallet Meta debits. */
export type WhatsappOrgBillingMode = "self_pay" | "credit_line";
export type CreditLineProviderId = "interakt" | (string & {});

export type CreditLineProviderConfig = {
  enabled?: boolean;
  /** Display name in admin UI */
  displayName?: string;
  /** Middleware / Cloud API base, e.g. https://amped-express.interakt.ai */
  apiBaseUrl?: string;
  /** Partner access token for middleware (x-access-token) and tp-signup Authorization */
  accessToken?: string;
  /** Meta Partner Solution ID for Embedded Signup extras.setup.solution_id */
  solutionId?: string;
  /** Graph/Cloud API version path segment, e.g. v17.0 */
  apiVersion?: string;
  /** Prefer POST .../marketing_messages for marketing templates */
  mmLiteEnabled?: boolean;
  /** Optional Interakt ISV app id (documentation reference) */
  isvAppId?: string;
  notes?: string;
};

export type CreditLineProvidersConfig = Record<string, CreditLineProviderConfig>;

/** Single-row store: upstream contract/settings from CUSTOMER_API_BASE_URL + local revenue-share notes (whitelabel). */
export const platformMasterSettings = pgTable("platform_master_settings", {
  id: varchar("id").primaryKey().default("singleton"),
  upstreamPayload: jsonb("upstream_payload").$type<Record<string, unknown>>().notNull().default({}),
  revenueShareLocal: jsonb("revenue_share_local").$type<Record<string, unknown>>(),
  walletBillingConfig: jsonb("wallet_billing_config").$type<WalletBillingConfig>().notNull().default({}),
  creditLineProvidersConfig: jsonb("credit_line_providers_config")
    .$type<CreditLineProvidersConfig>()
    .notNull()
    .default({}),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: varchar("last_sync_status", { length: 32 }),
  lastSyncError: text("last_sync_error"),
  /** Active WhatsApp panel UI template for all organizations on this domain. */
  activePanelTemplateId: varchar("active_panel_template_id").notNull().default("default"),
  /**
   * Months after plan expiry before org/business data is auto-purged (1–3).
   * Does not delete the user account.
   */
  subscriptionDataRetentionMonths: integer("subscription_data_retention_months").notNull().default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlatformMasterSettingsRow = typeof platformMasterSettings.$inferSelect;

export const organizationWhatsappBilling = pgTable("organization_whatsapp_billing", {
  organizationId: varchar("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  billingMode: varchar("billing_mode", { enum: ["self_pay", "credit_line"] })
    .notNull()
    .default("self_pay"),
  creditLineProvider: varchar("credit_line_provider", { length: 64 }),
  creditLineStatus: varchar("credit_line_status", {
    enum: ["inactive", "pending", "active", "error"],
  })
    .notNull()
    .default("inactive"),
  creditLineWabaId: varchar("credit_line_waba_id", { length: 64 }),
  creditLinePhoneNumberId: varchar("credit_line_phone_number_id", { length: 64 }),
  creditLineMetadata: jsonb("credit_line_metadata").$type<Record<string, unknown>>(),
  lastError: text("last_error"),
  updatedByUserId: varchar("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrganizationWhatsappBillingRow = typeof organizationWhatsappBilling.$inferSelect;

export const organizationWallets = pgTable("organization_wallets", {
  organizationId: varchar("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  balanceMinor: integer("balance_minor").notNull().default(0),
  currency: varchar("currency", { length: 10 }).notNull().default("INR"),
  status: varchar("status", { enum: ["active", "suspended"] }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrganizationWalletRow = typeof organizationWallets.$inferSelect;

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: varchar("type", {
      enum: ["reload", "debit_message", "debit_campaign", "debit_subscription", "refund", "adjustment"],
    }).notNull(),
    amountMinor: integer("amount_minor").notNull(),
    balanceAfterMinor: integer("balance_after_minor").notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("INR"),
    metaCategory: varchar("meta_category", { length: 32 }),
    metaCostMinor: integer("meta_cost_minor"),
    markupMinor: integer("markup_minor").notNull().default(0),
    chargedMinor: integer("charged_minor").notNull().default(0),
    description: text("description"),
    referenceType: varchar("reference_type", { length: 64 }),
    referenceId: varchar("reference_id", { length: 255 }),
    gatewayOrderId: varchar("gateway_order_id"),
    gatewayPaymentId: varchar("gateway_payment_id"),
    createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    recipientCountryIso: varchar("recipient_country_iso", { length: 8 }),
    rateVersionId: varchar("rate_version_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_wallet_tx_org_created").on(table.organizationId, table.createdAt),
    index("idx_wallet_tx_reference").on(table.referenceType, table.referenceId),
  ]
);

export type WalletTransactionRow = typeof walletTransactions.$inferSelect;

export const walletMetaRateVersions = pgTable("wallet_meta_rate_versions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  countryIso: varchar("country_iso", { length: 8 }).notNull().default("DEFAULT"),
  metaCategory: varchar("meta_category", {
    enum: ["marketing", "utility", "authentication", "service"],
  }).notNull(),
  rateMinor: integer("rate_minor").notNull(),
  /** Fixed markup paise for this row; null = use platform markupByCategory when markup enabled. */
  markupMinor: integer("markup_minor"),
  currency: varchar("currency", { length: 10 }).notNull().default("INR"),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  notes: text("notes"),
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WalletMetaRateVersionRow = typeof walletMetaRateVersions.$inferSelect;

export const walletMetaInvoices = pgTable("wallet_meta_invoices", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  periodLabel: varchar("period_label", { length: 64 }).notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  metaTotalMinor: integer("meta_total_minor").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("INR"),
  source: varchar("source", { length: 32 }).notNull().default("manual"),
  notes: text("notes"),
  uploadedByUserId: varchar("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WalletMetaInvoiceRow = typeof walletMetaInvoices.$inferSelect;

export const walletReconciliationRuns = pgTable("wallet_reconciliation_runs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceId: varchar("invoice_id")
    .notNull()
    .references(() => walletMetaInvoices.id, { onDelete: "cascade" }),
  status: varchar("status", { enum: ["pending", "completed", "failed"] }).notNull().default("pending"),
  estimatedMetaMinor: integer("estimated_meta_minor").notNull().default(0),
  actualMetaMinor: integer("actual_meta_minor").notNull(),
  varianceMinor: integer("variance_minor").notNull().default(0),
  adjustmentTransactionId: varchar("adjustment_transaction_id"),
  organizationScope: varchar("organization_scope", { length: 32 }).notNull().default("platform"),
  notes: text("notes"),
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type WalletReconciliationRunRow = typeof walletReconciliationRuns.$inferSelect;

export const walletLowBalanceAlertState = pgTable("wallet_low_balance_alert_state", {
  organizationId: varchar("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  lastAlertAt: timestamp("last_alert_at", { withTimezone: true }),
  lastBalanceMinor: integer("last_balance_minor"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const walletReloadOrders = pgTable(
  "wallet_reload_orders",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("INR"),
    status: varchar("status", { enum: ["pending", "paid", "failed", "cancelled"] })
      .notNull()
      .default("pending"),
    paymentGateway: varchar("payment_gateway", { length: 32 }).notNull().default("razorpay"),
    gatewayOrderId: varchar("gateway_order_id").notNull(),
    gatewayPaymentId: varchar("gateway_payment_id"),
    gatewayPayload: jsonb("gateway_payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_wallet_reload_org_status").on(table.organizationId, table.status),
  ]
);

export type WalletReloadOrderRow = typeof walletReloadOrders.$inferSelect;

// Integrations Table
export const integrations = pgTable("integrations", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(), // e.g., "google-calendar", "facebook-lead-ads"
  displayName: varchar("display_name").notNull(), // e.g., "Google Calendar", "Facebook Lead Ads"
  category: varchar("category", { enum: ['featured', 'flow', 'helper'] }).notNull(),
  status: varchar("status", { enum: ['connected', 'not_connected', 'error'] }).notNull().default('not_connected'),
  authType: varchar("auth_type", { enum: ['oauth', 'api_key', 'webhook', 'none'] }).notNull().default('none'),
  config: jsonb("config").$type<Record<string, any>>(), // Store integration-specific configuration
  credentials: jsonb("credentials").$type<Record<string, any>>(), // Encrypted credentials
  lastSyncAt: timestamp("last_sync_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_integrations_user").on(table.userId),
  index("idx_integrations_org").on(table.organizationId),
  index("idx_integrations_name").on(table.name),
]);

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;

/** Payment link / request for a CRM contact (Razorpay or Cashfree); public pay page uses `token`. */
export const contactPaymentRequests = pgTable(
  "contact_payment_requests",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    token: varchar("token", { length: 64 }).notNull().unique(),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    integrationId: varchar("integration_id").references(() => integrations.id, { onDelete: "set null" }),
    contactId: varchar("contact_id").references(() => managedContacts.id, { onDelete: "set null" }),
    gateway: varchar("gateway", { length: 32 }).notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("INR"),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    gatewayLinkId: varchar("gateway_link_id", { length: 255 }),
    gatewayPaymentId: varchar("gateway_payment_id", { length: 255 }),
    shortUrl: text("short_url"),
    customerPhone: varchar("customer_phone", { length: 32 }),
    description: text("description"),
    whatsappSessionId: varchar("whatsapp_session_id", { length: 128 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_contact_payment_req_org").on(table.organizationId),
    index("idx_contact_payment_req_gateway_link").on(table.gateway, table.gatewayLinkId),
  ]
);

export const insertContactPaymentRequestSchema = createInsertSchema(contactPaymentRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ContactPaymentRequestRow = typeof contactPaymentRequests.$inferSelect;
export type InsertContactPaymentRequest = z.infer<typeof insertContactPaymentRequestSchema>;

// Automation Flows Table (flow builder / workflow automation)
export const automationFlows = pgTable("automation_flows", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  status: varchar("status", { enum: ['active', 'inactive', 'draft'] }).notNull().default('inactive'),
  nodes: jsonb("nodes").$type<Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
    data: Record<string, any>;
  }>>().default([]),
  edges: jsonb("edges").$type<Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>>().default([]),
  /** Simple trigger → ordered steps model; canvas `nodes`/`edges` are untouched when null. */
  linearFlow: jsonb("linear_flow").$type<LinearFlowDefinition | null>().default(null),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_automation_flows_user").on(table.userId),
  index("idx_automation_flows_org").on(table.organizationId),
  index("idx_automation_flows_status").on(table.status),
]);

export const insertAutomationFlowSchema = createInsertSchema(automationFlows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AutomationFlow = typeof automationFlows.$inferSelect;
export type InsertAutomationFlow = z.infer<typeof insertAutomationFlowSchema>;

/** One execution of an automation flow (trigger or resumed after delay). */
export const automationFlowRuns = pgTable("automation_flow_runs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  flowId: varchar("flow_id").notNull().references(() => automationFlows.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  triggerNodeId: varchar("trigger_node_id"),
  triggerType: varchar("trigger_type"),
  contactId: varchar("contact_id"),
  status: varchar("status", {
    enum: ["running", "scheduled", "completed", "failed", "cancelled"],
  })
    .notNull()
    .default("running"),
  lastError: text("last_error"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_automation_flow_runs_flow_started").on(table.flowId, table.startedAt),
  index("idx_automation_flow_runs_org_started").on(table.organizationId, table.startedAt),
  index("idx_automation_flow_runs_status").on(table.status),
]);

export type AutomationFlowRun = typeof automationFlowRuns.$inferSelect;
export type InsertAutomationFlowRun = typeof automationFlowRuns.$inferInsert;

/** Timestamped events for debugging automation runs. */
export const automationFlowRunLogs = pgTable("automation_flow_run_logs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  runId: varchar("run_id")
    .notNull()
    .references(() => automationFlowRuns.id, { onDelete: "cascade" }),
  level: varchar("level", { enum: ["info", "warn", "error"] }).notNull().default("info"),
  event: varchar("event").notNull(),
  nodeId: varchar("node_id"),
  actionId: varchar("action_id"),
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_automation_flow_run_logs_run_created").on(table.runId, table.createdAt),
  index("idx_automation_flow_run_logs_event").on(table.event),
]);

export type AutomationFlowRunLog = typeof automationFlowRunLogs.$inferSelect;
export type InsertAutomationFlowRunLog = typeof automationFlowRunLogs.$inferInsert;

/** Persisted pause/resume state when an automation flow hits a long delay. */
export const automationFlowScheduledRuns = pgTable("automation_flow_scheduled_runs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  flowId: varchar("flow_id").notNull().references(() => automationFlows.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  runId: varchar("run_id").references(() => automationFlowRuns.id, { onDelete: "set null" }),
  nextNodeId: varchar("next_node_id"),
  resumeAt: timestamp("resume_at").notNull(),
  runContext: jsonb("run_context").$type<Record<string, unknown>>().notNull().default({}),
  visitedNodeIds: jsonb("visited_node_ids").$type<string[]>().notNull().default([]),
  status: varchar("status", { enum: ["pending", "running", "completed", "failed", "cancelled"] })
    .notNull()
    .default("pending"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_automation_flow_scheduled_runs_status_resume").on(table.status, table.resumeAt),
  index("idx_automation_flow_scheduled_runs_flow").on(table.flowId),
]);

export type AutomationFlowScheduledRun = typeof automationFlowScheduledRuns.$inferSelect;
export type InsertAutomationFlowScheduledRun = typeof automationFlowScheduledRuns.$inferInsert;

// Integration OAuth States Table (for OAuth flow)
export const integrationOAuthStates = pgTable("integration_oauth_states", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  integrationName: varchar("integration_name").notNull(),
  state: varchar("state").notNull().unique(), // OAuth state parameter
  codeVerifier: varchar("code_verifier"), // For PKCE
  redirectUri: varchar("redirect_uri"),
  clientId: varchar("client_id"), // Optional per-connection Google OAuth client ID
  clientSecret: varchar("client_secret"), // Optional per-connection Google OAuth client secret
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // OAuth states expire after 10 minutes
}, (table) => [
  index("idx_oauth_states_state").on(table.state),
  index("idx_oauth_states_user").on(table.userId),
]);

export type IntegrationOAuthState = typeof integrationOAuthStates.$inferSelect;
export type InsertIntegrationOAuthState = typeof integrationOAuthStates.$inferInsert;

// Chatbots Table
export const chatbots = pgTable("chatbots", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  status: varchar("status", { enum: ['draft', 'published'] }).notNull().default('draft'),
  sessionId: varchar("session_id").references(() => whatsappSessions.sessionId, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_chatbots_user").on(table.userId),
  index("idx_chatbots_org").on(table.organizationId),
  index("idx_chatbots_status").on(table.status),
]);

export const insertChatbotSchema = createInsertSchema(chatbots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Chatbot = typeof chatbots.$inferSelect;
export type InsertChatbot = z.infer<typeof insertChatbotSchema>;

// Chatbot Nodes Table (for storing flow nodes)
export const chatbotNodes = pgTable("chatbot_nodes", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  chatbotId: varchar("chatbot_id").notNull().references(() => chatbots.id, { onDelete: 'cascade' }),
  nodeType: varchar("node_type", { enum: ['trigger', 'send_text', 'send_button', 'send_list', 'send_media', 'send_cta', 'ask_question', 'ai_agent', 'http', 'delay', 'condition', 'send_template', 'send_product', 'ask_location', 'update_columns', 'update_tag', 'fetch_contact', 'stop_chatbot', 'append_google_sheet'] }).notNull(),
  position: jsonb("position").$type<{ x: number; y: number }>().notNull(),
  data: jsonb("data").$type<Record<string, any>>().notNull(),
  connections: jsonb("connections").$type<Array<{ from: string; to: string; fromHandle?: string; toHandle?: string }>>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_chatbot_nodes_chatbot").on(table.chatbotId),
  index("idx_chatbot_nodes_type").on(table.nodeType),
]);

// IMPORTANT: keep `id` so node ids remain stable across saves.
// The flow editor uses node ids in `connections.from/to`; if the backend generates new ids on each save,
// edges will not be able to reconnect after refresh.
export const insertChatbotNodeSchema = createInsertSchema(chatbotNodes).omit({
  createdAt: true,
  updatedAt: true,
});

export type ChatbotNode = typeof chatbotNodes.$inferSelect;
export type InsertChatbotNode = z.infer<typeof insertChatbotNodeSchema>;

// AI Assistants (for auto-reply with OpenAI + custom prompt / knowledge base)
export const aiAssistants = pgTable("ai_assistants", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  promptType: varchar("prompt_type", { enum: ["predefined", "custom"] }).notNull().default("predefined"),
  agentRole: varchar("agent_role"), // e.g. customer_support, coding, sales, general
  customPrompt: text("custom_prompt"), // system prompt / custom instructions
  openaiIntegrationId: varchar("openai_integration_id"), // use stored API key from integrations
  openaiApiKeyOverride: varchar("openai_api_key_override"), // optional override (encrypted in storage)
  model: varchar("model").notNull().default("gpt-4o"), // gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4, gpt-3.5-turbo
  agentRules: jsonb("agent_rules").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_ai_assistants_user").on(table.userId),
  index("idx_ai_assistants_org").on(table.organizationId),
]);

export const insertAiAssistantSchema = createInsertSchema(aiAssistants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AiAssistant = typeof aiAssistants.$inferSelect;
export type InsertAiAssistant = z.infer<typeof insertAiAssistantSchema>;

// Knowledge base files for AI assistant (.txt content stored)
export const aiAssistantKnowledgeFiles = pgTable("ai_assistant_knowledge_files", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  assistantId: varchar("assistant_id").notNull().references(() => aiAssistants.id, { onDelete: "cascade" }),
  fileName: varchar("file_name").notNull(),
  content: text("content").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  mimeType: varchar("mime_type").notNull().default("text/plain"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("idx_ai_assistant_kb_assistant").on(table.assistantId)]);

export const insertAiAssistantKnowledgeFileSchema = createInsertSchema(aiAssistantKnowledgeFiles).omit({
  id: true,
  createdAt: true,
});
export type AiAssistantKnowledgeFile = typeof aiAssistantKnowledgeFiles.$inferSelect;
export type InsertAiAssistantKnowledgeFile = z.infer<typeof insertAiAssistantKnowledgeFileSchema>;

// Support tickets (per-organization; customer can be guest or platform user)
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Monotonic per organization (e.g. #1, #2) */
    ticketNumber: integer("ticket_number").notNull(),
    /** Secret for public / unauthenticated customer portal */
    accessToken: varchar("access_token").notNull().unique(),
    subject: varchar("subject").notNull(),
    description: text("description").notNull(),
    status: varchar("status", {
      enum: ["open", "pending", "in_progress", "waiting_on_customer", "resolved", "closed"],
    })
      .notNull()
      .default("open"),
    customerEmail: varchar("customer_email").notNull(),
    customerName: varchar("customer_name").notNull(),
    customerPhone: varchar("customer_phone", { length: 32 }),
    customerUserId: varchar("customer_user_id").references(() => users.id, { onDelete: "set null" }),
    assignedToUserId: varchar("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
    /** When true, ticket is escalated to the whitelabel Technical Team portal */
    transferredToTechnical: boolean("transferred_to_technical").notNull().default(false),
    transferredToTechnicalAt: timestamp("transferred_to_technical_at"),
    /** ID of the ticket row in whatsapp-admin technical_support_tickets */
    technicalTicketId: varchar("technical_ticket_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_support_tickets_org").on(table.organizationId),
    index("idx_support_tickets_org_num").on(table.organizationId, table.ticketNumber),
    uniqueIndex("idx_support_tickets_org_number_unique").on(table.organizationId, table.ticketNumber),
    index("idx_support_tickets_status").on(table.status),
    index("idx_support_tickets_assigned").on(table.assignedToUserId),
    index("idx_support_tickets_customer_user").on(table.customerUserId),
  ],
);

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

export const supportMessages = pgTable(
  "support_messages",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    ticketId: varchar("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    authorType: varchar("author_type", {
      enum: ["customer", "agent", "technical_team"],
    }).notNull(),
    authorUserId: varchar("author_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_support_messages_ticket").on(table.ticketId),
    index("idx_support_messages_created").on(table.createdAt),
  ],
);

export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({
  id: true,
  createdAt: true,
});
export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;

export const supportAttachments = pgTable(
  "support_attachments",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    ticketId: varchar("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    messageId: varchar("message_id")
      .notNull()
      .references(() => supportMessages.id, { onDelete: "cascade" }),
    fileName: varchar("file_name").notNull(),
    filePath: varchar("file_path").notNull(),
    mimeType: varchar("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: varchar("uploaded_by", { enum: ["customer", "agent"] }).notNull(),
    uploadedByUserId: varchar("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_support_attachments_ticket").on(table.ticketId), index("idx_support_attachments_message").on(table.messageId)],
);

export const insertSupportAttachmentSchema = createInsertSchema(supportAttachments).omit({
  id: true,
  createdAt: true,
});
export type SupportAttachment = typeof supportAttachments.$inferSelect;
export type InsertSupportAttachment = z.infer<typeof insertSupportAttachmentSchema>;

// ─── Drip Campaigns (timed WhatsApp automation sequences) ───────────────────
export const dripCampaigns = pgTable(
  "drip_campaigns",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id"),
    name: varchar("name").notNull(),
    goal: varchar("goal").notNull().default("Lead Nurturing").$type<DripCampaignGoal>(),
    entryTrigger: varchar("entry_trigger").notNull().default("manual").$type<DripEntryTrigger>(),
    triggerConfig: jsonb("trigger_config").$type<DripTriggerConfig>().notNull().default({}),
    steps: jsonb("steps").$type<DripCampaignStep[]>().notNull().default([]),
    timezone: varchar("timezone").notNull().default("Asia/Kolkata"),
    startTime: varchar("start_time").notNull().default("09:00"),
    endTime: varchar("end_time").notNull().default("18:00"),
    workingDays: jsonb("working_days").$type<DripWeekday[]>().notNull().default([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ]),
    duplicateStrategy: varchar("duplicate_strategy")
      .notNull()
      .default("ignore")
      .$type<DripDuplicateStrategy>(),
    humanizerDelayMinutes: integer("humanizer_delay_minutes").notNull().default(0),
    stopOnReply: boolean("stop_on_reply").notNull().default(true),
    status: varchar("status").notNull().default("draft").$type<DripCampaignStatus>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_drip_campaigns_org").on(table.organizationId),
    index("idx_drip_campaigns_status").on(table.organizationId, table.status),
    index("idx_drip_campaigns_trigger").on(table.organizationId, table.entryTrigger, table.status),
  ],
);

export const insertDripCampaignSchema = createInsertSchema(dripCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type DripCampaign = typeof dripCampaigns.$inferSelect;
export type InsertDripCampaign = z.infer<typeof insertDripCampaignSchema>;

export const dripCampaignEnrollments = pgTable(
  "drip_campaign_enrollments",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    campaignId: varchar("campaign_id")
      .notNull()
      .references(() => dripCampaigns.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: varchar("contact_id")
      .notNull()
      .references(() => managedContacts.id, { onDelete: "cascade" }),
    status: varchar("status").notNull().default("running").$type<DripEnrollmentStatus>(),
    currentStepIndex: integer("current_step_index").notNull().default(0),
    nextExecuteAt: timestamp("next_execute_at"),
    lastExecutedAt: timestamp("last_executed_at"),
    enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    stoppedReason: text("stopped_reason"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_drip_enrollments_campaign").on(table.campaignId),
    index("idx_drip_enrollments_contact").on(table.contactId),
    index("idx_drip_enrollments_due").on(table.status, table.nextExecuteAt),
    uniqueIndex("idx_drip_enrollments_campaign_contact").on(table.campaignId, table.contactId),
  ],
);

export const insertDripCampaignEnrollmentSchema = createInsertSchema(dripCampaignEnrollments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  enrolledAt: true,
});
export type DripCampaignEnrollment = typeof dripCampaignEnrollments.$inferSelect;
export type InsertDripCampaignEnrollment = z.infer<typeof insertDripCampaignEnrollmentSchema>;

export const dripCampaignLogs = pgTable(
  "drip_campaign_logs",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    campaignId: varchar("campaign_id")
      .notNull()
      .references(() => dripCampaigns.id, { onDelete: "cascade" }),
    enrollmentId: varchar("enrollment_id")
      .notNull()
      .references(() => dripCampaignEnrollments.id, { onDelete: "cascade" }),
    contactId: varchar("contact_id").references(() => managedContacts.id, { onDelete: "set null" }),
    stepIndex: integer("step_index").notNull().default(0),
    actionType: varchar("action_type").notNull(),
    status: varchar("status", { enum: ["success", "failed", "skipped"] }).notNull(),
    message: text("message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_drip_logs_campaign").on(table.campaignId),
    index("idx_drip_logs_enrollment").on(table.enrollmentId),
  ],
);

export type DripCampaignLog = typeof dripCampaignLogs.$inferSelect;

/** Meetings scheduled via Inbox "Send meet / booking link" (and related flows). */
export const scheduledMeetings = pgTable(
  "scheduled_meetings",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chatId: varchar("chat_id").references(() => chats.id, { onDelete: "set null" }),
    contactName: varchar("contact_name").notNull(),
    contactNumber: varchar("contact_number").notNull(),
    customerEmail: varchar("customer_email"),
    provider: varchar("provider", { enum: ["google_meet", "calendly"] }).notNull(),
    title: varchar("title").notNull(),
    meetLink: text("meet_link").notNull(),
    startAt: timestamp("start_at").notNull(),
    endAt: timestamp("end_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    integrationId: varchar("integration_id"),
    whatsappSessionId: varchar("whatsapp_session_id"),
    externalEventId: varchar("external_event_id"),
    status: varchar("status", {
      enum: ["scheduled", "completed", "cancelled"],
    })
      .notNull()
      .default("scheduled"),
    source: varchar("source", { enum: ["inbox", "ai", "booking_page"] })
      .notNull()
      .default("inbox"),
    bookingCalendarId: varchar("booking_calendar_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_scheduled_meetings_org").on(table.organizationId),
    index("idx_scheduled_meetings_start").on(table.organizationId, table.startAt),
    index("idx_scheduled_meetings_provider").on(table.organizationId, table.provider),
    index("idx_scheduled_meetings_chat").on(table.chatId),
    index("idx_scheduled_meetings_booking_cal").on(table.bookingCalendarId),
  ],
);

export const insertScheduledMeetingSchema = createInsertSchema(scheduledMeetings).omit({
  id: true,
  createdAt: true,
});
export type ScheduledMeeting = typeof scheduledMeetings.$inferSelect;
export type InsertScheduledMeeting = z.infer<typeof insertScheduledMeetingSchema>;

/** Personal booking calendars — public scheduling links for one-on-one meetings. */
export type BookingCalendarAvailability = {
  timezone: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  weekdays: number[]; // 0=Sun .. 6=Sat
};

export const bookingCalendars = pgTable(
  "booking_calendars",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Meeting owner / host shown on the public page */
    hostUserId: varchar("host_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name").notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    slug: varchar("slug").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    /** google_meet | calendly | link_only */
    provider: varchar("provider", { enum: ["google_meet", "calendly", "link_only"] })
      .notNull()
      .default("google_meet"),
    integrationId: varchar("integration_id"),
    whatsappSessionId: varchar("whatsapp_session_id"),
    availability: jsonb("availability").$type<BookingCalendarAvailability>().notNull(),
    /** Visual theme preset for the public /book/:slug page */
    theme: varchar("theme").notNull().default("emerald"),
    /** Max simultaneous bookings allowed for the same start time on this calendar */
    maxBookingsPerSlot: integer("max_bookings_per_slot").notNull().default(1),
    /** When true, this calendar is linked from the public landing "Book a Demo" button */
    isPublicDemo: boolean("is_public_demo").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_booking_calendars_slug").on(table.slug),
    index("idx_booking_calendars_org").on(table.organizationId),
    index("idx_booking_calendars_host").on(table.hostUserId),
  ],
);

export const insertBookingCalendarSchema = createInsertSchema(bookingCalendars).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BookingCalendar = typeof bookingCalendars.$inferSelect;
export type InsertBookingCalendar = z.infer<typeof insertBookingCalendarSchema>;
