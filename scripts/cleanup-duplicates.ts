/**
 * Cleanup script to merge duplicate chats and contacts
 * Run with: npx tsx scripts/cleanup-duplicates.ts
 */

import { db } from '../db';
import { contacts, chats, messages } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

// Helper function to normalize phone numbers
function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace('@c.us', '').replace('@g.us', '').replace(/^\+/, '').trim();
}

async function cleanupDuplicates() {
  console.log('🧹 Starting cleanup of duplicate chats and contacts...\n');

  try {
    // Step 1: Get all contacts grouped by normalized number and session
    const allContacts = await db.select().from(contacts);
    const contactGroups = new Map<string, typeof allContacts>();

    for (const contact of allContacts) {
      const normalized = normalizePhoneNumber(contact.number);
      const key = `${contact.sessionId}:${normalized}`;
      
      if (!contactGroups.has(key)) {
        contactGroups.set(key, []);
      }
      contactGroups.get(key)!.push(contact);
    }

  // Step 2: Merge duplicate contacts
  let contactsMerged = 0;
  for (const [key, group] of contactGroups.entries()) {
    if (group.length > 1) {
      // Keep the first contact (oldest), merge others
      const [keepContact, ...duplicates] = group.sort((a, b) => 
        a.id.localeCompare(b.id)
      );

      // Update chats to use the kept contact
      for (const duplicate of duplicates) {
        await db
          .update(chats)
          .set({ contactId: keepContact.id })
          .where(eq(chats.contactId, duplicate.id));
        
        await db.delete(contacts).where(eq(contacts.id, duplicate.id));
        contactsMerged++;
      }

      // Update contact name to use the best available name
      const bestName = group
        .filter(c => c.name !== normalizePhoneNumber(c.number))
        .sort((a, b) => b.name.length - a.name.length)[0]?.name || keepContact.name;

      if (bestName !== keepContact.name) {
        await db
          .update(contacts)
          .set({ name: bestName })
          .where(eq(contacts.id, keepContact.id));
      }

      console.log(`✅ Merged ${duplicates.length} duplicate contacts for ${normalizePhoneNumber(keepContact.number)}`);
    }
  }

  // Step 3: Get all chats grouped by normalized number and session
  const allChats = await db.select().from(chats);
  const chatGroups = new Map<string, typeof allChats>();

  for (const chat of allChats) {
    const normalized = normalizePhoneNumber(chat.contactNumber);
    const key = `${chat.sessionId}:${normalized}`;
    
    if (!chatGroups.has(key)) {
      chatGroups.set(key, []);
    }
    chatGroups.get(key)!.push(chat);
  }

  // Step 4: Merge duplicate chats
  let chatsMerged = 0;
  for (const [key, group] of chatGroups.entries()) {
    if (group.length > 1) {
      // Keep the first chat (oldest), merge others
      const [keepChat, ...duplicates] = group.sort((a, b) => 
        a.id.localeCompare(b.id)
      );

      // Update messages to use the kept chat
      for (const duplicate of duplicates) {
        await db
          .update(messages)
          .set({ chatId: keepChat.id })
          .where(eq(messages.chatId, duplicate.id));
        
        await db.delete(chats).where(eq(chats.id, duplicate.id));
        chatsMerged++;
      }

      // Update chat contact name from contact if available
      if (keepChat.contactId) {
        const contact = await db
          .select()
          .from(contacts)
          .where(eq(contacts.id, keepChat.contactId))
          .limit(1);

        if (contact[0] && contact[0].name !== keepChat.contactName) {
          await db
            .update(chats)
            .set({ contactName: contact[0].name })
            .where(eq(chats.id, keepChat.id));
        }
      }

      console.log(`✅ Merged ${duplicates.length} duplicate chats for ${normalizePhoneNumber(keepChat.contactNumber)}`);
    }
  }

  // Step 5: Normalize phone number formats (add @c.us if missing)
  const contactsToUpdate = await db
    .select()
    .from(contacts)
    .where(
      sql`${contacts.number} NOT LIKE '%@c.us' AND ${contacts.number} NOT LIKE '%@g.us' AND ${contacts.isGroup} = false`
    );

  for (const contact of contactsToUpdate) {
    await db
      .update(contacts)
      .set({ number: `${contact.number}@c.us` })
      .where(eq(contacts.id, contact.id));
  }

  const chatsToUpdate = await db
    .select()
    .from(chats)
    .where(
      sql`${chats.contactNumber} NOT LIKE '%@c.us' AND ${chats.contactNumber} NOT LIKE '%@g.us' AND ${chats.isGroup} = false`
    );

  for (const chat of chatsToUpdate) {
    await db
      .update(chats)
      .set({ contactNumber: `${chat.contactNumber}@c.us` })
      .where(eq(chats.id, chat.id));
  }

  console.log('\n✨ Cleanup complete!');
  console.log(`📊 Summary:`);
  console.log(`   - Contacts merged: ${contactsMerged}`);
  console.log(`   - Chats merged: ${chatsMerged}`);
  console.log(`   - Phone numbers normalized: ${contactsToUpdate.length + chatsToUpdate.length}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run cleanup
cleanupDuplicates()
  .then(() => {
    console.log('\n✅ Cleanup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  });

