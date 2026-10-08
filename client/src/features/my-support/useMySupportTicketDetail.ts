import { useRef, useState, type FormEvent } from "react";
import { useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { resolveApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export const SUPPORT_DETAIL_STATUS_STYLES: Record<string, string> = {
  open: "bg-sky-100 text-sky-800",
  pending: "bg-amber-100 text-amber-900",
  in_progress: "bg-violet-100 text-violet-900",
  waiting_on_customer: "bg-orange-100 text-orange-900",
  resolved: "bg-emerald-100 text-emerald-900",
  closed: "bg-slate-200 text-slate-800",
};

export type SupportMessage = {
  id: string;
  body: string;
  authorType: string;
  authorName?: string;
  createdAt: string;
  attachments: { id: string; fileName: string; url: string; sizeBytes: number }[];
};

export type SupportTicketDetail = {
  id: string;
  ticketNumber: number;
  subject: string;
  status: string;
  customerName: string;
  customerViewUrl: string;
  organizationName?: string;
  messages: SupportMessage[];
};

export function useMySupportTicketDetail() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [match, params] = useRoute("/my-support/:id");
  const ticketId = match ? params?.id : undefined;
  const [reply, setReply] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const replyFileRef = useRef<HTMLInputElement>(null);

  const { data: detail, isLoading } = useQuery<SupportTicketDetail>({
    queryKey: ["/api/me/support/tickets", ticketId],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl(`/api/me/support/tickets/${ticketId}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!ticketId,
  });

  const replyMut = useMutation({
    mutationFn: async (fd: FormData) => {
      const res = await fetch(resolveApiUrl(`/api/me/support/tickets/${ticketId}/messages`), {
        method: "POST",
        body: fd,
        credentials: "include",
      });
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
      setReplyFile(null);
      if (replyFileRef.current) replyFileRef.current.value = "";
      void queryClient.invalidateQueries({ queryKey: ["/api/me/support/tickets", ticketId] });
      void queryClient.invalidateQueries({ queryKey: ["/api/me/support/tickets"] });
      toast({ title: "Message sent" });
    },
  });

  const onReply = (e: FormEvent) => {
    e.preventDefault();
    if (!ticketId || !reply.trim()) return;
    const fd = new FormData();
    fd.append("body", reply.trim());
    if (replyFile) fd.append("attachment", replyFile);
    replyMut.mutate(fd, {
      onError: (err: Error) =>
        toast({ title: "Failed", description: err.message, variant: "destructive" }),
    });
  };

  const openPortalWithoutReload = (url: string) => {
    try {
      const u = new URL(url, window.location.origin);
      if (u.origin === window.location.origin) {
        window.history.pushState({}, "", `${u.pathname}${u.search}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return {
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
  };
}
