/** Extract plain text from PDF buffer (server-side, pdfjs-dist) */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => (typeof item.str === "string" ? item.str : ""))
      .join(" ");
    parts.push(text);
  }
  return parts.join("\n\n").trim();
}

/** Strip HTML to plain text for web-crawled KB */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchUrlAsPlainText(url: string, maxBytes = 512_000): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Helicoptic-KB-Crawler/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Failed to fetch URL (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error("Page too large (max 512KB)");
  const contentType = res.headers.get("content-type") || "";
  const text = buf.toString("utf-8");
  if (contentType.includes("html")) return htmlToPlainText(text);
  return text.trim();
}
