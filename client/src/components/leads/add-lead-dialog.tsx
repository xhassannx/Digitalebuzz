import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountryCodeSelect } from "@/components/country-code-select";
import type { CountryDialEntry } from "@/lib/country-dial-codes";
import { useToast } from "@/hooks/use-toast";
import type { OrganizationLeadStatusRow } from "@/components/leads/lead-utils";
import { resolveDefaultLeadStatus, sessionLeadFromLabel, splitStoredPhone } from "@/components/leads/lead-utils";
import type { OrganizationLeadRow } from "@/pages/leads-page";
import { cn } from "@/lib/utils";

export type AddLeadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadStatuses: OrganizationLeadStatusRow[];
  defaultStatusSlug?: string;
  editingLead?: OrganizationLeadRow | null;
  skin?: boolean;
};

type LeadFormState = {
  status: string;
  source: string;
  sessionId: string;
  countryCode: string;
  phoneLocal: string;
  companyName: string;
  leadDate: string;
  name: string;
  email: string;
  label: string;
  estimateAmount: string;
  reference: string;
  address: string;
  comment: string;
};

type WhatsAppSessionRow = {
  sessionId: string;
  status: string;
  deviceInfo?: {
    displayPhoneNumber?: string;
    phoneNumber?: string;
    verifiedName?: string;
    name?: string;
  } | null;
};

function emptyForm(defaults: Partial<LeadFormState>): LeadFormState {
  return {
    status: defaults.status ?? "",
    source: defaults.source ?? "manual",
    sessionId: defaults.sessionId ?? "",
    countryCode: defaults.countryCode ?? "+91",
    phoneLocal: "",
    companyName: "",
    leadDate: format(new Date(), "yyyy-MM-dd"),
    name: "",
    email: "",
    label: "",
    estimateAmount: "0",
    reference: "",
    address: "",
    comment: "",
  };
}

function combinePhone(countryCode: string, local: string): string {
  const dial = countryCode.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const digits = local.replace(/[^\d]/g, "");
  return `${dial}${digits}`;
}

function formatLeadFromPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return digits ? `+${digits}` : phone;
}

export function AddLeadDialog({
  open,
  onOpenChange,
  leadStatuses,
  defaultStatusSlug,
  editingLead,
  skin,
}: AddLeadDialogProps) {
  const isEdit = !!editingLead;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const defaultStatus = resolveDefaultLeadStatus(leadStatuses, defaultStatusSlug);

  const [form, setForm] = useState<LeadFormState>(() => emptyForm({ status: defaultStatus }));

  const { data: sourceOptionsData } = useQuery({
    queryKey: ["/api/leads/sources", "lead-form"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/leads/sources");
      return res.json() as { sources: Array<{ value: string; label: string; fromIntegration?: boolean }> };
    },
    enabled: open,
  });

  const sourceOptions = sourceOptionsData?.sources ?? [];

  const { data: sessions = [] } = useQuery<WhatsAppSessionRow[]>({
    queryKey: ["/api/sessions", "lead-form"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sessions");
      return res.json();
    },
    enabled: open,
  });

  const leadFromOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const session of sessions.filter((s) => s.status === "connected")) {
      options.set(session.sessionId, sessionLeadFromLabel(session));
    }
    if (editingLead?.sessionId && !options.has(editingLead.sessionId)) {
      options.set(
        editingLead.sessionId,
        editingLead.leadFromPhone
          ? formatLeadFromPhone(editingLead.leadFromPhone)
          : editingLead.sessionId.slice(0, 12),
      );
    }
    return Array.from(options.entries()).map(([sessionId, label]) => ({ sessionId, label }));
  }, [sessions, editingLead?.sessionId, editingLead?.leadFromPhone]);

  const { data: tags = [] } = useQuery({
    queryKey: ["/api/tags", "lead-form"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tags");
      const data = await res.json();
      return Array.isArray(data) ? data : data?.tags ?? [];
    },
    enabled: open,
  });

  const { data: countryDialEntries = [], isLoading: countryDialLoading } = useQuery<CountryDialEntry[]>({
    queryKey: ["/api/country-dial-codes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/country-dial-codes");
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (editingLead) {
      const { countryCode, phoneLocal } = splitStoredPhone(editingLead.phoneNumber, countryDialEntries);
      setForm({
        status: editingLead.status || defaultStatus,
        source: editingLead.source || "manual",
        sessionId: editingLead.sessionId ?? "",
        countryCode,
        phoneLocal,
        companyName: editingLead.companyName ?? "",
        leadDate: editingLead.leadDate
          ? format(new Date(editingLead.leadDate), "yyyy-MM-dd")
          : editingLead.createdAt
            ? format(new Date(editingLead.createdAt), "yyyy-MM-dd")
            : format(new Date(), "yyyy-MM-dd"),
        name: editingLead.name ?? "",
        email: editingLead.email ?? "",
        label: editingLead.label ?? "",
        estimateAmount:
          editingLead.estimateAmount != null ? String(editingLead.estimateAmount) : "0",
        reference: editingLead.reference ?? "",
        address: editingLead.address ?? "",
        comment: editingLead.comment ?? "",
      });
      return;
    }
    setForm(
      emptyForm({
        status: defaultStatus,
        source: "manual",
        countryCode: "+91",
      }),
    );
  }, [open, editingLead, defaultStatus, countryDialEntries]);

  useEffect(() => {
    if (!open || editingLead || leadFromOptions.length === 0) return;
    setForm((current) =>
      current.sessionId ? current : { ...current, sessionId: leadFromOptions[0].sessionId },
    );
  }, [open, editingLead, leadFromOptions]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const phoneNumber = combinePhone(form.countryCode, form.phoneLocal);
      if (!phoneNumber.replace(/\D/g, "")) {
        throw new Error("Customer mobile number is required");
      }
      if (!form.name.trim()) {
        throw new Error("Customer name is required");
      }
      const payload = {
        name: form.name.trim(),
        phoneNumber,
        email: form.email.trim() || null,
        source: form.source || "manual",
        status: form.status || defaultStatus,
        sessionId: form.sessionId || null,
        companyName: form.companyName.trim() || null,
        leadDate: form.leadDate ? new Date(form.leadDate).toISOString() : null,
        label: form.label || null,
        estimateAmount: form.estimateAmount ? Number(form.estimateAmount) : null,
        reference: form.reference.trim() || null,
        address: form.address.trim() || null,
        comment: form.comment.trim() || null,
      };
      const res = isEdit
        ? await apiRequest("PATCH", `/api/leads/${editingLead!.id}`, payload)
        : await apiRequest("POST", "/api/leads", payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail =
          Array.isArray(err.errors) && err.errors.length > 0
            ? err.errors.map((e: { path?: string[]; message?: string }) =>
                e.path?.length ? `${e.path.join(".")}: ${e.message}` : e.message,
              ).join("; ")
            : err.message;
        throw new Error(detail || (isEdit ? "Failed to update lead" : "Failed to create lead"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      onOpenChange(false);
      toast({ title: isEdit ? "Lead updated" : "Lead added" });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });

  const primaryBtn = skin ? "bg-[#0059bb] hover:bg-[#004a9a] text-white" : "";
  const fieldClass = "h-10";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,900px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
          <DialogTitle className="text-lg font-semibold">{isEdit ? "Edit Lead" : "Add Lead"}</DialogTitle>
        </div>

        <div className="rh-dialog-scroll-body min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className={fieldClass}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {leadStatuses.map((s) => (
                    <SelectItem key={s.slug} value={s.slug}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Source</Label>
              <Select value={form.source} onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}>
                <SelectTrigger className={fieldClass}>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {sourceOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Lead From</Label>
              <Select
                value={form.sessionId || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, sessionId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className={fieldClass}>
                  <SelectValue placeholder="Connected number" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {leadFromOptions.map((option) => (
                    <SelectItem key={option.sessionId} value={option.sessionId}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Customer Mobile Number <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <CountryCodeSelect
                  entries={countryDialEntries}
                  isLoading={countryDialLoading}
                  value={form.countryCode}
                  onValueChange={(dial) => setForm((f) => ({ ...f, countryCode: dial }))}
                  className="w-[96px] shrink-0"
                  compactTrigger
                />
                <Input
                  className={cn(fieldClass, "min-w-0 flex-1")}
                  value={form.phoneLocal}
                  onChange={(e) => setForm((f) => ({ ...f, phoneLocal: e.target.value }))}
                  placeholder="Mobile number"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Company Name (Optional)</Label>
              <Input
                className={fieldClass}
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                placeholder="Enter Company Name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Date</Label>
              <Input
                type="date"
                className={fieldClass}
                value={form.leadDate}
                onChange={(e) => setForm((f) => ({ ...f, leadDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Customer Name <span className="text-destructive">*</span>
              </Label>
              <Input
                className={fieldClass}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Enter Customer Name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Email (Optional)</Label>
              <Input
                type="email"
                className={fieldClass}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Enter Customer Email"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Label (Optional)</Label>
              <Select
                value={form.label || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, label: v === "none" ? "" : v }))}
              >
                <SelectTrigger className={fieldClass}>
                  <SelectValue placeholder="Select Label" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select Label</SelectItem>
                  {(tags as { id: string; name: string }[]).map((tag) => (
                    <SelectItem key={tag.id} value={tag.name}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Label Wise Estimate Amount Calculation
              </Label>
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                {form.label ? `Label: ${form.label}` : "There Are No Label Select"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Estimate Amount</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                className={fieldClass}
                value={form.estimateAmount}
                onChange={(e) => setForm((f) => ({ ...f, estimateAmount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Reference (Optional)</Label>
              <Input
                className={fieldClass}
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                placeholder="Enter Reference"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Address (Optional)</Label>
            <Textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Enter Address"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Comment (Optional)</Label>
            <Textarea
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              placeholder="Enter Comment"
              rows={2}
            />
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t bg-muted/20 px-6 py-4">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className={cn(primaryBtn)}
            disabled={saveMutation.isPending || !form.phoneLocal.trim() || !form.name.trim()}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEdit ? (
              "Save"
            ) : (
              "Submit"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
