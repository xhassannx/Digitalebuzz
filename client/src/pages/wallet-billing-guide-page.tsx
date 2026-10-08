import { useQuery } from "@tanstack/react-query";
import { marked } from "marked";
import { Link, useLocation } from "wouter";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

marked.setOptions({ gfm: true, breaks: true });

export default function WalletBillingGuidePage() {
  const [location] = useLocation();
  const backHref = location.startsWith("/admin") ? "/admin/wallet-billing" : "/billing/wallet";
  const backLabel = location.startsWith("/admin") ? "Back to wallet billing" : "Back to wallet";

  const { data, isLoading, error } = useQuery<{ markdown: string }>({
    queryKey: ["/api/wallet/billing-guide"],
    queryFn: async () => {
      const res = await fetch("/api/wallet/billing-guide", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load guide");
      }
      return res.json();
    },
  });

  const html = data?.markdown ? marked.parse(data.markdown) : "";

  return (
    <div className="w-full min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {backLabel}
          </Link>
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-6 w-6 shrink-0 text-emerald-600" />
          <h1 className="text-xl font-bold truncate">WhatsApp wallet & Meta billing — setup guide</h1>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <p className="text-destructive text-sm">
          {(error as Error).message}. Ask your platform admin to ensure{" "}
          <code className="text-xs">docs/WHATSAPP_WALLET_BILLING_WHITELABEL_GUIDE.md</code> exists on the server.
        </p>
      )}

      {html && (
        <ScrollArea className="h-[calc(100vh-10rem)] rounded-lg border bg-card p-6 sm:p-8">
          <article
            className="prose prose-slate dark:prose-invert max-w-none prose-table:text-sm"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </ScrollArea>
      )}
    </div>
  );
}
