import { useState, useRef, useCallback, useEffect } from "react";
import { Paperclip, Send, Smile, Image, File as FileIcon, Video, X, Zap, Mic, Square, Play, Pause, Banknote, CalendarClock, Plus, ShoppingBag, CreditCard, Bot } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { resolveApiUrl, apiRequest } from "@/lib/queryClient";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";

type CannedMessageItem = {
  id: string;
  name: string;
  type: "TEXT" | "IMAGE";
  text: string;
  imageUrl?: string;
  fileName?: string;
};

type InboxChatbotItem = {
  id: string;
  name: string;
  status: string;
};

function cannedMessagesApiUrl(organizationId: string | undefined): string {
  const base = "/api/canned-messages";
  if (!organizationId) return base;
  return `${base}?organizationId=${encodeURIComponent(organizationId)}`;
}

async function fetchCannedMessagesFromApi(organizationId: string | undefined): Promise<CannedMessageItem[]> {
  const list = await fetchLegacyListApi<any>(cannedMessagesApiUrl(organizationId), "cannedMessages");
  return list.map((m: any) => ({
    id: m.id,
    name: m.name ?? m.title ?? "Untitled",
    type: (m.type === "IMAGE" ? "IMAGE" : "TEXT") as "TEXT" | "IMAGE",
    text: m.text ?? m.content ?? "",
    imageUrl: m.imageUrl,
    fileName: m.fileName,
  }));
}

async function fetchPublishedChatbotsFromApi(): Promise<InboxChatbotItem[]> {
  const res = await apiRequest("GET", "/api/chatbots");
  const data = await res.json();
  const list = Array.isArray(data) ? data : [];
  return list
    .filter((b: any) => String(b?.status || "").toLowerCase() === "published")
    .map((b: any) => ({
      id: String(b.id),
      name: String(b.name || "Untitled chatbot"),
      status: String(b.status || "published"),
    }))
    .sort((a: InboxChatbotItem, b: InboxChatbotItem) => a.name.localeCompare(b.name));
}
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmojiPicker } from "@/components/emoji-picker";
import { useToast } from "@/hooks/use-toast";
import { clearChatDraft, getChatDraft, setChatDraft } from "@/lib/chat-draft-storage";
import { preparePanelUploadFile } from "@/lib/prepare-panel-upload";
import { PanelUploadLimitsHint } from "@/components/panel-upload-limits-hint";

export type SendMediaCallbacks = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

interface MessageInputProps {
  onSendText: (message: string) => void;
  onSendMedia: (file: File, type: 'image' | 'video' | 'audio' | 'document', caption?: string, callbacks?: SendMediaCallbacks) => void;
  /** When set, IMAGE canned messages with /uploads/ path are sent via this (server-side); avoids client fetch. */
  onSendCannedImage?: (payload: { imagePath: string; caption?: string; fileName?: string }) => void;
  disabled?: boolean;
  showTemplateMode?: boolean;
  replyTo?: { id: string; body: string } | null;
  onClearReply?: () => void;
  /** Opens payment-request dialog (e.g. from chat page). */
  onPaymentRequest?: () => void;
  /** When false, payment button is hidden. */
  showPaymentRequest?: boolean;
  /** Opens meet / Calendly scheduling dialog (chat page). */
  onMeetLink?: () => void;
  showMeetLink?: boolean;
  /** Opens Meta catalog product picker (official WhatsApp only). */
  onCatalogProduct?: () => void;
  showCatalogProduct?: boolean;
  /** Opens WA Pay Review and pay dialog (official WhatsApp + catalog). */
  onWaPay?: () => void;
  showWaPay?: boolean;
  /** Manually start a published chatbot for the open chat. */
  onStartChatbot?: (chatbotId: string) => void;
  /** Persists draft text per chat in local storage. */
  chatId?: string;
}

export function MessageInput({
  onSendText,
  onSendMedia,
  onSendCannedImage,
  disabled,
  showTemplateMode,
  replyTo,
  onClearReply,
  onPaymentRequest,
  showPaymentRequest,
  onMeetLink,
  showMeetLink,
  onCatalogProduct,
  showCatalogProduct,
  onWaPay,
  showWaPay,
  onStartChatbot,
  chatId,
}: MessageInputProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [message, setMessage] = useState(() => getChatDraft(chatId));
  const hasText = message.trim().length > 0;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document'>('image');
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState("");
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoCaption, setVideoCaption] = useState("");
  const [cannedDropdownOpen, setCannedDropdownOpen] = useState(false);
  const [chatbotDropdownOpen, setChatbotDropdownOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const queryClient = useQueryClient();

  // Voice recording
  const [voiceRecordOpen, setVoiceRecordOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [recordPreviewUrl, setRecordPreviewUrl] = useState<string | null>(null);

  const updateMessage = useCallback(
    (value: string) => {
      setMessage(value);
      setChatDraft(chatId, value);
    },
    [chatId]
  );

  const getAcceptByMediaType = useCallback((type: 'image' | 'video' | 'document') => {
    if (type === 'image') return 'image/*';
    if (type === 'video') return 'video/*';
    return '.pdf,.csv,.xls,.xlsx,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }, []);

  const { data: orgData } = useQuery<{ organizations?: { id: string }[] }>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
    enabled: cannedDropdownOpen || chatbotDropdownOpen || toolsMenuOpen,
  });
  const cannedOrgId = Array.isArray(orgData) ? orgData?.[0]?.id : (orgData?.organizations ?? [])[0]?.id;

  const { data: cannedMessages = [] } = useQuery({
    queryKey: ["canned-messages-input", cannedOrgId],
    queryFn: () => fetchCannedMessagesFromApi(cannedOrgId),
    enabled: (cannedDropdownOpen || toolsMenuOpen) && !!cannedOrgId,
  });

  const { data: publishedChatbots = [], isFetching: chatbotsLoading } = useQuery({
    queryKey: ["inbox-chatbots"],
    queryFn: fetchPublishedChatbotsFromApi,
    enabled: (chatbotDropdownOpen || toolsMenuOpen) && !!onStartChatbot,
  });

  const sendCannedMessage = useCallback(
    async (canned: CannedMessageItem) => {
      if (canned.type === "TEXT") {
        if (canned.text.trim()) onSendText(canned.text.trim());
        onClearReply?.();
        setCannedDropdownOpen(false);
        return;
      }
      if (canned.type === "IMAGE" && canned.imageUrl) {
        const caption = canned.text.trim() || undefined;
        const isRelativeUpload = canned.imageUrl.startsWith("/uploads/");
        if (isRelativeUpload && onSendCannedImage) {
          onSendCannedImage({
            imagePath: canned.imageUrl,
            caption,
            fileName: canned.fileName,
          });
          onClearReply?.();
          setCannedDropdownOpen(false);
          return;
        }
        const imageUrlToFetch = isRelativeUpload
          ? resolveApiUrl(`/api/canned-media?path=${encodeURIComponent(canned.imageUrl)}`)
          : (canned.imageUrl.startsWith("http://") || canned.imageUrl.startsWith("https://")
              ? canned.imageUrl
              : `${window.location.origin}${canned.imageUrl.startsWith("/") ? "" : "/"}${canned.imageUrl}`);
        try {
          const res = await fetch(imageUrlToFetch, { credentials: "include" });
          if (!res.ok) throw new Error("Failed to load image");
          const blob = await res.blob();
          const mimeType = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
          const file = new File([blob], canned.fileName || "image.jpg", { type: mimeType });
          onSendMedia(file, "image", caption);
          onClearReply?.();
        } catch {
          if (caption) onSendText(canned.text.trim());
        }
        setCannedDropdownOpen(false);
        return;
      }
      if (canned.text.trim()) onSendText(canned.text.trim());
      onClearReply?.();
      setCannedDropdownOpen(false);
    },
    [onSendText, onSendMedia, onSendCannedImage, onClearReply]
  );

  const startSelectedChatbot = useCallback(
    (chatbot: InboxChatbotItem) => {
      if (!onStartChatbot) return;
      onStartChatbot(chatbot.id);
      setChatbotDropdownOpen(false);
      setToolsMenuOpen(false);
    },
    [onStartChatbot],
  );

  const INPUT_LINE_HEIGHT = 24;
  const inputPaddingY = isMobile ? 16 : 20;
  const MIN_INPUT_HEIGHT = INPUT_LINE_HEIGHT + inputPaddingY;
  const MAX_INPUT_HEIGHT = INPUT_LINE_HEIGHT * 2 + inputPaddingY;

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, MAX_INPUT_HEIGHT);
    el.style.height = `${Math.max(MIN_INPUT_HEIGHT, next)}px`;
  }, [MAX_INPUT_HEIGHT, MIN_INPUT_HEIGHT]);

  const handleSend = () => {
    if ((message.trim() || showTemplateMode) && !disabled) {
      onSendText(message.trim());
      updateMessage("");
      clearChatDraft(chatId);
      onClearReply?.();
      if (textareaRef.current) {
        textareaRef.current.style.height = `${MIN_INPUT_HEIGHT}px`;
      }
    }
  };

  useEffect(() => {
    requestAnimationFrame(() => syncTextareaHeight());
  }, [message, syncTextareaHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const draft = getChatDraft(chatId);
    setMessage(draft);
    requestAnimationFrame(() => syncTextareaHeight());
  }, [chatId, syncTextareaHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateMessage(e.target.value);
  };

  const handlePaste = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => syncTextareaHeight());
    });
  };

  const handleEmojiSelect = (emoji: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const currentValue = message;
      const newValue = currentValue.substring(0, start) + emoji + currentValue.substring(end);
      updateMessage(newValue);
      // Focus and set cursor position after emoji
      setTimeout(() => {
        textareaRef.current?.focus();
        const newCursorPos = start + emoji.length;
        textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
        syncTextareaHeight();
      }, 0);
    } else {
      // Fallback if textarea ref is not available
      updateMessage(message + emoji);
    }
  };

  const handleFileSelect = (type: 'image' | 'video' | 'document') => {
    setMediaType(type);
    if (fileInputRef.current) {
      // Set accept before opening picker so OS dialog applies the right filter immediately.
      fileInputRef.current.accept = getAcceptByMediaType(type);
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (!file) return;

    try {
      const prepared = await preparePanelUploadFile(file);
      if (prepared.compressed) {
        const savedKb = Math.round(prepared.savedBytes / 1024);
        toast({
          title: "Image optimized",
          description: `${file.name} reduced by ~${savedKb} KB before send.`,
          duration: 3500,
        });
      }

      const ready = prepared.file;
      if (mediaType === "image" || prepared.kind === "image") {
        if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
        setPendingImageFile(ready);
        setImagePreviewUrl(URL.createObjectURL(ready));
        setImageCaption("");
        setImagePreviewOpen(true);
      } else if (mediaType === "video" || prepared.kind === "video") {
        if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
        setPendingVideoFile(ready);
        setVideoPreviewUrl(URL.createObjectURL(ready));
        setVideoCaption("");
        setVideoPreviewOpen(true);
      } else {
        const sendType =
          prepared.kind === "audio"
            ? "audio"
            : prepared.kind === "document"
              ? "document"
              : prepared.kind;
        onSendMedia(ready, sendType);
      }
    } catch (error: unknown) {
      toast({
        title: "File not allowed",
        description: error instanceof Error ? error.message : "Upload failed",
        variant: "destructive",
      });
    }
  };

  const handleSendImageWithCaption = () => {
    if (pendingImageFile) {
      onSendMedia(pendingImageFile, 'image', imageCaption.trim() || undefined);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setPendingImageFile(null);
      setImagePreviewUrl(null);
      setImageCaption("");
      setImagePreviewOpen(false);
    }
  };

  const handleCancelImagePreview = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setPendingImageFile(null);
    setImagePreviewUrl(null);
    setImageCaption("");
    setImagePreviewOpen(false);
  };

  const handleSendVideoWithCaption = () => {
    if (pendingVideoFile) {
      onSendMedia(pendingVideoFile, 'video', videoCaption.trim() || undefined);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      setPendingVideoFile(null);
      setVideoPreviewUrl(null);
      setVideoCaption("");
      setVideoPreviewOpen(false);
    }
  };

  const handleCancelVideoPreview = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setPendingVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoCaption("");
    setVideoPreviewOpen(false);
  };

  // Create object URL for playback when we have a recorded blob
  useEffect(() => {
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      setRecordPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setRecordPreviewUrl(null);
  }, [recordedBlob]);

  // Voice recording: cleanup on unmount or when dialog closes
  useEffect(() => {
    if (!voiceRecordOpen) {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      setRecordSeconds(0);
      setRecordedBlob(null);
      setIsRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
      setIsPlayingPreview(false);
    }
  }, [voiceRecordOpen]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg';
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          setRecordedBlob(blob);
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordedBlob(null);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error('Voice recording failed:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const formatRecordTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSendVoiceNote = useCallback(() => {
    if (!recordedBlob || disabled) return;
    if (recordedBlob.size === 0) {
      toast({
        title: "Cannot send",
        description: "Recording is empty. Try recording again.",
        variant: "destructive",
      });
      return;
    }
    const ext = recordedBlob.type.includes('webm') ? 'webm' : 'ogg';
    const file = new File([recordedBlob], `voice-note.${ext}`, { type: recordedBlob.type });
    setIsSendingVoice(true);
    onSendMedia(file, 'audio', undefined, {
      onSuccess: () => {
        onClearReply?.();
        setRecordedBlob(null);
        setVoiceRecordOpen(false);
        setIsSendingVoice(false);
      },
      onError: () => {
        setIsSendingVoice(false);
      },
    });
  }, [recordedBlob, disabled, onSendMedia, onClearReply, toast]);

  const handleCancelVoiceRecord = useCallback(() => {
    setVoiceRecordOpen(false);
    setRecordedBlob(null);
  }, []);

  const togglePreviewPlayback = useCallback(() => {
    if (!recordedBlob || !audioPreviewRef.current) return;
    const audio = audioPreviewRef.current;
    if (isPlayingPreview) {
      audio.pause();
      audio.currentTime = 0;
    } else {
      audio.play();
    }
    setIsPlayingPreview(!isPlayingPreview);
  }, [recordedBlob, isPlayingPreview]);

  const replyBanner = replyTo ? (
    <div
      className={cn(
        "mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        isMobile ? "border-[#d1d7db] bg-white/90" : "border-border bg-muted/60",
      )}
    >
      <span className="flex-1 truncate text-muted-foreground" title={replyTo.body}>
        Replying to: {replyTo.body.length > 50 ? replyTo.body.slice(0, 50) + "…" : replyTo.body}
      </span>
      {onClearReply && (
        <button type="button" onClick={onClearReply} className="rounded p-1 hover:bg-muted" title="Cancel reply">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  ) : null;

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      className="hidden"
      onChange={handleFileChange}
      accept={getAcceptByMediaType(mediaType)}
    />
  );

  const attachMenuItems = (
    <>
      <DropdownMenuItem onClick={() => handleFileSelect("image")} data-testid="button-attach-image">
        <Image className="mr-2 h-4 w-4" />
        Image
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleFileSelect("video")} data-testid="button-attach-video">
        <Video className="mr-2 h-4 w-4" />
        Video
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleFileSelect("document")} data-testid="button-attach-document">
        <FileIcon className="mr-2 h-4 w-4" />
        Document
      </DropdownMenuItem>
      {showPaymentRequest && onPaymentRequest ? (
        <DropdownMenuItem onClick={onPaymentRequest} data-testid="button-payment-request">
          <Banknote className="mr-2 h-4 w-4" />
          Payment request
        </DropdownMenuItem>
      ) : null}
      {showMeetLink && onMeetLink ? (
        <DropdownMenuItem onClick={onMeetLink} data-testid="button-meet-link">
          <CalendarClock className="mr-2 h-4 w-4" />
          Meet / booking link
        </DropdownMenuItem>
      ) : null}
      {showCatalogProduct && onCatalogProduct ? (
        <DropdownMenuItem onClick={onCatalogProduct} data-testid="button-catalog-product">
          <ShoppingBag className="mr-2 h-4 w-4" />
          Catalog product
        </DropdownMenuItem>
      ) : null}
      {showWaPay && onWaPay ? (
        <DropdownMenuItem onClick={onWaPay} data-testid="button-wa-pay-send">
          <CreditCard className="mr-2 h-4 w-4" />
          Review and pay (WA Pay)
        </DropdownMenuItem>
      ) : null}
    </>
  );

  const cannedMenu = (
    <DropdownMenu
      open={cannedDropdownOpen}
      onOpenChange={(open) => {
        setCannedDropdownOpen(open);
        if (open) {
          queryClient.invalidateQueries({ queryKey: ["canned-messages", cannedOrgId] });
          queryClient.invalidateQueries({ queryKey: ["canned-messages-input", cannedOrgId] });
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("rounded-full", isMobile ? "h-10 w-10 text-[#54656f]" : "h-9 w-9")}
          disabled={disabled}
          title="Canned messages"
          data-testid="button-canned"
        >
          <Zap className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[280px] w-56 overflow-y-auto">
        {cannedMessages.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">No canned messages</div>
        ) : (
          cannedMessages.map((canned) => (
            <DropdownMenuItem
              key={canned.id}
              onClick={() => sendCannedMessage(canned)}
              data-testid={`canned-${canned.id}`}
            >
              <span className="truncate">{canned.name}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const chatbotMenu = onStartChatbot ? (
    <DropdownMenu
      open={chatbotDropdownOpen}
      onOpenChange={(open) => {
        setChatbotDropdownOpen(open);
        if (open) {
          queryClient.invalidateQueries({ queryKey: ["inbox-chatbots"] });
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("rounded-full", isMobile ? "h-10 w-10 text-[#54656f]" : "h-9 w-9")}
          disabled={disabled}
          title="Send chatbot"
          data-testid="button-chatbot"
        >
          <Bot className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[280px] w-56 overflow-y-auto">
        {chatbotsLoading ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">Loading chatbots…</div>
        ) : publishedChatbots.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">No published chatbots</div>
        ) : (
          publishedChatbots.map((bot) => (
            <DropdownMenuItem
              key={bot.id}
              onClick={() => startSelectedChatbot(bot)}
              data-testid={`chatbot-${bot.id}`}
            >
              <Bot className="mr-2 h-4 w-4 shrink-0 opacity-60" />
              <span className="truncate">{bot.name}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const messageField = (
    <Textarea
      ref={textareaRef}
      value={message}
      onChange={handleChange}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      placeholder={
        showTemplateMode ? "Template message - parameters filled above" : "Type a message..."
      }
      aria-label="Type a message"
      className={cn(
        "min-w-0 flex-1 resize-none overflow-y-auto overflow-x-hidden border-0 bg-transparent text-base leading-normal shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
        isMobile
          ? "max-h-16 !min-h-[24px] py-2 pl-1 pr-2"
          : "!min-h-[44px] max-h-[68px] rounded-2xl px-4 py-2.5",
      )}
      disabled={disabled || showTemplateMode}
      data-testid="input-message"
      rows={1}
    />
  );

  const waSendMicButton = (
    <button
      type="button"
      onClick={hasText || showTemplateMode ? handleSend : () => setVoiceRecordOpen(true)}
      disabled={(hasText || showTemplateMode ? !hasText && !showTemplateMode : false) || disabled}
      className={cn(
        "wa-send-mic-btn flex shrink-0 items-center justify-center rounded-full border-0 bg-[#008069] p-0 text-white shadow-sm hover:bg-[#006d58] disabled:opacity-50",
        isMobile ? "h-10 w-10" : "h-11 w-11",
      )}
      data-testid={hasText || showTemplateMode ? "button-send" : "button-voice-message"}
      aria-label={hasText || showTemplateMode ? "Send message" : "Voice message"}
    >
      {hasText || showTemplateMode ? <Send className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
    </button>
  );

  const mobileAttachMenu = (
    <DropdownMenu
      onOpenChange={(open) => {
        setToolsMenuOpen(open);
        if (open && cannedOrgId) {
          queryClient.invalidateQueries({ queryKey: ["canned-messages-input", cannedOrgId] });
        }
        if (open && onStartChatbot) {
          queryClient.invalidateQueries({ queryKey: ["inbox-chatbots"] });
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full p-0 text-[#54656f] hover:bg-black/5"
          disabled={disabled}
          data-testid="button-attachment"
          aria-label="Attach or more"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(320px,50vh)] w-52 overflow-y-auto">
        {attachMenuItems}
        {cannedMessages.length > 0 ? (
          <>
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              Canned messages
            </DropdownMenuItem>
            {cannedMessages.map((canned) => (
              <DropdownMenuItem
                key={canned.id}
                onClick={() => sendCannedMessage(canned)}
                data-testid={`canned-${canned.id}`}
              >
                <Zap className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                <span className="truncate">{canned.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
        {onStartChatbot ? (
          <>
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              Chatbots
            </DropdownMenuItem>
            {chatbotsLoading ? (
              <DropdownMenuItem disabled>Loading chatbots…</DropdownMenuItem>
            ) : publishedChatbots.length === 0 ? (
              <DropdownMenuItem disabled>No published chatbots</DropdownMenuItem>
            ) : (
              publishedChatbots.map((bot) => (
                <DropdownMenuItem
                  key={bot.id}
                  onClick={() => startSelectedChatbot(bot)}
                  data-testid={`chatbot-${bot.id}`}
                >
                  <Bot className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                  <span className="truncate">{bot.name}</span>
                </DropdownMenuItem>
              ))
            )}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      className={cn(
        "wa-message-composer",
        isMobile ? "bg-transparent px-2 py-1.5 pb-[max(0.25rem,env(safe-area-inset-bottom))]" : "bg-card p-4",
      )}
      data-testid="container-message-input"
    >
      {replyBanner}
      {fileInput}

      {isMobile ? (
        <div className="grid w-full grid-cols-[minmax(0,8fr)_minmax(0,2fr)] items-end gap-1.5">
          <div className="flex min-w-0 items-end gap-1 rounded-3xl border border-[#e9edef] bg-white px-2 py-1 shadow-sm">
            <div className="shrink-0 self-end pb-0.5">
              <EmojiPicker
                onEmojiSelect={handleEmojiSelect}
                triggerClassName="h-9 w-9 shrink-0 rounded-full text-[#54656f] hover:bg-black/5"
              />
            </div>
            {messageField}
          </div>

          <div className="flex min-w-0 items-end justify-end gap-0.5">
            {mobileAttachMenu}
            {waSendMicButton}
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full"
                disabled={disabled}
                data-testid="button-attachment"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {attachMenuItems}
            </DropdownMenuContent>
          </DropdownMenu>

          {messageField}

          <EmojiPicker onEmojiSelect={handleEmojiSelect} />

          <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border/60 bg-muted/25 px-0.5 py-0.5 dark:bg-muted/15">
            {showPaymentRequest && onPaymentRequest ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-emerald-700 dark:text-emerald-400"
                disabled={disabled}
                type="button"
                title="Send payment request"
                aria-label="Send payment request"
                onClick={onPaymentRequest}
                data-testid="button-payment-request"
              >
                <Banknote className="h-5 w-5" />
              </Button>
            ) : null}
            {showCatalogProduct && onCatalogProduct ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-emerald-700 dark:text-emerald-400"
                disabled={disabled}
                type="button"
                title="Send catalog product"
                aria-label="Send catalog product"
                onClick={onCatalogProduct}
                data-testid="button-catalog-product-toolbar"
              >
                <ShoppingBag className="h-5 w-5" />
              </Button>
            ) : null}
            {showWaPay && onWaPay ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-violet-700 dark:text-violet-400"
                disabled={disabled}
                type="button"
                title="Send Review and pay (WA Pay)"
                aria-label="Send Review and pay"
                onClick={onWaPay}
                data-testid="button-wa-pay-toolbar"
              >
                <CreditCard className="h-5 w-5" />
              </Button>
            ) : null}
            {cannedMenu}
            {chatbotMenu}
          </div>

          {showMeetLink && onMeetLink ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-sky-700 dark:text-sky-400"
              disabled={disabled}
              type="button"
              title="Send meet or booking link"
              aria-label="Send meet or booking link"
              onClick={onMeetLink}
              data-testid="button-meet-link"
            >
              <CalendarClock className="h-5 w-5" />
            </Button>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            disabled={disabled}
            title="Voice message"
            aria-label="Voice message"
            onClick={() => setVoiceRecordOpen(true)}
            data-testid="button-voice-message"
          >
            <Mic className="h-5 w-5" />
          </Button>

          <Button
            onClick={handleSend}
            disabled={(!message.trim() && !showTemplateMode) || disabled}
            className="shrink-0 rounded-full"
            size="icon"
            data-testid="button-send"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      )}

      <Dialog open={imagePreviewOpen} onOpenChange={(open) => !open && handleCancelImagePreview()}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-image-caption">
          <DialogHeader>
            <DialogTitle>Add caption to image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {imagePreviewUrl && (
              <div className="rounded-lg overflow-hidden bg-muted border border-border">
                <img
                  src={imagePreviewUrl}
                  alt="Preview"
                  className="w-full max-h-64 object-contain"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Caption (optional)</label>
              <Textarea
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                placeholder="Type a message..."
                className="min-h-[80px] resize-none"
                disabled={disabled}
                data-testid="input-image-caption"
              />
              <PanelUploadLimitsHint compact />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancelImagePreview}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendImageWithCaption}
              disabled={disabled}
              data-testid="button-send-image-caption"
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voiceRecordOpen} onOpenChange={(open) => !open && handleCancelVoiceRecord()}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-voice-record">
          <DialogHeader>
            <DialogTitle>Voice message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isRecording && (
              <div className="flex items-center justify-center gap-3 py-4">
                <span className="inline-flex h-3 w-3 rounded-full bg-red-500 animate-pulse" aria-hidden />
                <span className="font-mono text-lg tabular-nums text-muted-foreground">
                  {formatRecordTime(recordSeconds)}
                </span>
              </div>
            )}
            {!isRecording && !recordedBlob && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Tap the button below to start recording. Stop when done, then send or cancel.
              </p>
            )}
            {recordedBlob && !isRecording && recordPreviewUrl && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <audio
                    ref={audioPreviewRef}
                    src={recordPreviewUrl}
                    onEnded={() => setIsPlayingPreview(false)}
                    onPlay={() => setIsPlayingPreview(true)}
                    onPause={() => setIsPlayingPreview(false)}
                    className="max-w-full"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={togglePreviewPlayback}
                    className="gap-2"
                  >
                    {isPlayingPreview ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isPlayingPreview ? 'Pause' : 'Play'}
                  </Button>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Duration: {formatRecordTime(recordSeconds)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-between">
            {!recordedBlob ? (
              <>
                <Button type="button" variant="outline" onClick={handleCancelVoiceRecord}>
                  Cancel
                </Button>
                {isRecording ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={stopRecording}
                    className="gap-2"
                    data-testid="button-stop-recording"
                  >
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={startRecording}
                    className="gap-2 bg-[#25d366] hover:bg-[#20bd5a] text-white"
                    data-testid="button-start-recording"
                  >
                    <Mic className="h-4 w-4" />
                    Start recording
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handleCancelVoiceRecord}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSendVoiceNote}
                  disabled={disabled || isSendingVoice}
                  className="gap-2 bg-[#25d366] hover:bg-[#20bd5a] text-white"
                  data-testid="button-send-voice"
                >
                  {isSendingVoice ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={videoPreviewOpen} onOpenChange={(open) => !open && handleCancelVideoPreview()}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-video-caption">
          <DialogHeader>
            <DialogTitle>Add caption to video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {videoPreviewUrl && (
              <div className="rounded-lg overflow-hidden bg-muted border border-border">
                <video
                  src={videoPreviewUrl}
                  controls
                  className="w-full max-h-64 object-contain"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Caption (optional)</label>
              <Textarea
                value={videoCaption}
                onChange={(e) => setVideoCaption(e.target.value)}
                placeholder="Type a message..."
                className="min-h-[80px] resize-none"
                disabled={disabled}
                data-testid="input-video-caption"
              />
              <PanelUploadLimitsHint compact />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancelVideoPreview}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendVideoWithCaption}
              disabled={disabled}
              data-testid="button-send-video-caption"
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
