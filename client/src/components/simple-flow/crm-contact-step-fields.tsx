// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { fetchLegacyListApi } from "@/lib/legacy-list-api";
import { useCurrentMemberPermissions } from "@/hooks/useCurrentMemberPermissions";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export type CrmContactStepConfigProps = {
  configJson: string;
  onUpdate: (next: string) => void;
  canvasActionId?: string;
};

function safeParseConfig(json: string): Record<string, unknown> {
  try {
    const p = JSON.parse(json || "{}");
    if (p === null || typeof p !== "object" || Array.isArray(p)) return {};
    return p as Record<string, unknown>;
  } catch {
    return {};
  }
}

function emitConfig(base: Record<string, unknown>, patch: Record<string, unknown>, onUpdate: (s: string) => void) {
  onUpdate(JSON.stringify({ ...base, ...patch }, null, 2));
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

const CONTACT_SOURCE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "facebook", label: "Facebook" },
  { value: "import", label: "Import" },
  { value: "api", label: "API" },
  { value: "website", label: "Website" },
  { value: "indiamart", label: "IndiaMart" },
  { value: "google_ads", label: "Google Ads" },
  { value: "linkedin", label: "LinkedIn" },
];

function crmContactActionId(props: StepConfigProps): string {
  if (props.canvasActionId) return props.canvasActionId;
  const id = str(safeParseConfig(props.configJson)._canvasActionId);
  return id || "create-contact";
}

function splitLegacyName(full: string): { first: string; last: string } {
  const t = full.trim();
  if (!t) return { first: "", last: "" };
  const i = t.indexOf(" ");
  if (i === -1) return { first: t, last: "" };
  return { first: t.slice(0, i), last: t.slice(i + 1).trim() };
}

export function CrmContactStepFields(props: CrmContactStepConfigProps) {
  const { configJson, onUpdate } = props;
  const actionId = crmContactActionId(props);
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);

  const { hasPermission } = useCurrentMemberPermissions();
  const canViewTeamMembers = hasPermission("manage_team.view");

  const { data: organizationsData } = useQuery<{ organizations?: unknown[] } | unknown[]>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
    enabled:
      actionId === "create-contact" || actionId === "update-contact" || actionId === "auto-assign-contact",
  });
  const organizationsList = Array.isArray(organizationsData)
    ? organizationsData
    : ((organizationsData as { organizations?: unknown[] })?.organizations ?? []);
  const currentOrganizationId = (organizationsList[0] as { id?: string })?.id;

  const { data: orgMembers = [] } = useQuery<unknown[]>({
    queryKey: ["/api/organizations", currentOrganizationId, "members"],
    queryFn: async () => {
      if (!currentOrganizationId) return [];
      const res = await apiRequest("GET", `/api/organizations/${currentOrganizationId}/members`);
      return res.json();
    },
    enabled:
      !!currentOrganizationId &&
      canViewTeamMembers &&
      (actionId === "create-contact" || actionId === "update-contact" || actionId === "auto-assign-contact"),
  });

  const { data: contactTagsList = [] } = useQuery<unknown[]>({
    queryKey: ["/api/tags"],
    queryFn: async () => {
      try {
        return await fetchLegacyListApi("/api/tags", "tags");
      } catch {
        return [];
      }
    },
    enabled: actionId === "create-contact",
  });

  const merge = useCallback(
    (patch: Record<string, unknown>) => {
      emitConfig(safeParseConfig(configJson), patch, onUpdate);
    },
    [configJson, onUpdate]
  );

  // —— Create contact
  const [firstName, setFirstName] = useState(() => str(cfg.firstName));
  const [lastName, setLastName] = useState(() => str(cfg.lastName));
  const [email, setEmail] = useState(() => str(cfg.email));
  const [phone, setPhone] = useState(() => str(cfg.phone));
  const [notes, setNotes] = useState(() => str(cfg.notes));
  const [company, setCompany] = useState(() => str(cfg.company));
  const [jobTitle, setJobTitle] = useState(() => str(cfg.jobTitle));
  const [assignTo, setAssignTo] = useState(() => str(cfg.assignTo));
  const [source, setSource] = useState(() => str(cfg.source));
  const [status, setStatus] = useState(() => str(cfg.status));
  const [optIn, setOptIn] = useState(() => str(cfg.optIn));
  const [tags, setTags] = useState(() => str(cfg.tags));
  const [allowDuplicate, setAllowDuplicate] = useState(() => str(cfg.allowDuplicate));

  const emitCreate = useCallback(
    (patch: Partial<Record<string, string>>) => {
      const base = safeParseConfig(configJson);
      const next = {
        firstName: patch.firstName ?? firstName,
        lastName: patch.lastName ?? lastName,
        email: patch.email ?? email,
        phone: patch.phone ?? phone,
        notes: patch.notes ?? notes,
        company: patch.company ?? company,
        jobTitle: patch.jobTitle ?? jobTitle,
        assignTo: patch.assignTo ?? assignTo,
        source: patch.source ?? source,
        status: patch.status ?? status,
        optIn: patch.optIn ?? optIn,
        tags: patch.tags ?? tags,
        allowDuplicate: patch.allowDuplicate ?? allowDuplicate,
      };
      const combined = `${next.firstName} ${next.lastName}`.trim();
      emitConfig(base, { ...next, ...(combined ? { name: combined } : {}) }, onUpdate);
    },
    [
      allowDuplicate,
      assignTo,
      company,
      configJson,
      email,
      firstName,
      jobTitle,
      lastName,
      notes,
      onUpdate,
      optIn,
      phone,
      source,
      status,
      tags,
    ]
  );

  useEffect(() => {
    const c = safeParseConfig(configJson);
    let fn = str(c.firstName);
    let ln = str(c.lastName);
    if (!fn && !ln && str(c.name)) {
      const sp = splitLegacyName(str(c.name));
      fn = sp.first;
      ln = sp.last;
    }
    setFirstName(fn);
    setLastName(ln);
    setEmail(str(c.email));
    setPhone(str(c.phone));
    setNotes(str(c.notes));
    setCompany(str(c.company));
    setJobTitle(str(c.jobTitle));
    setAssignTo(str(c.assignTo));
    setSource(str(c.source));
    setStatus(str(c.status));
    setOptIn(str(c.optIn));
    setTags(str(c.tags));
    setAllowDuplicate(str(c.allowDuplicate));
  }, [configJson]);

  const [searchBy, setSearchBy] = useState(() => str(cfg.searchByIdOrPhone));
  const [contactIdOrPhone, setContactIdOrPhone] = useState(() => str(cfg.contactIdOrPhone));
  const [uName, setUName] = useState(() => str(cfg.name));
  const [uEmail, setUEmail] = useState(() => str(cfg.email));
  const [uStatus, setUStatus] = useState(() => str(cfg.status));
  const [uAssignTo, setUAssignTo] = useState(() => str(cfg.assignTo));
  const [uSource, setUSource] = useState(() => str(cfg.source));
  const [noteBody, setNoteBody] = useState(() => str(cfg.note));
  const [method, setMethod] = useState(() => str(cfg.method) || "GET");
  const [url, setUrl] = useState(() => str(cfg.url));
  const [dataStr, setDataStr] = useState(() =>
    typeof cfg.data === "string" ? cfg.data : JSON.stringify(cfg.data ?? "", null, 2)
  );

  useEffect(() => {
    const c = safeParseConfig(configJson);
    setSearchBy(str(c.searchByIdOrPhone));
    setContactIdOrPhone(str(c.contactIdOrPhone));
    setUName(str(c.name));
    setUEmail(str(c.email));
    setUStatus(str(c.status));
    setUAssignTo(str(c.assignTo));
    setUSource(str(c.source));
    setNoteBody(str(c.note));
    setMethod(str(c.method) || "GET");
    setUrl(str(c.url));
    setDataStr(typeof c.data === "string" ? c.data : JSON.stringify(c.data ?? "", null, 2));
  }, [configJson]);

  const title =
    actionId === "create-contact"
      ? "Create contact"
      : actionId === "update-contact"
        ? "Update contact"
        : actionId === "get-contact"
          ? "Get contact"
          : actionId === "auto-assign-contact"
            ? "Auto assign contact"
            : actionId === "add-note"
              ? "Add note"
              : "Contact (custom request)";

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">
        Workspace CRM contacts (same as the canvas Contact app). No external connection is required.
      </p>

      {actionId === "create-contact" ? (
        <>
          <div className="space-y-1">
            <Label className="text-xs">First name</Label>
            <Input
              className="h-9"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                emitCreate({ firstName: e.target.value });
              }}
              placeholder="{{contact.firstName}}"
            />
            <p className="text-[11px] text-muted-foreground">Contact first name</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Last name</Label>
            <Input
              className="h-9"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                emitCreate({ lastName: e.target.value });
              }}
              placeholder="{{contact.lastName}}"
            />
            <p className="text-[11px] text-muted-foreground">Contact last name</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input
              className="h-9"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                emitCreate({ email: e.target.value });
              }}
              placeholder="{{contact.email}}"
            />
            <p className="text-[11px] text-muted-foreground">Contact email address</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phone *</Label>
            <Input
              className="h-9"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                emitCreate({ phone: e.target.value });
              }}
              placeholder="{{contact.phone}}"
            />
            <p className="text-[11px] text-muted-foreground">Contact phone number</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea
              className="min-h-[56px] text-sm"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                emitCreate({ notes: e.target.value });
              }}
              placeholder="Internal notes"
            />
            <p className="text-[11px] text-muted-foreground">Additional notes about the contact</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Company</Label>
            <Input
              className="h-9"
              value={company}
              onChange={(e) => {
                setCompany(e.target.value);
                emitCreate({ company: e.target.value });
              }}
              placeholder="Acme Inc."
            />
            <p className="text-[11px] text-muted-foreground">Company name</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Job title</Label>
            <Input
              className="h-9"
              value={jobTitle}
              onChange={(e) => {
                setJobTitle(e.target.value);
                emitCreate({ jobTitle: e.target.value });
              }}
              placeholder="Sales lead"
            />
            <p className="text-[11px] text-muted-foreground">Job title</p>
          </div>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1">
              <ChevronDown className="h-3 w-3" />
              More options (assign, source, tags…)
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Assigned to</Label>
                <Select
                  value={assignTo || "__none__"}
                  onValueChange={(v) => {
                    const val = v === "__none__" ? "" : v;
                    setAssignTo(val);
                    emitCreate({ assignTo: val });
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select user…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {orgMembers.map((m: unknown) => {
                      const row = m as { id?: string; email?: string; name?: string };
                      const val = row.email || row.id || "";
                      return (
                        <SelectItem key={row.id || val} value={val}>
                          {row.name || row.email || row.id}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Source</Label>
                <Select
                  value={source || "__none__"}
                  onValueChange={(v) => {
                    const val = v === "__none__" ? "" : v;
                    setSource(val);
                    emitCreate({ source: val });
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {CONTACT_SOURCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Input
                  className="h-9"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    emitCreate({ status: e.target.value });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Opt in</Label>
                <Select
                  value={optIn || "__none__"}
                  onValueChange={(v) => {
                    const val = v === "__none__" ? "" : v;
                    setOptIn(val);
                    emitCreate({ optIn: val });
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Opt-in status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    <SelectItem value="opted_in">Opted in</SelectItem>
                    <SelectItem value="opted_out">Opted out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tags</Label>
                <Select
                  value={tags || "__none__"}
                  onValueChange={(v) => {
                    const val = v === "__none__" ? "" : v;
                    setTags(val);
                    emitCreate({ tags: val });
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {contactTagsList.map((t: unknown) => {
                      const row = t as { id?: string; name?: string };
                      const val = row.name || row.id;
                      if (!val) return null;
                      return (
                        <SelectItem key={row.id || val} value={val}>
                          {val}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Allow duplicate</Label>
                <Select
                  value={allowDuplicate || "__none__"}
                  onValueChange={(v) => {
                    const val = v === "__none__" ? "" : v;
                    setAllowDuplicate(val);
                    emitCreate({ allowDuplicate: val });
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      ) : null}

      {actionId === "update-contact" ? (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Search by ID or phone *</Label>
            <Select
              value={searchBy || "__none__"}
              onValueChange={(v) => {
                const val = v === "__none__" ? "" : v;
                setSearchBy(val);
                merge({ searchByIdOrPhone: val });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select…</SelectItem>
                <SelectItem value="id">ID</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contact ID or phone *</Label>
            <Input
              className="h-9"
              value={contactIdOrPhone}
              onChange={(e) => {
                setContactIdOrPhone(e.target.value);
                merge({ contactIdOrPhone: e.target.value });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Name *</Label>
            <Input
              className="h-9"
              value={uName}
              onChange={(e) => {
                setUName(e.target.value);
                merge({ name: e.target.value });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Assign to</Label>
            <Select
              value={uAssignTo || "__none__"}
              onValueChange={(v) => {
                const val = v === "__none__" ? "" : v;
                setUAssignTo(val);
                merge({ assignTo: val });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {orgMembers.map((m: unknown) => {
                  const row = m as { id?: string; email?: string; name?: string };
                  const val = row.email || row.id || "";
                  return (
                    <SelectItem key={row.id || val} value={val}>
                      {row.name || row.email || row.id}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Source</Label>
            <Select
              value={uSource || "__none__"}
              onValueChange={(v) => {
                const val = v === "__none__" ? "" : v;
                setUSource(val);
                merge({ source: val });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {CONTACT_SOURCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input
              className="h-9"
              type="email"
              value={uEmail}
              onChange={(e) => {
                setUEmail(e.target.value);
                merge({ email: e.target.value });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Input
              className="h-9"
              value={uStatus}
              onChange={(e) => {
                setUStatus(e.target.value);
                merge({ status: e.target.value });
              }}
            />
          </div>
        </>
      ) : null}

      {actionId === "get-contact" ? (
        <>
          <div className="space-y-1">
            <Label className="text-xs">ID or phone *</Label>
            <Select
              value={searchBy || "__none__"}
              onValueChange={(v) => {
                const val = v === "__none__" ? "" : v;
                setSearchBy(val);
                merge({ searchByIdOrPhone: val });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select…</SelectItem>
                <SelectItem value="id">ID</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contact ID or phone *</Label>
            <Input
              className="h-9"
              value={contactIdOrPhone}
              onChange={(e) => {
                setContactIdOrPhone(e.target.value);
                merge({ contactIdOrPhone: e.target.value });
              }}
            />
          </div>
        </>
      ) : null}

      {actionId === "auto-assign-contact" ? (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Search by ID or phone *</Label>
            <Select
              value={searchBy || "__none__"}
              onValueChange={(v) => {
                const val = v === "__none__" ? "" : v;
                setSearchBy(val);
                merge({ searchByIdOrPhone: val });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select…</SelectItem>
                <SelectItem value="id">ID</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contact ID or phone *</Label>
            <Input
              className="h-9"
              value={contactIdOrPhone}
              onChange={(e) => {
                setContactIdOrPhone(e.target.value);
                merge({ contactIdOrPhone: e.target.value });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Assign to *</Label>
            <Select
              value={uAssignTo || "__none__"}
              onValueChange={(v) => {
                const val = v === "__none__" ? "" : v;
                setUAssignTo(val);
                merge({ assignTo: val });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select…</SelectItem>
                {orgMembers.map((m: unknown) => {
                  const row = m as { id?: string; email?: string; name?: string };
                  const val = row.email || row.id || "";
                  return (
                    <SelectItem key={row.id || val} value={val}>
                      {row.name || row.email || row.id}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : null}

      {actionId === "add-note" ? (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Search by ID or phone *</Label>
            <Select
              value={searchBy || "__none__"}
              onValueChange={(v) => {
                const val = v === "__none__" ? "" : v;
                setSearchBy(val);
                merge({ searchByIdOrPhone: val });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select…</SelectItem>
                <SelectItem value="id">ID</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contact ID or phone *</Label>
            <Input
              className="h-9"
              value={contactIdOrPhone}
              onChange={(e) => {
                setContactIdOrPhone(e.target.value);
                merge({ contactIdOrPhone: e.target.value });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note *</Label>
            <Textarea
              className="min-h-[80px] text-sm"
              value={noteBody}
              onChange={(e) => {
                setNoteBody(e.target.value);
                merge({ note: e.target.value });
              }}
            />
          </div>
        </>
      ) : null}

      {actionId === "custom-request-contact" ? (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Method *</Label>
            <Select
              value={method}
              onValueChange={(v) => {
                setMethod(v);
                merge({ method: v });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">HTTP method for the request.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL *</Label>
            <Input
              className="h-9"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                merge({ url: e.target.value });
              }}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data</Label>
            <Textarea
              className="min-h-[72px] font-mono text-xs"
              value={dataStr}
              onChange={(e) => {
                setDataStr(e.target.value);
                merge({ data: e.target.value });
              }}
              spellCheck={false}
            />
            <p className="text-[11px] text-muted-foreground">Raw JSON body when needed.</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
