import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import {
  GoogleCalendarResourcePickers,
  GoogleSheetsResourcePickers,
  SimpleConnectionPicker,
} from "@/components/simple-flow/simple-flow-integration-pickers";
import { GoogleSheetsActionExtraFields } from "@/components/integrations/google-sheets-action-extra-fields";
import { CrmContactStepFields } from "@/components/simple-flow/crm-contact-step-fields";

export type StepConfigProps = {
  configJson: string;
  onUpdate: (next: string) => void;
  /** Canvas action id (e.g. create-spreadsheet-row); otherwise read from `config._canvasActionId`. */
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

function RawJsonCollapsible({ configJson }: { configJson: string }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronDown className="h-3 w-3" />
        Advanced: raw JSON (read-only)
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <Textarea className="min-h-[80px] font-mono text-xs" value={configJson} readOnly spellCheck={false} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function sheetActionId(props: StepConfigProps): string {
  if (props.canvasActionId) return props.canvasActionId;
  const id = str(safeParseConfig(props.configJson)._canvasActionId);
  return id || "create-spreadsheet-row";
}

function GoogleSheetStepFields(props: StepConfigProps) {
  const { configJson, onUpdate } = props;
  const actionId = sheetActionId(props);
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);

  const applyPatch = useCallback(
    (patch: Record<string, unknown>) => {
      emitConfig(safeParseConfig(configJson), patch, onUpdate);
    },
    [configJson, onUpdate]
  );

  const panelTitle =
    actionId === "create-spreadsheet"
      ? "Create spreadsheet"
      : actionId === "create-worksheet"
        ? "Create worksheet"
        : actionId === "create-spreadsheet-row"
          ? "Create spreadsheet row"
          : actionId === "find-worksheet"
            ? "Find worksheet"
            : actionId === "find-row"
              ? "Find row"
              : actionId === "update-row"
                ? "Update row"
                : "Google Sheets";

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">{panelTitle}</p>
      <p className="text-xs text-muted-foreground">
        Same fields as the advanced canvas editor. Use{" "}
        <code className="text-[11px]">{"{{contact.email}}"}</code> in values when needed.
      </p>

      <GoogleSheetsResourcePickers configJson={configJson} onUpdate={onUpdate} canvasActionId={actionId} />

      <GoogleSheetsActionExtraFields
        actionId={actionId}
        config={cfg}
        applyConfigPatch={applyPatch}
        connectionId={str(cfg.connectionId)}
        spreadsheetId={str(cfg.spreadsheetId)}
        worksheetId={str(cfg.worksheetId)}
        variant="simple"
      />

      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

function calendarActionId(props: StepConfigProps): string {
  if (props.canvasActionId) return props.canvasActionId;
  const id = str(safeParseConfig(props.configJson)._canvasActionId);
  return id || "create-event";
}

function GoogleCalendarStepFields(props: StepConfigProps) {
  const { configJson, onUpdate } = props;
  const actionId = calendarActionId(props);
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);
  const summary = () => str(cfg.summary ?? cfg.eventSummary);
  const description = () => str(cfg.description ?? cfg.eventDescription);
  const start = () => str(cfg.start ?? cfg.eventStart);
  const end = () => str(cfg.end ?? cfg.eventEnd);

  const [calendarId, setCalendarId] = useState(() => str(cfg.calendarId) || "primary");
  const [sum, setSum] = useState(summary);
  const [desc, setDesc] = useState(description);
  const [st, setSt] = useState(start);
  const [en, setEn] = useState(end);
  const [timeZone, setTimeZone] = useState(() => str(cfg.timeZone) || "Asia/Kolkata");

  useEffect(() => {
    const c = safeParseConfig(configJson);
    setCalendarId(str(c.calendarId) || "primary");
    setSum(str(c.summary ?? c.eventSummary));
    setDesc(str(c.description ?? c.eventDescription));
    setSt(str(c.start ?? c.eventStart));
    setEn(str(c.end ?? c.eventEnd));
    setTimeZone(str(c.timeZone) || "Asia/Kolkata");
  }, [configJson]);

  const emit = (patch: Record<string, string>) => {
    const base = safeParseConfig(configJson);
    const s = patch.summary ?? sum;
    const d = patch.description ?? desc;
    const a = patch.start ?? st;
    const b = patch.end ?? en;
    emitConfig(base, {
      calendarId: patch.calendarId ?? calendarId,
      summary: s,
      eventSummary: s,
      description: d,
      eventDescription: d,
      start: a,
      eventStart: a,
      end: b,
      eventEnd: b,
      timeZone: patch.timeZone ?? timeZone,
    }, onUpdate);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">Google Calendar</p>
      <GoogleCalendarResourcePickers configJson={configJson} onUpdate={onUpdate} canvasActionId={actionId} />
      {actionId === "custom-request-calendar" ? (
        <div className="space-y-1">
          <Label className="text-xs">Calendar ID (optional)</Label>
          <Input
            className="h-9"
            value={calendarId}
            onChange={(e) => {
              setCalendarId(e.target.value);
              emit({ calendarId: e.target.value });
            }}
            placeholder="primary"
          />
        </div>
      ) : null}
      <div className="space-y-1">
        <Label className="text-xs">Title *</Label>
        <Input className="h-9" value={sum} onChange={(e) => { setSum(e.target.value); emit({ summary: e.target.value }); }} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Textarea className="min-h-[60px] text-sm" value={desc} onChange={(e) => { setDesc(e.target.value); emit({ description: e.target.value }); }} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Start *</Label>
          <Input className="h-9" value={st} onChange={(e) => { setSt(e.target.value); emit({ start: e.target.value }); }} placeholder="ISO or {{contact.createdAt}}" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End *</Label>
          <Input className="h-9" value={en} onChange={(e) => { setEn(e.target.value); emit({ end: e.target.value }); }} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Time zone</Label>
        <Input className="h-9" value={timeZone} onChange={(e) => { setTimeZone(e.target.value); emit({ timeZone: e.target.value }); }} />
      </div>
      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

function GoogleContactsStepFields({ configJson, onUpdate }: StepConfigProps) {
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);
  const [n, setN] = useState(() => str(cfg.googleContactName ?? cfg.givenName));
  const [em, setEm] = useState(() => str(cfg.googleContactEmail ?? cfg.email));
  const [ph, setPh] = useState(() => str(cfg.googleContactPhone ?? cfg.phone));
  const [no, setNo] = useState(() => str(cfg.notes));

  useEffect(() => {
    const c = safeParseConfig(configJson);
    setN(str(c.googleContactName ?? c.givenName));
    setEm(str(c.googleContactEmail ?? c.email));
    setPh(str(c.googleContactPhone ?? c.phone));
    setNo(str(c.notes));
  }, [configJson]);

  const emit = (patch: Partial<{ n: string; em: string; ph: string; no: string }>) => {
    const base = safeParseConfig(configJson);
    const name = patch.n ?? n;
    const email = patch.em ?? em;
    const phone = patch.ph ?? ph;
    const notes = patch.no ?? no;
    emitConfig(base, {
      googleContactName: name,
      givenName: name,
      googleContactEmail: email,
      email,
      googleContactPhone: phone,
      phone,
      notes,
    }, onUpdate);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">Google Contact</p>
      <SimpleConnectionPicker configJson={configJson} onUpdate={onUpdate} integrationName="google-contacts" />
      <div className="space-y-1">
        <Label className="text-xs">Name *</Label>
        <Input className="h-9" value={n} onChange={(e) => { setN(e.target.value); emit({ n: e.target.value }); }} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Email</Label>
        <Input className="h-9" value={em} onChange={(e) => { setEm(e.target.value); emit({ em: e.target.value }); }} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Phone</Label>
        <Input className="h-9" value={ph} onChange={(e) => { setPh(e.target.value); emit({ ph: e.target.value }); }} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notes</Label>
        <Textarea className="min-h-[56px] text-sm" value={no} onChange={(e) => { setNo(e.target.value); emit({ no: e.target.value }); }} />
      </div>
      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

function OpenAIStepFields({ configJson, onUpdate }: StepConfigProps) {
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);
  const [model, setModel] = useState(() => str(cfg.model) || "gpt-4o-mini");
  const [prompt, setPrompt] = useState(() => str(cfg.prompt));

  useEffect(() => {
    const c = safeParseConfig(configJson);
    setModel(str(c.model) || "gpt-4o-mini");
    setPrompt(str(c.prompt));
  }, [configJson]);

  const emit = (patch: Partial<{ model: string; prompt: string }>) => {
    const base = safeParseConfig(configJson);
    emitConfig(
      base,
      {
        model: patch.model ?? model,
        prompt: patch.prompt ?? prompt,
      },
      onUpdate
    );
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">OpenAI</p>
      <SimpleConnectionPicker configJson={configJson} onUpdate={onUpdate} integrationName="openai" />
      <div className="space-y-1">
        <Label className="text-xs">Model</Label>
        <Input className="h-9" value={model} onChange={(e) => { setModel(e.target.value); emit({ model: e.target.value }); }} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Prompt *</Label>
        <Textarea className="min-h-[100px] text-sm" value={prompt} onChange={(e) => { setPrompt(e.target.value); emit({ prompt: e.target.value }); }} />
      </div>
      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

function GoogleGeminiStepFields({ configJson, onUpdate }: StepConfigProps) {
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);
  const [model, setModel] = useState(() => str(cfg.model) || "gemini-1.5-flash");
  const [prompt, setPrompt] = useState(() => str(cfg.prompt));
  const [maxTok, setMaxTok] = useState(() => str(cfg.maxOutputTokens ?? 256));

  useEffect(() => {
    const c = safeParseConfig(configJson);
    setModel(str(c.model) || "gemini-1.5-flash");
    setPrompt(str(c.prompt));
    setMaxTok(str(c.maxOutputTokens ?? 256));
  }, [configJson]);

  const emit = (patch: Record<string, string | number>) => {
    const base = safeParseConfig(configJson);
    const mt = patch.maxOutputTokens !== undefined ? Number(patch.maxOutputTokens) : parseInt(maxTok, 10) || 256;
    emitConfig(
      base,
      {
        model: str(patch.model ?? model),
        prompt: str(patch.prompt ?? prompt),
        maxOutputTokens: mt,
      },
      onUpdate
    );
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">Google Gemini</p>
      <SimpleConnectionPicker configJson={configJson} onUpdate={onUpdate} integrationName="google-gemini" />
      <div className="space-y-1">
        <Label className="text-xs">Model</Label>
        <Input className="h-9" value={model} onChange={(e) => { setModel(e.target.value); emit({ model: e.target.value }); }} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Max output tokens</Label>
        <Input
          className="h-9"
          type="number"
          min={1}
          value={maxTok}
          onChange={(e) => {
            setMaxTok(e.target.value);
            emit({ maxOutputTokens: parseInt(e.target.value, 10) || 256 });
          }}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Prompt *</Label>
        <Textarea className="min-h-[100px] text-sm" value={prompt} onChange={(e) => { setPrompt(e.target.value); emit({ prompt: e.target.value }); }} />
      </div>
      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

function CalendlyStepFields({ configJson, onUpdate }: StepConfigProps) {
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);
  const [method, setMethod] = useState(() => str(cfg.method) || "GET");
  const [url, setUrl] = useState(() => str(cfg.url));
  const [data, setData] = useState(() => (typeof cfg.data === "string" ? cfg.data : JSON.stringify(cfg.data ?? "", null, 2)));

  useEffect(() => {
    const c = safeParseConfig(configJson);
    setMethod(str(c.method) || "GET");
    setUrl(str(c.url));
    setData(typeof c.data === "string" ? c.data : JSON.stringify(c.data ?? "", null, 2));
  }, [configJson]);

  const emit = (patch: Partial<{ method: string; url: string; data: string }>) => {
    const base = safeParseConfig(configJson);
    const d = patch.data ?? data;
    emitConfig(
      base,
      {
        method: patch.method ?? method,
        url: patch.url ?? url,
        data: d,
      },
      onUpdate
    );
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">Calendly API request</p>
      <p className="text-xs text-muted-foreground">Typical test: GET <code className="text-[11px]">https://api.calendly.com/users/me</code></p>
      <SimpleConnectionPicker configJson={configJson} onUpdate={onUpdate} integrationName="calendly" />
      <div className="space-y-1">
        <Label className="text-xs">Method</Label>
        <Select value={method} onValueChange={(v) => { setMethod(v); emit({ method: v }); }}>
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
      </div>
      <div className="space-y-1">
        <Label className="text-xs">URL *</Label>
        <Input className="h-9" value={url} onChange={(e) => { setUrl(e.target.value); emit({ url: e.target.value }); }} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Body (optional, text or JSON)</Label>
        <Textarea className="min-h-[72px] font-mono text-xs" value={data} onChange={(e) => { setData(e.target.value); emit({ data: e.target.value }); }} spellCheck={false} />
      </div>
      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

function SmtpStepFields({ configJson, onUpdate }: StepConfigProps) {
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);
  const [useOrg, setUseOrg] = useState(() => cfg.useOrgSmtpSettings === true);
  const [to, setTo] = useState(() => str(cfg.to));
  const [subject, setSubject] = useState(() => str(cfg.subject));
  const [bodyHtml, setBodyHtml] = useState(() => str(cfg.bodyHtml));

  useEffect(() => {
    const c = safeParseConfig(configJson);
    setUseOrg(c.useOrgSmtpSettings === true);
    setTo(str(c.to));
    setSubject(str(c.subject));
    setBodyHtml(str(c.bodyHtml));
  }, [configJson]);

  const emit = (patch: Record<string, unknown>) => {
    const base = safeParseConfig(configJson);
    emitConfig(base, { ...patch }, onUpdate);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">Email (SMTP)</p>
      <div className="flex items-center gap-2">
        <Checkbox
          id="smtp-org"
          checked={useOrg}
          onCheckedChange={(v) => {
            const on = v === true;
            setUseOrg(on);
            emit({ useOrgSmtpSettings: on, to, subject, bodyHtml });
          }}
        />
        <Label htmlFor="smtp-org" className="text-xs font-normal cursor-pointer">
          Use organization SMTP settings
        </Label>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To *</Label>
        <Input className="h-9" value={to} onChange={(e) => { setTo(e.target.value); emit({ useOrgSmtpSettings: useOrg, to: e.target.value, subject, bodyHtml }); }} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Subject *</Label>
        <Input className="h-9" value={subject} onChange={(e) => { setSubject(e.target.value); emit({ useOrgSmtpSettings: useOrg, to, subject: e.target.value, bodyHtml }); }} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">HTML body *</Label>
        <Textarea
          className="min-h-[88px] text-sm"
          value={bodyHtml}
          onChange={(e) => {
            setBodyHtml(e.target.value);
            emit({ useOrgSmtpSettings: useOrg, to, subject, bodyHtml: e.target.value });
          }}
        />
      </div>
      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

function WhatsAppStepFields({ configJson, onUpdate }: StepConfigProps) {
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);
  const paramsToLine = (p: unknown) => {
    if (Array.isArray(p)) return p.map((x) => String(x)).join(", ");
    return "";
  };
  const [templateName, setTemplateName] = useState(() => str(cfg.templateName));
  const [language, setLanguage] = useState(() => str(cfg.language) || "en");
  const [bodyLine, setBodyLine] = useState(() => paramsToLine(cfg.bodyParams));

  useEffect(() => {
    const c = safeParseConfig(configJson);
    setTemplateName(str(c.templateName));
    setLanguage(str(c.language) || "en");
    setBodyLine(paramsToLine(c.bodyParams));
  }, [configJson]);

  const emit = (patch: Partial<{ templateName: string; language: string; bodyParams: string[]; bodyLine?: string }>) => {
    const base = safeParseConfig(configJson);
    const line = patch.bodyLine !== undefined ? patch.bodyLine : bodyLine;
    const arr =
      patch.bodyParams ??
      line
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    emitConfig(
      base,
      {
        templateName: patch.templateName ?? templateName,
        language: patch.language ?? language,
        bodyParams: arr,
      },
      onUpdate
    );
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">WhatsApp</p>
      <SimpleConnectionPicker
        configJson={configJson}
        onUpdate={onUpdate}
        integrationName="whatsapp-business"
        label="WhatsApp session"
      />
      <div className="space-y-1">
        <Label className="text-xs">Template name *</Label>
        <Input className="h-9" value={templateName} onChange={(e) => { setTemplateName(e.target.value); emit({ templateName: e.target.value }); }} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Language code</Label>
        <Input className="h-9" value={language} onChange={(e) => { setLanguage(e.target.value); emit({ language: e.target.value }); }} placeholder="en" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Template body parameters (comma-separated)</Label>
        <Input
          className="h-9"
          value={bodyLine}
          onChange={(e) => {
            const v = e.target.value;
            setBodyLine(v);
            emit({ bodyLine: v });
          }}
          placeholder="{{contact.name}}, {{contact.phone}}"
        />
      </div>
      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

function WebhookStepFields({ configJson, onUpdate }: StepConfigProps) {
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);
  const [method, setMethod] = useState(() => str(cfg.method) || "POST");
  const [url, setUrl] = useState(() => str(cfg.url));
  const [bodyText, setBodyText] = useState(() => {
    const b = cfg.body;
    if (b === undefined || b === null) return "{}";
    if (typeof b === "string") return b;
    try {
      return JSON.stringify(b, null, 2);
    } catch {
      return "{}";
    }
  });

  useEffect(() => {
    const c = safeParseConfig(configJson);
    setMethod(str(c.method) || "POST");
    setUrl(str(c.url));
    const b = c.body;
    if (b === undefined || b === null) setBodyText("{}");
    else if (typeof b === "string") setBodyText(b);
    else setBodyText(JSON.stringify(b, null, 2));
  }, [configJson]);

  const emit = () => {
    const base = safeParseConfig(configJson);
    let body: unknown = bodyText;
    try {
      body = JSON.parse(bodyText || "{}");
    } catch {
      body = bodyText;
    }
    emitConfig(base, { method, url, body }, onUpdate);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">Webhook</p>
      <div className="space-y-1">
        <Label className="text-xs">Method</Label>
        <Select value={method} onValueChange={(v) => { setMethod(v); setTimeout(emit, 0); }}>
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
      </div>
      <div className="space-y-1">
        <Label className="text-xs">URL *</Label>
        <Input className="h-9" value={url} onChange={(e) => { setUrl(e.target.value); }} onBlur={emit} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">JSON body</Label>
        <Textarea className="min-h-[100px] font-mono text-xs" value={bodyText} onChange={(e) => setBodyText(e.target.value)} onBlur={emit} spellCheck={false} />
      </div>
      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

function HttpRequestStepFields({ configJson, onUpdate }: StepConfigProps) {
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);
  const [method, setMethod] = useState(() => str(cfg.method) || "POST");
  const [url, setUrl] = useState(() => str(cfg.url));
  const [headersText, setHeadersText] = useState(() => {
    const h = cfg.headers;
    if (h && typeof h === "object" && !Array.isArray(h)) return JSON.stringify(h, null, 2);
    return "{}";
  });
  const [bodyText, setBodyText] = useState(() => {
    const b = cfg.body;
    if (b && typeof b === "object") return JSON.stringify(b, null, 2);
    if (typeof b === "string") return b;
    return "{}";
  });

  useEffect(() => {
    const c = safeParseConfig(configJson);
    setMethod(str(c.method) || "POST");
    setUrl(str(c.url));
    const h = c.headers;
    setHeadersText(h && typeof h === "object" && !Array.isArray(h) ? JSON.stringify(h, null, 2) : "{}");
    const b = c.body;
    setBodyText(b && typeof b === "object" ? JSON.stringify(b, null, 2) : typeof b === "string" ? b : "{}");
  }, [configJson]);

  const emit = () => {
    const base = safeParseConfig(configJson);
    let headers: Record<string, unknown> = {};
    try {
      const p = JSON.parse(headersText || "{}");
      if (p && typeof p === "object" && !Array.isArray(p)) headers = p as Record<string, unknown>;
    } catch {
      headers = {};
    }
    let body: unknown = {};
    try {
      body = JSON.parse(bodyText || "{}");
    } catch {
      body = bodyText;
    }
    emitConfig(base, { method, url, headers, body }, onUpdate);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">HTTP request</p>
      <div className="space-y-1">
        <Label className="text-xs">Method</Label>
        <Select value={method} onValueChange={(v) => { setMethod(v); setTimeout(emit, 0); }}>
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
      </div>
      <div className="space-y-1">
        <Label className="text-xs">URL *</Label>
        <Input className="h-9" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={emit} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Headers (JSON object)</Label>
        <Textarea className="min-h-[72px] font-mono text-xs" value={headersText} onChange={(e) => setHeadersText(e.target.value)} onBlur={emit} spellCheck={false} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Body (JSON or text)</Label>
        <Textarea className="min-h-[88px] font-mono text-xs" value={bodyText} onChange={(e) => setBodyText(e.target.value)} onBlur={emit} spellCheck={false} />
      </div>
      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

function DateHelperStepFields({ configJson, onUpdate }: StepConfigProps) {
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);
  const [operation, setOperation] = useState(() => str(cfg.operation) || "format");
  const [input, setInput] = useState(() => str(cfg.input));
  const [format, setFormat] = useState(() => str(cfg.format) || "ISO");

  useEffect(() => {
    const c = safeParseConfig(configJson);
    setOperation(str(c.operation) || "format");
    setInput(str(c.input));
    setFormat(str(c.format) || "ISO");
  }, [configJson]);

  const emit = () => emitConfig(safeParseConfig(configJson), { operation, input, format }, onUpdate);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">Date helper</p>
      <div className="space-y-1">
        <Label className="text-xs">Operation</Label>
        <Input className="h-9" value={operation} onChange={(e) => { setOperation(e.target.value); }} onBlur={emit} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Input</Label>
        <Input className="h-9" value={input} onChange={(e) => { setInput(e.target.value); }} onBlur={emit} placeholder="{{contact.createdAt}}" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Format</Label>
        <Input className="h-9" value={format} onChange={(e) => { setFormat(e.target.value); }} onBlur={emit} />
      </div>
      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

function MathHelperStepFields({ configJson, onUpdate }: StepConfigProps) {
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);
  const [operation, setOperation] = useState(() => str(cfg.operation) || "add");
  const [a, setA] = useState(() => str(cfg.a ?? 0));
  const [b, setB] = useState(() => str(cfg.b ?? 0));

  useEffect(() => {
    const c = safeParseConfig(configJson);
    setOperation(str(c.operation) || "add");
    setA(str(c.a ?? 0));
    setB(str(c.b ?? 0));
  }, [configJson]);

  const emit = () =>
    emitConfig(safeParseConfig(configJson), { operation, a: parseFloat(a) || 0, b: parseFloat(b) || 0 }, onUpdate);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">Math helper</p>
      <div className="space-y-1">
        <Label className="text-xs">Operation</Label>
        <Input className="h-9" value={operation} onChange={(e) => setOperation(e.target.value)} onBlur={emit} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">A</Label>
          <Input className="h-9" value={a} onChange={(e) => setA(e.target.value)} onBlur={emit} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">B</Label>
          <Input className="h-9" value={b} onChange={(e) => setB(e.target.value)} onBlur={emit} />
        </div>
      </div>
      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

function TextHelperStepFields({ configJson, onUpdate }: StepConfigProps) {
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);
  const [operation, setOperation] = useState(() => str(cfg.operation) || "template");
  const [template, setTemplate] = useState(() => str(cfg.template));

  useEffect(() => {
    const c = safeParseConfig(configJson);
    setOperation(str(c.operation) || "template");
    setTemplate(str(c.template));
  }, [configJson]);

  const emit = () => emitConfig(safeParseConfig(configJson), { operation, template }, onUpdate);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">Text helper</p>
      <div className="space-y-1">
        <Label className="text-xs">Operation</Label>
        <Input className="h-9" value={operation} onChange={(e) => setOperation(e.target.value)} onBlur={emit} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Template / text</Label>
        <Textarea className="min-h-[80px] text-sm" value={template} onChange={(e) => setTemplate(e.target.value)} onBlur={emit} />
      </div>
      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

function DatastoreStepFields({ configJson, onUpdate }: StepConfigProps) {
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);
  const [operation, setOperation] = useState(() => str(cfg.operation) || "set");
  const [key, setKey] = useState(() => str(cfg.key));
  const [value, setValue] = useState(() => str(cfg.value));

  useEffect(() => {
    const c = safeParseConfig(configJson);
    setOperation(str(c.operation) || "set");
    setKey(str(c.key));
    setValue(str(c.value));
  }, [configJson]);

  const emit = () => emitConfig(safeParseConfig(configJson), { operation, key, value }, onUpdate);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">Datastore</p>
      <div className="space-y-1">
        <Label className="text-xs">Operation</Label>
        <Input className="h-9" value={operation} onChange={(e) => setOperation(e.target.value)} onBlur={emit} placeholder="set / get / delete" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Key</Label>
        <Input className="h-9" value={key} onChange={(e) => setKey(e.target.value)} onBlur={emit} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Value</Label>
        <Input className="h-9" value={value} onChange={(e) => setValue(e.target.value)} onBlur={emit} />
      </div>
      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

function DelayUntilStepFields({ configJson, onUpdate }: StepConfigProps) {
  const cfg = useMemo(() => safeParseConfig(configJson), [configJson]);
  const [until, setUntil] = useState(() => str(cfg.delayUntil));
  useEffect(() => {
    setUntil(str(safeParseConfig(configJson).delayUntil));
  }, [configJson]);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium">Delay until</p>
      <p className="text-xs text-muted-foreground">
        ISO 8601 date/time (e.g. 2026-03-28T15:00:00Z). Same behavior as the canvas “Delay until” action.
      </p>
      <div className="space-y-1">
        <Label className="text-xs">Resume at (DateTime) *</Label>
        <Input
          className="h-9"
          value={until}
          onChange={(e) => {
            const v = e.target.value;
            setUntil(v);
            emitConfig(safeParseConfig(configJson), { delayUntil: v }, onUpdate);
          }}
          placeholder="2026-12-15T16:25:30Z"
        />
      </div>
      <RawJsonCollapsible configJson={configJson} />
    </div>
  );
}

/** Friendly form for catalog apps; returns null to fall back to JSON textarea on the page. */
export function integrationStepFieldsForApp(appId: string, props: StepConfigProps): ReactNode {
  const fromCfg = str(safeParseConfig(props.configJson)._canvasActionId);
  const aid = props.canvasActionId || fromCfg;

  switch (appId) {
    case "delay":
      if (aid === "delay-until") return <DelayUntilStepFields {...props} />;
      return null;
    case "google_sheet":
      return <GoogleSheetStepFields {...props} />;
    case "google_calendar":
      return <GoogleCalendarStepFields {...props} />;
    case "contact":
      return (
        <>
          <CrmContactStepFields {...props} />
          <RawJsonCollapsible configJson={props.configJson} />
        </>
      );
    case "google_contacts":
      return <GoogleContactsStepFields {...props} />;
    case "openai":
      return <OpenAIStepFields {...props} />;
    case "google_gemini":
      return <GoogleGeminiStepFields {...props} />;
    case "calendly":
      return <CalendlyStepFields {...props} />;
    case "smtp":
      return <SmtpStepFields {...props} />;
    case "whatsapp":
      return <WhatsAppStepFields {...props} />;
    case "webhook":
      return <WebhookStepFields {...props} />;
    case "http_request":
      return <HttpRequestStepFields {...props} />;
    case "date_helper":
      return <DateHelperStepFields {...props} />;
    case "math_helper":
      return <MathHelperStepFields {...props} />;
    case "text_helper":
      return <TextHelperStepFields {...props} />;
    case "datastore":
      return <DatastoreStepFields {...props} />;
    default:
      return null;
  }
}
