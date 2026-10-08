import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUnreadBadgeLabel } from "@/lib/format-unread-badge";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { Chat } from "@shared/schema";

type PastelColor = {
  bgStyle?: string;
  textStyle?: string;
};

function formatChatListTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function NovaChatListItem({
  chat,
  isActive,
  assignmentMode,
  isAssignmentSelected,
  onSelect,
  onAssignmentToggle,
  onPrefetch,
  pastelColor,
  checkboxClassName,
  showUnreadBadge,
  statusTag,
  contactTagNames = [],
}: {
  chat: Chat;
  isActive: boolean;
  assignmentMode: boolean;
  isAssignmentSelected: boolean;
  onSelect: () => void;
  onAssignmentToggle: (checked: boolean) => void;
  onPrefetch?: () => void;
  pastelColor: PastelColor;
  checkboxClassName?: string;
  showUnreadBadge: boolean;
  statusTag?: { emoji: string; label: string } | null;
  contactTagNames?: string[];
}) {
  const initials = chat.contactName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const timeLabel = formatChatListTime(chat.lastMessageTime ?? null);

  return (
    <div
      className={cn("nova-chat-row", isActive && !assignmentMode && "nova-chat-row--active")}
      data-testid={`nova-chat-row-${chat.id}`}
    >
      {assignmentMode ? (
        <div className="nova-chat-row-check flex items-center pl-3">
          <Checkbox
            checked={isAssignmentSelected}
            className={checkboxClassName}
            onCheckedChange={(checked) => onAssignmentToggle(checked === true)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      <div
        role="button"
        tabIndex={assignmentMode ? -1 : 0}
        className="nova-chat-row-body"
        onClick={() => {
          if (assignmentMode) return;
          onSelect();
        }}
        onMouseEnter={() => onPrefetch?.()}
        onKeyDown={(e) => {
          if (assignmentMode) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <div className="shrink-0">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold"
            style={{
              backgroundColor: pastelColor.bgStyle,
              color: pastelColor.textStyle,
            }}
          >
            {initials}
          </div>
        </div>
        <div className="nova-chat-row-text">
          <div className="nova-chat-row-head">
            <p className="nova-contact-name text-sm font-medium">
              {chat.contactName}
            </p>
            {showUnreadBadge && chat.unreadCount > 0 ? (
              <Badge className="nova-unread-badge flex items-center justify-center rounded-full p-0 text-white">
                {formatUnreadBadgeLabel(chat.unreadCount)}
              </Badge>
            ) : null}
            {timeLabel ? <span className="nova-chat-time">{timeLabel}</span> : null}
          </div>
          {chat.lastMessage ? (
            <p className="nova-last-message text-xs text-[#6b7280]">{chat.lastMessage}</p>
          ) : null}
          {statusTag ? (
            <span
              className="nova-contact-tag mt-1 inline-flex w-fit max-w-full items-center gap-1 self-start rounded-md border border-neutral-300/90 bg-neutral-200 px-1.5 py-0.5 text-[11px] font-medium leading-tight text-neutral-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-600 dark:text-zinc-50"
              title={contactTagNames.length > 1 ? contactTagNames.join(", ") : undefined}
            >
              <span className="shrink-0" aria-hidden>
                {statusTag.emoji}
              </span>
              <span className="min-w-0 truncate">{statusTag.label}</span>
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className={cn("nova-summarize-btn", !isActive && "nova-summarize-btn--muted")}
        onClick={(e) => e.stopPropagation()}
        title="Summarize conversation"
        aria-label="Summarize conversation"
        data-testid={`button-summarize-${chat.id}`}
      >
        <ChevronDown className="nova-summarize-icon shrink-0" strokeWidth={2.5} aria-hidden />
        <span className="nova-summarize-label"></span>
      </button>
    </div>
  );
}
