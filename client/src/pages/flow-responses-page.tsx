// @ts-nocheck
import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, MessageSquare, ArrowLeft, Eye } from "lucide-react";
import { FlowResponseDataList } from "@/components/form-response-viewer";

type FlowResponse = {
  id: string;
  phone: string;
  submittedAt: string;
  data?: Record<string, unknown>;
  flowName?: string | null;
};

function flowResponsesUrl(flowId: string, organizationId: string | undefined, query: URLSearchParams): string {
  const base = `/api/whatsapp-flows/${flowId}/responses`;
  if (organizationId) query.set("organizationId", organizationId);
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

export default function FlowResponsesPage() {
  const [, params] = useRoute("/whatsapp-flows/responses/:flowId");
  const flowId = params?.flowId ?? "";
  const [phoneFilter, setPhoneFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FlowResponse | null>(null);
  const rowsPerPage = 10;

  const { data: orgData } = useQuery<{ organizations?: { id: string }[] }>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
  });
  const organizationsList = Array.isArray(orgData) ? orgData : (orgData?.organizations ?? []);
  const organizationId = organizationsList[0]?.id;

  const flowUrl = organizationId
    ? `/api/whatsapp-flows/${flowId}?organizationId=${encodeURIComponent(organizationId)}`
    : `/api/whatsapp-flows/${flowId}`;

  const { data: flow, isLoading: flowLoading } = useQuery({
    queryKey: ["/api/whatsapp-flows", organizationId, flowId],
    queryFn: async () => {
      const res = await apiRequest("GET", flowUrl);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!flowId,
  });

  const { data: responsesData, isLoading: responsesLoading, error: responsesError, refetch } = useQuery<{
    responses: FlowResponse[];
    total: number;
  }>({
    queryKey: ["/api/whatsapp-flows", organizationId, flowId, "responses", page, phoneFilter],
    queryFn: async () => {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("limit", String(rowsPerPage));
      if (phoneFilter.trim()) q.set("phone", phoneFilter.trim());
      const res = await apiRequest(
        "GET",
        flowResponsesUrl(flowId, organizationId, q)
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load responses");
      }
      return res.json();
    },
    enabled: !!flowId,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const responses = responsesData?.responses ?? [];
  const total = responsesData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const start = (page - 1) * rowsPerPage;
  const end = Math.min(start + rowsPerPage, total);

  if (!flowId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Invalid flow.</p>
        <Link href="/whatsapp-flows">
          <Button variant="link" className="mt-2">
            Back to Forms
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/whatsapp-flows">Whatsapp Forms</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Responses</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-4">
        <Link href="/whatsapp-flows">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-semibold">Form responses</h1>
          <p className="text-muted-foreground mt-1">
            {flow?.name ? `${flow.name} · ` : ""}
            Customer submissions for this WhatsApp form
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label htmlFor="phone-filter" className="text-sm font-medium whitespace-nowrap">
                Phone
              </label>
              <Input
                id="phone-filter"
                placeholder="Filter by phone"
                value={phoneFilter}
                onChange={(e) => {
                  setPhoneFilter(e.target.value);
                  setPage(1);
                }}
                className="max-w-[200px]"
              />
            </div>
          </div>

          {flowLoading || responsesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : responsesError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <p className="text-destructive font-medium">Could not load responses.</p>
              <p className="text-sm text-muted-foreground">{(responsesError as Error).message}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : responses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-medium">No responses found.</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                When a customer opens the form from a template (View button) and submits it,
                their answers will appear here. If you already see a submission in Inbox,
                open that chat and use <span className="font-medium">View form response</span>,
                then refresh this page.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
                Refresh
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table scrollOnMobile className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone</TableHead>
                    <TableHead>Submitted at</TableHead>
                    <TableHead>Answers</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.map((r) => {
                    const previewKeys = Object.keys(r.data || {}).filter(
                      (k) => !["flow_token", "flowToken", "flow_id", "flowId", "version", "screen"].includes(k)
                    );
                    const preview =
                      previewKeys.length > 0
                        ? previewKeys
                            .slice(0, 3)
                            .map((k) => `${k}: ${String((r.data as any)[k] ?? "")}`)
                            .join(" · ")
                        : "—";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm whitespace-nowrap">{r.phone}</TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {r.submittedAt
                            ? new Date(r.submittedAt).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[360px]">
                          <span className="line-clamp-2">{preview}</span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => setSelected(r)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {total === 0 ? 0 : start + 1} to {end} of {total} entries
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                Rows per page: {rowsPerPage}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                >
                  «
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </Button>
                <span className="text-sm px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  ›
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  »
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Form response</DialogTitle>
            <DialogDescription>
              {selected?.phone ? (
                <span className="font-mono">{selected.phone}</span>
              ) : null}
              {selected?.submittedAt
                ? ` · ${new Date(selected.submittedAt).toLocaleString()}`
                : null}
            </DialogDescription>
          </DialogHeader>
          <FlowResponseDataList data={selected?.data} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
