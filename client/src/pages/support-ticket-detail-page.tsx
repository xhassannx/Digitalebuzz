// @ts-nocheck
import { useState, useRef, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { format } from "date-fns";
import { apiRequest, resolveApiUrl, rewritePanelMediaUrlToCurrentOrigin } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Forward, Loader2, Paperclip, RefreshCw, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPPORT_DETAIL_STATUS_STYLES } from "@/features/my-support/useMySupportTicketDetail";
import { tokens } from "@/panel-templates/helicoptic-v1/tokens";
import "@/panel-templates/helicoptic-v1/support-detail-atlas.css";

const STATUSES = [
  "open",
  "pending",
  "in_progress",
  "waiting_on_customer",
  "resolved",
  "closed",
] as const;

type Att = { id: string; fileName: string; url: string; mimeType: string; sizeBytes: number };
type Msg = {
  id: string;
  body: string;
  authorType: "customer" | "agent" | "technical_team";
  authorName?: string;
  createdAt: string;
  attachments: Att[];
};

type TicketDetail = {
  id: string;
  ticketNumber: number;
  subject: string;
  description: string;
  status: (typeof STATUSES)[number];
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  organizationId: string;
  organizationName?: string;
  assignedToUserId: string | null;
  assigneeName: string;
  transferredToTechnical?: boolean;
  messages: Msg[];
  updatedAt: string;
  createdAt: string;
};

export default function SupportTicketDetailPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [match, params] = useRoute("/admin/support/:id");
  const ticketId = match ? params?.id : undefined;
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: ticket, isLoading, isError, error, refetch, isFetching } = useQuery<TicketDetail>({
    queryKey: ["/api/admin/support/tickets", ticketId],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl(`/api/admin/support/tickets/${ticketId}`), {
        credentials: "include",
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      return res.json();
    },
    enabled: !!ticketId,
  });

  const { data: members = [] } = useQuery<{ userId: string; displayName: string }[]>({
    queryKey: ["/api/admin/support/assignable-members", ticket?.organizationId],
    queryFn: async () => {
      if (!ticket?.organizationId) return [];
      const res = await fetch(
        resolveApiUrl(
          `/api/admin/support/assignable-members?organizationId=${encodeURIComponent(ticket.organizationId)}`,
        ),
        { credentials: "include" },
      );
      if (!res.ok) {
        if (res.status === 403) return [];
        const t = await res.text();
        throw new Error(t);
      }
      return res.json();
    },
    enabled: !!ticket?.organizationId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, string | null>) => {
      const res = await apiRequest("PATCH", `/api/admin/support/tickets/${ticketId}`, data);
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/support/tickets"] });
    },
  });

  const messageMutation = useMutation({
    mutationFn: async (fd: FormData) => {
      const res = await fetch(resolveApiUrl(`/api/admin/support/tickets/${ticketId}/messages`), {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const t = await res.text();
        try {
          const j = JSON.parse(t);
          throw new Error(j.error || j.message || t);
        } catch {
          throw new Error(t || "Failed");
        }
      }
      return res.json();
    },
    onSuccess: () => {
      setBody("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/support/tickets", ticketId] });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        resolveApiUrl(`/api/admin/support/tickets/${ticketId}/transfer-technical`),
        { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/support/tickets", ticketId] });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/support/tickets"] });
      toast({ title: "Transferred to Technical Team" });
    },
    onError: (err: Error) => {
      toast({ title: "Transfer failed", description: err.message, variant: "destructive" });
    },
  });

  const onSubmitReply = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !ticketId) return;
    const fd = new FormData();
    fd.append("body", body.trim());
    if (file) {
      fd.append("attachment", file);
    }
    messageMutation.mutate(fd, {
      onError: (err: Error) => {
        toast({ title: "Could not send", description: err.message, variant: "destructive" });
      },
      onSuccess: () => toast({ title: "Message sent" }),
    });
  };

  if (!ticketId) {
    return <div className="p-6">Invalid ticket id.</div>;
  }

  return (
    <div
      className="atlas-support-detail atlas-sd-shell min-h-0 w-full flex-1 px-3 py-3 sm:px-5 sm:py-4 lg:px-6"
      data-testid="page-admin-support-detail"
      style={{ fontFamily: tokens.font.sans }}
    >
      <div className="atlas-sd-shell-inner">
        <div className="atlas-sd-toolbar">
          <Link href="/admin/support" className="atlas-sd-back mb-0">
            <ArrowLeft className="h-4 w-4" />
            Back to tickets
          </Link>
          <button
            type="button"
            className="atlas-sd-icon-btn"
            title="Refresh conversation"
            aria-label="Refresh conversation"
            onClick={() => void refetch()}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--rh-brand,#047857)]" />
          </div>
        ) : isError || !ticket ? (
          <div className="atlas-sd-card p-8 text-center">
            <p className="text-sm text-[#6b7280]">
              {(error as Error)?.message || "Could not load this ticket."}
            </p>
            <button type="button" className="atlas-sd-portal-btn mt-4" onClick={() => void refetch()}>
              Try again
            </button>
          </div>
        ) : (
          <div className="atlas-sd-card atlas-sd-card--detail">
            <div className="atlas-sd-detail-header">
              <div className="atlas-sd-header-top !mb-0">
                <div className="min-w-0">
                  <h1 className="atlas-sd-title">
                    #{ticket.ticketNumber} — {ticket.subject}
                  </h1>
                  <p className="atlas-sd-meta">
                    {ticket.customerName} &lt;{ticket.customerEmail}&gt;
                    {ticket.customerPhone ? ` · ${ticket.customerPhone}` : ""}
                    {ticket.organizationName ? ` · ${ticket.organizationName}` : ""}
                  </p>
                </div>
                <div className="atlas-sd-header-actions">
                  <span
                    className={cn(
                      "atlas-sd-status",
                      SUPPORT_DETAIL_STATUS_STYLES[ticket.status] || "bg-[#f3f4f6] text-[#414754]",
                    )}
                  >
                    {ticket.status.replace(/_/g, " ")}
                  </span>
                  {ticket.transferredToTechnical ? (
                    <span className="atlas-sd-status bg-[#ede9fe] text-[#5b21b6]">
                      With Technical Team
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="atlas-sd-portal-btn"
                      disabled={transferMutation.isPending}
                      onClick={() => {
                        if (confirm("Transfer this ticket to the Technical Team?")) {
                          transferMutation.mutate();
                        }
                      }}
                    >
                      {transferMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Forward className="h-3.5 w-3.5" />
                      )}
                      Transfer
                    </button>
                  )}
                </div>
              </div>

              <div className="atlas-sd-controls">
                <div className="atlas-sd-control">
                  <label className="atlas-sd-field-label">Status</label>
                  <Select
                    value={ticket.status}
                    onValueChange={(v) => {
                      updateMutation.mutate(
                        { status: v },
                        {
                          onError: (e: Error) =>
                            toast({
                              title: "Update failed",
                              description: e.message,
                              variant: "destructive",
                            }),
                          onSuccess: () => {
                            void queryClient.invalidateQueries({
                              queryKey: ["/api/admin/support/tickets", ticketId],
                            });
                            toast({ title: "Status updated" });
                          },
                        },
                      );
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-[#e5e7eb]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="atlas-sd-control">
                  <label className="atlas-sd-field-label">Assignee</label>
                  <Select
                    value={ticket.assignedToUserId || "none"}
                    onValueChange={(v) => {
                      const payload =
                        v === "none" ? { assignedToUserId: null as const } : { assignedToUserId: v };
                      updateMutation.mutate(payload, {
                        onError: (e: Error) =>
                          toast({
                            title: "Update failed",
                            description: e.message,
                            variant: "destructive",
                          }),
                        onSuccess: () => {
                          void queryClient.invalidateQueries({
                            queryKey: ["/api/admin/support/tickets", ticketId],
                          });
                          toast({ title: "Assignee updated" });
                        },
                      });
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-[#e5e7eb]">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="atlas-sd-messages">
              {ticket.messages.length === 0 ? (
                <p className="text-sm text-[#6b7280]">No messages yet.</p>
              ) : (
                ticket.messages.map((m) => {
                  const isAgent = m.authorType === "agent";
                  const isTechnical = m.authorType === "technical_team";
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "atlas-sd-msg",
                        isAgent && "atlas-sd-msg--agent",
                        isTechnical && "atlas-sd-msg--technical",
                      )}
                    >
                      <div className="atlas-sd-msg-head">
                        <span className="atlas-sd-msg-author">
                          {isTechnical
                            ? "Technical Team"
                            : isAgent
                              ? m.authorName || "Support"
                              : ticket.customerName}
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
                          <span className="ml-1 text-[#9ca3af] no-underline">
                            ({Math.round(a.sizeBytes / 1024)} KB)
                          </span>
                        </a>
                      ))}
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={onSubmitReply} className="atlas-sd-reply">
              <label className="atlas-sd-reply-label" htmlFor="admin-support-reply">
                Reply to conversation
              </label>
              <textarea
                id="admin-support-reply"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your reply…"
                className="atlas-sd-reply-input"
                rows={3}
              />
              <div className="atlas-sd-reply-actions">
                <input
                  type="file"
                  className="sr-only"
                  ref={fileInputRef}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  className="atlas-sd-attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach a file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                {file ? <span className="atlas-sd-attach-name">{file.name}</span> : null}
                <button
                  type="submit"
                  className="atlas-sd-send-btn"
                  disabled={!body.trim() || messageMutation.isPending}
                >
                  {messageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send reply
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
