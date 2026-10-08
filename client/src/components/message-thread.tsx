// @ts-nocheck
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Message } from "@shared/schema";
import { format, isToday, isYesterday } from "date-fns";
import { getPastelColorForName, cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, rewritePanelMediaUrlToCurrentOrigin } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  MessageThreadRowsContext,
  MessageThreadVirtualRow,
  messageThreadGetInitials,
  type MessageThreadRowsContextValue,
  type OpenMediaPopupState,
} from "./message-thread-virtual-row";
import { estimateMessageRowHeight } from "./message-thread-internals";

// Limit cached blob URLs to prevent "Aw, Snap!" / out-of-memory (Chrome Error 5)
const MAX_CACHED_IMAGES = 12;
const MAX_AUTO_LOAD_IMAGES = 8;
const MAX_CONCURRENT_IMAGE_LOADS = 2;
const AUTO_LOAD_DEBOUNCE_MS = 1000;
/** Below this count, render a normal list (avoids virtual row overlap on short/medium threads). */
const VIRTUAL_ROW_THRESHOLD = 80;

function MeasuredVirtualRow({
  vi,
  virtualizer,
  children,
}: {
  vi: VirtualItem;
  virtualizer: ReturnType<typeof useVirtualizer<HTMLElement, Element>>;
  children: ReactNode;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      elRef.current = node;
      virtualizer.measureElement(node);
    },
    [virtualizer]
  );

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    virtualizer.measureElement(el);
    const raf = requestAnimationFrame(() => {
      virtualizer.measureElement(el);
    });
    const ro = new ResizeObserver(() => {
      virtualizer.measureElement(el);
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [virtualizer, vi.index]);

  return (
    <div
      ref={setRef}
      data-index={vi.index}
      className="absolute left-0 top-0 w-full overflow-visible"
      style={{ transform: `translateY(${vi.start}px)`, minHeight: vi.size }}
    >
      {children}
    </div>
  );
}

type MessageFlatRow =
  | { type: "divider"; id: string; label: string }
  | { type: "message"; message: Message };

function MessageThreadRowContent({ row }: { row: MessageFlatRow }) {
  if (row.type === "divider") {
    return (
      <div className="flex justify-center py-3">
        <div className="bg-[#ffffff] text-[#54656f] px-3 py-1 rounded-full text-xs font-medium shadow-sm">
          {row.label}
        </div>
      </div>
    );
  }
  return (
    <div className="pb-4 pt-1">
      <MessageThreadVirtualRow message={row.message} />
    </div>
  );
}

interface MessageThreadProps {
  messages: Message[];
  /** True while switching chats / fetching the first page for the selected thread */
  isLoadingThread?: boolean;
  templates?: any[];
  contactName: string;
  contactProfilePic?: string;
  sessionId?: string; // Add sessionId for media URL resolution
  chatId?: string; // Add chatId to detect when chat changes
  onReply?: (message: Message) => void;
  onReact?: (message: Message, emoji: string) => void;
  hasMoreOlder?: boolean;
  isFetchingOlder?: boolean;
  fetchOlderMessages?: () => void | Promise<void>;
}

export function MessageThread({
  messages,
  isLoadingThread = false,
  templates = [],
  contactName,
  contactProfilePic,
  sessionId,
  chatId,
  onReply,
  onReact,
  hasMoreOlder = false,
  isFetchingOlder = false,
  fetchOlderMessages,
}: MessageThreadProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const lastChatId = useRef<string | undefined>(chatId);
  const wasAtBottomRef = useRef(true); // Only auto-scroll when user was viewing latest messages
  const { toast } = useToast();
  
  // Track downloaded images by message ID
  const [downloadedImages, setDownloadedImages] = useState<Record<string, string>>({});
  const [downloadingImages, setDownloadingImages] = useState<Set<string>>(new Set());
  const downloadedImagesRef = useRef<Record<string, string>>({});
  const downloadingImagesRef = useRef<Set<string>>(new Set());
  downloadedImagesRef.current = downloadedImages;
  downloadingImagesRef.current = downloadingImages;

  // Ref to track blob URLs for synchronous cleanup (prevents memory leaks / Chrome Error 5)
  const blobUrlsRef = useRef<Map<string, string>>(new Map());
  const loadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const processedMessageIdsRef = useRef<Set<string>>(new Set()); // Track processed messages to avoid re-processing
  const autoLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map()); // Track fetch requests for cancellation
  
  // Track which image or video is open in popup
  const [openMediaPopup, setOpenMediaPopup] = useState<OpenMediaPopupState>(null);
  const [carouselCardIndexByMessageId, setCarouselCardIndexByMessageId] = useState<Record<string, number>>({});
  const isVideoMediaUrl = useCallback(
    (url: string, msg?: Message) =>
      /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url) || url.includes("/video/") || msg?.templateType === "VIDEO",
    []
  );

  const normalizeTemplateKey = useCallback((value: string) => value.toLowerCase().replace(/[^a-z0-9_]/g, "_"), []);

  const getTemplateForMessage = useCallback(
    (message: Message) => {
      if (!message.templateName) return null;
      return (
        templates.find((t: any) => {
          if (!t?.name) return false;
          return (
            t.name === message.templateName ||
            normalizeTemplateKey(t.name) === normalizeTemplateKey(message.templateName || "")
          );
        }) || null
      );
    },
    [templates, normalizeTemplateKey]
  );

  // Reset initial mount flag when chat changes and cleanup blob URLs
  useEffect(() => {
    if (lastChatId.current !== chatId) {
      isInitialMount.current = true;
      wasAtBottomRef.current = true;
      // Cancel all in-flight requests
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();
      // Clear processed message IDs
      processedMessageIdsRef.current.clear();
      // Revoke all blob URLs from previous chat (ref + state so nothing is missed)
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
      setDownloadedImages((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        return {};
      });
      lastChatId.current = chatId;
    }
  }, [chatId]);

  // Cleanup blob URLs when component unmounts (sync revoke to prevent memory leaks)
  useEffect(() => {
    return () => {
      // Cancel all in-flight requests
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();
      // Clear timeout
      if (autoLoadTimeoutRef.current) {
        clearTimeout(autoLoadTimeoutRef.current);
      }
      // Revoke all blob URLs
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
      // Clean up state blob URLs
      setDownloadedImages((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        return {};
      });
    };
  }, []);

  // Auto-load images only for RECENT messages (limit count + concurrency to avoid OOM / Chrome Error 5)
  // Debounced to prevent rapid re-runs when messages update frequently (e.g., via WebSocket)
  useEffect(() => {
    // Clear any pending timeout
    if (autoLoadTimeoutRef.current) {
      clearTimeout(autoLoadTimeoutRef.current);
    }
    
    // Debounce the auto-load to prevent excessive image loading
    autoLoadTimeoutRef.current = setTimeout(() => {
      const imageMessages = messages.filter((m) => {
        // Skip if already downloaded, downloading, or already processed
        if (!m.mediaUrl || downloadedImages[m.id] || downloadingImages.has(m.id) || processedMessageIdsRef.current.has(m.id)) {
          return false;
        }
        return (
          m.type === 'image' ||
          m.type === 'template' ||
          m.mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
          m.mediaUrl.includes('lookaside.fbsbx.com') ||
          m.mediaUrl.includes('facebook.com') ||
          m.mediaUrl.startsWith('/uploads/') ||
          (/^[a-zA-Z0-9_-]+$/.test(m.mediaUrl) && m.mediaUrl.length > 10)
        );
      });
      
      // Only auto-load for the last N messages (most recent at end)
      const toLoad = imageMessages.slice(-MAX_AUTO_LOAD_IMAGES);
      
      if (toLoad.length === 0) return;
      
      // Mark messages as processed before loading
      toLoad.forEach((msg) => processedMessageIdsRef.current.add(msg.id));
      
      let cancelled = false;
      const runQueue = async () => {
        for (let i = 0; i < toLoad.length && !cancelled; i += MAX_CONCURRENT_IMAGE_LOADS) {
          const batch = toLoad.slice(i, i + MAX_CONCURRENT_IMAGE_LOADS);
          await Promise.all(
            batch.map((msg) =>
              handleDownloadImage(msg).catch(() => {
                // Remove from processed set on error so it can be retried
                processedMessageIdsRef.current.delete(msg.id);
              })
            )
          );
          // Small delay between batches to prevent overwhelming the browser
          if (i + MAX_CONCURRENT_IMAGE_LOADS < toLoad.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      };
      runQueue();
    }, AUTO_LOAD_DEBOUNCE_MS);
    
    return () => {
      if (autoLoadTimeoutRef.current) {
        clearTimeout(autoLoadTimeoutRef.current);
        autoLoadTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, chatId]); // Only depend on length and chatId, not full messages array

  // Track if user is at bottom - only auto-scroll on new messages when they're viewing latest
  const SCROLL_BOTTOM_THRESHOLD = 100;
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const attach = () => {
      const el = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      if (!el) return;
      const onScroll = () => {
        const { scrollTop, clientHeight, scrollHeight } = el;
        wasAtBottomRef.current = scrollTop + clientHeight >= scrollHeight - SCROLL_BOTTOM_THRESHOLD;
      };
      el.addEventListener('scroll', onScroll, { passive: true });
      cleanup = () => el.removeEventListener('scroll', onScroll);
    };
    attach();
    if (!cleanup) timeoutId = setTimeout(attach, 200);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      cleanup?.();
    };
  }, [chatId]);

  // Periodic cleanup of old blob URLs to prevent memory accumulation
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setDownloadedImages((prev) => {
        const currentCount = Object.keys(prev).length;
        if (currentCount > MAX_CACHED_IMAGES) {
          // Clean up oldest entries (first keys in insertion order)
          const entries = Object.entries(prev);
          const toRemove = entries.slice(0, currentCount - MAX_CACHED_IMAGES);
          toRemove.forEach(([id, url]) => {
            URL.revokeObjectURL(url);
            blobUrlsRef.current.delete(id);
          });
          const next = { ...prev };
          toRemove.forEach(([id]) => delete next[id]);
          return next;
        }
        return prev;
      });
    }, 30000); // Run every 30 seconds
    
    return () => clearInterval(cleanupInterval);
  }, []); // Run once on mount, cleanup runs based on current state

  const formatDateDividerLabel = useCallback((date: Date) => {
    const msgDate = new Date(date);
    if (isToday(msgDate)) return "Today";
    if (isYesterday(msgDate)) return "Yesterday";
    return format(msgDate, "MMMM d, yyyy");
  }, []);

  // Resolve image URL - handle both local and remote URLs, and media IDs
  const resolveImageUrl = useCallback((mediaUrl: string | null | undefined, msgSessionId?: string): string | null => {
    if (!mediaUrl) return null;

    // Live DB + local dev: avoid fetch() CORS to production for our own /uploads and /api paths
    mediaUrl = rewritePanelMediaUrlToCurrentOrigin(mediaUrl);

    // If it's a Facebook CDN URL, use proxy endpoint (requires authentication)
    if (mediaUrl.includes('lookaside.fbsbx.com') || mediaUrl.includes('facebook.com')) {
      const sid = msgSessionId || sessionId;
      if (sid) {
        // Use proxy endpoint to fetch with authentication
        return `/api/media-proxy?url=${encodeURIComponent(mediaUrl)}&sessionId=${sid}`;
      }
      // If no sessionId, return original URL (might fail but better than nothing)
      return mediaUrl;
    }
    
    // If it's already a full URL (http/https), return as is
    if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
      return mediaUrl;
    }
    
    // If it starts with /uploads/ or /, it's a local path
    if (mediaUrl.startsWith('/uploads/') || (mediaUrl.startsWith('/') && !mediaUrl.startsWith('//'))) {
      // For local paths, prepend the API base URL if needed
      const baseUrl = window.location.origin;
      return `${baseUrl}${mediaUrl}`;
    }
    
    // If it looks like a WhatsApp media ID (alphanumeric, no slashes or dots)
    // We'll try to fetch it via the API endpoint
    if (/^[a-zA-Z0-9_-]+$/.test(mediaUrl) && mediaUrl.length > 10) {
      // This might be a media ID - use the API endpoint with sessionId
      const sid = msgSessionId || sessionId;
      if (sid) {
        return `/api/media/${mediaUrl}?sessionId=${sid}`;
      }
      // If no sessionId, try without it (might work for some cases)
      return `/api/media/${mediaUrl}`;
    }
    
    // Otherwise, assume it's a relative path
    return `/${mediaUrl}`;
  }, [sessionId]);

  // Download image when user clicks on the fallback (stable identity — keeps row context from churning)
  const handleDownloadImage = useCallback(async (message: Message): Promise<string | undefined> => {
    const messageId = message.id;

    const cached = downloadedImagesRef.current[messageId];
    if (cached) return cached;

    if (downloadingImagesRef.current.has(messageId)) return undefined;

    if (!message.mediaUrl) {
      toast({
        title: "Error",
        description: "No media URL available",
        variant: "destructive",
      });
      return undefined;
    }
    
    setDownloadingImages(prev => new Set(prev).add(messageId));
    
    try {
      const originalMediaUrl = message.mediaUrl;
      const resolvedUrl = resolveImageUrl(originalMediaUrl, message.sessionId);

      if (import.meta.env.DEV) {
        console.log("[Download Image] Attempting to download:", {
          messageId,
          originalMediaUrl,
          resolvedUrl,
          sessionId: message.sessionId || sessionId,
        });
      }

      if (!resolvedUrl) {
        throw new Error("Could not resolve media URL");
      }
      
      // Build full URL for fetch
      let fetchUrl: string;
      if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
        // Already a full URL
        fetchUrl = resolvedUrl;
      } else {
        // Relative URL - prepend origin
        fetchUrl = `${window.location.origin}${resolvedUrl}`;
      }

      if (import.meta.env.DEV) {
        console.log("[Download Image] Fetching from:", fetchUrl);
      }

      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllersRef.current.set(messageId, abortController);
      
      // Fetch the image with credentials for authentication
      let response = await fetch(fetchUrl, {
        method: 'GET',
        credentials: 'include', // Include cookies for authentication
        headers: {
          Accept: 'image/*, audio/*, video/*, application/json, application/octet-stream, */*',
        },
        signal: abortController.signal, // Allow cancellation
      });

      // GET /api/media/:mediaId returns JSON { url } (Graph CDN or local path), not raw bytes
      if (response.ok) {
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          try {
            const mediaData = await response.json();
            if (mediaData?.url && typeof mediaData.url === 'string') {
              const graphUrl = mediaData.url;
              if (
                graphUrl.includes('lookaside.fbsbx.com') ||
                graphUrl.includes('facebook.com')
              ) {
                const proxyUrl = `/api/media-proxy?url=${encodeURIComponent(graphUrl)}&sessionId=${message.sessionId || sessionId}`;
                response = await fetch(`${window.location.origin}${proxyUrl}`, {
                  method: 'GET',
                  credentials: 'include',
                  headers: { Accept: 'image/*, audio/*, video/*, application/octet-stream, */*' },
                  signal: abortController.signal,
                });
              } else if (graphUrl.startsWith('http://') || graphUrl.startsWith('https://')) {
                response = await fetch(graphUrl, {
                  method: 'GET',
                  credentials: 'include',
                  headers: { Accept: 'image/*, audio/*, video/*, application/octet-stream, */*' },
                  signal: abortController.signal,
                });
              } else {
                const rel = graphUrl.startsWith('/') ? graphUrl : `/${graphUrl}`;
                response = await fetch(`${window.location.origin}${rel}`, {
                  method: 'GET',
                  credentials: 'include',
                  headers: { Accept: 'image/*, audio/*, video/*, application/octet-stream, */*' },
                  signal: abortController.signal,
                });
              }
            }
          } catch (jsonFollowErr) {
            console.warn('[Download Image] JSON follow-up from /api/media failed:', jsonFollowErr);
          }
        }
      }
      
      // If URL expired (404) and it's a media-proxy URL, try to extract media ID and use /api/media endpoint
      if (!response.ok && response.status === 404 && fetchUrl.includes('/api/media-proxy')) {
        console.warn('[Download Image] Media proxy returned 404, trying to extract media ID from original URL...');
        
        // Try to extract media ID from the original media URL
        // Facebook CDN URLs contain media IDs in query parameters: ?mid=123456789
        let possibleMediaId: string | null = null;
        
        // Try to extract from mid= query parameter (most common)
        const midMatch = originalMediaUrl.match(/[?&]mid=([a-zA-Z0-9_-]+)/);
        if (midMatch && midMatch[1]) {
          possibleMediaId = midMatch[1];
        }
        
        // Fallback: try other patterns
        if (!possibleMediaId) {
          const mediaIdMatch = originalMediaUrl.match(/\/([a-zA-Z0-9_-]{15,})\//) || 
                              originalMediaUrl.match(/id=([a-zA-Z0-9_-]{15,})/) ||
                              originalMediaUrl.match(/\/([a-zA-Z0-9_-]{15,})$/);
          if (mediaIdMatch && mediaIdMatch[1]) {
            possibleMediaId = mediaIdMatch[1];
          }
        }
        
        if (possibleMediaId && message.sessionId) {
          if (import.meta.env.DEV) {
            console.log("[Download Image] Extracted media ID:", possibleMediaId);
            console.log("[Download Image] Attempting to fetch using media ID endpoint...");
          }

          // Try the /api/media/:mediaId endpoint
          const mediaIdUrl = `${window.location.origin}/api/media/${possibleMediaId}?sessionId=${message.sessionId || sessionId}`;
          
          try {
            const mediaIdResponse = await fetch(mediaIdUrl, {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Accept': 'application/json, */*',
              },
            });
            
            if (mediaIdResponse.ok) {
              const mediaData = await mediaIdResponse.json();
              if (mediaData.url) {
                if (import.meta.env.DEV) {
                  console.log(
                    "[Download Image] Got fresh URL from media ID endpoint:",
                    mediaData.url.substring(0, 100),
                  );
                }

                // If it's a Facebook CDN URL, fetch it through our media-proxy endpoint
                if (mediaData.url.includes('lookaside.fbsbx.com') || mediaData.url.includes('facebook.com')) {
                  const proxyUrl = `/api/media-proxy?url=${encodeURIComponent(mediaData.url)}&sessionId=${message.sessionId || sessionId}`;
                  if (import.meta.env.DEV) {
                    console.log("[Download Image] Fetching fresh URL through media-proxy...");
                  }
                  response = await fetch(`${window.location.origin}${proxyUrl}`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                      Accept: 'image/*, audio/*, video/*, application/octet-stream, */*',
                    },
                    signal: abortController.signal,
                  });
                } else {
                  // For non-Facebook URLs, fetch directly
                  response = await fetch(mediaData.url, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                      Accept: 'image/*, audio/*, video/*, application/octet-stream, */*',
                    },
                    signal: abortController.signal,
                  });
                }
                
                if (response.ok) {
                  if (import.meta.env.DEV) {
                    console.log("[Download Image] Successfully fetched using media ID endpoint");
                  }
                } else {
                  console.warn('[Download Image] Fresh URL also failed:', response.status, response.statusText);
                }
              }
            } else {
              const errorText = await mediaIdResponse.text().catch(() => '');
              console.warn('[Download Image] Media ID endpoint failed:', mediaIdResponse.status, errorText.substring(0, 200));
            }
          } catch (mediaIdError) {
            console.warn('[Download Image] Media ID endpoint error:', mediaIdError);
            // Continue with original error
          }
        } else {
          console.warn('[Download Image] Could not extract media ID from URL:', originalMediaUrl.substring(0, 200));
        }
      }
      
      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          // Ignore text parsing errors
        }
        
        console.error('[Download Image] Failed to fetch:', {
          status: response.status,
          statusText: response.statusText,
          url: fetchUrl,
          resolvedUrl,
          originalMediaUrl,
          error: errorText.substring(0, 500),
        });
        
        // Try to parse error message from JSON response
        let errorMessage = `Failed to fetch image: ${response.status} ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            errorMessage = errorJson.error;
          } else if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch (e) {
          // Use default error message
        }
        
        // Provide user-friendly error message
        if (response.status === 404) {
          errorMessage = 'Media URL has expired. The image may no longer be available.';
        }
        
        throw new Error(errorMessage);
      }
      
      // Expect binary media (not HTML error pages)
      const contentType = response.headers.get('content-type') || '';
      const isBinaryMedia =
        contentType.startsWith('image/') ||
        contentType.startsWith('audio/') ||
        contentType.startsWith('video/') ||
        contentType.startsWith('application/octet-stream');
      if (!isBinaryMedia && !contentType.includes('application/json')) {
        console.warn('[Download Image] Unexpected content type:', contentType);
      }
      
      // Remove abort controller after successful fetch
      abortControllersRef.current.delete(messageId);
      
      // Convert to blob and create object URL
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      // Cap cache size to prevent memory exhaustion (Chrome "Aw, Snap!" / Error 5)
      setDownloadedImages((prev) => {
        const next = { ...prev, [messageId]: blobUrl };
        blobUrlsRef.current.set(messageId, blobUrl);
        const keys = Object.keys(next);
        if (keys.length <= MAX_CACHED_IMAGES) return next;
        // Evict oldest (first key in insertion order)
        const toEvict = keys[0];
        const urlToRevoke = next[toEvict];
        if (urlToRevoke) {
          URL.revokeObjectURL(urlToRevoke);
          blobUrlsRef.current.delete(toEvict);
        }
        const { [toEvict]: _, ...rest } = next;
        return rest;
      });

      return blobUrl;
    } catch (error: any) {
      // Remove abort controller on error
      abortControllersRef.current.delete(messageId);

      // Don't show error toast for aborted requests
      if (error.name === "AbortError") {
        return undefined;
      }
      console.error("[Download Image] Error:", error);
      // Only show toast for user-initiated downloads, not auto-loads
      // Auto-loads fail silently to avoid spam
      return undefined;
    } finally {
      setDownloadingImages((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }, [sessionId, resolveImageUrl, toast]);

  const handleDownloadImageFile = useCallback(
    async (message: Message) => {
      if (!message.mediaUrl) {
        toast({
          title: "Error",
          description: "No media URL available",
          variant: "destructive",
        });
        return;
      }

      try {
        let blob: Blob;

        let blobUrl = downloadedImagesRef.current[message.id];
        if (blobUrl) {
          const response = await fetch(blobUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch blob: ${response.status}`);
          }
          blob = await response.blob();
        } else {
          blobUrl = await handleDownloadImage(message);

          if (blobUrl) {
            const response = await fetch(blobUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch blob: ${response.status}`);
            }
            blob = await response.blob();
          } else {
            const resolvedUrl = resolveImageUrl(message.mediaUrl, message.sessionId);
            if (!resolvedUrl) {
              throw new Error("Could not resolve media URL");
            }
            const fetchUrl = resolvedUrl.startsWith("http")
              ? resolvedUrl
              : `${window.location.origin}${resolvedUrl}`;

            const response = await fetch(fetchUrl, {
              credentials: "include",
            });

            if (!response.ok) {
              throw new Error(`Failed to fetch image: ${response.status}`);
            }

            blob = await response.blob();
          }
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        const originalUrl = message.mediaUrl || "";
        const urlParts = originalUrl.split("/");
        const urlFileName = urlParts[urlParts.length - 1]?.split("?")[0] || "image";
        let extension = "jpg";
        if (urlFileName.includes(".")) {
          extension = urlFileName.split(".").pop() || "jpg";
        } else if (blob.type && blob.type.includes("/")) {
          extension = blob.type.split("/")[1] || "jpg";
          if (extension === "jpeg") extension = "jpg";
        }
        const fileName = `image_${message.id.substring(0, 8)}.${extension}`;

        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 100);

        toast({
          title: "Download started",
          description: `Downloading ${fileName}...`,
        });
      } catch (error: any) {
        console.error("[Download Image File] Error:", error);
        toast({
          title: "Failed to download image",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    },
    [handleDownloadImage, resolveImageUrl, toast],
  );

  const visibleMessages = useMemo(
    () =>
      messages.filter((m) => {
        const noBody = !m.body || !String(m.body).trim();
        if (m.type === "text" && noBody && !m.mediaUrl) return false;
        return true;
      }),
    [messages]
  );

  type FlatRow = MessageFlatRow;

  const flatRows = useMemo(() => {
    const rows: FlatRow[] = [];
    let lastDate = "";
    for (const m of visibleMessages) {
      const date = format(new Date(m.timestamp), "yyyy-MM-dd");
      if (date !== lastDate) {
        lastDate = date;
        rows.push({
          type: "divider",
          id: `divider-${date}`,
          label: formatDateDividerLabel(new Date(m.timestamp)),
        });
      }
      rows.push({ type: "message", message: m });
    }
    return rows;
  }, [visibleMessages, formatDateDividerLabel]);

  const [scrollParentEl, setScrollParentEl] = useState<HTMLElement | null>(null);

  // Must depend on visible count, not only chatId: first paint often has no ScrollArea (empty state)
  // while messages load; when rows appear the viewport mounts but chatId unchanged → was leaving
  // scrollParentEl null forever so the virtualizer returned no items (blank thread).
  useLayoutEffect(() => {
    const q = () => {
      const el = scrollAreaRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement | null;
      setScrollParentEl(el ?? null);
    };
    q();
    const id = requestAnimationFrame(() => requestAnimationFrame(q));
    return () => cancelAnimationFrame(id);
  }, [chatId, visibleMessages.length]);

  const useVirtualList = flatRows.length > VIRTUAL_ROW_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollParentEl,
    getItemKey: (index) => {
      const row = flatRows[index];
      if (!row) return `row-${index}`;
      return row.type === "divider" ? row.id : row.message.id;
    },
    estimateSize: (index) => {
      const row = flatRows[index];
      if (row?.type === "divider") return 52;
      if (row?.type === "message") return estimateMessageRowHeight(row.message);
      return 80;
    },
    overscan: 12,
  });

  const remeasureRows = useCallback(() => {
    requestAnimationFrame(() => {
      virtualizer.measure();
    });
  }, [virtualizer]);

  useEffect(() => {
    virtualizer.measure();
  }, [flatRows.length, scrollParentEl, virtualizer, downloadedImages, carouselCardIndexByMessageId]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const viewport = scrollParentEl;
      if (!viewport || flatRows.length === 0) return;
      const jump = () => {
        if (useVirtualList) {
          virtualizer.scrollToIndex(flatRows.length - 1, { align: "end", behavior });
        } else {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior });
        }
        wasAtBottomRef.current = true;
      };
      jump();
      if (useVirtualList) {
        requestAnimationFrame(() => {
          virtualizer.measure();
          virtualizer.scrollToIndex(flatRows.length - 1, { align: "end", behavior: "auto" });
        });
      }
    },
    [scrollParentEl, flatRows.length, virtualizer, useVirtualList],
  );

  // After opening a chat: jump to latest message once rows are ready.
  useLayoutEffect(() => {
    if (!scrollParentEl || flatRows.length === 0 || !isInitialMount.current) return;
    scrollToBottom("auto");
    isInitialMount.current = false;
    const raf = requestAnimationFrame(() => {
      virtualizer.measure();
      scrollToBottom("auto");
    });
    return () => cancelAnimationFrame(raf);
  }, [chatId, scrollParentEl, flatRows.length, scrollToBottom, virtualizer]);

  const prevMessageCountRef = useRef(0);
  const prevScrollChatIdRef = useRef<string | undefined>(chatId);
  // New messages in the same chat while user is at the bottom.
  useEffect(() => {
    if (chatId !== prevScrollChatIdRef.current) {
      prevScrollChatIdRef.current = chatId;
      prevMessageCountRef.current = 0;
      return;
    }
    if (!wasAtBottomRef.current || !scrollParentEl || flatRows.length === 0) {
      prevMessageCountRef.current = messages.length;
      return;
    }
    if (messages.length > prevMessageCountRef.current) {
      const timeoutId = setTimeout(() => scrollToBottom("smooth"), 50);
      prevMessageCountRef.current = messages.length;
      return () => clearTimeout(timeoutId);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, chatId, scrollToBottom, scrollParentEl, flatRows.length]);

  const rowsContextValue = useMemo<MessageThreadRowsContextValue>(
    () => ({
      contactName,
      contactProfilePic,
      onReply,
      onReact,
      getTemplateForMessage,
      carouselCardIndexByMessageId,
      setCarouselCardIndexByMessageId,
      downloadedImages,
      downloadingImages,
      resolveImageUrl,
      handleDownloadImage,
      handleDownloadImageFile,
      setOpenMediaPopup,
      isVideoMediaUrl,
      onRowLayoutChange: remeasureRows,
    }),
    [
      contactName,
      contactProfilePic,
      onReply,
      onReact,
      getTemplateForMessage,
      carouselCardIndexByMessageId,
      downloadedImages,
      downloadingImages,
      resolveImageUrl,
      handleDownloadImage,
      handleDownloadImageFile,
      isVideoMediaUrl,
      remeasureRows,
    ]
  );

  const loadOlderWithScrollPreserve = useCallback(() => {
    if (!fetchOlderMessages || !scrollParentEl) return Promise.resolve();
    const el = scrollParentEl;
    const prevH = el.scrollHeight;
    const prevT = el.scrollTop;
    return Promise.resolve(fetchOlderMessages()).finally(() => {
      requestAnimationFrame(() => {
        el.scrollTop = prevT + (el.scrollHeight - prevH);
      });
    });
  }, [fetchOlderMessages, scrollParentEl]);

  const loadingOlderRef = useRef(false);
  useEffect(() => {
    const el = scrollParentEl;
    if (!el || !fetchOlderMessages || !hasMoreOlder) return;
    const TOP = 140;
    const onScroll = () => {
      if (el.scrollTop > TOP || isFetchingOlder || loadingOlderRef.current) return;
      loadingOlderRef.current = true;
      const prevH = el.scrollHeight;
      const prevT = el.scrollTop;
      Promise.resolve(fetchOlderMessages()).finally(() => {
        requestAnimationFrame(() => {
          loadingOlderRef.current = false;
          el.scrollTop = prevT + (el.scrollHeight - prevH);
        });
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollParentEl, fetchOlderMessages, hasMoreOlder, isFetchingOlder]);

  if (visibleMessages.length === 0) {
    const pastelColor = getPastelColorForName(contactName);
    if (isLoadingThread) {
      return (
        <div
          className="flex-1 flex items-center justify-center min-h-0"
          style={{
            backgroundColor: "#ffffff",
            backgroundImage: "url(/whatsapp-background.svg)",
            backgroundSize: "400px 400px",
            backgroundRepeat: "repeat",
          }}
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading messages" />
        </div>
      );
    }
    return (
      <div 
        className="flex-1 flex items-center justify-center"
        style={{
          backgroundColor: '#efeae2',
          // Use SVG pattern or replace with actual image: url(/whatsapp-background.png)
          backgroundImage: 'url(/whatsapp-background.svg)',
          backgroundSize: '400px 400px',
          backgroundRepeat: 'repeat',
          backgroundPosition: '0 0',
        }}
      >
        <div className="text-center space-y-3">
          <div className="w-32 h-32 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Avatar className="h-24 w-24">
              {contactProfilePic ? (
                <AvatarImage src={contactProfilePic} alt={contactName} />
              ) : null}
              <AvatarFallback 
                className={cn("text-2xl font-bold", pastelColor.bg, pastelColor.text)}
                style={{ 
                  backgroundColor: pastelColor.bgStyle, 
                  color: pastelColor.textStyle 
                }}
              >
                {messageThreadGetInitials(contactName)}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <p className="font-semibold text-lg">{contactName}</p>
            <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea 
      className="flex-1 min-h-0" 
      data-testid="scroll-messages" 
      ref={scrollAreaRef}
      style={{
        backgroundColor: '#ffffff',
        // Use SVG pattern or replace with actual image: url(/whatsapp-background.png)
        backgroundImage: 'url(/whatsapp-background.svg)',
        backgroundSize: '400px 400px',
        backgroundRepeat: 'repeat',
        backgroundPosition: '0 0',
      }}
    >
      <div className="px-4 pt-2 pb-4">
        {(hasMoreOlder || isFetchingOlder) && fetchOlderMessages ? (
          <div className="flex justify-center pb-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFetchingOlder || !hasMoreOlder}
              onClick={() => void loadOlderWithScrollPreserve()}
            >
              {isFetchingOlder ? (
                <>
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Loading…
                </>
              ) : (
                "Load older messages"
              )}
            </Button>
          </div>
        ) : null}
        <MessageThreadRowsContext.Provider value={rowsContextValue}>
          {useVirtualList ? (
            <div
              className="relative w-full"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualizer.getVirtualItems().map((vi) => {
                const row = flatRows[vi.index];
                if (!row) return null;
                const rowKey = row.type === "divider" ? row.id : row.message.id;
                return (
                  <MeasuredVirtualRow key={rowKey} vi={vi} virtualizer={virtualizer}>
                    <MessageThreadRowContent row={row} />
                  </MeasuredVirtualRow>
                );
              })}
            </div>
          ) : (
            <div className="w-full">
              {flatRows.map((row) => {
                const rowKey = row.type === "divider" ? row.id : row.message.id;
                return (
                  <div key={rowKey}>
                    <MessageThreadRowContent row={row} />
                  </div>
                );
              })}
            </div>
          )}
          {/* Invisible element at the bottom to scroll to */}
          <div ref={messagesEndRef} className="h-1" />
        </MessageThreadRowsContext.Provider>
      </div>
      
      {/* Image / Video Popup Dialog */}
      <Dialog open={!!openMediaPopup} onOpenChange={(open) => {
        if (!open) setOpenMediaPopup(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-2 pr-12">
            <DialogTitle>{openMediaPopup?.type === 'video' ? 'Video' : 'Image'} Preview</DialogTitle>
          </DialogHeader>
          {openMediaPopup && (
            <div className="p-4 pt-2 flex flex-col items-center gap-4">
              {openMediaPopup.type === 'video' ? (
                <video
                  src={openMediaPopup.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-w-full max-h-[70vh] object-contain rounded-lg bg-black"
                />
              ) : (
                <img
                  src={openMediaPopup.url}
                  alt="Preview"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const errorDiv = target.nextElementSibling as HTMLElement;
                    if (errorDiv) {
                      errorDiv.style.display = 'block';
                    }
                  }}
                />
              )}
              <div className="hidden text-center text-muted-foreground p-4">
                Failed to load
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (openMediaPopup) {
                      const message = messages.find(m => m.id === openMediaPopup.messageId);
                      if (message) {
                        handleDownloadImageFile(message);
                      }
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download {openMediaPopup.type === 'video' ? 'Video' : 'Image'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (openMediaPopup) {
                      window.open(openMediaPopup.url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .wa-media-card img,
  .wa-media-card video {
    object-fit: contain !important;
    max-height: none !important;
    height: auto !important;
    width: 100% !important;
  }
  .wa-media-card {
    max-width: min(100%, 17.5rem);
  }
  @media (min-width: 640px) {
    .wa-media-card {
      max-width: 18.75rem;
    }
  }
`;
document.head.appendChild(style);