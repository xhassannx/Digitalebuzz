// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { apiRequest, queryClient } from './queryClient';
import { useAuth } from '../hooks/useAuth';
import { notifyNewMessage } from '../hooks/useNotifications';
import { trimMessageCacheForChat } from './message-query-cache';
import {
  appendMessageToInfinite,
  isMessagesInfiniteData,
  mergeMessagePages,
  trimMessagesInfiniteData,
  updateMessageInInfinite,
} from './messages-infinite-cache';

/** Small fetch for desktop notifications only — must NOT use react-query cache (avoids OOM from caching 200 msgs per chat). */
const MESSAGE_PREVIEW_LIMIT = 12;

function findChatInPanelCache(chatId: string): { contactName?: string; lastMessage?: string } | undefined {
  const entries = queryClient.getQueriesData<any[]>({ queryKey: ['/api/chats'], exact: false });
  for (const [, data] of entries) {
    if (!Array.isArray(data)) continue;
    const c = data.find((x: any) => x.id === chatId);
    if (c) return { contactName: c.contactName, lastMessage: c.lastMessage };
  }
  return undefined;
}

/** Batched contacts refresh — every incoming message was invalidating+refetching /api/contacts (very expensive). */
let contactsRefreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleThrottledContactsRefresh() {
  if (contactsRefreshTimer != null) return;
  contactsRefreshTimer = setTimeout(() => {
    contactsRefreshTimer = null;
    // Invalidate only — refetchQueries duplicated network work when contacts query is already active
    queryClient.invalidateQueries({ queryKey: ['/api/contacts'], refetchType: 'active' });
    queryClient.invalidateQueries({ queryKey: ['/api/contacts/inbox-index'], refetchType: 'active' });
  }, 5000);
}

function phonesMatchDigits(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.endsWith(b) || b.endsWith(a);
}

/** Resolve WebSocket URL. For white-label: use VITE_WS_URL or derive from VITE_BASE_URL so WS hits API server. */
function getWebSocketUrl(): string {
  const explicit = import.meta.env?.VITE_WS_URL;
  if (typeof explicit === 'string' && explicit.trim()) {
    const url = explicit.trim();
    if (url.startsWith('ws')) return url.endsWith('/ws') ? url : `${url.replace(/\/$/, '')}/ws`;
    const base = url.replace(/\/$/, '');
    const wsBase = base.startsWith('https') ? base.replace(/^https/, 'wss') : base.startsWith('http') ? base.replace(/^http/, 'ws') : `wss://${base}`;
    return `${wsBase}/ws`;
  }
  const apiBase = import.meta.env?.VITE_BASE_URL;
  if (typeof apiBase === 'string' && apiBase.trim()) {
    const base = apiBase.trim().replace(/\/$/, '');
    const wsBase = base.startsWith('https') ? base.replace(/^https/, 'wss') : base.startsWith('http') ? base.replace(/^http/, 'ws') : `wss://${base}`;
    return `${wsBase}/ws`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  let host = window.location.host;
  if (!host || host.includes('undefined') || host === 'localhost' || host === 'localhost:') {
    const port = window.location.port;
    const defaultPort = protocol === 'wss:' ? '443' : '5002';
    host = `${window.location.hostname || 'localhost'}:${port && port !== '80' && port !== '443' ? port : defaultPort}`;
  }
  return `${protocol}//${host}/ws`;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptRef = useRef(0);
  const previousUnreadCounts = useRef<Map<string, number>>(new Map());
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const connect = () => {
      const wsUrl = getWebSocketUrl();
      if (import.meta.env.DEV) {
        console.log('[WebSocket] Connecting to:', wsUrl);
      }
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setIsConnected(true);
      };

      ws.onclose = () => {
        setIsConnected(false);
        const delay = Math.min(2000 * Math.pow(2, reconnectAttemptRef.current), 60_000);
        reconnectAttemptRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { event: eventType, data } = message;

          if (import.meta.env.DEV) {
            if (eventType === 'new_message') {
              console.log('%c[WebSocket] new_message', 'color: #FF9800; font-weight: bold;', data);
            } else {
              console.log('[WebSocket]', eventType, data);
            }
          }

          switch (eventType) {
            case 'qr_update':
              if (import.meta.env.DEV) {
                console.log('[WebSocket] qr_update', data.sessionId, 'qr len', data.qrCode?.length);
              }
              queryClient.setQueryData<Array<any>>(['/api/sessions'], (oldData) => {
                if (!oldData) {
                  queryClient.refetchQueries({ queryKey: ['/api/sessions'] });
                  return oldData;
                }
                const sessionExists = oldData.some((s: any) => s.sessionId === data.sessionId);
                if (!sessionExists) {
                  queryClient.refetchQueries({ queryKey: ['/api/sessions'] });
                  return oldData;
                }
                return oldData.map((session: any) =>
                  session.sessionId === data.sessionId
                    ? { ...session, qrCode: data.qrCode, status: 'qr' }
                    : session
                );
              });
              break;
            
            case 'session_status':
              // Optimistically update the sessions query cache with the new status
              queryClient.setQueryData<Array<any>>(['/api/sessions'], (oldData) => {
                if (!oldData) return oldData;
                return oldData.map((session: any) => 
                  session.sessionId === data.sessionId
                    ? { ...session, status: data.status }
                    : session
                );
              });
              queryClient.invalidateQueries({ queryKey: ['/api/integrations/whatsapp-business/added-phones'] });
              break;
            
            case 'new_message': {
              // Ignore reaction-only messages (reactions are applied to the target message via message_updated)
              const type = data?.type ?? 'text';
              if (type === 'reaction') {
                if (import.meta.env.DEV) {
                  console.log('[WebSocket] Ignoring reaction-only new_message:', { id: data?.id });
                }
                break;
              }

              const chatId = data?.chatId ?? data?.chat_id;
              if (chatId && data?.id) {
                // Keep full server payload (template/footer/button fields). Older code whitelisted fields and stripped Copy code / template metadata.
                const d = data as Record<string, any>;
                const msg = {
                  ...d,
                  id: d.id,
                  chatId,
                  body: d.body ?? '',
                  fromMe: d.fromMe ?? d.from_me ?? false,
                  timestamp: d.timestamp ?? d.sentAt ?? d.sent_at ?? new Date().toISOString(),
                  type: d.type ?? 'text',
                  status: d.status ?? 'sent',
                  senderName: d.senderName ?? d.sender_name,
                  senderNumber: d.senderNumber ?? d.sender_number,
                  mediaUrl: d.mediaUrl ?? d.media_url,
                  whatsappMessageId: d.whatsappMessageId ?? d.whatsapp_message_id,
                  caption: d.caption,
                  replyToMessageId: d.replyToMessageId ?? d.reply_to_message_id,
                  quotedBody: d.quotedBody ?? d.quoted_body,
                  quotedFromMe: d.quotedFromMe ?? d.quoted_from_me,
                  footer: d.footer,
                  footerButtonType: d.footerButtonType ?? d.footer_button_type,
                  footerButtonText: d.footerButtonText ?? d.footer_button_text,
                  footerButtonUrl: d.footerButtonUrl ?? d.footer_button_url,
                  footerButtonPhone: d.footerButtonPhone ?? d.footer_button_phone,
                  templateName: d.templateName ?? d.template_name,
                  templateLanguage: d.templateLanguage ?? d.template_language,
                  templateParams: d.templateParams ?? d.template_params,
                  templateType: d.templateType ?? d.template_type,
                  headerText: d.headerText ?? d.header_text,
                  carouselCardMediaUrls: d.carouselCardMediaUrls ?? d.carousel_card_media_urls,
                } as any;

                // 1) Add message to cache instantly so it appears in the open chat without delay
                queryClient.setQueryData<any>(['/api/messages', chatId], (oldData) => {
                  if (isMessagesInfiniteData(oldData)) {
                    return appendMessageToInfinite(oldData, msg) as any;
                  }
                  // useInfiniteQuery requires { pages, pageParams }; plain arrays crash getOptimisticResult (.pages.length).
                  const flat = Array.isArray(oldData) ? oldData : [];
                  if (!flat.length) {
                    return trimMessagesInfiniteData({
                      pages: [[msg]],
                      pageParams: [undefined],
                    }) as any;
                  }
                  if (flat.some((m: any) => m.id === msg.id)) {
                    return trimMessagesInfiniteData({
                      pages: [trimMessageCacheForChat(flat)],
                      pageParams: [undefined],
                    }) as any;
                  }
                  const next = [...flat, msg].sort(
                    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  );
                  return trimMessagesInfiniteData({
                    pages: [trimMessageCacheForChat(next)],
                    pageParams: [undefined],
                  }) as any;
                });

                // 2) Update chats list cache so sidebar shows new last message and unread instantly
                let chatWasInCache = false;
                queryClient.setQueriesData<Array<any>>(
                  { queryKey: ['/api/chats'] },
                  (oldData) => {
                    if (!oldData || !Array.isArray(oldData)) return oldData;
                    const chat = oldData.find((c: any) => c.id === chatId);
                    if (!chat) return oldData;
                    chatWasInCache = true;
                    const lastMessage = msg.body && msg.body.trim() ? msg.body : (msg.caption || '[Media]');
                    const updatedChat = {
                      ...chat,
                      lastMessage: lastMessage.substring(0, 200),
                      lastMessageTime: msg.timestamp,
                      unreadCount: (chat.unreadCount ?? 0) + (msg.fromMe ? 0 : 1),
                    };
                    const rest = oldData.filter((c: any) => c.id !== chatId);
                    const byTime = (a: any, b: any) =>
                      new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime();
                    return [updatedChat, ...rest].sort(byTime);
                  }
                );
                // If this was a new chat (not in cache), refetch chats and contacts so they appear without manual sync
                if (!chatWasInCache && data && !(data.fromMe ?? data.from_me)) {
                  queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
                  scheduleThrottledContactsRefresh();
                }
              } else {
                // Do not invalidate ['/api/messages'] — that refetches every chat's message list and can OOM the tab.
                if (import.meta.env.DEV) {
                  console.warn('[WebSocket] new_message missing chatId or id; skipped cache update');
                }
              }

              if (data && !(data.fromMe ?? data.from_me)) {
                scheduleThrottledContactsRefresh();
              }

              // Show notification for incoming messages
              if (data && !(data.fromMe ?? data.from_me)) {
                if (import.meta.env.DEV) {
                  console.log('[WebSocket] notify incoming:', {
                    senderName: data.senderName,
                    body: data.body?.substring(0, 50),
                    chatId: data.chatId,
                  });
                }
                notifyNewMessage(data);
              }
              break;
            }
            
            case 'chat_updated':
              if (import.meta.env.DEV) console.log('[WebSocket] chat_updated', data);

              // Check if unreadCount increased (indicates new incoming message)
              if (data.chatId && typeof data.unreadCount === 'number') {
                // Prune map if it grows too large (prevents "Out of Memory" / Aw Snap)
                if (previousUnreadCounts.current.size > 500) {
                  const entries = Array.from(previousUnreadCounts.current.entries()).slice(-250);
                  previousUnreadCounts.current = new Map(entries);
                }
                const previousCount = previousUnreadCounts.current.get(data.chatId) || 0;
                const currentCount = data.unreadCount;

                // If unread count increased, fetch chat and latest message to show notification
                if (currentCount > previousCount && currentCount > 0) {
                  scheduleThrottledContactsRefresh();

                  // One-off API calls only — never queryClient.fetchQuery for full message history (default limit 200 × N chats = OOM).
                  void (async () => {
                    try {
                      const cached = findChatInPanelCache(data.chatId);
                      const res = await apiRequest(
                        'GET',
                        `/api/messages/${data.chatId}?limit=${MESSAGE_PREVIEW_LIMIT}`
                      );
                      const messages = await res.json();
                      if (!Array.isArray(messages) || messages.length === 0) {
                        notifyNewMessage({
                          fromMe: false,
                          body: cached?.lastMessage || '[New message]',
                          senderName: cached?.contactName || 'Unknown',
                          chatId: data.chatId,
                        });
                        return;
                      }
                      const latestIncoming = messages
                        .filter((m: any) => !m.fromMe)
                        .sort(
                          (a: any, b: any) =>
                            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                        )[0];
                      if (import.meta.env.DEV) {
                        console.log('[WebSocket] notify from chat_updated:', {
                          senderName: cached?.contactName,
                          chatId: data.chatId,
                        });
                      }
                      notifyNewMessage({
                        fromMe: false,
                        body:
                          latestIncoming?.body ||
                          latestIncoming?.caption ||
                          cached?.lastMessage ||
                          '[Media]',
                        senderName:
                          cached?.contactName ||
                          latestIncoming?.senderName ||
                          'Unknown',
                        chatId: data.chatId,
                      });
                    } catch (err) {
                      console.error('[WebSocket] Error fetching preview for chat_updated notification:', err);
                    }
                  })();
                }
                
                // Update previous count
                previousUnreadCounts.current.set(data.chatId, currentCount);
              }
              
              // Update chat in cache instead of invalidating – prevents refetch that can clear selected chat
              if (data.chatId != null && typeof data.unreadCount === 'number') {
                queryClient.setQueriesData<Array<any>>(
                  { queryKey: ['/api/chats'] },
                  (oldData) => {
                    if (!oldData || !Array.isArray(oldData)) return oldData;
                    const chat = oldData.find((c: any) => c.id === data.chatId);
                    if (!chat) return oldData;
                    const updated = { ...chat, unreadCount: data.unreadCount };
                    return oldData.map((c: any) => (c.id === data.chatId ? updated : c));
                  }
                );
              }
              // Don't invalidate on malformed chat_updated – it causes the view to switch to Welcome screen
              break;

            case 'contact_optin_updated': {
              const digits = String(data?.phoneNumber ?? '').replace(/\D/g, '');
              const optIn = data?.optIn === true || data?.optIn === 'true' ? 'true' : 'false';
              if (!digits) break;
              queryClient.setQueryData<Array<any>>(['/api/contacts/inbox-index'], (old) => {
                if (!Array.isArray(old)) return old;
                let found = false;
                const updated = old.map((c) => {
                  const cDigits = String(c.phoneNumber || '').replace(/\D/g, '');
                  if (phonesMatchDigits(cDigits, digits)) {
                    found = true;
                    return {
                      ...c,
                      customFields: { ...(c.customFields || {}), optIn },
                    };
                  }
                  return c;
                });
                if (!found && data?.contactId) {
                  updated.push({
                    id: data.contactId,
                    phoneNumber: digits,
                    name: digits,
                    customFields: { optIn },
                    tags: [],
                    source: 'whatsapp',
                  });
                }
                return updated;
              });
              break;
            }
            
            case 'message_updated':
              // Reaction or other update: merge updated message into cache (ensure reactions show)
              if (data.chatId && data.message) {
                const msg = data.message as any;
                const reactions = msg.reactions ?? (msg as any).reactions;
                if (import.meta.env.DEV && Array.isArray(reactions) && reactions.length > 0) {
                  console.log('[WebSocket] message_updated (reaction):', { messageId: msg.id, chatId: data.chatId, reactions });
                }
                queryClient.setQueryData<any>(['/api/messages', data.chatId], (oldData) => {
                  if (isMessagesInfiniteData(oldData)) {
                    const next = updateMessageInInfinite(oldData, msg.id, (m) => ({
                      ...m,
                      ...msg,
                      reactions: reactions ?? m.reactions,
                    }));
                    return next ?? oldData;
                  }
                  if (!oldData || !Array.isArray(oldData)) return oldData;
                  const next = oldData.map((m: any) =>
                    m.id === msg.id
                      ? { ...m, ...msg, reactions: reactions ?? m.reactions }
                      : m
                  );
                  return trimMessagesInfiniteData({
                    pages: [trimMessageCacheForChat(next)],
                    pageParams: [undefined],
                  }) as any;
                });
              }
              break;

            case 'message_status':
            case 'message_status_update':
              // Update specific message status in cache if messageId is provided
              if (data.messageId && data.status) {
                if (import.meta.env.DEV) {
                  console.log('[WebSocket] message status', data.messageId, data.status);
                }

                // Single pass — duplicate setQueryData + getAll().forEach was doing 2× work per delivery receipt (main-thread jank).
                queryClient.setQueriesData<any>(
                  { queryKey: ['/api/messages'] },
                  (oldData) => {
                    if (isMessagesInfiniteData(oldData)) {
                      const merged = mergeMessagePages(oldData.pages);
                      if (!merged.some((msg: any) => msg.id === data.messageId)) return oldData;
                      const next = updateMessageInInfinite(oldData, data.messageId, (m) => ({
                        ...m,
                        status: data.status,
                      }));
                      return next ?? oldData;
                    }
                    if (!oldData || !Array.isArray(oldData)) return oldData;
                    const hasUpdate = oldData.some((msg: any) => msg.id === data.messageId);
                    if (!hasUpdate) {
                      return trimMessagesInfiniteData({
                        pages: [trimMessageCacheForChat(oldData)],
                        pageParams: [undefined],
                      }) as any;
                    }
                    const mapped = oldData.map((msg: any) =>
                      msg.id === data.messageId ? { ...msg, status: data.status } : msg
                    );
                    return trimMessagesInfiniteData({
                      pages: [trimMessageCacheForChat(mapped)],
                      pageParams: [undefined],
                    }) as any;
                  }
                );
              } else {
                if (import.meta.env.DEV) {
                  console.warn('[WebSocket] message_status without messageId; skipped (avoid invalidating all /api/messages)');
                }
              }
              // Don't invalidate chats – it causes the view to switch to Welcome screen when user is in a chat
              break;
            
            case 'message_sync_complete':
              // Refetch only mounted queries — avoid marking every cached chat/messages query stale at once
              queryClient.invalidateQueries({
                queryKey: ['/api/chats'],
                refetchType: 'active',
              });
              queryClient.invalidateQueries({
                queryKey: ['/api/messages'],
                refetchType: 'active',
              });
              // Dispatch custom event to notify components
              window.dispatchEvent(new CustomEvent('messageSyncComplete', { detail: data }));
              break;
            
            case 'message_sync_error':
              // Dispatch custom event to notify components
              window.dispatchEvent(new CustomEvent('messageSyncError', { detail: data }));
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user]); // Re-connect if user changes

  return { isConnected, ws: wsRef.current };
}
