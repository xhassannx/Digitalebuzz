import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { resolveApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Forward, Loader2, Plus, RefreshCw, ShieldCheck, Ticket, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPPORT_STATUS_STYLES } from "@/features/my-support/useMySupportPage";
import { tokens } from "@/panel-templates/helicoptic-v1/tokens";
import { RhButton } from "@/panel-templates/ratehonk-v1/components/rh";
import "@/panel-templates/helicoptic-v1/my-support-atlas.css";

type Row = {
  id: string;
  ticketNumber: number;
  subject: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  assigneeName: string;
  organizationName?: string;
  transferredToTechnical?: boolean;
  updatedAt: string;
};

const RESOLVED_STATUSES = new Set(["resolved", "closed"]);

export default function SupportTicketsListPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [transferOnCreate, setTransferOnCreate] = useState(true);

  const { data: rows = [], isLoading, isFetching, refetch } = useQuery<Row[]>({
    queryKey: ["/api/admin/support/tickets"],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl("/api/admin/support/tickets"), { credentials: "include" });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || res.statusText);
      }
      return res.json();
    },
  });

  const { data: orgs = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/admin/support/organizations"],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl("/api/admin/support/organizations"), { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(resolveApiUrl("/api/admin/support/tickets"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
          organizationId,
          customerName: customerName.trim() || "SaaS Admin",
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          transferToTechnical: transferOnCreate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      return data;
    },
    onSuccess: (data) => {
      setCreateOpen(false);
      setSubject("");
      setDescription("");
      setOrganizationId("");
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/support/tickets"] });
      toast({
        title: transferOnCreate ? "Ticket created & transferred" : "Ticket created",
        description: data.transferredToTechnical
          ? "Technical Team can now see this ticket."
          : `Ticket #${data.ticketNumber} created.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Could not create ticket", description: err.message, variant: "destructive" });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await fetch(resolveApiUrl(`/api/admin/support/tickets/${ticketId}/transfer-technical`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/support/tickets"] });
      toast({ title: "Transferred to Technical Team" });
    },
    onError: (err: Error) => {
      toast({ title: "Transfer failed", description: err.message, variant: "destructive" });
    },
  });

  const openCount = rows.filter((r) => !RESOLVED_STATUSES.has(r.status)).length;
  const resolvedCount = rows.filter((r) => RESOLVED_STATUSES.has(r.status)).length;

  return (
    <div
      className="atlas-support min-h-full w-full px-3 py-4 sm:px-5 sm:py-6 lg:px-6"
      data-testid="page-admin-support"
      style={{ fontFamily: tokens.font.sans }}
    >
      <div className="mx-auto w-full max-w-6xl">
        <header className="atlas-sup-header">
          <div className="min-w-0">
            <h1 className="atlas-sup-title">Support</h1>
            <p className="atlas-sup-subtitle">
              Tickets from your customers. Assign, reply, or transfer unresolved issues to the
              Technical Team.
            </p>
            <p className="atlas-sup-sla-note">
              Your ticket will be seen/opened within 2 hours, and you will get an update within 24
              hours after the ticket has been seen.
            </p>
          </div>

          <div className="atlas-sup-header-actions">
            <button
              type="button"
              className="atlas-sup-icon-btn"
              title="Refresh tickets"
              aria-label="Refresh tickets"
              onClick={() => void refetch()}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </button>
            <button type="button" className="atlas-sup-new-btn" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create ticket
            </button>
          </div>
        </header>

        <section className="atlas-sup-tickets">
          <div className="atlas-sup-tickets-head">
            <div className="min-w-0">
              <h2 className="atlas-sup-tickets-title">Tickets</h2>
              <p className="atlas-sup-tickets-sub">
                Assign to team members, reply, or transfer to the Technical Team portal.
              </p>
            </div>
            <div className="atlas-sup-counts">
              <span className="atlas-sup-count atlas-sup-count--open">{openCount} Open</span>
              <span className="atlas-sup-count atlas-sup-count--resolved">
                {resolvedCount} Resolved
              </span>
            </div>
          </div>

          <div className="atlas-sup-tickets-body">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--rh-brand,#047857)]" />
              </div>
            ) : rows.length === 0 ? (
              <div className="atlas-sup-empty">
                <div className="atlas-sup-empty-icon" aria-hidden>
                  <Ticket className="h-7 w-7" strokeWidth={1.75} />
                </div>
                <p className="atlas-sup-empty-title">No tickets yet</p>
                <p className="atlas-sup-empty-desc">
                  Customer tickets and admin-created requests will appear here.
                </p>
              </div>
            ) : (
              <div className="atlas-sup-table-wrap">
                <table className="atlas-sup-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Subject</th>
                      <th>Customer</th>
                      <th>Phone</th>
                      <th>Assignee</th>
                      <th>Status</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="font-mono text-sm font-semibold text-[#6b7280]">
                          #{r.ticketNumber}
                        </td>
                        <td>
                          <Link className="atlas-sup-subject" href={`/admin/support/${r.id}`}>
                            {r.subject}
                          </Link>
                          {r.transferredToTechnical ? (
                            <div>
                              <span className="atlas-sup-tech-badge">Technical Team</span>
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <div className="text-sm font-medium text-[#111827]">{r.customerName}</div>
                          <div className="text-xs text-[#6b7280]">{r.customerEmail}</div>
                          <div className="text-xs text-[#9ca3af]">{r.organizationName || "—"}</div>
                        </td>
                        <td className="whitespace-nowrap text-sm text-[#111827]">
                          {r.customerPhone || "—"}
                        </td>
                        <td className="text-sm">{r.assigneeName || "—"}</td>
                        <td>
                          <span
                            className={cn(
                              "atlas-sup-row-status",
                              SUPPORT_STATUS_STYLES[r.status] || "bg-[#f3f4f6] text-[#414754]",
                            )}
                          >
                            {r.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap text-sm text-[#6b7280]">
                          {r.updatedAt ? format(new Date(r.updatedAt), "MMM d, yyyy HH:mm") : "—"}
                        </td>
                        <td className="text-right">
                          {!r.transferredToTechnical ? (
                            <button
                              type="button"
                              className="atlas-sup-row-open"
                              disabled={transferMutation.isPending}
                              onClick={() => {
                                if (confirm("Transfer this ticket to the Technical Team?")) {
                                  transferMutation.mutate(r.id);
                                }
                              }}
                            >
                              <Forward className="h-3.5 w-3.5" />
                              Transfer
                            </button>
                          ) : (
                            <span className="text-xs font-medium text-[#9ca3af]">Transferred</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="atlas-sup-trust">
            <span className="atlas-sup-trust-item">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure ticket handoff
            </span>
            <span className="atlas-sup-trust-item">
              <Zap className="h-3.5 w-3.5" />
              Syncs with Technical Team portal
            </span>
          </div>
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create support ticket</DialogTitle>
            <DialogDescription>
              Create a ticket as SaaS admin. Optionally send it straight to the Technical Team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Organization / business</Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue…"
                className="min-h-[100px]"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Contact name</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-1.5">
                <Label>Contact email</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Phone number</Label>
              <Input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 9876543210"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={transferOnCreate}
                onChange={(e) => setTransferOnCreate(e.target.checked)}
              />
              Transfer to Technical Team immediately
            </label>
          </div>
          <DialogFooter>
            <RhButton type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </RhButton>
            <RhButton
              type="button"
              disabled={
                !subject.trim() ||
                !description.trim() ||
                !organizationId ||
                !customerEmail.trim() ||
                customerPhone.replace(/\D/g, "").length < 10 ||
                createMutation.isPending
              }
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create
            </RhButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
