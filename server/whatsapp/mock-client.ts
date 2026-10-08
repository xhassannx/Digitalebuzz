import QRCode from 'qrcode';
import { storage } from '../storage';
import type { WhatsappSession } from '@shared/schema';

export class MockWhatsAppClientManager {
  private sessions: Map<string, any>;
  private qrCodeCallbacks: Map<string, (qr: string) => void>;
  private statusCallbacks: Map<string, (status: WhatsappSession['status']) => void>;
  private messageCallbacks: Map<string, (message: any) => void>;

  constructor() {
    this.sessions = new Map();
    this.qrCodeCallbacks = new Map();
    this.statusCallbacks = new Map();
    this.messageCallbacks = new Map();
  }

  async createSession(sessionId: string): Promise<void> {
    if (this.sessions.has(sessionId)) {
      throw new Error('Session already exists');
    }

    const mockSession = {
      sessionId,
      status: 'qr',
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, mockSession);

    // Generate a mock QR code
    const mockQRData = `https://wa.me/mock-session-${sessionId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(mockQRData);
    
    await storage.updateSession(sessionId, {
      status: 'qr',
      qrCode: qrCodeDataUrl,
    });

    const qrCallback = this.qrCodeCallbacks.get(sessionId);
    if (qrCallback) qrCallback(qrCodeDataUrl);

    // Simulate connection after 3 seconds (auto-scan QR for demo)
    setTimeout(async () => {
      await this.simulateConnection(sessionId);
    }, 3000);
  }

  private async simulateConnection(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'connected';
    session.deviceInfo = {
      platform: 'Mock WhatsApp Web',
      phoneNumber: '+1-555-DEMO-' + Math.floor(Math.random() * 10000),
      name: 'Demo Device',
    };

    await storage.updateSession(sessionId, {
      status: 'connected',
      deviceInfo: session.deviceInfo,
      qrCode: undefined,
    });

    const statusCallback = this.statusCallbacks.get(sessionId);
    if (statusCallback) statusCallback('connected');

    console.log(`Mock session ${sessionId} connected`);
  }

  async disconnectSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    this.sessions.delete(sessionId);
    this.qrCodeCallbacks.delete(sessionId);
    this.statusCallbacks.delete(sessionId);
    this.messageCallbacks.delete(sessionId);

    await storage.updateSession(sessionId, {
      status: 'disconnected',
      qrCode: undefined,
    });
  }

  async sendTextMessage(sessionId: string, to: string, message: string, _options?: { replyToWhatsAppMessageId?: string }): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    // Simulate message sending
    const messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    console.log(`[MOCK] Sending text message to ${to}: ${message}`);

    return {
      id: messageId,
      timestamp: new Date(),
      status: 'sent',
    };
  }

  async sendLocationMessage(
    sessionId: string,
    to: string,
    latitude: number,
    longitude: number,
    address?: string
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    // Simulate location message sending
    const messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    console.log(`[MOCK] Sending location to ${to}: ${latitude}, ${longitude} ${address ? `(${address})` : ''}`);

    return {
      id: messageId,
      timestamp: new Date(),
      status: 'sent',
    };
  }

  async sendContactMessage(
    sessionId: string,
    to: string,
    name: string,
    phone: string,
    email?: string
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    // Simulate contact message sending (vCard)
    const messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    console.log(`[MOCK] Sending contact to ${to}: ${name} (${phone}${email ? `, ${email}` : ''})`);

    return {
      id: messageId,
      timestamp: new Date(),
      status: 'sent',
    };
  }

  async sendMediaMessage(
    sessionId: string,
    to: string,
    media: Buffer,
    fileName: string,
    caption?: string
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    console.log(`[MOCK] Sending media to ${to}: ${fileName} (${media.length} bytes)${caption ? ` - ${caption}` : ''}`);

    return {
      id: messageId,
      timestamp: new Date(),
      status: 'sent',
    };
  }

  async getChats(sessionId: string): Promise<any[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Return mock chats - in real app, this would fetch from WhatsApp
    return [
      {
        id: 'mock_chat_1@c.us',
        name: 'Demo Contact 1',
        number: '15551234567',
        unreadCount: 0,
        lastMessage: 'This is a mock chat for demo purposes',
        lastMessageTime: new Date(),
        isGroup: false,
      },
      {
        id: 'mock_chat_2@c.us',
        name: 'Demo Contact 2',
        number: '15559876543',
        unreadCount: 2,
        lastMessage: 'Mock message received',
        lastMessageTime: new Date(Date.now() - 3600000),
        isGroup: false,
      },
      {
        id: 'mock_group_1@g.us',
        name: 'Project Team',
        number: 'mock_group_1@g.us',
        unreadCount: 5,
        lastMessage: 'Meeting at 3 PM',
        lastMessageTime: new Date(Date.now() - 7200000),
        isGroup: true,
      },
      {
        id: 'mock_group_2@g.us',
        name: 'Family Chat',
        number: 'mock_group_2@g.us',
        unreadCount: 0,
        lastMessage: 'See you tomorrow!',
        lastMessageTime: new Date(Date.now() - 86400000),
        isGroup: true,
      },
    ];
  }

  async getContacts(sessionId: string): Promise<any[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Return mock contacts
    return [
      {
        id: 'mock_contact_1@c.us',
        name: 'Demo Contact 1',
        number: '15551234567',
        isGroup: false,
      },
      {
        id: 'mock_contact_2@c.us',
        name: 'Demo Contact 2',
        number: '15559876543',
        isGroup: false,
      },
      {
        id: 'mock_contact_3@c.us',
        name: 'Test User',
        number: '15555555555',
        isGroup: false,
      },
    ];
  }

  async getGroups(sessionId: string): Promise<any[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Return mock groups
    return [
      {
        id: 'mock_group_1@g.us',
        name: 'Project Team',
        number: 'mock_group_1@g.us',
        participantCount: 8,
        isGroup: true,
      },
      {
        id: 'mock_group_2@g.us',
        name: 'Family Chat',
        number: 'mock_group_2@g.us',
        participantCount: 5,
        isGroup: true,
      },
      {
        id: 'mock_group_3@g.us',
        name: 'Office Announcements',
        number: 'mock_group_3@g.us',
        participantCount: 24,
        isGroup: true,
      },
    ];
  }

  getClient(sessionId: string): any | undefined {
    return this.sessions.get(sessionId);
  }

  isClientReady(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session ? session.status === 'connected' : false;
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

  // Helper method to simulate receiving a message (for testing)
  async simulateIncomingMessage(sessionId: string, from: string, body: string): Promise<void> {
    const callback = this.messageCallbacks.get(sessionId);
    if (callback) {
      callback({
        sessionId,
        chatId: from,
        body,
        fromMe: false,
        type: 'text',
        timestamp: new Date(),
        senderName: 'Mock Sender',
        senderNumber: from,
        hasMedia: false,
      });
    }
  }
}

export const mockWhatsappManager = new MockWhatsAppClientManager();
