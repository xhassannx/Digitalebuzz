/**
 * Atlas (Emerald) Support ticket detail — Rh-whatsapp "Refined Aesthetic".
 *
 * UI-only reskin of the shared /my-support/:id page. All data/behaviour comes
 * from useMySupportTicketDetail() so the conversation + reply flow is unchanged.
 */
import { Link } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink, Loader2, Paperclip, Send } from "lucide-react";
import { rewritePanelMediaUrlToCurrentOrigin } from "@/lib/queryClient";
import {
  useMySupportTicketDetail,
  SUPPORT_DETAIL_STATUS_STYLES,
} from "@/features/my-support/useMySupportTicketDetail";
import { cn } from "@/lib/utils";
import { tokens } from "../tokens";

export default function AtlasMySupportTicketDetailPage() {
  const {
    ticketId,
    detail,
    isLoading,
    reply,
    setReply,
    replyFile,
    setReplyFile,
    replyFileRef,
    replyMut,
    onReply,
    openPortalWithoutReload,
  } = useMySupportTicketDetail();

  if (!ticketId) {
    return <div className="p-6">Invalid ticket id.</div>;
  }

  return (
    <div
      className="atlas-support-detail atlas-sd-shell min-h-0 w-full flex-1 px-3 py-3 sm:px-5 sm:py-4 lg:px-6"
      data-testid="page-my-support-detail"
      style={{ fontFamily: tokens.font.sans }}
    >
      <div className="atlas-sd-shell-inner">
        <div className="atlas-sd-toolbar">
          <Link href="/my-support" className="atlas-sd-back mb-0">
            <ArrowLeft className="h-4 w-4" />
            Back to tickets
          </Link>
        </div>

        {isLoading || !detail ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--rh-brand,#047857)]" />
          </div>
        ) : (
          <div className="atlas-sd-card atlas-sd-card--detail">
            <div className="atlas-sd-detail-header">
              <div className="atlas-sd-header-top !mb-0">
                <div className="min-w-0">
                  <h1 className="atlas-sd-title">
                    #{detail.ticketNumber} — {detail.subject}
                  </h1>
                  <p className="atlas-sd-meta">
                    {detail.organizationName || "Support"} · {detail.customerName}
                  </p>
                </div>
                <span
                  className={cn(
                    "atlas-sd-status",
                    SUPPORT_DETAIL_STATUS_STYLES[detail.status] || "bg-[#f3f4f6] text-[#414754]",
                  )}
                >
                  {detail.status.replace(/_/g, " ")}
                </span>
              </div>
              <button
                type="button"
                className="atlas-sd-portal-btn mt-3"
                onClick={() => openPortalWithoutReload(detail.customerViewUrl)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open secure ticket link
              </button>
            </div>

            <div className="atlas-sd-messages">
              {detail.messages.map((m) => {
                const isAgent = m.authorType === "agent";
                return (
                  <div
                    key={m.id}
                    className={cn("atlas-sd-msg", isAgent && "atlas-sd-msg--agent")}
                  >
                    <div className="atlas-sd-msg-head">
                      <span className="atlas-sd-msg-author">
                        {isAgent ? m.authorName || "Support" : "You"}
                      </span>
                      <span className="atlas-sd-msg-time">
                        {m.createdAt ? format(new Date(m.createdAt), "PPp") : ""}
                      </span>
                    </div>
                    <p className="atlas-sd-msg-body">{m.body}</p>
                    {m.attachments?.map((a) => (
                      <a
                        key={a.id}
                        href={rewritePanelMediaUrlToCurrentOrigin(a.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="atlas-sd-msg-attach"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {a.fileName}
                      </a>
                    ))}
                  </div>
                );
              })}
            </div>

            <form onSubmit={onReply} className="atlas-sd-reply">
              <label className="atlas-sd-reply-label" htmlFor="my-support-reply">
                Reply to conversation
              </label>
              <textarea
                id="my-support-reply"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your message..."
                className="atlas-sd-reply-input"
                rows={3}
              />
              <div className="atlas-sd-reply-actions">
                <input
                  type="file"
                  className="sr-only"
                  ref={replyFileRef}
                  onChange={(e) => setReplyFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  className="atlas-sd-attach-btn"
                  onClick={() => replyFileRef.current?.click()}
                  aria-label="Attach a file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                {replyFile ? (
                  <span className="atlas-sd-attach-name">{replyFile.name}</span>
                ) : null}
                <button
                  type="submit"
                  className="atlas-sd-send-btn"
                  disabled={!reply.trim() || replyMut.isPending}
                >
                  {replyMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
