/**
 * Bound in-memory message lists for open chats (WebSocket + optimistic sends).
 * Without a cap, long sessions cause Chrome "Aw, Snap" / STATUS_BREAKPOINT (memory).
 */
/** Hard cap for in-memory message arrays (open chat + react-query). Lower = less Chrome OOM risk. */
export const MAX_CACHED_MESSAGES_PER_CHAT = 150;

export function trimMessageCacheForChat<T>(msgs: T[] | undefined): T[] {
  if (!msgs || !Array.isArray(msgs) || msgs.length <= MAX_CACHED_MESSAGES_PER_CHAT) {
    return msgs ?? [];
  }
  return msgs.slice(-MAX_CACHED_MESSAGES_PER_CHAT);
}
