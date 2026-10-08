/** Append a {{variable}} snippet into a text/JSON field (space-separated). */
export function appendFlowVariable(current: string, snippet: string): string {
  const s = snippet.trim();
  if (!s) return current;
  const c = current.trim();
  return c ? `${c} ${s}` : s;
}
