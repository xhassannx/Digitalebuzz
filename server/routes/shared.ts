import { storage } from "../storage";
import { isAuthenticatedOrApiKey } from "../replitAuth";
import { rateLimitMiddleware } from "../middleware/rate-limiter";
import { resolveOrganizationContext, requireOrganizationRole } from "../middleware/organization-context";
import { whatsappManager as unofficialManager } from "../whatsapp/client";
import { businessAPIManager } from "../whatsapp/business-api-client";

// Helper to get userId from either session or API key (used by routes)
export const getUserId = (req: any): string => {
  return req.user?.claims?.sub || req.userId;
};

// Helper to combine auth + rate limiting for API endpoints
export const withAuthAndRateLimit = [isAuthenticatedOrApiKey, rateLimitMiddleware];
export const withOrgContext = [isAuthenticatedOrApiKey, rateLimitMiddleware, resolveOrganizationContext];
export const withOrgAdmin = [...withOrgContext, requireOrganizationRole('owner', 'admin')];
export const withOrgOwner = [...withOrgContext, requireOrganizationRole('owner')];

// Helper to get the appropriate WhatsApp client manager based on connection type
export const getWhatsAppManager = async (sessionId: string) => {
  const session = await storage.getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  switch (session.connectionType) {
    case 'official':
      return businessAPIManager;
    case 'unofficial':
      return unofficialManager;
    default:
      throw new Error(`Unsupported connection type: ${session.connectionType}. Please use 'official' (Business API) or 'unofficial' (WhatsApp Web) connection type.`);
  }
};

// Helper function to normalize phone numbers for comparison
export const normalizePhoneNumber = (phoneNumber: string): string => {
  // Remove @c.us, @g.us suffixes and any + prefix
  return phoneNumber.replace('@c.us', '').replace('@g.us', '').replace(/^\+/, '').trim();
};

// Helper function to find or create chat and return its UUID
export const findOrCreateChat = async (sessionId: string, contactNumber: string): Promise<string> => {
  // Normalize the input phone number for comparison
  const normalizedInput = normalizePhoneNumber(contactNumber);
  
  // Check if chat exists (normalize both for comparison)
  const chats = await storage.getChatsBySession(sessionId);
  const existingChat = chats.find(c => {
    const normalizedChat = normalizePhoneNumber(c.contactNumber);
    return normalizedChat === normalizedInput;
  });
  
  if (existingChat) {
    return existingChat.id;
  }
  
  // Detect if this is a group based on WhatsApp ID format
  const isGroup = contactNumber.includes('@g.us');
  
  // Generate appropriate display name
  let contactName = contactNumber;
  if (isGroup) {
    // For groups, try to extract a readable name from the ID
    contactName = contactNumber.replace('@g.us', '').replace(/_/g, ' ');
  } else {
    // For individual contacts, just show the phone number
    contactName = contactNumber.replace('@c.us', '');
  }
  
  // First, find or create the contact (normalize for comparison)
  const existingContacts = await storage.getContactsBySession(sessionId);
  let contact = existingContacts.find(c => {
    const normalizedContact = normalizePhoneNumber(c.number);
    return normalizedContact === normalizedInput;
  });
  
  if (!contact) {
    // Ensure contactNumber has proper format for storage
    let formattedNumber = contactNumber;
    if (!isGroup && !formattedNumber.includes('@c.us') && !formattedNumber.includes('@g.us')) {
      formattedNumber = `${formattedNumber}@c.us`;
    }
    
    // Create new contact
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
  
  // Create new chat using the contact's UUID
  const newChat = await storage.createChat({
    sessionId,
    contactId: contact.id, // Use the contact's UUID, not the phone number
    contactName,
    contactNumber: formattedChatNumber,
    lastMessage: '',
    lastMessageTime: new Date(),
    unreadCount: 0,
    isGroup,
  });
  
  return newChat.id;
};
