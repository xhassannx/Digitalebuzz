import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, MoreVertical, Pencil, Check, X, Loader2 } from "lucide-react";
import { getPastelColorForName, cn } from "@/lib/utils";
import { useInboxAccent } from "@/panel-templates/ratehonk-v1/useInboxAccent";
import { useIsMobile } from "@/hooks/use-mobile";

interface ConversationHeaderProps {
  contactName: string;
  contactNumber: string;
  contactProfilePic?: string;
  isOnline?: boolean;
  lastSeen?: Date;
  activeDeviceName?: string;
  optIn?: boolean;
  onOptInChange?: (checked: boolean) => void;
  /** Mobile: return to conversation list */
  onBack?: () => void;
  /** When set, clicking the avatar or phone/status line opens contact details (e.g. right-side panel) */
  onHeaderClick?: () => void;
  /** When set, pencil allows renaming (requires manage_contacts.edit from parent) */
  onRenameContact?: (newName: string) => Promise<void>;
  isRenaming?: boolean;
}

function formatPhoneDisplay(contactNumber: string): string {
  const digits = contactNumber.replace(/@c\.us|@g\.us|[^\d]/g, "").trim();
  return digits ? `+${digits}` : contactNumber || "";
}

export function ConversationHeader({
  contactName,
  contactNumber,
  contactProfilePic,
  isOnline,
  lastSeen,
  activeDeviceName,
  optIn = true,
  onOptInChange,
  onBack,
  onHeaderClick,
  onRenameContact,
  isRenaming = false,
}: ConversationHeaderProps) {
  const accent = useInboxAccent();
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(contactName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(contactName);
  }, [contactName, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusText = () => {
    if (isOnline) return "online";
    if (lastSeen) {
      const now = new Date();
      const diff = now.getTime() - new Date(lastSeen).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return "last seen just now";
      if (minutes < 60) return `last seen ${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `last seen ${hours}h ago`;
      return "last seen recently";
    }
    return formatPhoneDisplay(contactNumber);
  };

  const displayPhone = formatPhoneDisplay(contactNumber);
  const pastelColor = getPastelColorForName(contactName);
  const showRename = Boolean(onRenameContact);

  const saveRename = async () => {
    const next = draft.trim();
    if (!next || next === contactName.trim()) {
      setEditing(false);
      setDraft(contactName);
      return;
    }
    if (!onRenameContact) return;
    await onRenameContact(next);
    setEditing(false);
  };

  const cancelRename = () => {
    setDraft(contactName);
    setEditing(false);
  };

  const avatarInner = (
    <Avatar className={cn(isMobile ? "h-9 w-9" : "h-10 w-10")}>
      {contactProfilePic ? <AvatarImage src={contactProfilePic} alt={contactName} /> : null}
      <AvatarFallback
        className={cn("font-bold", pastelColor.bg, pastelColor.text)}
        style={{
          backgroundColor: pastelColor.bgStyle,
          color: pastelColor.textStyle,
        }}
      >
        {getInitials(contactName)}
      </AvatarFallback>
    </Avatar>
  );

  const avatarBlock = (
    <div className="relative shrink-0">
      {avatarInner}
      {!isMobile && (
        <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-[#25d366] p-0.5 dark:border-muted">
          <svg viewBox="0 0 24 24" className="h-full w-full fill-white text-white" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-1.123-2.03-1.25-.272-.128-.47-.191-.669.191-.198.382-.768 1.25-.941 1.507-.173.256-.347.29-.644.097-.297-.191-1.253-.463-2.386-1.475-.881-.788-1.477-1.761-1.65-2.056-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
        </div>
      )}
    </div>
  );

  const nameRow = editing ? (
    <>
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void saveRename();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelRename();
          }
        }}
        disabled={isRenaming}
        className={cn(
          "h-8 text-sm font-medium",
          isMobile ? "w-full min-w-0" : "max-w-[min(100%,280px)]",
        )}
        maxLength={200}
        data-testid="input-contact-rename"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-green-600 hover:text-green-700"
        disabled={isRenaming || !draft.trim()}
        onClick={() => void saveRename()}
        aria-label="Save name"
      >
        {isRenaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={isRenaming}
        onClick={cancelRename}
        aria-label="Cancel rename"
      >
        <X className="h-4 w-4" />
      </Button>
    </>
  ) : (
    <>
      <p
        className={cn(
          "min-w-0 font-semibold",
          isMobile
            ? "truncate text-base font-medium leading-tight text-white"
            : "truncate text-sm font-medium text-[#111b21] dark:text-foreground",
        )}
        data-testid="text-contact-name"
      >
        {contactName}
      </p>
      {showRename && !isMobile && (
        <button
          type="button"
          className="shrink-0 rounded-md p-1.5 text-[#00a884] transition-colors hover:bg-black/5 hover:text-[#008f72] dark:text-green-400 dark:hover:bg-white/10 dark:hover:text-green-300"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(contactName);
            setEditing(true);
          }}
          disabled={isRenaming}
          aria-label="Edit contact name"
          title="Edit name"
        >
          <Pencil className="h-4 w-4" strokeWidth={2.25} />
        </button>
      )}
    </>
  );

  const statusRow = (
    <div className="flex min-w-0 items-center gap-2">
      {isOnline && !isMobile && <span className="h-2 w-2 shrink-0 rounded-full bg-[#00a884]" />}
      {onHeaderClick && !isMobile ? (
        <button
          type="button"
          onClick={() => onHeaderClick()}
          className="min-w-0 truncate rounded-sm text-left text-xs text-[#667781] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 dark:text-muted-foreground"
          data-testid="text-contact-status"
          aria-label="Open contact details"
        >
          {displayPhone || getStatusText()}
        </button>
      ) : (
        <p
          className={cn(
            "min-w-0 truncate text-xs",
            isMobile ? "text-white/80" : "text-[#667781] dark:text-muted-foreground",
          )}
          data-testid="text-contact-status"
        >
          {isMobile
            ? activeDeviceName || (isOnline ? "online" : getStatusText())
            : displayPhone || getStatusText()}
        </p>
      )}
    </div>
  );

  const optInControl =
    onOptInChange ? (
      <div className="flex shrink-0 items-center gap-2">
        <Label htmlFor="optin-toggle" className="whitespace-nowrap text-xs font-medium text-muted-foreground">
          OptIn
        </Label>
        <Switch
          id="optin-toggle"
          checked={optIn}
          onCheckedChange={onOptInChange}
          className={cn(
            "h-6 w-11 shrink-0",
            accent.isRatehonk
              ? "data-[state=checked]:bg-[#0059bb]"
              : "data-[state=checked]:bg-[#00a884]",
          )}
        />
      </div>
    ) : null;

  const mobileMenu =
    isMobile && (onOptInChange || showRename) ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-12 w-10 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10"
            aria-label="Chat options"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {onOptInChange ? (
            <DropdownMenuItem
              className="flex items-center justify-between gap-3"
              onSelect={(e) => e.preventDefault()}
            >
              <span className="text-sm">Opt-in</span>
              <Switch
                checked={optIn}
                onCheckedChange={onOptInChange}
                className={cn(
                  "h-6 w-11 shrink-0",
                  accent.isRatehonk
                    ? "data-[state=checked]:bg-[#0059bb]"
                    : "data-[state=checked]:bg-[#00a884]",
                )}
              />
            </DropdownMenuItem>
          ) : null}
          {showRename ? (
            <DropdownMenuItem
              onSelect={() => {
                setDraft(contactName);
                setEditing(true);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit name
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  if (isMobile) {
    const headerMain = (
      <>
        {avatarBlock}
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex min-w-0 items-center gap-1">{nameRow}</div>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-1">{nameRow}</div>
              {statusRow}
            </>
          )}
        </div>
      </>
    );

    return (
      <div
        className={cn(
          "flex h-[52px] shrink-0 items-center pr-1 text-white shadow-sm",
          accent.mobileConversationHeader,
        )}
        data-testid="header-conversation"
      >
        {onBack ? (
          <button
            type="button"
            className="flex h-12 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
            aria-label="Back to conversations"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBack();
            }}
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
        ) : null}
        {onHeaderClick ? (
          <button
            type="button"
            onClick={() => onHeaderClick()}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-1 pr-1 text-left hover:bg-white/10"
            aria-label="Open contact details"
          >
            {headerMain}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3 py-1 pr-1">{headerMain}</div>
        )}
        {mobileMenu}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-16 shrink-0 items-center justify-between px-4",
        accent.conversationHeader,
      )}
      data-testid="header-conversation"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {onHeaderClick ? (
          <button
            type="button"
            onClick={() => onHeaderClick()}
            className="-ml-2 shrink-0 cursor-pointer rounded-md p-2 transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 dark:hover:bg-white/5"
            aria-label="Open contact details"
          >
            {avatarBlock}
          </button>
        ) : (
          <div className="-ml-2 shrink-0 p-2">{avatarBlock}</div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1.5">{nameRow}</div>
          {statusRow}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {activeDeviceName && (
          <div className="flex items-center gap-2 text-xs text-[#667781] dark:text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[#00a884]" />
            <span className="font-medium">{activeDeviceName}</span>
          </div>
        )}
        {optInControl}
      </div>
    </div>
  );
}
