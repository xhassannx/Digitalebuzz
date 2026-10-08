import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { notifyNewMessage } from './useNotifications';
import { useAuth } from './useAuth';

// Hook to monitor chats and detect new incoming messages
// Works globally when logged in — must NOT run on marketing/landing (was: enabled for any non-/chat route → 401 spam + reload churn).
export function useMessageNotifications() {
  const { user } = useAuth();
  const [location] = useLocation();
  const isOnChatPage = typeof location === 'string' && location.startsWith('/chat');
  const pollingEnabled = !!user && !isOnChatPage;
  const previousChatsRef = useRef<Map<string, { unreadCount: number; lastMessageTime: string | null }>>(new Map());
  const notifiedMessageIds = useRef<Set<string>>(new Set());
  // Track the last message time we've notified for each chat
  const lastNotifiedTimeRef = useRef<Map<string, string>>(new Map());

  // Backup polling only when not on /chat (chat page uses WebSocket + its own session query).
  // 15s here duplicated traffic and, with fetchQuery(message) below, contributed to tab OOM.
  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ['/api/sessions'],
    enabled: pollingEnabled,
    refetchInterval: (query) => {
      if (query.state.status === "error") return false;
      if (typeof document !== "undefined" && document.hidden) return 120_000;
      return 90_000;
    },
    staleTime: 60_000,
  });

  // Get all connected sessions
  const connectedSessions = sessions.filter((s: any) => s.status === 'connected');
  
  // Get chats for all connected sessions (we'll check the first one, or combine them)
  // For simplicity, we'll monitor the first connected session's chats
  const firstConnectedSessionId = connectedSessions.length > 0 ? connectedSessions[0].sessionId : undefined;

  // Get chats data for the first connected session (backup to WebSocket; WebSocket pushes new_message/chat_updated)
  // Disable when on chat page – prevents chats/messages API calls that cause Welcome screen flash
  const { data: chats = [] } = useQuery<any[]>({
    queryKey: ['/api/chats', firstConnectedSessionId],
    enabled: pollingEnabled && !!firstConnectedSessionId,
    refetchInterval: (query) => {
      if (query.state.status === "error") return false;
      if (typeof document !== "undefined" && document.hidden) return 120_000;
      return 90_000;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!user) return;
    if (!chats || chats.length === 0) {
      if (import.meta.env.DEV) console.log('[MessageNotifications] No chats available yet');
      return;
    }

    if (!firstConnectedSessionId) {
      if (import.meta.env.DEV) console.log('[MessageNotifications] No connected session found');
      return;
    }

    if (previousChatsRef.current.size > 600) {
      previousChatsRef.current = new Map();
    }

    // Check each chat for new messages
    for (const chat of chats) {
      const chatId = chat.id;
      const currentUnreadCount = chat.unreadCount || 0;
      const currentLastMessageTime = chat.lastMessageTime;

      const previous = previousChatsRef.current.get(chatId);
      
      // If this is the first time we see this chat, just store it
      if (!previous) {
        previousChatsRef.current.set(chatId, {
          unreadCount: currentUnreadCount,
          lastMessageTime: currentLastMessageTime,
        });
        continue;
      }

      // Check if unread count increased (new message arrived)
      const unreadIncreased = currentUnreadCount > previous.unreadCount;
      
      // Check if last message time changed (new message)
      const lastMessageChanged = currentLastMessageTime && 
        currentLastMessageTime !== previous.lastMessageTime &&
        new Date(currentLastMessageTime) > new Date(previous.lastMessageTime || 0);
      
      // Check if the last message is very recent (within last 15 seconds) - indicates a new message
      // This catches messages even if unreadCount is 0 (user might have viewed quickly)
      // If unread count increased OR last message time changed (new message), fetch the latest message
      // We notify for every new message, even if unreadCount is 0 (user might have viewed it quickly)
      // This ensures notifications show for every new message, not just when unreadCount increases
      if (unreadIncreased || lastMessageChanged) {
        // Check if we've already notified for this exact lastMessageTime
        const lastNotifiedTime = lastNotifiedTimeRef.current.get(chatId);
        if (currentLastMessageTime && lastNotifiedTime === currentLastMessageTime) {
          if (import.meta.env.DEV) {
            console.log('[MessageNotifications] Already notified for this lastMessageTime:', currentLastMessageTime);
          }
          previousChatsRef.current.set(chatId, {
            unreadCount: currentUnreadCount,
            lastMessageTime: currentLastMessageTime,
          });
          continue;
        }

        if (import.meta.env.DEV) console.log('[MessageNotifications] New message detected', {
          chatId,
          contactName: chat.contactName,
          unreadCount: currentUnreadCount,
          lastMessageTime: currentLastMessageTime,
          lastNotifiedTime
        });

        // One-off fetch only — never queryClient.fetchQuery (that cached up to 100 msgs × N chats → OOM).
        void (async () => {
          try {
            const res = await apiRequest('GET', `/api/messages/${chatId}?limit=12`);
            const messages = await res.json();
            if (!messages || !Array.isArray(messages) || messages.length === 0) return;

            const latestIncoming = messages
              .filter((m: any) => !m.fromMe)
              .sort(
                (a: any, b: any) =>
                  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              )[0];

            if (!latestIncoming) return;
            if (latestIncoming.type === 'reaction') {
              if (import.meta.env.DEV) {
                console.log('[MessageNotifications] Skipping notification for reaction-only message:', latestIncoming.id);
              }
              return;
            }

            const messageTime = latestIncoming.timestamp ? new Date(latestIncoming.timestamp).getTime() : 0;
            const isRecent = messageTime > 0 && Date.now() - messageTime < 120000;
            if (!isRecent) {
              if (import.meta.env.DEV) {
                console.log('[MessageNotifications] Skipping notification – latest message not recent.');
              }
              return;
            }

            const shouldNotify =
              !currentLastMessageTime || currentLastMessageTime !== lastNotifiedTime;

            if (shouldNotify) {
              if (currentLastMessageTime) {
                lastNotifiedTimeRef.current.set(chatId, currentLastMessageTime);
              }

              const messageKey = `${chatId}-${latestIncoming.id}-${latestIncoming.timestamp}`;
              notifiedMessageIds.current.add(messageKey);

              if (import.meta.env.DEV) {
                console.log('[MessageNotifications] Triggering notification', {
                  messageId: latestIncoming.id,
                  timestamp: latestIncoming.timestamp,
                  senderName: chat.contactName,
                });
              }

              notifyNewMessage({
                fromMe: false,
                body: latestIncoming.body || latestIncoming.caption || '[Media]',
                senderName: chat.contactName || latestIncoming.senderName || 'Unknown',
                chatId,
              });

              if (notifiedMessageIds.current.size > 200) {
                const idsArray = Array.from(notifiedMessageIds.current);
                notifiedMessageIds.current = new Set(idsArray.slice(-100));
              }
            }
          } catch (err: any) {
            if (err?.name === 'CancelledError' || err?.message?.includes('Cancelled')) return;
            console.error('[MessageNotifications] Error fetching message preview:', err);
          }
        })();
      }

      // Update previous state
      previousChatsRef.current.set(chatId, {
        unreadCount: currentUnreadCount,
        lastMessageTime: currentLastMessageTime,
      });
    }
  }, [user, chats, firstConnectedSessionId]);
}
