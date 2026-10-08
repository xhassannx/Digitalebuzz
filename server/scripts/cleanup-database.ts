/**
 * Database Cleanup Script: Clean all tables except essential ones
 * 
 * This script will DELETE data from:
 * - WhatsApp sessions, contacts, chats, messages
 * - Campaigns and campaign recipients
 * - Message templates, activity logs, sync requests
 * - Webhooks
 * - Managed contacts, contact tags, contact columns
 * - Groups and group members
 * - Chatbots and chatbot nodes
 * - WhatsApp flows
 * - Integrations and OAuth states
 * - Opt keywords
 * - Usage tracking
 * 
 * This script will PRESERVE:
 * - Users
 * - Plans
 * - Organizations
 * - Organization members
 * - Organization themes
 * - Subscriptions
 * - Payments
 * - User settings
 * - API keys
 * - Sessions (authentication sessions)
 * 
 * WARNING: This is irreversible! Make sure you have a backup.
 */

import "dotenv/config";
import { db } from "../../db";
import {
  whatsappSessions,
  contacts,
  chats,
  messages,
  webhooks,
  campaigns,
  campaignRecipients,
  messageTemplates,
  messageActivityLog,
  messageSyncRequests,
  managedContacts,
  contactTags,
  contactTagAssignments,
  contactColumns,
  groups,
  groupMembers,
  chatbots,
  chatbotNodes,
  whatsappFlows,
  integrations,
  integrationOAuthStates,
  optKeywords,
  usageTracking,
} from "@shared/schema";

async function cleanupDatabase() {
  console.log("🧹 Starting database cleanup (preserving users, plans, organizations, etc.)...\n");

  try {
    // Delete in order respecting foreign key constraints
    // Tables with foreign keys should be deleted before their parent tables
    
    console.log("1. Deleting campaign recipients...");
    await db.delete(campaignRecipients);
    console.log("   ✅ Deleted all campaign recipients\n");

    console.log("2. Deleting campaigns...");
    await db.delete(campaigns);
    console.log("   ✅ Deleted all campaigns\n");

    console.log("3. Deleting chatbot nodes...");
    await db.delete(chatbotNodes);
    console.log("   ✅ Deleted all chatbot nodes\n");

    console.log("4. Deleting chatbots...");
    await db.delete(chatbots);
    console.log("   ✅ Deleted all chatbots\n");

    console.log("5. Deleting group members...");
    await db.delete(groupMembers);
    console.log("   ✅ Deleted all group members\n");

    console.log("6. Deleting groups...");
    await db.delete(groups);
    console.log("   ✅ Deleted all groups\n");

    console.log("7. Deleting contact tag assignments...");
    await db.delete(contactTagAssignments);
    console.log("   ✅ Deleted all contact tag assignments\n");

    console.log("8. Deleting contact tags...");
    await db.delete(contactTags);
    console.log("   ✅ Deleted all contact tags\n");

    console.log("9. Deleting contact columns...");
    await db.delete(contactColumns);
    console.log("   ✅ Deleted all contact columns\n");

    console.log("10. Deleting managed contacts...");
    await db.delete(managedContacts);
    console.log("    ✅ Deleted all managed contacts\n");

    console.log("11. Deleting messages...");
    await db.delete(messages);
    console.log("    ✅ Deleted all messages\n");

    console.log("12. Deleting chats...");
    await db.delete(chats);
    console.log("    ✅ Deleted all chats\n");

    console.log("13. Deleting contacts...");
    await db.delete(contacts);
    console.log("    ✅ Deleted all contacts\n");

    console.log("14. Deleting WhatsApp sessions...");
    await db.delete(whatsappSessions);
    console.log("    ✅ Deleted all WhatsApp sessions\n");

    console.log("15. Deleting message templates...");
    await db.delete(messageTemplates);
    console.log("    ✅ Deleted all message templates\n");

    console.log("16. Deleting message activity logs...");
    await db.delete(messageActivityLog);
    console.log("    ✅ Deleted all message activity logs\n");

    console.log("17. Deleting message sync requests...");
    await db.delete(messageSyncRequests);
    console.log("    ✅ Deleted all message sync requests\n");

    console.log("18. Deleting webhooks...");
    await db.delete(webhooks);
    console.log("    ✅ Deleted all webhooks\n");

    console.log("19. Deleting WhatsApp flows...");
    await db.delete(whatsappFlows);
    console.log("    ✅ Deleted all WhatsApp flows\n");

    console.log("20. Deleting integration OAuth states...");
    await db.delete(integrationOAuthStates);
    console.log("    ✅ Deleted all integration OAuth states\n");

    console.log("21. Deleting integrations...");
    await db.delete(integrations);
    console.log("    ✅ Deleted all integrations\n");

    console.log("22. Deleting opt keywords...");
    await db.delete(optKeywords);
    console.log("    ✅ Deleted all opt keywords\n");

    console.log("23. Deleting usage tracking...");
    await db.delete(usageTracking);
    console.log("    ✅ Deleted all usage tracking\n");

    console.log("✨ Database cleanup completed successfully!\n");
    console.log("📋 Preserved tables:");
    console.log("   - users");
    console.log("   - plans");
    console.log("   - organizations");
    console.log("   - organization_members");
    console.log("   - organization_themes");
    console.log("   - subscriptions");
    console.log("   - payments");
    console.log("   - user_settings");
    console.log("   - api_keys");
    console.log("   - sessions (authentication)");
    
    return {
      success: true,
      message: "Database cleanup completed successfully. Essential data preserved.",
    };
  } catch (error: any) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  }
}

// Run if executed directly
cleanupDatabase()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Cleanup failed:", error);
    process.exit(1);
  });

export { cleanupDatabase };

