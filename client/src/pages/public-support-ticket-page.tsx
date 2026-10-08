import { useState, useRef, FormEvent, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { format } from "date-fns";
import { resolveApiUrl, rewritePanelMediaUrlToCurrentOrigin } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LifeBuoy, Loader2, MessageSquare, Paperclip, LogIn } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-sky-100 text-sky-800",
  pending: "bg-amber-100 text-amber-900",
  in_progress: "bg-violet-100 text-violet-900",
  waiting_on_customer: "bg-orange-100 text-orange-900",
  resolved: "bg-emerald-100 text-emerald-900",
  closed: "bg-slate-200 text-slate-800",
};

type Msg = {
  id: string;
  body: string;
  authorType: string;
  authorName?: string;
  createdAt: string;
  attachments: { id: string; fileName: string; url: string; sizeBytes: number }[];
};

type Detail = {
  id: string;
  ticketNumber: number;
  subject: string;
  status: string;
  customerName: string;
  messages: Msg[];
  customerViewUrl?: string;
  organizationName?: string;
};

export default function PublicSupportTicketPage() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const accessToken = useMemo(() => {
    const s = new URLSearchParams(window.location.search);
    return s.get("accessToken") || "";
  }, [location]);

  const { data: ticket, isLoading } = useQuery<Detail>({
    queryKey: ["/api/public/support/tickets", accessToken],
    queryFn: async () => {
      if (!accessToken) throw new Error("Missing accessToken");
      const res = await fetch(
        resolveApiUrl(`/api/public/support/tickets?accessToken=${encodeURIComponent(accessToken)}`)
      );
      if (!res.ok) throw new Error("Ticket not found");
      return res.json();
    },
    enabled: accessToken.length > 0,
  });

  const replyMut = useMutation({
    mutationFn: async (vars: { id: string; fd: FormData }) => {
      const res = await fetch(
        resolveApiUrl(`/api/public/support/tickets/${vars.id}/messages`),
        { method: "POST", body: vars.fd }
      );
      if (!res.ok) {
        const t = await res.text();
        try {
          const j = JSON.parse(t);
          throw new Error(j.error || t);
        } catch {
          throw new Error(t);
        }
      }
      return res.json();
    },
    onSuccess: () => {
      setReply("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      void queryClient.invalidateQueries({ queryKey: ["/api/public/support/tickets", accessToken] });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !ticket) return;
    const fd = new FormData();
    fd.append("accessToken", accessToken);
    fd.append("body", reply.trim());
    if (file) {
      fd.append("attachment", file);
    }
    replyMut.mutate(
      { id: ticket.id, fd },
    {
      onError: (err: Error) => {
        // eslint-disable-next-line no-alert
        alert(err.message);
      },
    }
    );
  };

  if (!accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Missing <code>accessToken</code> in the link. Check your email.</p>
            <p className="mt-2">
              <Link className="text-primary underline" href="/login">Log in</Link> to open <strong>My support</strong> instead.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <LifeBuoy className="h-7 w-7" />
            <span className="font-semibold">Support</span>
          </div>
          {!isAuthenticated && (
            <Button variant="outline" size="sm" asChild>
              <a href="/login" className="inline-flex items-center">
                <LogIn className="h-4 w-4 mr-1" />
                Log in
              </a>
            </Button>
          )}
        </div>
        {isLoading || !ticket ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>#{ticket.ticketNumber} — {ticket.subject}</CardTitle>
                  {ticket.organizationName && (
                    <CardDescription className="mt-1">{ticket.organizationName}</CardDescription>
                  )}
                </div>
                <Badge className={STATUS_STYLES[ticket.status] || ""} variant="secondary">
                  {ticket.status.replace(/_/g, " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Hi {ticket.customerName}, you can add messages below. You will be notified by email on each reply.</p>
              <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                {ticket.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg border p-3 ${
                      m.authorType === "agent" ? "border-l-4 border-l-primary bg-slate-50" : "bg-white"
                    }`}
                  >
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {m.authorType === "agent" ? m.authorName || "Support" : "You"}
                      </span>
                      <span>{m.createdAt && format(new Date(m.createdAt), "PPp")}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
                    {m.attachments?.map((a) => (
                      <a
                        key={a.id}
                        href={rewritePanelMediaUrlToCurrentOrigin(a.url)}
                        className="mt-1 block text-sm text-primary underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {a.fileName}
                      </a>
                    ))}
                  </div>
                ))}
              </div>
              <form onSubmit={onSubmit} className="space-y-2 border-t pt-3">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Add a follow-up message…"
                  className="min-h-[100px]"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    className="sr-only"
                    ref={fileRef}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  {file && <span className="text-xs text-muted-foreground">{file.name}</span>}
                  <Button type="submit" disabled={!reply.trim() || replyMut.isPending}>
                    {replyMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4 mr-1" />
                    )}
                    Send
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
