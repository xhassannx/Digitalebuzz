/**
 * Cleanup Script: Delete all sessions, messages, templates, and related data
 * 
 * This script will delete:
 * - All WhatsApp sessions (devices)
 * - All messages
 * - All chats
 * - All contacts
 * - All message templates
 * - All message sync requests
 * - All message activity logs
 * 
 * WARNING: This is irreversible!
 */

import { db } from "../../db";
import {
  whatsappSessions,
  messages,
  chats,
  contacts,
  messageTemplates,
  messageSyncRequests,
  messageActivityLog,
} from "@shared/schema";

export async function cleanupAllData() {
  console.log("🧹 Starting cleanup of all data...");

  try {
    // Delete in order respecting foreign key constraints
    // Note: Due to cascade deletes, deleting sessions will auto-delete chats, messages, and contacts
    
    // 1. Delete message templates
    const templatesResult = await db.delete(messageTemplates);
    console.log("✅ Deleted all message templates");

    // 2. Delete message sync requests
    const syncRequestsResult = await db.delete(messageSyncRequests);
    console.log("✅ Deleted all message sync requests");

    // 3. Delete message activity logs
    const activityLogsResult = await db.delete(messageActivityLog);
    console.log("✅ Deleted all message activity logs");

    // 4. Delete messages (explicitly, though cascade will handle it)
    const messagesResult = await db.delete(messages);
    console.log("✅ Deleted all messages");

    // 5. Delete chats (explicitly, though cascade will handle it)
    const chatsResult = await db.delete(chats);
    console.log("✅ Deleted all chats");

    // 6. Delete contacts (explicitly, though cascade will handle it)
    const contactsResult = await db.delete(contacts);
    console.log("✅ Deleted all contacts");

    // 7. Delete all sessions (this will cascade delete related chats, messages, contacts)
    const sessionsResult = await db.delete(whatsappSessions);
    console.log("✅ Deleted all WhatsApp sessions");

    console.log("✨ Cleanup completed successfully!");
    
    return {
      success: true,
      message: "All data has been cleaned up successfully",
    };
  } catch (error: any) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  }
}

// If running directly
if (require.main === module) {
  cleanupAllData()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Cleanup failed:", error);
      process.exit(1);
    });
}

