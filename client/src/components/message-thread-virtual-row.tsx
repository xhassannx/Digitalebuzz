import { createContext, useContext, useLayoutEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { Check, CheckCheck, Download, ExternalLink, Phone, Reply, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Message } from "@shared/schema";
import { format } from "date-fns";
import { cn, getPastelColorForName } from "@/lib/utils";
import {
  QUICK_EMOJIS,
  getAuthTemplateOtpParamIndex,
  getMessageFooterButtonsForDisplay,
  isIncomingButtonClickMessage,
  isWhatsAppMediaCardMessage,
  WHATSAPP_CARD_MEDIA_IMAGE_CLASS,
  WHATSAPP_INLINE_MEDIA_IMAGE_CLASS,
  WHATSAPP_MEDIA_CARD_WRAPPER_CLASS,
  VoiceMessagePlayer,
  MessageReactButton,
} from "./message-thread-internals";
import { ChatFormResponseButton } from "@/components/form-response-viewer";

function resolveDocumentDisplayName(body?: string | null, mediaUrl?: string | null): string {
  const placeholders = new Set(["[document]", "[media]", "untitled", ""]);
  const trimmed = (body || "").trim();
  if (trimmed && !placeholders.has(trimmed.toLowerCase())) return trimmed;
  if (mediaUrl) {
    const name = mediaUrl.split("/").pop()?.split("?")[0];
    if (name && !/^untitled$/i.test(name)) {
      try {
        return decodeURIComponent(name);
      } catch {
        return name;
      }
    }
  }
  return "Document";
}

function isDocumentPlaceholderBody(body?: string | null): boolean {
  const b = (body || "").trim().toLowerCase();
  return !b || b === "[document]" || b === "[media]" || b === "untitled";
}

export function messageThreadGetInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function messageThreadFormatTime(date: Date | string) {
  return format(new Date(date), "HH:mm");
}

/** Prefer sentAt for outbound so the bubble shows the real send time. */
export function messageThreadDisplayTime(message: { timestamp?: Date | string | null; sentAt?: Date | string | null; fromMe?: boolean | null }) {
  const raw =
    message.fromMe && message.sentAt
      ? message.sentAt
      : message.timestamp || message.sentAt;
  return messageThreadFormatTime(raw || new Date());
}

export function messageThreadStatusIcon(status: Message["status"]) {
  switch (status) {
    case "sent":
      return <Check className="h-3 w-3 text-[#667781]" />;
    case "delivered":
      return <CheckCheck className="h-3 w-3 text-[#667781]" />;
    case "read":
      return <CheckCheck className="h-3 w-3 text-[#219cd0]" />;
    case "pending":
      return <Check className="h-3 w-3 text-[#667781] opacity-50" />;
    case "failed":
      return <Check className="h-3 w-3 text-red-500" />;
    default:
      return <Check className="h-3 w-3 text-[#667781]" />;
  }
}

export type OpenMediaPopupState = { url: string; messageId: string; type: "image" | "video" } | null;

export interface MessageThreadRowsContextValue {
  contactName: string;
  contactProfilePic?: string;
  onReply?: (m: Message) => void;
  onReact?: (m: Message, emoji: string) => void;
  getTemplateForMessage: (m: Message) => any;
  carouselCardIndexByMessageId: Record<string, number>;
  setCarouselCardIndexByMessageId: Dispatch<SetStateAction<Record<string, number>>>;
  downloadedImages: Record<string, string>;
  downloadingImages: Set<string>;
  resolveImageUrl: (mediaUrl: string | null | undefined, msgSessionId?: string) => string | null;
  /** Resolves to blob URL when cached or fetched; undefined if skipped or failed. */
  handleDownloadImage: (m: Message) => Promise<string | undefined>;
  handleDownloadImageFile: (m: Message) => Promise<void>;
  setOpenMediaPopup: Dispatch<SetStateAction<OpenMediaPopupState>>;
  isVideoMediaUrl: (url: string, msg?: Message) => boolean;
  /** Notify virtualizer to remeasure row heights (e.g. after images load). */
  onRowLayoutChange?: () => void;
}

export const MessageThreadRowsContext = createContext<MessageThreadRowsContextValue | null>(null);

export function MessageThreadVirtualRow({ message }: { message: Message }) {
  const ctx = useContext(MessageThreadRowsContext);
  if (!ctx) throw new Error("MessageThreadVirtualRow must be used inside MessageThreadRowsContext.Provider");

  const footerButtonsForDisplay = useMemo(
    () => getMessageFooterButtonsForDisplay(message, ctx.getTemplateForMessage),
    [message, ctx.getTemplateForMessage]
  );

  useLayoutEffect(() => {
    ctx.onRowLayoutChange?.();
  }, [
    message.id,
    message.body,
    footerButtonsForDisplay.length,
    message.senderName,
    message.replyToMessageId,
    message.quotedBody,
    message.mediaUrl,
    ctx.onRowLayoutChange,
  ]);

  const isFromMe = message.fromMe === true;
  const isMediaCardMessage = isWhatsAppMediaCardMessage(message);
  const senderName = !isFromMe ? (message.senderName || ctx.contactName) : "";
  const pastelColor = !isFromMe ? getPastelColorForName(senderName) : null;
  // Atlas avatar palette uses white text on dark fills — never use that for mint/pastel bubbles.
  const isAtlasBubble =
    typeof document !== "undefined" &&
    document.documentElement.dataset.panelTemplate === "helicoptic-v1";
  const applyPastelBubbleFill = Boolean(pastelColor && !isFromMe && !isAtlasBubble);
  const incomingButtonClick = isIncomingButtonClickMessage(message);

  if (incomingButtonClick) {
    const label =
      message.body?.trim() ||
      (() => {
        try {
          const arr = JSON.parse(message.footerButtonText || "[]");
          return Array.isArray(arr) && arr[0]?.text ? String(arr[0].text) : "";
        } catch {
          return "";
        }
      })();
    if (label) {
      return (
        <div
          id={`msg-${message.id}`}
          className="flex w-full justify-center py-1"
          data-testid={`message-${message.id}`}
        >
          <div className="max-w-[85%] rounded-full border border-[#25d366]/30 bg-[#dcf8c6] px-3 py-1.5 text-center text-xs font-medium text-[#0b141a] shadow-sm">
            Clicked: {label}
          </div>
        </div>
      );
    }
  }

  return (
                    <div
                      id={`msg-${message.id}`}
                      className={`flex gap-2 ${isFromMe ? 'justify-end' : 'justify-start'} min-w-0 w-full`}
                      data-testid={`message-${message.id}`}
                    >
                      {/* Avatar only for received messages (left side) */}
                      {!isFromMe && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          {ctx.contactProfilePic ? (
                            <AvatarImage src={ctx.contactProfilePic} alt={ctx.contactName} />
                          ) : null}
                          <AvatarFallback 
                            className={cn("text-xs font-bold", pastelColor?.bg, pastelColor?.text)}
                            style={{ backgroundColor: pastelColor?.bgStyle, color: pastelColor?.textStyle }}
                          >
                            {messageThreadGetInitials(senderName)}
                          </AvatarFallback>
                        </Avatar>
                      )}
    
                      {/* Wrapper for message bubble and external buttons — w-fit (not flex-1) so CTA buttons don't stretch full chat width */}
                      <div
                        className={cn(
                          "flex flex-col gap-1 group/bubble min-w-0 w-fit",
                          isMediaCardMessage
                            ? WHATSAPP_MEDIA_CARD_WRAPPER_CLASS
                            : "max-w-md md:max-w-md lg:max-w-lg",
                          isFromMe && "ml-auto",
                        )}
                      >
                        {/* Sender name only for received messages - outside bubble to avoid width constraints */}
                        {!isFromMe && message.senderName && (
                          <p 
                            className="text-sm font-bold text-[#25d366] px-1 break-words whitespace-normal overflow-visible" 
                            style={{ 
                              wordBreak: 'break-word', 
                              overflowWrap: 'break-word',
                              overflow: 'visible',
                              lineHeight: '1.2'
                            }}
                          >
                            {message.senderName}
                          </p>
                        )}
                        {/* Message bubble with hover actions */}
                        <div
                          className={cn(
                            "relative shadow-sm border border-[#e5e7eb] min-w-0",
                            isMediaCardMessage
                              ? "wa-media-card overflow-hidden bg-white text-[#111b21] p-0"
                              : cn(
                                  "p-2 px-3 shadow-2xl shadow-black/10",
                                  isFromMe ? "bg-sky-100 text-sky-900" : "",
                                ),
                          )}
                          style={{
                            animation: 'slideIn 150ms ease-out',
                            borderRadius: isFromMe ? '7.5px 0 7.5px 7.5px' : '0 7.5px 7.5px 7.5px',
                            ...(!isMediaCardMessage && applyPastelBubbleFill ? {
                              backgroundColor: pastelColor!.bgStyle,
                              color: pastelColor!.textStyle,
                            } : {}),
                          }}
                        >
                          {/* Hover actions: reply + react (inside bubble so virtual rows don't bleed into neighbors) */}
                          <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5 opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-150 pointer-events-none group-hover/bubble:pointer-events-auto">
                            {ctx.onReply && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); ctx.onReply?.(message); }}
                                className="p-1.5 rounded-full bg-[#ffffff] border border-[#e5e7eb] shadow-sm hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="Reply"
                                data-testid={`button-reply-${message.id}`}
                              >
                                <Reply className="h-4 w-4" />
                              </button>
                            )}
                            {ctx.onReact && (
                              <MessageReactButton message={message} onReact={ctx.onReact} quickEmojis={QUICK_EMOJIS} />
                            )}
                          </div>
    
                          {/* Template media carousel cards (render from template metadata) */}
                          {message.type === 'template' && (() => {
                            const tpl = ctx.getTemplateForMessage(message);
                            const templateMeta = tpl?.metaData || tpl?.metadata || {};
                            const mediaCards = Array.isArray(templateMeta.mediaCards) ? templateMeta.mediaCards : [];
                            const isMediaCarousel = templateMeta.interactiveAction === 'MEDIA_CARD_CAROUSEL' && mediaCards.length > 0;
                            if (!isMediaCarousel) return null;
    
                            const selectedIndex = Math.min(
                              Math.max(0, ctx.carouselCardIndexByMessageId[message.id] ?? 0),
                              mediaCards.length - 1
                            );
                            const selectedCard = mediaCards[selectedIndex];
                            if (!selectedCard) return null;
    
                            const sentCarouselUrls =
                              message.carouselCardMediaUrls ??
                              (message as { carousel_card_media_urls?: string[] }).carousel_card_media_urls;
                            const sentUrlForCard =
                              Array.isArray(sentCarouselUrls) && sentCarouselUrls[selectedIndex]?.trim()
                                ? sentCarouselUrls[selectedIndex].trim()
                                : null;
                            const cardMediaUrl = sentUrlForCard || selectedCard.mediaUrl;
    
                            return (
                              <div className="mb-2 mt-1 border rounded-lg p-2 bg-white/70">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[11px] text-gray-600">Media Card Carousel ({mediaCards.length} card{mediaCards.length > 1 ? 's' : ''})</p>
                                  {mediaCards.length > 1 && (
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          ctx.setCarouselCardIndexByMessageId((prev) => ({
                                            ...prev,
                                            [message.id]: Math.max(0, selectedIndex - 1),
                                          }));
                                        }}
                                        disabled={selectedIndex === 0}
                                      >
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                      </Button>
                                      <span className="text-[11px] text-muted-foreground">{selectedIndex + 1}/{mediaCards.length}</span>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          ctx.setCarouselCardIndexByMessageId((prev) => ({
                                            ...prev,
                                            [message.id]: Math.min(mediaCards.length - 1, selectedIndex + 1),
                                          }));
                                        }}
                                        disabled={selectedIndex === mediaCards.length - 1}
                                      >
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
    
                                {selectedCard.mediaType === 'IMAGE' && cardMediaUrl ? (
                                  <img
                                    src={ctx.resolveImageUrl(cardMediaUrl, message.sessionId) || cardMediaUrl}
                                    alt={`Card ${selectedIndex + 1}`}
                                    className="w-full h-auto max-w-full object-contain rounded mb-2 bg-[#e9edef]"
                                    loading="lazy"
                                    decoding="async"
                                    onLoad={() => ctx.onRowLayoutChange?.()}
                                  />
                                ) : selectedCard.mediaType === 'VIDEO' && cardMediaUrl ? (
                                  <video
                                    preload="metadata"
                                    muted
                                    playsInline
                                    src={ctx.resolveImageUrl(cardMediaUrl, message.sessionId) || cardMediaUrl}
                                    className="w-full h-auto max-w-full object-contain rounded mb-2 bg-black"
                                  />
                                ) : selectedCard.mediaType === 'VIDEO' ? (
                                  <div className="w-full h-24 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500 mb-2">
                                    Video card
                                  </div>
                                ) : null}
    
                                {selectedCard.bodyText && (
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{selectedCard.bodyText}</p>
                                )}
    
                                {Array.isArray(selectedCard.buttons) && selectedCard.buttons.length > 0 && (
                                  <div className="space-y-1">
                                    {selectedCard.buttons.map((button: any, idx: number) => (
                                      <div key={idx} className="w-full text-left px-2 py-1.5 border rounded text-xs bg-white">
                                        {button.text || `Button ${idx + 1}`}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
    
                          {/* Template with VIDEO header: show video thumbnail, click to open in popup */}
                          {message.mediaUrl && message.type === 'template' && ctx.isVideoMediaUrl(message.mediaUrl, message) && (
                              <div className={cn("relative group", isMediaCardMessage ? "" : "mb-2 -mx-3 -mt-3")}>
                                <video
                                  preload="metadata"
                                  muted
                                  playsInline
                                  src={ctx.resolveImageUrl(message.mediaUrl, message.sessionId) || ''}
                                  className={cn(
                                    "w-full cursor-pointer hover:opacity-90 transition-opacity block",
                                    isMediaCardMessage
                                      ? "h-auto max-w-full object-contain bg-black"
                                      : "h-auto max-w-full object-contain bg-black rounded-t-lg",
                                  )}
                                  style={isMediaCardMessage ? { display: 'block' } : { borderRadius: isFromMe ? '7.5px 0 0 0' : '0 7.5px 0 0', display: 'block' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const url = ctx.downloadedImages[message.id] || ctx.resolveImageUrl(message.mediaUrl, message.sessionId) || '';
                                    if (url) ctx.setOpenMediaPopup({ url, messageId: message.id, type: 'video' });
                                  }}
                                  onError={(e) => {
                                    const target = e.target as HTMLVideoElement;
                                    target.style.display = 'none';
                                  }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center">
                                    <div className="w-0 h-0 border-l-[16px] border-l-white border-y-[10px] border-y-transparent ml-1" />
                                  </div>
                                </div>
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0b141a]/70 hover:bg-[#0b141a]/90 pointer-events-auto"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    ctx.handleDownloadImageFile(message);
                                  }}
                                  title="Download video"
                                >
                                  <Download className="h-4 w-4 text-white" />
                                </Button>
                              </div>
                          )}
    
                          {/* Header Image - show for image type, template with image media (exclude template+video) */}
                          {message.mediaUrl && !(message.type === 'template' && ctx.isVideoMediaUrl(message.mediaUrl, message)) && (
                            (message.type === 'image' || 
                             message.type === 'template' || 
                             (message.type === 'text' && message.mediaUrl) ||
                             (message.type === 'document' && message.mediaUrl && message.mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) || // Handle images sent as documents
                             (message.mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) || // Show any mediaUrl that looks like an image file, regardless of type
                             (message.mediaUrl.includes('lookaside.fbsbx.com') || message.mediaUrl.includes('facebook.com')) || // Facebook CDN URLs (for previously sent images via Business API)
                             (message.mediaUrl.startsWith('/uploads/') && message.type !== 'video' && message.type !== 'audio') || // Local uploads that aren't video/audio
                             (message.fromMe && message.mediaUrl && message.type !== 'video' && message.type !== 'audio' && !message.mediaUrl.match(/\.(mp4|mp3|wav|pdf|doc|docx)$/i)) // Previously sent images: if fromMe and has mediaUrl but not video/audio/document, try as image
                            ) && (
                              <div className={cn("relative group", isMediaCardMessage ? "" : "mb-2 -mx-3 -mt-3")}>
                                {/* Use downloaded image if available, otherwise use resolved URL */}
                                <img
                                  src={ctx.downloadedImages[message.id] || ctx.resolveImageUrl(message.mediaUrl, message.sessionId) || ''}
                                  alt="Media"
                                  className={cn(
                                    "w-full cursor-pointer hover:opacity-95 transition-opacity",
                                    isMediaCardMessage
                                      ? WHATSAPP_CARD_MEDIA_IMAGE_CLASS
                                      : WHATSAPP_INLINE_MEDIA_IMAGE_CLASS,
                                  )}
                                  loading="lazy"
                                  decoding="async"
                                  style={
                                    isMediaCardMessage
                                      ? { display: "block" }
                                      : {
                                          borderRadius: isFromMe ? "7.5px 0 0 0" : "0 7.5px 0 0",
                                          display: "block",
                                        }
                                  }
                                  data-testid={`img-media-${message.id}`}
                                  data-image-id={message.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const imageUrl = ctx.downloadedImages[message.id] || ctx.resolveImageUrl(message.mediaUrl, message.sessionId) || '';
                                    if (imageUrl) {
                                      ctx.setOpenMediaPopup({ url: imageUrl, messageId: message.id, type: 'image' });
                                    }
                                  }}
                                  onError={async (e) => {
                                    const target = e.target as HTMLImageElement;
                                    const resolvedUrl = ctx.resolveImageUrl(message.mediaUrl, message.sessionId);
                                    if (import.meta.env.DEV) {
                                      console.warn("[Image] load failed", message.id, resolvedUrl, target.currentSrc);
                                    }

                                    // Show fallback if image hasn't been downloaded yet
                                    if (!ctx.downloadedImages[message.id]) {
                                      target.style.display = 'none';
                                      const fallback = target.nextElementSibling as HTMLElement;
                                      if (fallback && fallback.getAttribute('data-fallback-id')) {
                                        fallback.style.display = 'flex';
                                      }
                                      
                                      // For template messages or sent messages, try to auto-download/load the image
                                      if (message.type === 'template' || message.fromMe) {
                                        try {
                                          if (import.meta.env.DEV) {
                                            console.log(
                                              "[Image Error] auto-download template/sent:",
                                              message.id,
                                            );
                                          }
                                          await ctx.handleDownloadImage(message);
                                        } catch (downloadError) {
                                          console.error('[Image Error] Failed to auto-download image:', downloadError);
                                        }
                                      }
                                    }
                                  }}
                                  onLoad={(e) => {
                                    ctx.onRowLayoutChange?.();
                                    // Ensure image is visible when it loads successfully
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'block';
                                    // Hide fallback if it exists
                                    const fallback = target.nextElementSibling as HTMLElement;
                                    if (fallback && fallback.getAttribute('data-fallback-id')) {
                                      fallback.style.display = 'none';
                                    }
                                  }}
                                />
                                {/* Fallback for failed image load - clickable to download */}
                                {!ctx.downloadedImages[message.id] && (
                                  <div 
                                    className="hidden items-center gap-2 p-2 bg-muted rounded cursor-pointer hover:bg-muted/80 transition-colors"
                                    data-fallback-id={message.id}
                                    onClick={async () => {
                                      // First try to load and display the image
                                      try {
                                        await ctx.handleDownloadImage(message);
                                        // If successful, the image should now be in ctx.downloadedImages and will display
                                        // Also trigger a file download
                                        setTimeout(() => {
                                          ctx.handleDownloadImageFile(message);
                                        }, 500);
                                      } catch (error) {
                                        console.error('[Fallback Click] Failed to load image:', error);
                                        // If loading fails, still try to download the file
                                        ctx.handleDownloadImageFile(message);
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        ctx.handleDownloadImage(message).then(() => {
                                          ctx.handleDownloadImageFile(message);
                                        });
                                      }
                                    }}
                                    title="Click to download image"
                                  >
                                    {ctx.downloadingImages.has(message.id) ? (
                                      <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-sm">Downloading...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Download className="h-4 w-4" />
                                        <span className="text-sm">Image unavailable</span>
                                      </>
                                    )}
                                  </div>
                                )}
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0b141a]/70 hover:bg-[#0b141a]/90"
                                  data-testid={`button-download-${message.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    ctx.handleDownloadImageFile(message);
                                  }}
                                  title="Download image"
                                >
                                  <Download className="h-4 w-4 text-white" />
                                </Button>
                              </div>
                            )
                          )}
    
                          {/* Other media types - only show if image/video wasn't displayed above. Include type 'text' when mediaUrl is audio so previously sent voice messages show the player. */}
                          {message.mediaUrl && 
                           message.type !== 'image' && 
                           message.type !== 'template' && 
                           (message.type !== 'text' || /\.(ogg|opus|webm|mp3|wav|m4a)(\?|$)/i.test(message.mediaUrl)) && (
                            <div className="mb-2">
                              {message.type === 'video' ? (
                                <div className="relative group -mx-3 -mt-3">
                                  <video
                                    preload="metadata"
                                    muted
                                    playsInline
                                    src={ctx.resolveImageUrl(message.mediaUrl, message.sessionId) || ''}
                                    className="w-full h-auto max-w-full object-contain rounded mb-2 bg-black"
                                    style={{ borderRadius: isFromMe ? '7.5px 0 0 0' : '0 7.5px 0 0', display: 'block' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const url = ctx.downloadedImages[message.id] || ctx.resolveImageUrl(message.mediaUrl, message.sessionId) || '';
                                      if (url) ctx.setOpenMediaPopup({ url, messageId: message.id, type: 'video' });
                                    }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center">
                                      <div className="w-0 h-0 border-l-[16px] border-l-white border-y-[10px] border-y-transparent ml-1" />
                                    </div>
                                  </div>
                                  <Button
                                    size="icon"
                                    variant="secondary"
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0b141a]/70 hover:bg-[#0b141a]/90"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      ctx.handleDownloadImageFile(message);
                                    }}
                                    title="Download video"
                                  >
                                    <Download className="h-4 w-4 text-white" />
                                  </Button>
                                </div>
                              ) : (message.type === 'audio' || (message.mediaUrl && /\.(ogg|opus|webm|mp3|wav|m4a)(\?|$)/i.test(message.mediaUrl) && message.type !== 'document')) ? (
                                <VoiceMessagePlayer
                                  message={message}
                                  resolveUrl={ctx.resolveImageUrl}
                                  onDownload={ctx.handleDownloadImageFile}
                                  isFromMe={isFromMe}
                                />
                              ) : message.type === 'document' ? (
                                <div 
                                  className="flex items-center gap-2 p-2 bg-muted rounded cursor-pointer hover:bg-muted/80 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    ctx.handleDownloadImageFile(message);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      ctx.handleDownloadImageFile(message);
                                    }
                                  }}
                                  title="Click to download document"
                                >
                                  <Download className="h-4 w-4" />
                                  <span className="text-sm">{resolveDocumentDisplayName(message.body, message.mediaUrl)}</span>
                                </div>
                              ) : (
                                <div 
                                  className="flex items-center gap-2 p-2 bg-muted rounded cursor-pointer hover:bg-muted/80 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    ctx.handleDownloadImageFile(message);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      ctx.handleDownloadImageFile(message);
                                    }
                                  }}
                                  title="Click to download media file"
                                >
                                  <Download className="h-4 w-4" />
                                  <span className="text-sm">Media file</span>
                                </div>
                              )}
                            </div>
                          )}
    
                          {/* Quoted message (reply) - WhatsApp-style strip; click scrolls to original message */}
                          {(message.replyToMessageId || message.quotedBody) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!message.replyToMessageId) return;
                                const el = document.getElementById(`msg-${message.replyToMessageId}`);
                                if (el) {
                                  if ((el as any)._highlightTimeout) clearTimeout((el as any)._highlightTimeout);
                                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  el.classList.add('ring-2', 'ring-sky-400', 'ring-offset-2', 'rounded-lg');
                                  (el as any)._highlightTimeout = setTimeout(() => {
                                    el.classList.remove('ring-2', 'ring-sky-400', 'ring-offset-2', 'rounded-lg');
                                    (el as any)._highlightTimeout = null;
                                  }, 2000);
                                }
                              }}
                              className={cn(
                                "mb-2 pl-2 border-l-2 rounded-r text-left w-full cursor-pointer hover:opacity-90 transition-opacity",
                                isMediaCardMessage
                                  ? "mx-3 mt-2 border-[#00a884]/40 bg-[#f0f2f5]"
                                  : isFromMe
                                    ? "border-sky-600/60 bg-sky-50/50"
                                    : "border-muted-foreground/40 bg-muted/40",
                              )}
                              data-testid={`quoted-${message.id}`}
                              title="Go to message"
                            >
                              <p className="text-xs font-medium opacity-90 truncate">
                                {message.quotedFromMe ? 'You' : ctx.contactName}
                              </p>
                              <p className="text-sm whitespace-pre-wrap break-words line-clamp-2 opacity-90">
                                {message.quotedBody || 'Message'}
                              </p>
                            </button>
                          )}
    
                          {/* Message text with URL detection (skip duplicate body for contact CTA clicks; popup shows it). Hide body for audio messages so "[Media]" is not shown under the player. */}
                          {message.body &&
                           !(message.type === 'audio' || (message.mediaUrl && /\.(ogg|opus|webm|mp3|wav|m4a)(\?|$)/i.test(message.mediaUrl) && message.type !== 'document')) &&
                           !(message.type === 'document' && isDocumentPlaceholderBody(message.body)) &&
                           (isFromMe || !isIncomingButtonClickMessage(message)) && (
                            <div className={cn(
                              "text-sm whitespace-pre-wrap break-words leading-relaxed",
                              isMediaCardMessage
                                ? "px-3 pt-2 pb-1 text-[#111b21]"
                                : message.type !== 'text' && message.mediaUrl
                                  ? "mt-2"
                                  : "",
                            )} data-testid={`text-message-body-${message.id}`}>
                              {(() => {
                                // Only http(s) and www. — do not match "bare" domain-like text or filenames such as
                                // invoice-INV376.pdf (the old regex treated ".pdf" as a TLD and opened https://invoice-INV376.pdf).
                                const urlRegex = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
                                const parts = [];
                                let lastIndex = 0;
                                let match;
                                
                                // Reset regex lastIndex
                                urlRegex.lastIndex = 0;
                                
                                while ((match = urlRegex.exec(message.body)) !== null) {
                                  // Add text before URL
                                  if (match.index > lastIndex) {
                                    parts.push({ type: 'text', content: message.body.substring(lastIndex, match.index) });
                                  }
                                  // Add URL
                                  const url = match[0].trim();
                                  // Clean URL (remove trailing punctuation that's not part of URL)
                                  const cleanUrl = url.replace(/[.,;:!?]+$/, '');
                                  const href = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
                                  parts.push({ type: 'url', content: cleanUrl, href });
                                  lastIndex = match.index + match[0].length;
                                }
                                
                                // Add remaining text
                                if (lastIndex < message.body.length) {
                                  parts.push({ type: 'text', content: message.body.substring(lastIndex) });
                                }
                                
                                // If no URLs found, return original text
                                if (parts.length === 0) {
                                  return <span>{message.body}</span>;
                                }
                                
                                return parts.map((part, index) => {
                                  if (part.type === 'url') {
                                    return (
                                      <a
                                        key={index}
                                        href={part.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn(
                                          "msg-bubble-link underline underline-offset-2 hover:opacity-90 inline-flex items-center gap-1 break-all font-medium",
                                          isFromMe
                                            ? "text-sky-700"
                                            : "text-[#0369a1]",
                                        )}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(part.href, '_blank', 'noopener,noreferrer');
                                        }}
                                      >
                                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                        <span>{part.content}</span>
                                      </a>
                                    );
                                  }
                                  return <span key={index}>{part.content}</span>;
                                });
                              })()}
                            </div>
                          )}

                          <ChatFormResponseButton
                            fromMe={isFromMe}
                            messageBody={message.body}
                            whatsappMessageId={message.whatsappMessageId}
                          />
    
                          {/* Footer */}
                          {message.footer && (
                            <p 
                              className={cn(
                                "text-xs mt-2 text-center border-t pt-2",
                                isMediaCardMessage
                                  ? "mx-3 text-[#667781] border-[#e9edef]"
                                  : isFromMe
                                    ? "text-sky-800/80"
                                    : "text-[#54656f]",
                              )}
                            >
                              {message.footer}
                            </p>
                          )}
    
                          {/* Timestamp and status */}
                          <div 
                            className={cn(
                              "msg-bubble-meta flex items-center gap-1 justify-end mt-1 text-[11px] font-semibold tabular-nums",
                              isMediaCardMessage
                                ? "px-3 pb-2 text-[#667781] font-normal"
                                : isFromMe
                                  ? "text-[#54656f]"
                                  : "text-[#54656f]",
                            )}
                          >
                            <span>{messageThreadDisplayTime(message)}</span>
                            {/* Status icon only for sent messages (right side) */}
                            {isFromMe && (
                              <span 
                                className="ml-1" 
                                title={`Status: ${message.status || 'unknown'}`}
                                data-status={message.status}
                                data-message-id={message.id}
                              >
                                {messageThreadStatusIcon(message.status)}
                              </span>
                            )}
                          </div>
    
                          {/* Reactions (from me and from contact) */}
                          {Array.isArray(message.reactions) && message.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5 justify-end items-center">
                              {message.reactions.map((r: { emoji: string; fromMe: boolean }, i: number) => (
                                <span key={i} className="text-base leading-none" title={r.fromMe ? "You" : "Contact"}>
                                  {r.emoji}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Template CTA buttons inside card (WhatsApp order: image → text → buttons) */}
                          {isMediaCardMessage && footerButtonsForDisplay.length > 0 && (
                            <div className="divide-y divide-[#e9edef] border-t border-[#e9edef]">
                              {footerButtonsForDisplay.map((button: any, index: number) => (
                                <button
                                  key={index}
                                  type="button"
                                  className="w-full py-2.5 px-4 text-sm font-medium text-[#00a884] bg-white hover:bg-[#f5f6f6] transition-colors flex items-center justify-center gap-2"
                                  onClick={() => {
                                    if (button.authCopyCode) {
                                      const tpl = ctx.getTemplateForMessage(message);
                                      const idx = tpl ? getAuthTemplateOtpParamIndex(tpl) : 0;
                                      const params = Array.isArray(message.templateParams) ? message.templateParams : [];
                                      const code = String(params[idx] ?? "").trim();
                                      if (code) {
                                        void navigator.clipboard.writeText(code);
                                      }
                                      return;
                                    }
                                    if (button.type === 'URL' && button.url) {
                                      window.open(button.url, '_blank', 'noopener,noreferrer');
                                    } else if (button.type === 'PHONE_NUMBER' && button.phoneNumber) {
                                      window.location.href = `tel:${button.phoneNumber}`;
                                    } else if (button.type === 'QUICK_REPLY') {
                                      if (import.meta.env.DEV) {
                                        console.log("Quick reply clicked:", button.text);
                                      }
                                    }
                                  }}
                                >
                                  {button.type === 'URL' && !button.authCopyCode && <ExternalLink className="h-4 w-4" />}
                                  {button.type === 'PHONE_NUMBER' && <Phone className="h-4 w-4" />}
                                  <span>{button.text || button.url || button.phoneNumber}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
    
                        {/* Buttons - rendered outside bubble for non-template messages */}
                        {!isMediaCardMessage && footerButtonsForDisplay.length > 0 && (
                          <div className="space-y-1.5 w-full mt-2 mb-1">
                            {footerButtonsForDisplay.map((button: any, index: number) => (
                              <button
                                key={index}
                                type="button"
                                className={`w-full py-2.5 px-4 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
                                  isFromMe 
                                    ? 'bg-[#3bce6f] hover:bg-[#349656] text-[#ffffff] border border-[#00a884]/20'
                                    : 'bg-[#3bce6f] hover:bg-[#349656] text-[#ffffff] border border-[#00a884]/20 rounded-lg'
                                }`}
                                onClick={() => {
                                  if (button.authCopyCode) {
                                    const tpl = ctx.getTemplateForMessage(message);
                                    const idx = tpl ? getAuthTemplateOtpParamIndex(tpl) : 0;
                                    const params = Array.isArray(message.templateParams) ? message.templateParams : [];
                                    const code = String(params[idx] ?? "").trim();
                                    if (code) {
                                      void navigator.clipboard.writeText(code);
                                    }
                                    return;
                                  }
                                  if (button.type === 'URL' && button.url) {
                                    window.open(button.url, '_blank', 'noopener,noreferrer');
                                  } else if (button.type === 'PHONE_NUMBER' && button.phoneNumber) {
                                    window.location.href = `tel:${button.phoneNumber}`;
                                  } else if (button.type === 'QUICK_REPLY') {
                                    if (import.meta.env.DEV) {
                                      console.log("Quick reply clicked:", button.text);
                                    }
                                  }
                                }}
                              >
                                {button.type === 'URL' && !button.authCopyCode && <ExternalLink className="h-4 w-4" />}
                                {button.type === 'PHONE_NUMBER' && <Phone className="h-4 w-4" />}
                                <span>{button.text || button.url || button.phoneNumber}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
    
                      {/* Spacer for sent messages (right side) */}
                      {isFromMe && <div className="w-8" />}
                    </div>
  );
}
