import { Link } from "wouter";
import { format } from "date-fns";
import { rewritePanelMediaUrlToCurrentOrigin } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ExternalLink, Loader2, MessageSquare, Paperclip } from "lucide-react";
import { usePanelTemplate } from "@/panel-templates/PanelTemplateProvider";
import AtlasMySupportTicketDetailPage from "@/panel-templates/helicoptic-v1/pages/MySupportDetail";
import {
  useMySupportTicketDetail,
  SUPPORT_DETAIL_STATUS_STYLES as STATUS_STYLES,
} from "@/features/my-support/useMySupportTicketDetail";

function DefaultMySupportTicketDetail() {
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

  if (!ticketId) return <div className="p-6">Invalid ticket id.</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Link href="/my-support" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </Link>
      {isLoading || !detail ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>
                    #{detail.ticketNumber} — {detail.subject}
                  </CardTitle>
                  <CardDescription>
                    {detail.organizationName || "Support"} · {detail.customerName}
                  </CardDescription>
                </div>
                <Badge className={STATUS_STYLES[detail.status] || ""} variant="secondary">
                  {detail.status.replace(/_/g, " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => openPortalWithoutReload(detail.customerViewUrl)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open secure ticket link
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
              <CardDescription>All messages for this ticket.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                {detail.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg border p-3 ${m.authorType === "agent" ? "bg-muted/30 border-l-4 border-l-primary" : ""}`}
                  >
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{m.authorType === "agent" ? m.authorName || "Support" : "You"}</span>
                      <span>{m.createdAt ? format(new Date(m.createdAt), "PPp") : ""}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
                    {m.attachments?.map((a) => (
                      <a
                        key={a.id}
                        href={rewritePanelMediaUrlToCurrentOrigin(a.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block text-sm text-primary underline"
                      >
                        {a.fileName}
                      </a>
                    ))}
                  </div>
                ))}
              </div>

              <form onSubmit={onReply} className="space-y-2 border-t pt-3">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your message..."
                  className="min-h-[90px]"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    className="sr-only"
                    ref={replyFileRef}
                    onChange={(e) => setReplyFile(e.target.files?.[0] || null)}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => replyFileRef.current?.click()}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  {replyFile && <span className="text-xs">{replyFile.name}</span>}
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
        </>
      )}
    </div>
  );
}

export default function MySupportTicketDetailPage() {
  const { templateId } = usePanelTemplate();
  if (templateId === "helicoptic-v1") {
    return <AtlasMySupportTicketDetailPage />;
  }
  return <DefaultMySupportTicketDetail />;
}
