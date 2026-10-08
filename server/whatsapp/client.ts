// @ts-nocheck
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { storage } from '../storage';
import { buildPublicUploadPath, saveUploadBuffer } from '../utils/media-storage';
import { guardOutboundSend } from '../opt-keyword-service';
import type { WhatsappSession } from '@shared/schema';

// Timeout utility to prevent hanging operations
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

export type ReactionUpdateCallback = (updatedMessage: { id: string; chatId: string; [key: string]: unknown }) => void;

export class WhatsAppClientManager {
  private clients: Map<string, Client>;
  private qrCodeCallbacks: Map<string, (qr: string) => void>;
  private statusCallbacks: Map<string, (status: WhatsappSession['status']) => void>;
  private messageCallbacks: Map<string, (message: any) => void>;
  private reactionCallbacks: Map<string, ReactionUpdateCallback>;

  constructor() {
    this.clients = new Map();
    this.qrCodeCallbacks = new Map();
    this.statusCallbacks = new Map();
    this.messageCallbacks = new Map();
    this.reactionCallbacks = new Map();
  }

  async createSession(sessionId: string): Promise<void> {
    if (this.clients.has(sessionId)) {
      throw new Error('Session already exists');
    }

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: sessionId }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-default-apps',
          '--disable-features=TranslateUI',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-popup-blocking',
          '--disable-prompt-on-repost',
          '--disable-renderer-backgrounding',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-pings',
          '--safebrowsing-disable-auto-update',
          '--enable-automation',
          '--password-store=basic',
          '--use-mock-keychain',
        ],
      },
    });

    this.clients.set(sessionId, client);

    // QR Code event
    client.on('qr', async (qr) => {
      try {
        console.log(`[WhatsApp Client] QR code received for session ${sessionId}, generating data URL...`);
        const qrCodeDataUrl = await QRCode.toDataURL(qr);
        console.log(`[WhatsApp Client] QR code data URL generated, length: ${qrCodeDataUrl.length}`);
        
        const updateResult = await storage.updateSession(sessionId, {
          status: 'qr',
          qrCode: qrCodeDataUrl,
        });
        console.log(`[WhatsApp Client] QR code saved to database for session ${sessionId}, result:`, updateResult ? 'success' : 'failed');
        
        const callback = this.qrCodeCallbacks.get(sessionId);
        if (callback) {
          console.log(`[WhatsApp Client] Calling QR code callback for session ${sessionId}`);
          callback(qrCodeDataUrl);
        } else {
          console.warn(`[WhatsApp Client] No QR code callback registered for session ${sessionId}`);
        }
      } catch (error) {
        console.error(`[WhatsApp Client] Error generating QR code for session ${sessionId}:`, error);
      }
    });

    // Ready event
    client.on('ready', async () => {
      console.log(`WhatsApp client ${sessionId} is ready`);
      
      // Wait a moment for client.info to be fully populated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const info = client.info;
      console.log(`[WhatsApp Client] Ready event - client.info exists: ${!!info}, wid: ${info?.wid?.user}`);
      
      if (!info) {
        console.warn(`[WhatsApp Client] Warning: client.info is not available immediately after ready event for session ${sessionId}`);
      }
      
      await storage.updateSession(sessionId, {
        status: 'connected',
        deviceInfo: {
          platform: info?.platform || 'unknown',
          phoneNumber: info?.wid?.user || '',
          name: info?.pushname || 'WhatsApp',
        },
        qrCode: undefined,
      });

      const callback = this.statusCallbacks.get(sessionId);
      if (callback) callback('connected');

      // NOTE: Old message syncing is now disabled by default to prevent database bloat and UI hanging
      // Users must request and purchase message history sync as a premium feature
      // See /api/sessions/:sessionId/sync-messages endpoint for manual sync
      console.log(`[WhatsApp Client] Session ${sessionId} connected. Old message sync disabled by default.`);
    });

    // Authenticated event
    client.on('authenticated', async () => {
      console.log(`WhatsApp client ${sessionId} authenticated`);
      await storage.updateSession(sessionId, {
        status: 'connecting',
      });
    });

    // Disconnected event
    client.on('disconnected', async (reason) => {
      console.log(`WhatsApp client ${sessionId} disconnected:`, reason);
      
      // Check if it's a rate limit or authentication failure
      const isRateLimited = reason === 'NAVIGATION' || 
                           reason === 'CONFLICT' ||
                           String(reason).toLowerCase().includes('rate') ||
                           String(reason).toLowerCase().includes('limit') ||
                           String(reason).toLowerCase().includes("can't link");
      
      await storage.updateSession(sessionId, {
        status: 'disconnected',
        qrCode: undefined,
        ...(isRateLimited && { 
          deviceInfo: { 
            error: 'WhatsApp rate limit: Too many connection attempts. Please wait before trying again.',
            reason: String(reason)
          } 
        })
      });

      const callback = this.statusCallbacks.get(sessionId);
      if (callback) callback('disconnected');
    });

    // Message event
    client.on('message', async (msg) => {
      try {
        const contact = await msg.getContact();
        const chat = await msg.getChat();
        
        // Get media URL if message has media
        let mediaUrl: string | null = null;
        if (msg.hasMedia) {
          try {
            const media = await msg.downloadMedia();
            if (media) {
              const ext = media.mimetype.split('/')[1] || 'bin';
              const filename = `${msg.id.id}.${ext}`;
              const publicPath = buildPublicUploadPath('media', filename);
              const buffer = Buffer.from(media.data, 'base64');
              await saveUploadBuffer(publicPath, buffer, media.mimetype);
              mediaUrl = publicPath;
            }
          } catch (mediaError) {
            console.error('Error downloading media:', mediaError);
          }
        }
        
        // Resolve reply/quote context when user sends a reply from their device (whatsapp-web.js: getQuotedMessage)
        let replyToMessageId: string | undefined;
        let quotedBody: string | undefined;
        let quotedFromMe: boolean | undefined;
        try {
          const getQuotedMessage = (msg as any).getQuotedMessage;
          if (typeof getQuotedMessage === 'function') {
            const quoted = await getQuotedMessage.call(msg);
            if (quoted) {
              const quotedId = (quoted.id && (quoted.id as any)._serialized) || (quoted.id && (quoted.id as any).id);
              if (quotedId) {
                const session = await storage.getSession(sessionId);
                if (session?.userId) {
                  const refMsg = await storage.getMessageByIdOrWhatsAppId(quotedId, session.userId, sessionId);
                  if (refMsg) {
                    replyToMessageId = refMsg.id;
                    quotedBody = (refMsg.body && String(refMsg.body).trim()) ? String(refMsg.body).substring(0, 500) : '[Message]';
                    quotedFromMe = refMsg.fromMe ?? false;
                  } else {
                    quotedBody = (quoted.body && String(quoted.body).trim()) ? String(quoted.body).substring(0, 500) : '[Message]';
                    quotedFromMe = !!(quoted.fromMe);
                  }
                }
              }
            }
          }
        } catch (quoteErr) {
          // Ignore quote resolution errors
        }

        const callback = this.messageCallbacks.get(sessionId);
        if (callback) {
          callback({
            sessionId,
            chatId: msg.from,
            body: msg.body || msg.caption || '',
            fromMe: msg.fromMe,
            type: msg.type,
            timestamp: new Date(msg.timestamp * 1000),
            senderName: contact.name || contact.pushname || '',
            senderNumber: msg.from,
            hasMedia: msg.hasMedia,
            mediaUrl: mediaUrl || undefined,
            id: (msg.id && (msg.id as any)._serialized) ? (msg.id as any)._serialized : (msg.id && (msg.id as any).id) ? (msg.id as any).id : undefined,
            whatsappMessageId: (msg.id && (msg.id as any)._serialized) ? (msg.id as any)._serialized : undefined,
            replyToMessageId,
            quotedBody,
            quotedFromMe,
          });
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    // Incoming reaction: update the message that was reacted to and notify so UI shows it
    client.on('message_reaction', async (reaction: any) => {
      try {
        const parentId = (reaction.msgId && (reaction.msgId as any)._serialized) || (typeof reaction.msgId === 'string' ? reaction.msgId : null);
        if (!parentId) return;
        const session = await storage.getSession(sessionId);
        if (!session) return;
        const myWid = (client as any).info?.wid;
        const senderJid = reaction.senderId ? String(reaction.senderId).replace(/@.*$/, '') : '';
        const myUser = myWid?.user ? String(myWid.user) : '';
        const fromMe = !!(myUser && senderJid && senderJid === myUser);
        const emoji = (reaction.reaction ?? reaction.reactionText ?? '').trim() || '👍';
        const targetMessage = await storage.getMessageByIdOrWhatsAppId(parentId, session.userId, sessionId);
        if (!targetMessage) return;
        const existing = (targetMessage.reactions as Array<{ emoji: string; fromMe: boolean }>) || [];
        const next = [...existing.filter((r: { fromMe: boolean }) => r.fromMe !== fromMe), { emoji, fromMe }];
        const updated = await storage.updateMessage(targetMessage.id, { reactions: next });
        if (updated) {
          const cb = this.reactionCallbacks.get(sessionId);
          if (cb) cb(updated as { id: string; chatId: string; [key: string]: unknown });
        }
      } catch (err) {
        console.error('[WhatsApp Client] Error processing reaction:', err);
      }
    });

    // Initialize client
    console.log(`[WhatsApp Client] Initializing client for session ${sessionId}...`);
    await client.initialize();
    console.log(`[WhatsApp Client] Client initialized for session ${sessionId}, waiting for QR code...`);
    
    await storage.updateSession(sessionId, {
      status: 'connecting',
    });
  }

  async disconnectSession(sessionId: string): Promise<void> {
    const client = this.clients.get(sessionId);
    
    if (client) {
      await client.destroy();
      this.clients.delete(sessionId);
      this.qrCodeCallbacks.delete(sessionId);
      this.statusCallbacks.delete(sessionId);
      this.messageCallbacks.delete(sessionId);
      this.reactionCallbacks.delete(sessionId);
    }

    await storage.updateSession(sessionId, {
      status: 'disconnected',
      qrCode: undefined,
    });
  }

  async sendTextMessage(sessionId: string, to: string, message: string, options?: { replyToWhatsAppMessageId?: string }): Promise<any> {
    const client = this.clients.get(sessionId);
    if (!client) {
      throw new Error('Session not found');
    }

    await guardOutboundSend(sessionId, to);

    // Handle both individual contacts (@c.us) and groups (@g.us)
    let chatId: string;
    if (to.includes('@g.us')) {
      // Already a group ID
      chatId = to;
    } else if (to.includes('@c.us')) {
      // Already an individual contact ID
      chatId = to;
    } else {
      // Default to individual contact
      chatId = `${to}@c.us`;
    }

    let quotedMessage: any = undefined;
    if (options?.replyToWhatsAppMessageId) {
      const getMessageById = (client as any).getMessageById?.bind(client);
      if (typeof getMessageById === 'function') {
        quotedMessage = await getMessageById(options.replyToWhatsAppMessageId);
      }
    }
    
    // Wrap sendMessage with timeout to prevent hanging (30 seconds)
    const sendOptions = quotedMessage ? { quoted: quotedMessage } : {};
    const sentMessage = await withTimeout(
      client.sendMessage(chatId, message, sendOptions),
      30000,
      'Message send operation timed out after 30 seconds. Please check your connection and try again.'
    );
    
    return {
      id: (sentMessage.id && (sentMessage.id as any)._serialized) ? (sentMessage.id as any)._serialized : sentMessage.id.id,
      timestamp: new Date(sentMessage.timestamp * 1000),
      status: 'sent',
    };
  }

  async sendReaction(sessionId: string, messageId: string, emoji: string): Promise<void> {
    const client = this.clients.get(sessionId);
    if (!client) {
      throw new Error('Session not found');
    }
    const getMessageById = (client as any).getMessageById?.bind(client);
    if (typeof getMessageById !== 'function') {
      throw new Error('Reactions are not supported by this WhatsApp client');
    }
    const msg = await getMessageById(messageId);
    if (!msg) {
      throw new Error('Message not found. It may be too old or from another device.');
    }
    await msg.react(emoji);
  }

  async sendMediaMessage(
    sessionId: string,
    to: string,
    media: Buffer,
    fileName: string,
    caption?: string,
    mimeType?: string
  ): Promise<any> {
    const client = this.clients.get(sessionId);
    if (!client) {
      throw new Error('Session not found');
    }

    await guardOutboundSend(sessionId, to);

    const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
    const resolvedMime = mimeType || this.getMimeType(fileName);
    const messageMedia = new MessageMedia(
      resolvedMime,
      media.toString('base64'),
      fileName
    );

    // Wrap sendMessage with timeout to prevent hanging (60 seconds for media)
    const sentMessage = await withTimeout(
      client.sendMessage(chatId, messageMedia, { caption }),
      60000,
      'Media send operation timed out after 60 seconds. The file may be too large or your connection is slow. Please try again.'
    );

    return {
      id: sentMessage.id.id,
      timestamp: new Date(sentMessage.timestamp * 1000),
      status: 'sent',
    };
  }

  async getChats(sessionId: string): Promise<any[]> {
    const client = this.clients.get(sessionId);
    if (!client) {
      throw new Error('Session not found');
    }

    console.log(`[WhatsApp Client] Getting chats for session ${sessionId}`);
    console.log(`[WhatsApp Client] Client info available:`, !!client.info);
    
    try {
      const chats = await client.getChats();
      console.log(`[WhatsApp Client] Retrieved ${chats.length} chats from WhatsApp`);
      
      if (chats.length === 0) {
        console.log(`[WhatsApp Client] No chats found in WhatsApp - this is normal for a new connection`);
        return [];
      }
      
      // Process chats in parallel, but skip profile pics for faster processing
      // Profile pics can be loaded lazily later if needed
      const processedChats = await Promise.all(chats.map(async (chat) => {
        try {
          const contact = await chat.getContact().catch(() => null);
          return {
            id: chat.id._serialized,
            name: chat.name || contact?.name || contact?.pushname || chat.id.user,
            number: chat.id.user,
            unreadCount: chat.unreadCount,
            lastMessage: chat.lastMessage?.body || '',
            lastMessageTime: chat.lastMessage ? new Date(chat.lastMessage.timestamp * 1000) : undefined,
            isGroup: chat.isGroup,
            profilePic: undefined, // Skip profile pic fetching for faster response - can be loaded on demand
          };
        } catch (error) {
          console.error(`[WhatsApp Client] Error processing chat ${chat.id._serialized}:`, error);
          // Return basic info even if contact fetch fails
          return {
            id: chat.id._serialized,
            name: chat.name || chat.id.user,
            number: chat.id.user,
            unreadCount: chat.unreadCount || 0,
            lastMessage: chat.lastMessage?.body || '',
            lastMessageTime: chat.lastMessage ? new Date(chat.lastMessage.timestamp * 1000) : undefined,
            isGroup: chat.isGroup,
            profilePic: undefined,
          };
        }
      }));
      
      console.log(`[WhatsApp Client] Processed ${processedChats.length} chats`);
      return processedChats;
    } catch (error) {
      console.error(`[WhatsApp Client] Error getting chats for session ${sessionId}:`, error);
      throw error;
    }
  }

  async getContacts(sessionId: string): Promise<any[]> {
    const client = this.clients.get(sessionId);
    if (!client) {
      throw new Error('Session not found');
    }

    const contacts = await client.getContacts();
    
    return contacts.map((contact) => ({
      id: contact.id._serialized,
      name: contact.name || contact.pushname || contact.id.user,
      number: contact.id.user,
      isGroup: contact.isGroup,
    }));
  }

  /**
   * Sync message history for all chats in the background
   * Fetches the last 50 messages from each chat and stores them in the database
   */
  async syncMessageHistory(sessionId: string): Promise<void> {
    try {
      console.log(`[WhatsApp Client] Starting message history sync for session ${sessionId}...`);
      const client = this.clients.get(sessionId);
      if (!client) {
        console.log(`[WhatsApp Client] Client not found for session ${sessionId}, skipping history sync`);
        return;
      }

      // Wait a bit for the client to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get all chats
      const chats = await client.getChats();
      console.log(`[WhatsApp Client] Found ${chats.length} chats to sync message history for session ${sessionId}`);

      if (chats.length === 0) {
        console.log(`[WhatsApp Client] No chats found, skipping message history sync`);
        return;
      }

      // Get existing chats from database to map WhatsApp chat IDs to database chat IDs
      const dbChats = await storage.getChatsBySession(sessionId);
      
      // Process chats in batches to avoid overwhelming the system
      const BATCH_SIZE = 5;
      const MESSAGES_PER_CHAT = 50; // Fetch last 50 messages per chat

      for (let i = 0; i < chats.length; i += BATCH_SIZE) {
        const batch = chats.slice(i, i + BATCH_SIZE);
        
        await Promise.allSettled(
          batch.map(async (chat) => {
            try {
              // Find corresponding database chat
              // For groups, chat.id.user might be different, so we need to match by the full ID
              const chatIdToMatch = chat.id._serialized || chat.id.user;
              const dbChat = dbChats.find(c => 
                c.contactNumber === chat.id.user || 
                c.contactNumber === chatIdToMatch ||
                (chat.isGroup && c.contactNumber.includes(chat.id.user))
              );
              if (!dbChat) {
                console.log(`[WhatsApp Client] No database chat found for ${chat.id.user} (${chat.name || 'Unknown'}), skipping message sync`);
                return;
              }

              // Check if we already have messages for this chat
              const messageCount = await storage.countMessagesInChat(dbChat.id);
              if (messageCount >= MESSAGES_PER_CHAT) {
                console.log(`[WhatsApp Client] Chat ${chat.id.user} already has ${messageCount} messages, skipping`);
                return;
              }

              console.log(`[WhatsApp Client] Fetching messages for chat ${chat.id.user} (${chat.name || 'Unknown'})...`);
              
              // Fetch messages from WhatsApp
              const messages = await chat.fetchMessages({ limit: MESSAGES_PER_CHAT });
              console.log(`[WhatsApp Client] Fetched ${messages.length} messages from WhatsApp for chat ${chat.id.user}`);

              if (messages.length === 0) {
                return;
              }

              // Get contact info for sender names
              const contactCache = new Map<string, string>();
              
              // Process and store messages
              const messagesToStore = await Promise.all(
                messages.map(async (msg) => {
                  try {
                    // Get sender name
                    let senderName = '';
                    let senderNumber = msg.from || chat.id.user;
                    
                    if (!msg.fromMe) {
                      if (!contactCache.has(senderNumber)) {
                        try {
                          const contact = await msg.getContact();
                          senderName = contact.name || contact.pushname || '';
                          contactCache.set(senderNumber, senderName);
                        } catch (e) {
                          // If contact fetch fails, use empty name
                          contactCache.set(senderNumber, '');
                        }
                      } else {
                        senderName = contactCache.get(senderNumber) || '';
                      }
                    }

                    // Determine message type
                    let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' = 'text';
                    if (msg.hasMedia) {
                      if (msg.type === 'image') messageType = 'image';
                      else if (msg.type === 'video') messageType = 'video';
                      else if (msg.type === 'audio' || msg.type === 'ptt') messageType = 'audio';
                      else if (msg.type === 'document') messageType = 'document';
                      else if (msg.type === 'location') messageType = 'location';
                      else if (msg.type === 'vcard') messageType = 'contact';
                    }

                    return {
                      sessionId,
                      chatId: dbChat.id,
                      body: msg.body || msg.caption || '',
                      fromMe: msg.fromMe,
                      type: messageType,
                      status: msg.fromMe ? (msg.ack === 3 ? 'read' : msg.ack === 2 ? 'delivered' : 'sent') : 'delivered' as const,
                      senderName,
                      senderNumber,
                      timestamp: new Date(msg.timestamp * 1000),
                    };
                  } catch (error) {
                    console.error(`[WhatsApp Client] Error processing message:`, error);
                    return null;
                  }
                })
              );

              // Filter out nulls and check for duplicates
              const validMessages = messagesToStore.filter(m => m !== null) as any[];
              
              // Check which messages already exist (by timestamp and body to avoid duplicates)
              const existingMessageKeys = new Set(
                existingMessages.map(m => `${m.timestamp.getTime()}-${m.body.substring(0, 50)}`)
              );

              const newMessages = validMessages.filter(m => {
                const key = `${m.timestamp.getTime()}-${m.body.substring(0, 50)}`;
                return !existingMessageKeys.has(key);
              });

              if (newMessages.length === 0) {
                console.log(`[WhatsApp Client] No new messages to store for chat ${chat.id.user}`);
                return;
              }

              // Store messages in database
              console.log(`[WhatsApp Client] Storing ${newMessages.length} new messages for chat ${chat.id.user}...`);
              
              // Insert messages one by one to handle potential duplicates gracefully
              let storedCount = 0;
              for (const msg of newMessages) {
                try {
                  await storage.createMessage(msg);
                  storedCount++;
                } catch (error: any) {
                  // Ignore duplicate key errors
                  if (!error.message?.includes('duplicate') && !error.message?.includes('unique')) {
                    console.error(`[WhatsApp Client] Error storing message:`, error);
                  }
                }
              }

              console.log(`[WhatsApp Client] Stored ${storedCount} messages for chat ${chat.id.user}`);
            } catch (error) {
              console.error(`[WhatsApp Client] Error syncing messages for chat ${chat.id.user}:`, error);
            }
          })
        );

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < chats.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`[WhatsApp Client] Completed message history sync for session ${sessionId}`);
    } catch (error) {
      console.error(`[WhatsApp Client] Error in message history sync for session ${sessionId}:`, error);
    }
  }

  async sendLocationMessage(
    sessionId: string,
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string
  ): Promise<any> {
    const client = this.clients.get(sessionId);
    if (!client) {
      throw new Error('Session not found');
    }

    const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
    const location = new (pkg as any).Location(latitude, longitude, address || name);
    
    // Wrap sendMessage with timeout to prevent hanging (30 seconds)
    const sentMessage = await withTimeout(
      client.sendMessage(chatId, location),
      30000,
      'Location send operation timed out after 30 seconds. Please check your connection and try again.'
    );

    return {
      id: sentMessage.id.id,
      timestamp: new Date(sentMessage.timestamp * 1000),
      status: 'sent',
    };
  }

  async sendContactMessage(
    sessionId: string,
    to: string,
    contactName: string,
    contactPhone: string
  ): Promise<any> {
    const client = this.clients.get(sessionId);
    if (!client) {
      throw new Error('Session not found');
    }

    const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
    
    const normalizedPhone = contactPhone.replace(/\D/g, '');
    
    const vcard = 'BEGIN:VCARD\n'
      + 'VERSION:3.0\n'
      + `FN:${contactName}\n`
      + `TEL;type=CELL;type=VOICE;waid=${normalizedPhone}:${contactPhone}\n`
      + 'END:VCARD';
    
    // Wrap sendMessage with timeout to prevent hanging (30 seconds)
    const sentMessage = await withTimeout(
      client.sendMessage(chatId, {
        contacts: {
          displayName: contactName,
          contacts: [{ vcard }]
        }
      }),
      30000,
      'Contact send operation timed out after 30 seconds. Please check your connection and try again.'
    );

    return {
      id: sentMessage.id.id,
      timestamp: new Date(sentMessage.timestamp * 1000),
      status: 'sent',
    };
  }

  async getGroups(sessionId: string): Promise<any[]> {
    const client = this.clients.get(sessionId);
    if (!client) {
      throw new Error('Session not found');
    }

    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup);
    
    return Promise.all(groups.map(async (group) => {
      const contact = await group.getContact();
      return {
        id: group.id._serialized,
        name: group.name || contact.name || contact.pushname || group.id.user,
        number: group.id.user,
        isGroup: true,
        participantCount: (group as any).participants?.length || 0,
      };
    }));
  }

  getClient(sessionId: string): Client | undefined {
    return this.clients.get(sessionId);
  }

  async ensureClient(sessionId: string): Promise<boolean> {
    // If client already exists, return true
    if (this.clients.has(sessionId)) {
      return true;
    }

    // Check if session exists in database and is connected
    const session = await storage.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      console.log(`[WhatsApp Client] ensureClient: Session ${sessionId} not found or not connected`);
      return false;
    }

    // Try to restore the client (LocalAuth should restore from saved auth data)
    console.log(`[WhatsApp Client] ensureClient: Attempting to restore client for session ${sessionId}`);
    try {
      // Create a new client instance - LocalAuth will restore from saved session
      const client = new Client({
        authStrategy: new LocalAuth({ clientId: sessionId }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ],
        },
      });

      this.clients.set(sessionId, client);

      // Set up event handlers (same as createSession)
      client.on('ready', async () => {
        console.log(`WhatsApp client ${sessionId} is ready (restored)`);
        await new Promise(resolve => setTimeout(resolve, 500));
        const info = client.info;
        console.log(`[WhatsApp Client] Restored client - client.info exists: ${!!info}, wid: ${info?.wid?.user}`);
        
        await storage.updateSession(sessionId, {
          status: 'connected',
          deviceInfo: {
            platform: info?.platform || 'unknown',
            phoneNumber: info?.wid?.user || '',
            name: info?.pushname || 'WhatsApp',
          },
          qrCode: undefined,
        });

        const callback = this.statusCallbacks.get(sessionId);
        if (callback) callback('connected');
      });

      client.on('disconnected', async (reason) => {
        console.log(`WhatsApp client ${sessionId} disconnected (restored):`, reason);
        await storage.updateSession(sessionId, {
          status: 'disconnected',
          qrCode: undefined,
        });
        const callback = this.statusCallbacks.get(sessionId);
        if (callback) callback('disconnected');
      });

      // Initialize the client - this will restore the session if auth data exists
      console.log(`[WhatsApp Client] Initializing restored client for session ${sessionId}...`);
      
      // Set up a promise to wait for the ready event
      let readyResolve: ((value: boolean) => void) | null = null;
      let promiseResolved = false;
      
      const readyPromise = new Promise<boolean>((resolve) => {
        readyResolve = (value: boolean) => {
          if (promiseResolved) return;
          promiseResolved = true;
          resolve(value);
        };
      });
      
      // Listen for ready event (one-time)
      const readyHandler = async () => {
        console.log(`[WhatsApp Client] Restored client ${sessionId} is ready`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for info to populate
        if (readyResolve) readyResolve(true);
      };
      
      client.once('ready', readyHandler);
      
      // Also listen for authentication failure
      const authFailureHandler = () => {
        console.log(`[WhatsApp Client] Restored client ${sessionId} authentication failed`);
        client.removeListener('ready', readyHandler);
        if (readyResolve) readyResolve(false);
      };
      
      client.once('auth_failure', authFailureHandler);
      client.once('disconnected', () => {
        client.removeListener('ready', readyHandler);
        client.removeListener('auth_failure', authFailureHandler);
        if (readyResolve) readyResolve(false);
      });
      
      // Check if client is already ready (might have been restored and ready immediately)
      if (this.isClientReady(sessionId)) {
        console.log(`[WhatsApp Client] Restored client ${sessionId} is already ready`);
        client.removeListener('ready', readyHandler);
        client.removeListener('auth_failure', authFailureHandler);
        return true;
      }
      
      // Start initialization
      await client.initialize();
      console.log(`[WhatsApp Client] Restored client initialized for session ${sessionId}, waiting for ready event...`);
      
      // Check again after initialization (client might be ready immediately)
      if (this.isClientReady(sessionId)) {
        console.log(`[WhatsApp Client] Restored client ${sessionId} is ready immediately after initialization`);
        client.removeListener('ready', readyHandler);
        client.removeListener('auth_failure', authFailureHandler);
        return true;
      }
      
      // Wait for ready event with timeout
      // Use a longer timeout - WhatsApp client restoration can be slow
      // Also poll periodically to catch cases where ready event fires but listener misses it
      let timeoutResolved = false;
      
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          timeoutResolved = true;
          if (promiseResolved) {
            return; // Already resolved
          }
          console.warn(`[WhatsApp Client] Timeout waiting for ready event for session ${sessionId} (after 30s)`);
          client.removeListener('ready', readyHandler);
          client.removeListener('auth_failure', authFailureHandler);
          // Check if client is ready anyway (might have been ready before we set up listener)
          const ready = this.isClientReady(sessionId);
          if (ready) {
            console.log(`[WhatsApp Client] Client ${sessionId} is ready despite timeout (checked after timeout)`);
          }
          if (!promiseResolved) {
            promiseResolved = true;
            resolve(ready);
          }
        }, 30000); // 30 second timeout - WhatsApp client restoration can be slow
      });
      
      // Also set up a polling mechanism to check readiness periodically
      // This catches cases where the ready event fires but the listener misses it
      const pollInterval = setInterval(() => {
        if (promiseResolved || timeoutResolved) {
          clearInterval(pollInterval);
          return;
        }
        if (this.isClientReady(sessionId)) {
          console.log(`[WhatsApp Client] Client ${sessionId} became ready during polling (before timeout)`);
          clearInterval(pollInterval);
          if (readyResolve && !promiseResolved) {
            promiseResolved = true;
            client.removeListener('ready', readyHandler);
            client.removeListener('auth_failure', authFailureHandler);
            readyResolve(true);
          }
        }
      }, 1000); // Check every second
      
      const ready = await Promise.race([readyPromise, timeoutPromise]);
      
      // Clean up polling interval
      clearInterval(pollInterval);
      
      if (!ready) {
        console.warn(`[WhatsApp Client] Restored client for session ${sessionId} not ready after initialization`);
        // Final check - sometimes the client becomes ready right after the timeout
        await new Promise(resolve => setTimeout(resolve, 2000));
        const finalCheck = this.isClientReady(sessionId);
        if (finalCheck) {
          console.log(`[WhatsApp Client] Client ${sessionId} became ready after final check`);
          return true;
        }
      }
      
      return ready;
    } catch (error: any) {
      console.error(`[WhatsApp Client] ensureClient: Failed to restore client for session ${sessionId}:`, error);
      // Remove client from map if initialization failed
      this.clients.delete(sessionId);
      // If restoration fails, mark session as disconnected
      await storage.updateSession(sessionId, { status: 'disconnected' });
      return false;
    }
  }

  isClientReady(sessionId: string): boolean {
    const client = this.clients.get(sessionId);
    if (!client) {
      console.log(`[WhatsApp Client] isClientReady: No client found for session ${sessionId}`);
      return false;
    }
    
    // Check if client is in a ready state
    // The client is ready if:
    // 1. client.info exists (indicates authentication completed)
    // 2. OR we can check the internal state
    try {
      const hasInfo = client.info !== undefined;
      const hasValidInfo = hasInfo && client.info?.wid !== undefined;
      
      // Check multiple ways the client might expose its state
      const state = (client as any).state;
      const puppeteerPage = (client as any).pupPage;
      const isPageReady = puppeteerPage && !puppeteerPage.isClosed();
      
      // Client is ready if:
      // - It has valid info (most reliable indicator)
      // - OR state is explicitly 'READY' or 'CONNECTED'
      // - OR state is 'OPENING' and has info (transitioning to ready)
      const isAuthenticated = hasInfo && hasValidInfo;
      const stateReady = state === 'READY' || state === 'CONNECTED' || (state === 'OPENING' && hasInfo);
      
      const isReady = isAuthenticated || stateReady;
      
      // If client exists but not ready, check if it's in a bad state
      if (!isReady && client) {
        const clientState = (client as any).state;
        if (clientState === 'DISCONNECTED' || clientState === 'LOGGED_OUT' || clientState === 'UNPAIRED') {
          console.warn(`[WhatsApp Client] Client for session ${sessionId} is in disconnected state: ${clientState}`);
        }
      }
      
      // Only log if not ready to reduce log spam
      if (!isReady) {
        console.log(`[WhatsApp Client] isClientReady for session ${sessionId}: ${isReady}`, {
          hasInfo,
          hasValidInfo,
          infoExists: !!client.info,
          widExists: !!client.info?.wid,
          state: state || 'unknown',
          clientExists: !!client
        });
      }
      return isReady;
    } catch (error) {
      console.error(`[WhatsApp Client] Error checking client readiness:`, error);
      // Fallback: if client exists, assume it might be ready
      return !!client.info;
    }
  }
  
  // Async version that waits for client to be ready
  async waitForClientReady(sessionId: string, maxWaitMs: number = 10000): Promise<boolean> {
    // First, ensure the client exists (restore if needed)
    // Don't fail if ensureClient returns false - the client might still be initializing
    const clientExists = await this.ensureClient(sessionId);
    if (!clientExists) {
      console.log(`[WhatsApp Client] waitForClientReady: ensureClient returned false for session ${sessionId}, but will continue polling...`);
      // Don't return false immediately - the client might still be in the map and initializing
      // Check if client exists in map
      if (!this.clients.has(sessionId)) {
        console.log(`[WhatsApp Client] waitForClientReady: No client in map for session ${sessionId}`);
        return false;
      }
    }

    const startTime = Date.now();
    
    // Poll for readiness, checking every 500ms
    while (Date.now() - startTime < maxWaitMs) {
      if (this.isClientReady(sessionId)) {
        console.log(`[WhatsApp Client] waitForClientReady: Client ${sessionId} is ready after ${Date.now() - startTime}ms`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 500)); // Check every 500ms
    }
    
    // Final check
    const isReady = this.isClientReady(sessionId);
    if (isReady) {
      console.log(`[WhatsApp Client] waitForClientReady: Client ${sessionId} became ready at the end of wait period`);
    } else {
      console.log(`[WhatsApp Client] waitForClientReady: Client ${sessionId} still not ready after ${maxWaitMs}ms`);
    }
    return isReady;
  }

  onQRCode(sessionId: string, callback: (qr: string) => void): void {
    this.qrCodeCallbacks.set(sessionId, callback);
  }

  onStatusChange(sessionId: string, callback: (status: WhatsappSession['status']) => void): void {
    this.statusCallbacks.set(sessionId, callback);
  }

  onMessage(sessionId: string, callback: (message: any) => void): void {
    this.messageCallbacks.set(sessionId, callback);
  }

  onReaction(sessionId: string, callback: ReactionUpdateCallback): void {
    this.reactionCallbacks.set(sessionId, callback);
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      mpeg: 'audio/mpeg',
      ogg: 'audio/ogg',
      opus: 'audio/opus',
      wav: 'audio/wav',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}

export const whatsappManager = new WhatsAppClientManager();
