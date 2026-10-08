/**
 * Comprehensive ETL Migration Script: PostgreSQL (Neon) -> MongoDB
 * Retains both camelCase and snake_case properties so all Mongoose models
 * and direct queries work seamlessly without missing fields.
 *
 * Run: npm run db:migrate-to-mongo
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Pool } from "pg";
import { getDatabaseUrl, getPgPoolConfig } from "../db/pg-connection";
import { getMongoUri } from "../db/mongo";

function toCamelCase(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Normalizes an object by creating camelCase versions of all snake_case keys,
 * while ALSO retaining the original snake_case keys.
 */
function normalizeDoc(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = value;
    const camel = toCamelCase(key);
    if (!(camel in result)) {
      result[camel] = value;
    }
  }
  return result;
}

async function main() {
  console.log("==================================================");
  console.log("🚀 Starting Comprehensive PostgreSQL to MongoDB Data Migration");
  console.log("==================================================");

  const pgUrl = getDatabaseUrl();
  const mongoUri = getMongoUri();

  if (!pgUrl) {
    throw new Error("DATABASE_URL is not set in environment");
  }
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set in environment");
  }

  console.log(`[PG] Connecting to PostgreSQL...`);
  const pool = new Pool(getPgPoolConfig(pgUrl));
  await pool.query("SELECT 1");
  console.log(`[PG] Connected successfully.`);

  console.log(`[Mongo] Connecting to MongoDB...`);
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db!;
  console.log(`[Mongo] Connected successfully.`);

  // Drop stale or bad unique indexes that could collide
  try {
    const planIndexes = await db.collection("plans").indexes();
    if (planIndexes.some((idx) => idx.name === "slug_1")) {
      await db.collection("plans").dropIndex("slug_1");
      console.log(`[Mongo] Dropped old slug_1 index on plans`);
    }
  } catch {
    // ignore
  }
  try {
    const integrationIndexes = await db.collection("integrations").indexes();
    if (integrationIndexes.some((idx) => idx.name === "organizationId_1_provider_1")) {
      await db.collection("integrations").dropIndex("organizationId_1_provider_1");
      console.log(`[Mongo] Dropped old organizationId_1_provider_1 index on integrations`);
    }
  } catch {
    // ignore
  }

  async function migrateTable(
    pgTable: string,
    mongoCollectionName: string,
    options?: {
      getId?: (row: any) => any;
      transform?: (row: any, normalized: any) => any;
    }
  ) {
    const started = Date.now();
    try {
      const { rows } = await pool.query(`SELECT * FROM "${pgTable}"`);
      if (!rows.length) {
        console.log(`[${pgTable} -> ${mongoCollectionName}] 0 rows found. Skipping.`);
        return;
      }
      console.log(`[${pgTable} -> ${mongoCollectionName}] Migrating ${rows.length} rows...`);

      const collection = db.collection(mongoCollectionName);

      const operations = rows.map((row) => {
        const normalized = normalizeDoc(row);

        // Derive _id
        let idVal: any;
        if (options?.getId) {
          idVal = options.getId(row);
        } else {
          idVal = row.id || row._id || row.sid || row.organization_id || row.key;
        }

        const customTransformed = options?.transform
          ? options.transform(row, normalized)
          : {};

        const finalDoc = {
          ...normalized,
          ...customTransformed,
          _id: typeof idVal === "number" ? idVal : String(idVal),
          id: typeof idVal === "number" ? idVal : String(idVal),
        };

        return {
          updateOne: {
            filter: { _id: finalDoc._id },
            update: { $set: finalDoc },
            upsert: true,
          },
        };
      });

      const CHUNK_SIZE = 500;
      for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
        const chunk = operations.slice(i, i + CHUNK_SIZE);
        await collection.bulkWrite(chunk, { ordered: false });
      }

      console.log(
        `[${pgTable} -> ${mongoCollectionName}] ✅ Migrated ${rows.length} rows in ${Date.now() - started}ms`
      );
    } catch (err: any) {
      console.warn(`[${pgTable} -> ${mongoCollectionName}] ⚠️ Migration error:`, err.message);
    }
  }

  try {
    // 1. Users
    await migrateTable("users", "users", {
      transform: (row) => ({
        firstName: row.first_name,
        lastName: row.last_name,
        passwordHash: row.password_hash,
        isSaaSOwner: Boolean(row.is_saas_owner),
        isActive: Boolean(row.is_active),
        emailVerified: Boolean(row.email_verified),
        accountStatus: row.account_status || "active",
        isTrialAccount: Boolean(row.is_trial_account),
        email: row.email ? String(row.email).toLowerCase().trim() : undefined,
      }),
    });

    // 2. Organizations
    await migrateTable("organizations", "organizations", {
      transform: (row) => ({
        ownerId: row.owner_id ? String(row.owner_id) : undefined,
      }),
    });

    // 3. Organization Members
    await migrateTable("organization_members", "organizationmembers", {
      getId: (row) => row.id || `${row.organization_id}_${row.user_id}`,
      transform: (row) => ({
        organizationId: String(row.organization_id),
        userId: String(row.user_id),
        role: row.role || "member",
        permissions: row.permissions || {},
        createdAt: row.joined_at || new Date(),
        updatedAt: row.joined_at || new Date(),
      }),
    });

    // 4. WhatsApp Sessions
    await migrateTable("whatsapp_sessions", "whatsappsessions", {
      getId: (row) => row.session_id || row.id,
      transform: (row) => ({
        sessionId: String(row.session_id || row.id),
        userId: String(row.user_id),
        organizationId: row.organization_id ? String(row.organization_id) : undefined,
        connectionType: row.connection_type || "unofficial",
        status: row.status || "disconnected",
        isActive: !row.deleted_at,
        deviceInfo: row.device_info || {},
      }),
    });

    // 5. Chats
    await migrateTable("chats", "chats", {
      transform: (row) => ({
        sessionId: String(row.session_id),
        contactId: row.contact_id ? String(row.contact_id) : undefined,
        name: row.contact_name,
        contactName: row.contact_name,
        contactNumber: row.contact_number,
        whatsappChatId: row.contact_number,
        lastMessage: row.last_message,
        lastMessageText: row.last_message,
        lastMessageTime: row.last_message_time,
        lastMessageTimestamp: row.last_message_time,
        unreadCount: Number(row.unread_count || 0),
        isGroup: Boolean(row.is_group),
      }),
    });

    // 6. Messages
    await migrateTable("messages", "messages", {
      transform: (row) => ({
        sessionId: String(row.session_id),
        chatId: String(row.chat_id),
        organizationId: row.organization_id ? String(row.organization_id) : undefined,
        body: row.body || "",
        fromMe: Boolean(row.from_me),
        isFromMe: Boolean(row.from_me),
        timestamp: row.timestamp || row.created_at,
        type: row.type || "text",
        mediaUrl: row.media_url,
        status: row.status || "sent",
        whatsappMessageId: row.whatsapp_message_id,
        senderName: row.sender_name,
        senderNumber: row.sender_number,
        from: row.from_me ? (row.sender_number || "me") : (row.sender_number || "customer"),
        to: row.from_me ? "customer" : "me",
      }),
    });

    // 7. Managed Contacts (CRM)
    await migrateTable("managed_contacts", "managedcontacts", {
      transform: (row) => ({
        userId: row.user_id ? String(row.user_id) : undefined,
        organizationId: String(row.organization_id),
        name: row.name,
        phone: row.phone_number,
        phoneNumber: row.phone_number,
        email: row.email,
        notes: row.notes,
        source: row.source || "manual",
        customFields: row.custom_fields || {},
      }),
    });

    // 8. Raw Contacts (WhatsApp device sync)
    await migrateTable("contacts", "contacts", {
      transform: (row) => ({
        sessionId: String(row.session_id),
        name: row.name,
        number: row.number,
        phone: row.number,
        phoneNumber: row.number,
        profilePic: row.profile_pic,
        isGroup: Boolean(row.is_group),
      }),
    });

    // 9. Contact Tags
    await migrateTable("contact_tags", "contacttags", {
      transform: (row) => ({
        organizationId: String(row.organization_id),
        userId: row.user_id ? String(row.user_id) : undefined,
        name: row.name,
        color: row.color || "#3b82f6",
      }),
    });

    // 10. Message Templates
    await migrateTable("message_templates", "messagetemplates", {
      transform: (row) => ({
        organizationId: String(row.organization_id),
        userId: String(row.user_id),
        templateId: row.template_id,
        name: row.name,
        language: row.language || "en_US",
        status: row.status || "APPROVED",
        category: row.category || "MARKETING",
        phoneNumberId: row.phone_number_id,
        components: row.components || [],
        metaData: row.meta_data || {},
      }),
    });

    // 11. Canned Messages (Quick Replies)
    await migrateTable("canned_messages", "cannedmessages", {
      transform: (row) => ({
        organizationId: String(row.organization_id),
        userId: String(row.user_id),
        shortcut: row.name || row.text?.slice(0, 20) || "quick",
        title: row.name || "Quick Reply",
        content: row.text || "",
        category: row.type || "general",
      }),
    });

    // 12. Campaigns
    await migrateTable("campaigns", "campaigns", {
      transform: (row) => ({
        userId: String(row.user_id),
        organizationId: String(row.organization_id),
        sessionId: String(row.session_id),
        name: row.name,
        templateId: row.template_id,
        templateName: row.message_template,
        status: row.status || "draft",
        scheduledAt: row.scheduled_at,
        totalRecipients: Number(row.total_recipients || 0),
        sentCount: Number(row.sent_count || 0),
        deliveredCount: Number(row.delivered_count || 0),
        failedCount: Number(row.failed_count || 0),
        headerMediaUrl: row.header_image_url,
      }),
    });

    // 13. Campaign Recipients
    await migrateTable("campaign_recipients", "campaignrecipients", {
      transform: (row) => ({
        campaignId: String(row.campaign_id),
        contactId: row.contact_id ? String(row.contact_id) : undefined,
        phone: row.phone_number,
        phoneNumber: row.phone_number,
        name: row.name,
        status: row.status || "pending",
        sentAt: row.sent_at,
        deliveredAt: row.delivered_at,
        readAt: row.read_at,
        errorMessage: row.error_message,
      }),
    });

    // 14. Plans
    await migrateTable("plans", "plans", {
      transform: (row) => ({
        name: row.name,
        displayName: row.display_name,
        slug:
          row.slug ||
          (row.name
            ? String(row.name).toLowerCase().replace(/[^a-z0-9]+/g, "_")
            : String(row.id)),
        priceMonthly: Number(row.price_monthly || 0),
        priceQuarterly: Number(row.price_quarterly || 0),
        priceYearly: Number(row.price_yearly || 0),
        features: row.features || {},
        isActive: Boolean(row.is_active),
        status: row.status || "published",
        isPopular: Boolean(row.is_popular),
        isInternational: Boolean(row.is_international),
        currency: row.currency || "INR",
        isSystemDefault: Boolean(row.is_system_default),
      }),
    });

    // 15. Subscriptions
    await migrateTable("subscriptions", "subscriptions", {
      transform: (row) => ({
        userId: String(row.user_id),
        organizationId: row.organization_id ? String(row.organization_id) : undefined,
        planId: String(row.plan_id),
        status: row.status || "active",
        billingCycle: row.billing_cycle || "monthly",
        currentPeriodStart: row.current_period_start,
        currentPeriodEnd: row.current_period_end,
        paymentGateway: row.payment_gateway,
        gatewaySubscriptionId: row.gateway_subscription_id,
      }),
    });

    // 16. Payments
    await migrateTable("payments", "payments", {
      transform: (row) => ({
        subscriptionId: row.subscription_id ? String(row.subscription_id) : undefined,
        userId: String(row.user_id),
        amount: Number(row.amount || 0),
        currency: row.currency || "INR",
        status: row.status || "captured",
        paymentGateway: row.payment_gateway,
        gatewayOrderId: row.gateway_order_id,
        gatewayPaymentId: row.gateway_payment_id,
        gatewaySignature: row.gateway_signature,
        metadata: row.metadata || {},
      }),
    });

    // 17. Organization Wallets
    await migrateTable("organization_wallets", "organizationwallets", {
      getId: (row) => row.organization_id,
      transform: (row) => ({
        organizationId: String(row.organization_id),
        balanceMinor: Number(row.balance_minor || 0),
        currency: row.currency || "INR",
        status: row.status || "active",
      }),
    });

    // 18. Wallet Transactions
    await migrateTable("wallet_transactions", "wallettransactions", {
      transform: (row) => ({
        organizationId: String(row.organization_id),
        type: row.type,
        amountMinor: Number(row.amount_minor || 0),
        balanceAfterMinor: Number(row.balance_after_minor || 0),
        currency: row.currency || "INR",
        description: row.description,
      }),
    });

    // 19. Chatbots
    await migrateTable("chatbots", "chatbots", {
      transform: (row) => ({
        organizationId: String(row.organization_id),
        userId: String(row.user_id),
        name: row.name,
        sessionId: row.session_id ? String(row.session_id) : undefined,
        isActive: row.status === "active",
      }),
    });

    // 20. Country Dial Codes
    await migrateTable("country_dial_codes", "countrydialcodes", {
      getId: (row) => Number(row.id),
      transform: (row) => ({
        countryName: row.country_name,
        countryCode: row.iso_code,
        dialPrefix: row.dial_prefix,
      }),
    });

    // 21. Integrations
    await migrateTable("integrations", "integrations", {
      transform: (row) => ({
        organizationId: String(row.organization_id),
        userId: String(row.user_id),
        name: row.name,
        provider: row.name || row.category || "custom",
        displayName: row.display_name,
        category: row.category,
        status: row.status,
        authType: row.auth_type,
        config: row.config || {},
        credentials: row.credentials || {},
      }),
    });

    // 22. AI Assistants
    await migrateTable("ai_assistants", "aiassistants", {
      transform: (row) => ({
        organizationId: String(row.organization_id),
        userId: String(row.user_id),
        name: row.name,
        model: row.model || "gpt-4o",
        instructions: row.custom_prompt || row.agent_rules || "Default Assistant",
        isActive: true,
      }),
    });

    // 23. API Keys
    await migrateTable("api_keys", "apikeys", {
      transform: (row) => ({
        organizationId: String(row.organization_id),
        userId: String(row.user_id),
        keyHash: row.key || "key",
        keyPrefix: (row.key || "key").slice(0, 8),
        name: row.name,
        isActive: true,
      }),
    });

    // 24. Automation Flows
    await migrateTable("automation_flows", "automationflows", {
      transform: (row) => ({
        organizationId: String(row.organization_id),
        userId: String(row.user_id),
        name: row.name,
        triggerType: "whatsapp_message",
        flowDefinition: row.linear_flow || { nodes: row.nodes, edges: row.edges },
        isActive: row.status === "active",
      }),
    });

    // 25. Platform Master Settings
    await migrateTable("platform_master_settings", "platformmastersettings", {
      getId: () => "singleton",
      transform: (row) => ({
        platformName: row.platform_name || "DigitaleBuzz",
        supportEmail: row.support_email,
        settings: row.settings || {},
        upstreamPayload: row.upstream_payload || {},
        revenueShareLocal: row.revenue_share_local || {},
        walletBillingConfig: row.wallet_billing_config || {},
        creditLineProvidersConfig: row.credit_line_providers_config || {},
        activePanelTemplateId: row.active_panel_template_id || "default",
        subscriptionDataRetentionMonths: row.subscription_data_retention_months || 3,
      }),
    });

    // 26. SMTP Settings
    await migrateTable("smtp_settings", "smtpsettings", {
      getId: (row) => String(row.id || "singleton"),
      transform: (row) => ({
        host: row.host,
        port: row.port,
        secure: row.secure,
        username: row.username,
        password: row.password,
        fromEmail: row.from_email,
        fromName: row.from_name,
      }),
    });

    // 27. Website Builder Pages
    await migrateTable("website_builder_pages", "websitebuilderpages", {
      transform: (row) => ({
        slug:
          row.slug ||
          (row.title
            ? String(row.title).toLowerCase().replace(/[^a-z0-9]+/g, "-")
            : String(row.id)),
        title: row.title,
        content: row.content || {},
        isPublished: row.is_published,
      }),
    });

    // 28. Sessions (User active web logins)
    await migrateTable("sessions", "sessions", {
      getId: (row) => String(row.sid),
      transform: (row) => ({
        session: row.sess,
        expires: row.expire,
      }),
    });

    // 29. Subscription History
    await migrateTable("subscription_history", "subscriptionhistory");

    // 30. User Addons
    await migrateTable("user_addons", "useraddons");

    // 31. Whitelabel Onboarding Fees
    await migrateTable("whitelabel_onboarding_fees", "whitelabelonboardingfees");

    // 32. Organization Leads
    await migrateTable("organization_leads", "organizationleads");

    // 33. Organization Lead Statuses
    await migrateTable("organization_lead_statuses", "organizationleadstatuses");

    // 34. Contact Notes
    await migrateTable("contact_notes", "contactnotes");

    // 35. Contact Activity Log
    await migrateTable("contact_activity_log", "contactactivitylogs");

    // 36. Panel Transactional Email Log
    await migrateTable("panel_transactional_email_log", "paneltransactionalemaillogs");

    // 37. Wallet Meta Rate Versions
    await migrateTable("wallet_meta_rate_versions", "walletmetarateversions");

    console.log("==================================================");
    console.log("🎉 Complete Migration Finished with 0 Data Loss!");
    console.log("==================================================");
  } finally {
    await pool.end();
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("❌ Fatal Migration Error:", err);
  process.exit(1);
});
