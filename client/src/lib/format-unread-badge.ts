/** WhatsApp-style unread badge label (exact count up to 9, then 9+, 99+). */
export function formatUnreadBadgeLabel(count: number): string {
  if (count <= 0) return "";
  if (count > 99) return "99+";
  if (count > 9) return "9+";
  return String(count);
}
