import type { InfiniteData } from "@tanstack/react-query";
import type { Message } from "@shared/schema";
import { MAX_CACHED_MESSAGES_PER_CHAT, trimMessageCacheForChat } from "@/lib/message-query-cache";

export type MessagesInfiniteData = InfiniteData<Message[], MessagesCursor | undefined>;

export type MessagesCursor = { beforeAt: string; beforeId: string };

function compareMessagesChronologically(a: Message, b: Message): number {
  const ta = new Date(a.timestamp || 0).getTime();
  const tb = new Date(b.timestamp || 0).getTime();
  if (ta !== tb) return ta - tb;
  return String(a.id).localeCompare(String(b.id));
}

/** Merge infinite pages to chronological order (oldest → newest), dedupe by id. */
export function mergeMessagePages(pages: Message[][]): Message[] {
  if (!pages?.length) return [];
  const byId = new Map<string, Message>();
  for (const page of pages) {
    for (const m of page) {
      const prev = byId.get(m.id);
      byId.set(m.id, prev ? mergeMessageForCache(prev, m) : m);
    }
  }
  return Array.from(byId.values()).sort(compareMessagesChronologically);
}

function trimOldestFromPages(pages: Message[][], maxTotal: number): Message[][] {
  const out = pages.map((p) => [...p]);
  let total = mergeMessagePages(out).length;
  let pi = out.length - 1;
  while (total > maxTotal && pi >= 0) {
    if (out[pi].length === 0) {
      pi--;
      continue;
    }
    out[pi].shift();
    total--;
  }
  return out.filter((p) => p.length > 0);
}

/** Drop oldest rows across pages until under cap; trims pageParams from the end to match. */
export function trimMessagesInfiniteData(data: MessagesInfiniteData): MessagesInfiniteData {
  const pages = trimOldestFromPages(data.pages, MAX_CACHED_MESSAGES_PER_CHAT);
  const dropped = data.pages.length - pages.length;
  const pageParams =
    dropped > 0 ? data.pageParams.slice(0, data.pageParams.length - dropped) : data.pageParams;
  return { pages, pageParams };
}

export function isMessagesInfiniteData(v: unknown): v is MessagesInfiniteData {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as MessagesInfiniteData).pages) &&
    Array.isArray((v as MessagesInfiniteData).pageParams)
  );
}

/** Fields often missing on WebSocket `new_message` payloads — keep richer row when merging duplicates (race with HTTP response). */
const MESSAGE_MERGE_PRESERVE_KEYS: (keyof Message)[] = [
  "footer",
  "footerButtonType",
  "footerButtonText",
  "footerButtonUrl",
  "footerButtonPhone",
  "templateName",
  "templateLanguage",
  "templateParams",
  "templateType",
  "headerText",
  "carouselCardMediaUrls",
];

function isEmptyMergeValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

/** Merge two copies of the same message id (WS stub vs full API row). Prefer defined dense fields from either side. */
export function mergeMessageForCache(existing: Message, incoming: Message): Message {
  const out = { ...existing, ...incoming } as Record<string, unknown>;
  for (const k of MESSAGE_MERGE_PRESERVE_KEYS) {
    const ik = incoming[k];
    const ek = existing[k];
    if (isEmptyMergeValue(ik) && !isEmptyMergeValue(ek)) {
      out[k as string] = ek;
    }
  }
  return out as Message;
}

export function appendMessageToInfinite(
  old: MessagesInfiniteData | undefined,
  msg: Message
): MessagesInfiniteData {
  if (!old?.pages?.length) {
    return trimMessagesInfiniteData({
      pages: [[msg]],
      pageParams: [undefined],
    });
  }
  const pages = old.pages.map((p, i) => (i === 0 ? [...p] : [...p]));
  const head = pages[0];
  const dupIdx = head.findIndex((m) => m.id === msg.id);
  if (dupIdx >= 0) {
    head[dupIdx] = mergeMessageForCache(head[dupIdx], msg);
    head.sort(compareMessagesChronologically);
    return trimMessagesInfiniteData({ ...old, pages });
  }
  head.push(msg);
  head.sort(compareMessagesChronologically);
  return trimMessagesInfiniteData({ ...old, pages });
}

export function updateMessageInInfinite(
  old: MessagesInfiniteData | undefined,
  messageId: string,
  updater: (m: Message) => Message
): MessagesInfiniteData | undefined {
  if (!old?.pages?.length) return old;
  let hit = false;
  const pages = old.pages.map((page) =>
    page.map((m) => {
      if (m.id !== messageId) return m;
      hit = true;
      return updater(m);
    })
  );
  return hit ? { ...old, pages } : old;
}
