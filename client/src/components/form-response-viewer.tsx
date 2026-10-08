import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { ClipboardList, Loader2, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export type FlowResponsePayload = {
  id: string;
  phone: string;
  submittedAt?: string;
  data?: Record<string, unknown>;
  flowId?: string | null;
  flowName?: string | null;
};

const HIDDEN_RESPONSE_KEYS = new Set([
  "flow_token",
  "flowToken",
  "flow_id",
  "flowId",
  "version",
  "screen",
]);

export function formatFlowResponseEntries(data?: Record<string, unknown> | null): { key: string; value: string }[] {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data)
    .filter(([key]) => !HIDDEN_RESPONSE_KEYS.has(key))
    .map(([key, value]) => ({
      key,
      value:
        value == null
          ? "—"
          : typeof value === "string"
            ? value
            : typeof value === "number" || typeof value === "boolean"
              ? String(value)
              : JSON.stringify(value),
    }));
}

export function looksLikeFormSubmissionMessage(body?: string | null): boolean {
  const text = (body || "").trim();
  if (!text) return false;
  if (/form\s*submitted/i.test(text)) return true;
  if (/^sent$/i.test(text)) return true;
  return false;
}

export function FlowResponseDataList({ data }: { data?: Record<string, unknown> | null }) {
  const entries = formatFlowResponseEntries(data);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No field answers in this response.</p>;
  }
  return (
    <dl className="space-y-3">
      {entries.map(({ key, value }) => (
        <div key={key} className="rounded-md border bg-muted/30 px-3 py-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{key}</dt>
          <dd className="mt-1 text-sm whitespace-pre-wrap break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

type ChatFormResponseButtonProps = {
  whatsappMessageId?: string | null;
  messageBody?: string | null;
  fromMe?: boolean;
};

/** Shows a "View form response" control on inbound form-submission chat bubbles. */
export function ChatFormResponseButton({
  whatsappMessageId,
  messageBody,
  fromMe,
}: ChatFormResponseButtonProps) {
  const [open, setOpen] = useState(false);
  const enabled = !fromMe && !!whatsappMessageId && looksLikeFormSubmissionMessage(messageBody);

  const { data, isLoading, isError, error } = useQuery<FlowResponsePayload>({
    queryKey: ["/api/whatsapp-flow-responses/by-message", whatsappMessageId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/whatsapp-flow-responses/by-message/${encodeURIComponent(whatsappMessageId!)}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Response not found");
      }
      return res.json();
    },
    enabled: open && enabled,
    retry: false,
  });

  if (!enabled) return null;

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-2 h-8 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <ClipboardList className="h-3.5 w-3.5" />
        View form response
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Form response</DialogTitle>
            <DialogDescription>
              {data?.flowName
                ? `Submitted for “${data.flowName}”`
                : "Answers the customer submitted through the WhatsApp form."}
            </DialogDescription>
          </DialogHeader>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <p className="text-sm text-muted-foreground">
              {(error as Error)?.message || "No stored response found for this message."}
              {" "}
              Open WhatsApp Forms → View responses to browse all submissions.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">
                {data?.phone ? <span className="font-mono">{data.phone}</span> : null}
                {data?.submittedAt
                  ? ` · ${new Date(data.submittedAt).toLocaleString()}`
                  : null}
              </div>
              <FlowResponseDataList data={data?.data} />
              {data?.flowId ? (
                <Link href={`/whatsapp-flows/responses/${data.flowId}`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open all responses
                  </Button>
                </Link>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
