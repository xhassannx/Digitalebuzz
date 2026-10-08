import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { RefreshCw, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

function safeParse(json: string): Record<string, unknown> {
  try {
    const o = JSON.parse(json || "{}");
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

type IntegrationRow = {
  id: string;
  name: string;
  displayName?: string;
  connectionName?: string;
  config?: { connectionName?: string; name?: string };
};

function connectionLabel(c: IntegrationRow, index: number): string {
  const base =
    c.config?.connectionName || c.connectionName || c.config?.name || c.displayName || c.name;
  if (c.name === "google-sheets" && (!base || base === "Google Sheets")) {
    return `${base || "Google Sheets"} #${index + 1}`;
  }
  return base || "Connection";
}

type PickerProps = {
  configJson: string;
  onUpdate: (next: string) => void;
  integrationName: string;
  label?: string;
};

/** Dropdown of connected integrations (matches canvas “Connection”). */
export function SimpleConnectionPicker({ configJson, onUpdate, integrationName, label }: PickerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const cfg = useMemo(() => safeParse(configJson), [configJson]);
  const selected = str(cfg.connectionId);

  const { data: all = [] } = useQuery<IntegrationRow[]>({
    queryKey: ["/api/integrations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations");
      return res.json();
    },
  });

  const options = useMemo(
    () => all.filter((c) => c.name === integrationName),
    [all, integrationName]
  );

  const filtered = useMemo(
    () => options.filter((c) => connectionLabel(c, options.indexOf(c)).toLowerCase().includes(q.toLowerCase())),
    [options, q]
  );

  const pick = useCallback(
    (id: string) => {
      const base = safeParse(configJson);
      onUpdate(JSON.stringify({ ...base, connectionId: id }, null, 2));
      setOpen(false);
      setQ("");
    },
    [configJson, onUpdate]
  );

  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{label ?? "Connection"}</Label>
        <Link href="/integrations" className="text-xs text-orange-600 hover:underline">
          + New
        </Link>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm hover:bg-accent/50"
          >
            <span className={selected ? "text-foreground" : "text-muted-foreground"}>
              {selected
                ? connectionLabel(options.find((c) => c.id === selected) ?? { id: "", name: "" }, options.findIndex((c) => c.id === selected)) || "Selected"
                : `Select ${integrationName.replace(/-/g, " ")} connection`}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="p-2">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-8" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <ScrollArea className="h-[200px]">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No connections. Connect in Integrations.</p>
              ) : (
                <div className="space-y-0">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${selected === c.id ? "bg-muted" : ""}`}
                      onClick={() => pick(c.id)}
                    >
                      {connectionLabel(c, options.indexOf(c))}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-full"
        onClick={() => {
          void queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
          toast({ title: "Refreshed", description: "Connection list updated." });
        }}
      >
        <RefreshCw className="mr-2 h-3.5 w-3.5" />
        Refresh list
      </Button>
    </div>
  );
}

const SHEETS_USE_DRIVE = new Set([
  "create-spreadsheet",
  "create-spreadsheet-row",
  "create-worksheet",
  "find-worksheet",
  "find-row",
  "update-row",
]);
/** Target spreadsheet (existing file to write into or search in). */
const SHEETS_USE_TARGET_SPREADSHEET = new Set([
  "create-spreadsheet-row",
  "create-worksheet",
  "find-worksheet",
  "find-row",
  "update-row",
]);
const SHEETS_USE_WORKSHEET = new Set(["create-spreadsheet-row", "find-row", "update-row"]);

/** Google Sheets: drive, spreadsheet, worksheet pickers (same APIs as canvas). */
export function GoogleSheetsResourcePickers({
  configJson,
  onUpdate,
  canvasActionId,
}: {
  configJson: string;
  onUpdate: (next: string) => void;
  canvasActionId: string;
}) {
  const { toast } = useToast();
  const cfg = useMemo(() => safeParse(configJson), [configJson]);
  const connectionId = str(cfg.connectionId);
  const driveId = str(cfg.driveId) || "root";
  const spreadsheetId = str(cfg.spreadsheetId);
  const copySpreadsheetId = str(cfg.copySpreadsheetId);
  const worksheetId = str(cfg.worksheetId);

  const [drives, setDrives] = useState<Array<{ id: string; name: string }>>([]);
  const [spreadsheets, setSpreadsheets] = useState<Array<{ id: string; name: string }>>([]);
  const [worksheets, setWorksheets] = useState<Array<{ id: string; name: string }>>([]);

  const [driveOpen, setDriveOpen] = useState(false);
  const [ssOpen, setSsOpen] = useState(false);
  const [ssCopyOpen, setSsCopyOpen] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  const [dq, setDq] = useState("");
  const [sq, setSq] = useState("");
  const [sqCopy, setSqCopy] = useState("");
  const [wq, setWq] = useState("");

  const needDrive = SHEETS_USE_DRIVE.has(canvasActionId);
  const needTargetSpreadsheet = SHEETS_USE_TARGET_SPREADSHEET.has(canvasActionId);
  const needCopySpreadsheet = canvasActionId === "create-spreadsheet";
  const needWorksheet = SHEETS_USE_WORKSHEET.has(canvasActionId);

  const patch = useCallback(
    (p: Record<string, unknown>) => {
      const base = safeParse(configJson);
      onUpdate(JSON.stringify({ ...base, ...p }, null, 2));
    },
    [configJson, onUpdate]
  );

  const loadDrives = useCallback(async () => {
    if (!connectionId) {
      toast({ variant: "destructive", title: "Select a connection first" });
      return;
    }
    try {
      const res = await apiRequest("GET", `/api/integrations/google-sheets/drives?connectionId=${connectionId}`);
      const data = await res.json();
      setDrives(data.drives || []);
      toast({ title: "Drives updated" });
    } catch {
      toast({ variant: "destructive", title: "Failed to load drives" });
    }
  }, [connectionId, toast]);

  const loadSpreadsheets = useCallback(async () => {
    if (!connectionId) {
      toast({ variant: "destructive", title: "Select a connection first" });
      return;
    }
    try {
      const res = await apiRequest(
        "GET",
        `/api/integrations/google-sheets/spreadsheets?connectionId=${connectionId}&driveId=${encodeURIComponent(driveId || "root")}`
      );
      const data = await res.json();
      setSpreadsheets(data.spreadsheets || []);
      toast({ title: "Spreadsheets updated" });
    } catch {
      toast({ variant: "destructive", title: "Failed to load spreadsheets" });
    }
  }, [connectionId, driveId, toast]);

  const loadWorksheets = useCallback(async () => {
    if (!connectionId || !spreadsheetId) {
      toast({ variant: "destructive", title: "Select connection and spreadsheet first" });
      return;
    }
    try {
      const res = await apiRequest(
        "GET",
        `/api/integrations/google-sheets/worksheets?connectionId=${connectionId}&spreadsheetId=${encodeURIComponent(spreadsheetId)}`
      );
      const data = await res.json();
      setWorksheets(data.worksheets || []);
      toast({ title: "Worksheets updated" });
    } catch {
      toast({ variant: "destructive", title: "Failed to load worksheets" });
    }
  }, [connectionId, spreadsheetId, toast]);

  useEffect(() => {
    if (!connectionId || !needDrive) return;
    void loadDrives();
  }, [connectionId, needDrive, loadDrives]);

  useEffect(() => {
    if (!connectionId || !(needTargetSpreadsheet || needCopySpreadsheet)) return;
    void loadSpreadsheets();
  }, [connectionId, driveId, needTargetSpreadsheet, needCopySpreadsheet, loadSpreadsheets]);

  useEffect(() => {
    if (!connectionId || !spreadsheetId || !needWorksheet) return;
    void loadWorksheets();
  }, [connectionId, spreadsheetId, needWorksheet, loadWorksheets]);

  if (!needDrive) return null;

  return (
    <div className="space-y-3">
      <SimpleConnectionPicker configJson={configJson} onUpdate={onUpdate} integrationName="google-sheets" label="Google Sheets connection" />

      <div className="space-y-2 rounded-md border bg-background p-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Drive</Label>
          <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => void loadDrives()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <Popover open={driveOpen} onOpenChange={setDriveOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm"
            >
              {driveId
                ? drives.find((d) => d.id === driveId)?.name || driveId
                : "Select drive (defaults to My Drive)"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="p-2">
              <Input className="mb-2 h-8" placeholder="Search..." value={dq} onChange={(e) => setDq(e.target.value)} />
              <ScrollArea className="h-[180px]">
                <button
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    patch({ driveId: "root" });
                    setDriveOpen(false);
                  }}
                >
                  My Drive (root)
                </button>
                {drives
                  .filter((d) => d.name.toLowerCase().includes(dq.toLowerCase()))
                  .map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${driveId === d.id ? "bg-muted" : ""}`}
                      onClick={() => {
                        patch({ driveId: d.id });
                        setDriveOpen(false);
                      }}
                    >
                      {d.name}
                    </button>
                  ))}
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">
          The Google Drive where your spreadsheet resides. If nothing is selected, your personal Drive is used.
        </p>
      </div>

      {needCopySpreadsheet ? (
        <div className="space-y-2 rounded-md border bg-background p-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Spreadsheet to copy</Label>
            <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => void loadSpreadsheets()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Popover open={ssCopyOpen} onOpenChange={setSsCopyOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm">
                <span className={copySpreadsheetId ? "text-foreground" : "text-muted-foreground"}>
                  {copySpreadsheetId
                    ? spreadsheets.find((s) => s.id === copySpreadsheetId)?.name || copySpreadsheetId
                    : "Select spreadsheet to copy (optional)"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="p-2">
                <Input className="mb-2 h-8" placeholder="Search..." value={sqCopy} onChange={(e) => setSqCopy(e.target.value)} />
                <ScrollArea className="h-[200px]">
                  <button
                    type="button"
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      patch({ copySpreadsheetId: "" });
                      setSsCopyOpen(false);
                    }}
                  >
                    None (blank spreadsheet)
                  </button>
                  {spreadsheets
                    .filter((s) => s.name.toLowerCase().includes(sqCopy.toLowerCase()))
                    .map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${copySpreadsheetId === s.id ? "bg-muted" : ""}`}
                        onClick={() => {
                          patch({ copySpreadsheetId: s.id });
                          setSsCopyOpen(false);
                        }}
                      >
                        {s.name}
                      </button>
                    ))}
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">Optional — duplicate an existing spreadsheet as a template.</p>
        </div>
      ) : null}

      {needTargetSpreadsheet ? (
        <div className="space-y-2 rounded-md border bg-background p-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Spreadsheet *</Label>
            <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => void loadSpreadsheets()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Popover open={ssOpen} onOpenChange={setSsOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm">
                {spreadsheetId
                  ? spreadsheets.find((s) => s.id === spreadsheetId)?.name || spreadsheetId
                  : "Select spreadsheet"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="p-2">
                <Input className="mb-2 h-8" placeholder="Search..." value={sq} onChange={(e) => setSq(e.target.value)} />
                <ScrollArea className="h-[200px]">
                  {spreadsheets
                    .filter((s) => s.name.toLowerCase().includes(sq.toLowerCase()))
                    .map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${spreadsheetId === s.id ? "bg-muted" : ""}`}
                        onClick={() => {
                          patch({ spreadsheetId: s.id });
                          setSsOpen(false);
                        }}
                      >
                        {s.name}
                      </button>
                    ))}
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">The spreadsheets in your Google Drive.</p>
        </div>
      ) : null}

      {needWorksheet ? (
        <div className="space-y-2 rounded-md border bg-background p-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Worksheet *</Label>
            <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => void loadWorksheets()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Popover open={wsOpen} onOpenChange={setWsOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm">
                {worksheetId ? worksheets.find((w) => w.id === worksheetId)?.name || worksheetId : "Select worksheet"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="p-2">
                <Input className="mb-2 h-8" placeholder="Search..." value={wq} onChange={(e) => setWq(e.target.value)} />
                <ScrollArea className="h-[200px]">
                  {worksheets
                    .filter((w) => w.name.toLowerCase().includes(wq.toLowerCase()))
                    .map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${worksheetId === w.id ? "bg-muted" : ""}`}
                        onClick={() => {
                          patch({ worksheetId: w.id });
                          setWsOpen(false);
                        }}
                      >
                        {w.name}
                      </button>
                    ))}
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">Worksheets in the selected spreadsheet. Row 1 should contain headers.</p>
        </div>
      ) : null}
    </div>
  );
}

/** Google Calendar: pick calendar after connection (create/update event). */
export function GoogleCalendarResourcePickers({
  configJson,
  onUpdate,
  canvasActionId,
}: {
  configJson: string;
  onUpdate: (next: string) => void;
  canvasActionId: string;
}) {
  const { toast } = useToast();
  const cfg = useMemo(() => safeParse(configJson), [configJson]);
  const connectionId = str(cfg.connectionId);
  const calendarId = str(cfg.calendarId);

  const [calendars, setCalendars] = useState<Array<{ id: string; name: string }>>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const needCalList = canvasActionId === "create-event" || canvasActionId === "update-event";

  const patch = useCallback(
    (p: Record<string, unknown>) => {
      const base = safeParse(configJson);
      onUpdate(JSON.stringify({ ...base, ...p }, null, 2));
    },
    [configJson, onUpdate]
  );

  const loadCalendars = useCallback(async () => {
    if (!connectionId) {
      toast({ variant: "destructive", title: "Select a connection first" });
      return;
    }
    try {
      const res = await apiRequest("GET", `/api/integrations/google-calendar/calendars?connectionId=${connectionId}`);
      const data = await res.json();
      setCalendars(data.calendars || []);
      toast({ title: "Calendars updated" });
    } catch {
      toast({ variant: "destructive", title: "Failed to load calendars" });
    }
  }, [connectionId, toast]);

  useEffect(() => {
    if (!connectionId || !needCalList) return;
    void loadCalendars();
  }, [connectionId, needCalList, loadCalendars]);

  if (!needCalList) {
    return <SimpleConnectionPicker configJson={configJson} onUpdate={onUpdate} integrationName="google-calendar" />;
  }

  return (
    <div className="space-y-3">
      <SimpleConnectionPicker configJson={configJson} onUpdate={onUpdate} integrationName="google-calendar" />
      <div className="space-y-2 rounded-md border bg-background p-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Calendar *</Label>
          <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => void loadCalendars()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm">
              {calendarId ? calendars.find((c) => c.id === calendarId)?.name || calendarId : "Select calendar"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="p-2">
              <Input className="mb-2 h-8" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
              <ScrollArea className="h-[200px]">
                {calendars
                  .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${calendarId === c.id ? "bg-muted" : ""}`}
                      onClick={() => {
                        patch({ calendarId: c.id });
                        setOpen(false);
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
