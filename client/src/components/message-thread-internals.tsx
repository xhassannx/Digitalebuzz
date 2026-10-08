import { useEffect, useRef, useState } from "react";
import { Download, Play, Pause, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Message } from "@shared/schema";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
export const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏"];

export function parseMessageFooterButtons(message: Message) {
  if (!message.footerButtonText) return [];

  try {
    const parsed = JSON.parse(message.footerButtonText);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    if (message.footerButtonType && message.footerButtonType !== "NONE" && message.footerButtonText) {
      return [
        {
          type: message.footerButtonType,
          text: message.footerButtonText,
          url: message.footerButtonUrl,
          phoneNumber: message.footerButtonPhone,
        },
      ];
    }
  }

  return [];
}

/** Body {{n}} index where the OTP lives for AUTH templates (after header placeholders). */
export function getAuthTemplateOtpParamIndex(templateRow: any): number {
  if (!templateRow?.components) return 0;
  const headerComp = templateRow.components.find((c: any) => c.type === "HEADER");
  let headerVarCount = 0;
  if (headerComp?.format === "TEXT" && typeof headerComp.text === "string") {
    headerVarCount = (headerComp.text.match(/\{\{\d+\}\}/g) || []).length;
  }
  return headerVarCount;
}

/**
 * WhatsApp stores AUTH copy-code controls as OTP or URL buttons; persisted history often omitted them.
 * Synthesize a Copy code button when we have an AUTH template row + template params (OTP).
 */
export function getAuthenticationCopyCodeButtons(
  message: Message,
  getTemplateForMessage: (m: Message) => any
): Array<{ type: string; text: string; authCopyCode?: boolean; url?: string; phoneNumber?: string }> {
  if (message.type !== "template" || !message.templateName) return [];
  const tpl = getTemplateForMessage(message);
  if (!tpl) return [];
  const cat = String(tpl.category || "").toUpperCase();
  const btnsEarly = tpl.components?.find((c: any) => String(c.type || "").toUpperCase() === "BUTTONS")?.buttons || [];
  const hasOtpStyle = btnsEarly.some((b: any) => String(b.type || "").toUpperCase() === "OTP");
  if (cat !== "AUTHENTICATION" && !hasOtpStyle) return [];

  const params = Array.isArray(message.templateParams) ? message.templateParams : [];
  const idx = getAuthTemplateOtpParamIndex(tpl);
  const otp = String(params[idx] ?? "").trim();
  if (!otp) return [];

  const buttonsComp = tpl.components?.find((c: any) => String(c.type || "").toUpperCase() === "BUTTONS");
  const raw = buttonsComp?.buttons || [];
  const isOneTap = (b: any) => {
    const t = String(b?.otp_type || "").toUpperCase();
    return t === "ONE_TAP" || t === "ZERO_TAP";
  };

  const hasEligibleButton =
    raw.length === 0 ||
    raw.some((b: any) => {
      if (isOneTap(b)) return false;
      const typ = String(b.type || "").toUpperCase();
      return typ === "OTP" || typ === "URL";
    });
  if (!hasEligibleButton) return [];

  const label =
    raw.find((b: any) => String(b.type || "").toUpperCase() === "URL")?.text ||
    raw.find((b: any) => String(b.type || "").toUpperCase() === "OTP")?.text ||
    "Copy code";

  return [{ type: "QUICK_REPLY", text: String(label || "Copy code").trim(), authCopyCode: true }];
}

/** Incoming button/list tap — metadata only; not an outgoing template with clickable CTAs. */
export function isIncomingButtonClickMessage(message: Message): boolean {
  if (message.fromMe) return false;
  const t =
    (message as { footerButtonType?: string }).footerButtonType ??
    (message as { footer_button_type?: string }).footer_button_type;
  return t === "QUICK_REPLY";
}

/** WhatsApp-style card: image header + caption (+ optional CTA buttons) in one bubble. */
export function isWhatsAppMediaCardMessage(message: Message): boolean {
  if (message.type === "template") return true;
  if (message.templateName) return true;
  if (message.templateType === "IMAGE" || message.templateType === "VIDEO") return true;
  const footerType =
    (message as { footerButtonType?: string }).footerButtonType ??
    (message as { footer_button_type?: string }).footer_button_type;
  if (message.footerButtonText && footerType && footerType !== "NONE") return true;
  if (!message.mediaUrl) return false;
  if (message.type === "video" || message.type === "audio") return false;

  const url = message.mediaUrl;
  const looksLikeImage =
    message.type === "image" ||
    message.templateType === "IMAGE" ||
    /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url) ||
    url.includes("lookaside.fbsbx.com") ||
    url.includes("facebook.com") ||
    url.startsWith("/uploads/");

  if (!looksLikeImage) return false;
  return Boolean(message.body?.trim()) || Boolean(message.footer?.trim());
}

export const WHATSAPP_CARD_MEDIA_IMAGE_CLASS =
  "w-full h-auto max-w-full object-contain block bg-[#e9edef]";

export const WHATSAPP_INLINE_MEDIA_IMAGE_CLASS =
  "w-full h-auto max-w-full object-contain block";

/** Slightly narrower than regular chat bubbles — matches WhatsApp template/image cards. */
export const WHATSAPP_MEDIA_CARD_WRAPPER_CLASS =
  "max-w-[min(100%,17.5rem)] sm:max-w-[18.75rem]";

/** Merge stored footer buttons with synthetic AUTH copy-code when needed. */
/** Rough row height for TanStack Virtual before DOM measure (buttons, quotes, sender name). */
export function estimateMessageRowHeight(message: Message): number {
  if (isIncomingButtonClickMessage(message)) {
    return 44;
  }

  const isMediaCard = isWhatsAppMediaCardMessage(message);

  let h = 80;
  if (!message.fromMe && message.senderName) h += 24;
  if (isMediaCard) h += 120;
  if (message.type === "document") h += 140;
  if (message.mediaUrl) h += isMediaCard ? 440 : 280;

  const body = message.body ?? "";
  const lineCount = Math.max(1, body.split("\n").length);
  const bodyLen = body.length;
  if (bodyLen > 0) {
    h += Math.min(420, Math.max(28, lineCount * 22, Math.ceil(bodyLen / 42) * 22));
  }

  const buttons = parseMessageFooterButtons(message).length;
  if (buttons > 0) h += 12 + buttons * 48;
  else if (message.footerButtonText && message.fromMe) h += 52;

  if (message.replyToMessageId || message.quotedBody) h += 64;
  if (message.footer) h += 32;
  if (Array.isArray(message.reactions) && message.reactions.length > 0) h += 28;
  return Math.min(1200, Math.max(88, h));
}

export function getMessageFooterButtonsForDisplay(
  message: Message,
  getTemplateForMessage: (m: Message) => any
): Array<{ type: string; text: string; authCopyCode?: boolean; url?: string; phoneNumber?: string }> {
  if (isIncomingButtonClickMessage(message)) return [];
  const parsed = parseMessageFooterButtons(message);
  const synthetic = getAuthenticationCopyCodeButtons(message, getTemplateForMessage);
  if (parsed.some((b: any) => b.authCopyCode)) return parsed;
  if (parsed.length > 0 && synthetic.length > 0) {
    const want = String(synthetic[0]?.text || "")
      .trim()
      .toLowerCase();
    if (want && parsed.some((b: any) => String(b.text || "").trim().toLowerCase() === want)) return parsed;
  }
  return [...parsed, ...synthetic];
}

/** WhatsApp-style voice message player: play/pause, progress bar, duration, download */
export function VoiceMessagePlayer({
  message,
  resolveUrl,
  onDownload,
  isFromMe,
}: {
  message: Message;
  resolveUrl: (url: string | null | undefined, sessionId?: string) => string | null;
  onDownload: (message: Message) => void;
  isFromMe: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const src = resolveUrl(message.mediaUrl, message.sessionId);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src) return;
    el.src = src;
    const onLoadedMetadata = () => {
      setDuration(el.duration);
      setReady(true);
    };
    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
    } else {
      el.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    const el = audioRef.current;
    if (el) {
      el.currentTime = t;
      setCurrentTime(t);
    }
  };

  const formatTime = (s: number) => {
    if (!Number.isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 py-1 pr-1 min-w-0">
      <audio ref={audioRef} preload="metadata" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full"
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={onSeek}
          onClick={(e) => e.stopPropagation()}
          className="w-full h-1.5 accent-primary cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{ready ? formatTime(duration) : "0:00"}</span>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onDownload(message);
        }}
        title="Download"
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function MessageReactButton({
  message,
  onReact,
  quickEmojis,
}: {
  message: Message;
  onReact: (message: Message, emoji: string) => void;
  quickEmojis: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-full bg-[#ffffff] border border-[#e5e7eb] shadow-sm hover:bg-muted text-muted-foreground hover:text-foreground"
          title="React"
          data-testid={`button-react-${message.id}`}
        >
          <Smile className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-1.5"
        align={message.fromMe ? "start" : "end"}
        side={message.fromMe ? "left" : "right"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-1 flex-wrap max-w-[200px]">
          {quickEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="text-lg p-1.5 rounded hover:bg-muted transition-colors"
              onClick={() => {
                onReact(message, emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
