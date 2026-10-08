const DRAFT_PREFIX = "chat-draft:";

export function getChatDraft(chatId: string | undefined): string {
  if (!chatId) return "";
  try {
    return sessionStorage.getItem(`${DRAFT_PREFIX}${chatId}`) ?? "";
  } catch {
    return "";
  }
}

export function setChatDraft(chatId: string | undefined, text: string): void {
  if (!chatId) return;
  try {
    const key = `${DRAFT_PREFIX}${chatId}`;
    if (!text) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, text);
  } catch {
    // ignore quota / private mode
  }
}

export function clearChatDraft(chatId: string | undefined): void {
  setChatDraft(chatId, "");
}
