type KbFile = { fileName: string; content: string; mimeType?: string };

/** Stable fingerprint of KB + prompt so chats can reset when knowledge changes. */
export function computeKnowledgeFingerprint(
  files: KbFile[],
  customPrompt?: string | null
): string {
  const parts = [
    String(customPrompt || "").trim(),
    ...files
      .map((f) => `${f.fileName}\n${f.content}`)
      .sort((a, b) => a.localeCompare(b)),
  ];
  const raw = parts.join("\n---\n");
  // Simple non-crypto hash (fast, good enough for change detection)
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `${files.length}:${raw.length}:${hash}`;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function chunkContent(content: string, maxChunk = 1200): string[] {
  const sections = content.split(/\n---+\n|\n\n(?=[#A-Z0-9])/g).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  for (const section of sections) {
    if (section.length <= maxChunk) {
      chunks.push(section);
      continue;
    }
    let start = 0;
    while (start < section.length) {
      chunks.push(section.slice(start, start + maxChunk));
      start += maxChunk;
    }
  }
  return chunks.length ? chunks : [content];
}

function scoreChunk(chunk: string, queryTokens: string[]): number {
  if (!queryTokens.length) return 0;
  const lower = chunk.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (lower.includes(token)) score += 1;
  }
  return score / queryTokens.length;
}

/**
 * Sections that describe HOW the assistant should behave (conversation flow, rules,
 * instructions, greeting, steps). These must ALWAYS be sent to the model — never
 * dropped by keyword search — otherwise the bot ignores the flow the user wrote.
 */
const INSTRUCTION_MARKERS =
  /(conversation flow|\bflow\b|\bstep\s*\d|step[- ]by[- ]step|instruction|\brules?\b|ai behavior|behaviour|how to|always|must |should |greeting|welcome|first (ask|message|send)|booking|appointment|when the customer|if (the )?customer|reply with|ask for|guardrail|policy|important)/i;

function isInstructionChunk(chunk: string): boolean {
  const head = chunk.slice(0, 400);
  return INSTRUCTION_MARKERS.test(head) || INSTRUCTION_MARKERS.test(chunk.slice(0, 1200));
}

export function searchKnowledgeChunks(files: KbFile[], query: string, topK = 8): string[] {
  const queryTokens = tokenize(query);
  const allChunks: { text: string; score: number; fileName: string; order: number }[] = [];

  let order = 0;
  for (const file of files) {
    let content = file.content;
    if (file.mimeType === "text/faq") {
      try {
        const faqs = JSON.parse(file.content) as Array<{ question?: string; answer?: string }>;
        content = faqs.map((f) => `Q: ${f.question || ""}\nA: ${f.answer || ""}`).join("\n\n");
      } catch {
        /* use raw */
      }
    }
    for (const chunk of chunkContent(content)) {
      allChunks.push({ text: chunk, score: scoreChunk(chunk, queryTokens), fileName: file.fileName, order: order++ });
    }
  }

  // Always keep instruction/flow chunks (in original order) so behavior rules are never lost.
  const instructionChunks = allChunks.filter((c) => isInstructionChunk(c.text));
  const instructionSet = new Set(instructionChunks.map((c) => c.order));

  // Top keyword matches from the remaining (factual) chunks.
  const matched = allChunks
    .filter((c) => !instructionSet.has(c.order) && c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const combined = [...instructionChunks, ...matched];
  if (combined.length) {
    // Preserve document order for readability
    return combined.sort((a, b) => a.order - b.order).map((c) => c.text);
  }

  // Fallback: first chunks from each file when nothing matched
  return files.flatMap((f) => chunkContent(f.content).slice(0, 3)).slice(0, topK);
}

/** Approx char budget to send the WHOLE KB inline (well within gpt-4o context). */
const FULL_KB_CHAR_BUDGET = 18000;

function faqToText(file: KbFile): string {
  if (file.mimeType !== "text/faq") return file.content;
  try {
    const faqs = JSON.parse(file.content) as Array<{ question?: string; answer?: string }>;
    return faqs.map((f) => `Q: ${f.question || ""}\nA: ${f.answer || ""}`).join("\n\n");
  } catch {
    return file.content;
  }
}

export function buildKnowledgeContext(
  files: KbFile[],
  userMessage: string,
  useSearch: boolean
): string {
  if (!files.length) return "";

  const totalChars = files.reduce((sum, f) => sum + (f.content?.length || 0), 0);

  // If the KB is small (typical case), always send it in FULL so the conversation
  // flow / instructions are never dropped — regardless of the search toggle.
  if (!useSearch || totalChars <= FULL_KB_CHAR_BUDGET) {
    const full = files.map((f) => faqToText(f)).join("\n\n---\n\n");
    return (
      "\n\n--- Knowledge Base (follow these instructions and use these facts) ---\n" +
      full +
      "\n\nFollow any conversation flow, steps, or rules written above exactly. " +
      "Answer questions ONLY from this knowledge base; if something is not covered, say you don't have that information."
    );
  }

  // Large KB: keyword search, but instruction/flow chunks are always retained.
  const relevant = searchKnowledgeChunks(files, userMessage, 8);
  if (!relevant.length) {
    return (
      "\n\n--- Knowledge Base ---\n" +
      files.map((f) => faqToText(f).slice(0, 3000)).join("\n\n---\n\n")
    );
  }
  return (
    "\n\n--- Knowledge Base (follow these instructions and use these facts) ---\n" +
    relevant.join("\n\n---\n") +
    "\n\nFollow any conversation flow, steps, or rules written above exactly. " +
    "Answer questions ONLY from the knowledge above; if something is not covered, say you don't have that information."
  );
}
