import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, Loader2, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function headerFieldsFromConfig(cfg: Record<string, unknown>): string[] {
  const arr = cfg.sheetHeaderFields;
  if (Array.isArray(arr)) {
    return arr.map((x) => str(x));
  }
  const sh = str(cfg.spreadsheetHeader);
  if (sh.trim()) {
    return sh
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function readRow(cfg: Record<string, unknown>): Record<string, string> {
  const r = cfg.row;
  if (r && typeof r === "object" && !Array.isArray(r)) {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
      o[k] = str(v);
    }
    return o;
  }
  return {};
}

function uniqueHeaderKeys(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    const base = h.trim() || "Column";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
}

async function fetchHeaderRowApi(connectionId: string, spreadsheetId: string, sheetId: string): Promise<string[]> {
  const q = new URLSearchParams({
    connectionId,
    spreadsheetId,
  });
  if (sheetId) q.set("sheetId", sheetId);
  const res = await apiRequest("GET", `/api/integrations/google-sheets/header-row?${q}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Failed to fetch header row");
  }
  const data = await res.json();
  return Array.isArray(data.headers) ? data.headers.map((h: unknown) => str(h)) : [];
}

/** Chatbot builder opens the variable picker instead of typing `{{...}}` manually. */
export type GoogleSheetsColumnVariablePicker = {
  /** Current chatbot node id (for “upstream variables” in Data Selector). */
  nodeId: string;
  open: (ctx: { contextLabel: string; fieldKey: string; onInsert: (snippet: string) => void }) => void;
};

export type GoogleSheetsActionExtraFieldsProps = {
  actionId: string;
  config: Record<string, unknown>;
  applyConfigPatch: (patch: Record<string, unknown>) => void;
  connectionId: string;
  spreadsheetId: string;
  worksheetId: string;
  /** Optional className for outer wrapper */
  className?: string;
  /** Canvas uses slightly different label styling via className on inner cards */
  variant?: "simple" | "canvas";
  /** When set (chatbot “Append to Google Sheet”), each column value gets an “Insert variable” control. */
  columnVariablePicker?: GoogleSheetsColumnVariablePicker;
  /**
   * Contact / CRM custom columns from the panel (same as Contacts page). Shown for “create-spreadsheet-row”
   * so tenants can copy `{{contact.<id>}}` without looking up ids.
   */
  contactColumnHints?: Array<{ id: string; label: string }>;
};

/**
 * Action-specific Google Sheets fields (title, headers, find row, update row, dynamic row + Fetch fields).
 * Resource pickers (connection / drive / spreadsheet / worksheet) stay in the parent.
 */
export function GoogleSheetsActionExtraFields({
  actionId,
  config,
  applyConfigPatch,
  connectionId,
  spreadsheetId,
  worksheetId,
  className = "",
  variant = "simple",
  columnVariablePicker,
  contactColumnHints,
}: GoogleSheetsActionExtraFieldsProps) {
  const { toast } = useToast();
  const [fetchingHeaders, setFetchingHeaders] = useState(false);
  const [columnOptions, setColumnOptions] = useState<string[]>([]);

  const sheetHeaderFields = useMemo(() => headerFieldsFromConfig(config), [config]);
  const [localHeaders, setLocalHeaders] = useState<string[]>(sheetHeaderFields);

  useEffect(() => {
    setLocalHeaders(sheetHeaderFields.length ? sheetHeaderFields : []);
  }, [sheetHeaderFields.join("|")]);

  const rowMap = useMemo(() => readRow(config), [config]);
  const [localRow, setLocalRow] = useState(rowMap);
  useEffect(() => {
    setLocalRow(rowMap);
  }, [JSON.stringify(rowMap)]);

  const pushHeaders = useCallback(
    (fields: string[]) => {
      setLocalHeaders(fields);
      const joined = fields.map((f) => f.trim()).filter(Boolean).join(", ");
      applyConfigPatch({ sheetHeaderFields: fields, spreadsheetHeader: joined });
    },
    [applyConfigPatch]
  );

  const addHeaderField = useCallback(() => {
    pushHeaders([...localHeaders, ""]);
  }, [localHeaders, pushHeaders]);

  const removeHeaderField = useCallback(
    (index: number) => {
      pushHeaders(localHeaders.filter((_, i) => i !== index));
    },
    [localHeaders, pushHeaders]
  );

  const updateHeaderField = useCallback(
    (index: number, value: string) => {
      const next = localHeaders.map((h, i) => (i === index ? value : h));
      pushHeaders(next);
    },
    [localHeaders, pushHeaders]
  );

  const mergeRow = useCallback(
    (next: Record<string, string>) => {
      setLocalRow(next);
      applyConfigPatch({ row: next });
    },
    [applyConfigPatch]
  );

  const updateRowKey = useCallback(
    (key: string, value: string) => {
      mergeRow({ ...localRow, [key]: value });
    },
    [localRow, mergeRow]
  );

  const runFetchFields = useCallback(async () => {
    if (!connectionId || !spreadsheetId) {
      toast({
        variant: "destructive",
        title: "Select spreadsheet",
        description: "Choose a spreadsheet first. For row actions, also pick a worksheet when required.",
      });
      return;
    }
    if ((actionId === "find-row" || actionId === "create-spreadsheet-row" || actionId === "update-row") && !worksheetId) {
      toast({
        variant: "destructive",
        title: "Select worksheet",
        description: "Pick a worksheet so we can read row 1 headers.",
      });
      return;
    }
    setFetchingHeaders(true);
    try {
      const sid =
        actionId === "find-worksheet" && !worksheetId ? "" : worksheetId;
      const headers = await fetchHeaderRowApi(connectionId, spreadsheetId, sid);
      const keys = uniqueHeaderKeys(headers);
      setColumnOptions(keys.filter((k) => k.trim()));
      const prev = { ...readRow(config) };
      for (const k of keys) {
        if (!(k in prev)) prev[k] = "";
      }
      applyConfigPatch({ row: prev });
      setLocalRow(prev);
      toast({ title: "Fields loaded", description: `${keys.length} column(s) from row 1.` });
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Fetch failed",
        description: e instanceof Error ? e.message : "Could not read header row",
      });
    } finally {
      setFetchingHeaders(false);
    }
  }, [actionId, applyConfigPatch, config, connectionId, spreadsheetId, worksheetId, toast]);

  useEffect(() => {
    if (actionId !== "find-row") return;
    if (!connectionId || !spreadsheetId || !worksheetId) {
      setColumnOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const headers = await fetchHeaderRowApi(connectionId, spreadsheetId, worksheetId);
        const keys = uniqueHeaderKeys(headers);
        if (!cancelled) setColumnOptions(keys);
      } catch {
        if (!cancelled) setColumnOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actionId, connectionId, spreadsheetId, worksheetId]);

  const cardClass =
    variant === "canvas"
      ? "border border-gray-200 rounded-lg bg-white mt-3"
      : "space-y-3 rounded-md border bg-background p-3";

  const innerClass = variant === "canvas" ? "p-3 pt-4 space-y-3" : "space-y-3";

  const yesNo = (value: unknown) => {
    const s = str(value).toLowerCase();
    if (s === "yes" || s === "true" || s === "1") return "yes";
    if (s === "no" || s === "false" || s === "0") return "no";
    return "";
  };

  // —— Create spreadsheet / Create worksheet: title + dynamic headers + overwrite (worksheet only)
  if (actionId === "create-spreadsheet" || actionId === "create-worksheet") {
    const title = str(config.spreadsheetTitle);
    return (
      <div className={className}>
        <div className={cardClass}>
          {variant === "canvas" ? (
            <div className="p-3 border-b border-gray-200">
              <span className="font-medium text-sm">
                {actionId === "create-spreadsheet" ? "Create spreadsheet" : "Create worksheet"}
              </span>
            </div>
          ) : null}
          <div className={innerClass}>
            <div className="space-y-1">
              <Label className={variant === "canvas" ? "text-xs text-gray-600" : "text-xs"}>Title *</Label>
              <Input
                className="h-9"
                placeholder={actionId === "create-spreadsheet" ? "Spreadsheet title" : "Worksheet title"}
                value={title}
                onChange={(e) => applyConfigPatch({ spreadsheetTitle: e.target.value })}
              />
              <p className={variant === "canvas" ? "text-xs text-gray-500 mt-1" : "text-xs text-muted-foreground"}>
                The title for the new {actionId === "create-spreadsheet" ? "spreadsheet" : "worksheet"}.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className={variant === "canvas" ? "text-xs text-gray-600" : "text-xs"}>Headers</Label>
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={addHeaderField}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add header
                </Button>
              </div>
              {localHeaders.length === 0 ? (
                <p
                  className={
                    variant === "canvas"
                      ? "text-xs text-gray-500 rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center"
                      : "text-xs text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center"
                  }
                >
                  No headers added yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {localHeaders.map((h, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        className="h-9 flex-1"
                        placeholder={`Header ${i + 1}`}
                        value={h}
                        onChange={(e) => updateHeaderField(i, e.target.value)}
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeHeaderField(i)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className={variant === "canvas" ? "text-xs text-gray-500" : "text-xs text-muted-foreground"}>
                Optional column names for the first row. Saved as <code className="text-[10px]">spreadsheetHeader</code> for
                your automation runtime.
              </p>
            </div>

            {actionId === "create-worksheet" ? (
              <div className="space-y-1">
                <Label className={variant === "canvas" ? "text-xs text-gray-600" : "text-xs"}>Overwrite</Label>
                <Select
                  value={yesNo(config.overwriteWorksheet) || "no"}
                  onValueChange={(v) => applyConfigPatch({ overwriteWorksheet: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Yes / No" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
                <p className={variant === "canvas" ? "text-xs text-gray-500 mt-1" : "text-xs text-muted-foreground"}>
                  If a worksheet with this title already exists, Yes replaces its content. Use with caution.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // —— Find worksheet
  if (actionId === "find-worksheet") {
    const wt = str(config.worksheetSearchTitle);
    const cif = yesNo(config.createWorksheetIfNone);
    return (
      <div className={className}>
        <div className={cardClass}>
          {variant === "canvas" ? (
            <div className="p-3 border-b border-gray-200">
              <span className="font-medium text-sm">Find worksheet</span>
            </div>
          ) : null}
          <div className={innerClass}>
            <div className="space-y-1">
              <Label className={variant === "canvas" ? "text-xs text-gray-600" : "text-xs"}>Title *</Label>
              <Input
                className="h-9"
                placeholder="Exact worksheet title (case-sensitive)"
                value={wt}
                onChange={(e) => applyConfigPatch({ worksheetSearchTitle: e.target.value })}
              />
              <p className={variant === "canvas" ? "text-xs text-gray-500 mt-1" : "text-xs text-muted-foreground"}>
                The worksheet title must match exactly.
              </p>
            </div>
            <div className="space-y-1">
              <Label className={variant === "canvas" ? "text-xs text-gray-600" : "text-xs"}>Create worksheet if none are found</Label>
              <Select
                value={cif || "no"}
                onValueChange={(v) => applyConfigPatch({ createWorksheetIfNone: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label className={variant === "canvas" ? "text-xs text-gray-600 font-medium" : "text-xs font-medium"}>Dynamic fields</Label>
                <p className={variant === "canvas" ? "text-xs text-gray-500" : "text-xs text-muted-foreground"}>
                  Load column names from row 1 of the selected spreadsheet (first sheet or chosen worksheet when set).
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void runFetchFields()} disabled={fetchingHeaders}>
                {fetchingHeaders ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Fetch fields
              </Button>
            </div>
            {Object.keys(localRow).length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {Object.keys(localRow).length} column key(s) in config — use in later steps as{" "}
                <code className="text-[10px]">{"{{steps...}}"}</code>.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // —— Find row
  if (actionId === "find-row") {
    const col = str(config.columnSearch);
    const sv = str(config.searchValue);
    return (
      <div className={className}>
        <div className={cardClass}>
          {variant === "canvas" ? (
            <div className="p-3 border-b border-gray-200">
              <span className="font-medium text-sm">Find Row</span>
            </div>
          ) : null}
          <div className={innerClass}>
            <div className="space-y-1">
              <Label className={variant === "canvas" ? "text-xs text-gray-600" : "text-xs"}>Column to search *</Label>
              {columnOptions.length > 0 ? (
                <Select
                  value={columnOptions.includes(col) ? col : "__custom__"}
                  onValueChange={(v) => applyConfigPatch({ columnSearch: v === "__custom__" ? col : v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columnOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">Custom name…</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              <Input
                className="h-9"
                placeholder="Column name (must match header row)"
                value={col}
                onChange={(e) => applyConfigPatch({ columnSearch: e.target.value })}
              />
              {columnOptions.length > 0 ? (
                <p className={variant === "canvas" ? "text-xs text-gray-500" : "text-xs text-muted-foreground"}>
                  From worksheet row 1: {columnOptions.join(", ")}
                </p>
              ) : (
                <p className={variant === "canvas" ? "text-xs text-gray-500 mt-1" : "text-xs text-muted-foreground"}>
                  Connect worksheet above to auto-detect columns.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className={variant === "canvas" ? "text-xs text-gray-600" : "text-xs"}>Search value *</Label>
              <Input
                className="h-9"
                placeholder="{{contact.email}}"
                value={sv}
                onChange={(e) => applyConfigPatch({ searchValue: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // —— Update row & Create spreadsheet row: row index (update only) + dynamic values + fetch
  if (actionId === "update-row" || actionId === "create-spreadsheet-row") {
    const ri = str(config.rowIndex);
    return (
      <div className={className}>
        <div className={cardClass}>
          {variant === "canvas" ? (
            <div className="p-3 border-b border-gray-200">
              <span className="font-medium text-sm">{actionId === "update-row" ? "Update Row" : "Create spreadsheet row"}</span>
            </div>
          ) : null}
          <div className={innerClass}>
            {actionId === "update-row" ? (
              <div className="space-y-1">
                <Label className={variant === "canvas" ? "text-xs text-gray-600" : "text-xs"}>Row index *</Label>
                <Input
                  className="h-9"
                  placeholder="2"
                  value={ri}
                  onChange={(e) => applyConfigPatch({ rowIndex: e.target.value })}
                />
                <p className={variant === "canvas" ? "text-xs text-gray-500 mt-1" : "text-xs text-muted-foreground"}>
                  1-based row number (1 is the header row; first data row is usually 2).
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Worksheet name (optional)</Label>
                    <Input
                      className="h-9"
                      value={str(config.worksheetName)}
                      onChange={(e) => applyConfigPatch({ worksheetName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Range (optional)</Label>
                    <Input
                      className="h-9"
                      placeholder="A:E"
                      value={str(config.range) || "A:E"}
                      onChange={(e) => applyConfigPatch({ range: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label className={variant === "canvas" ? "text-xs text-gray-600 font-medium" : "text-xs font-medium"}>Dynamic fields</Label>
                <p className={variant === "canvas" ? "text-xs text-gray-500" : "text-xs text-muted-foreground"}>
                  Pull column headers from row 1, then map values for each column. Rows are saved in the same left-to-right order as row 1 (column A, B, C…).
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void runFetchFields()} disabled={fetchingHeaders}>
                {fetchingHeaders ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Fetch fields
              </Button>
            </div>

            {actionId === "create-spreadsheet-row" && contactColumnHints && contactColumnHints.length > 0 ? (
              <div
                className={
                  variant === "canvas"
                    ? "rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2"
                    : "rounded-md border bg-muted/40 p-3 space-y-2"
                }
              >
                <div>
                  <Label className={variant === "canvas" ? "text-xs text-gray-800 font-medium" : "text-xs font-medium"}>
                    CRM dynamic fields (Contacts)
                  </Label>
                  <p className={variant === "canvas" ? "text-xs text-gray-600 mt-0.5" : "text-[10px] text-muted-foreground mt-0.5"}>
                    Same columns as your{" "}
                    <span className="font-medium">Contacts</span> page. Add a <strong>Fetch Contact</strong> step before this
                    block, then click a field to copy <code className="text-[10px]">{"{{contact.id}}"}</code> and paste it into
                    the matching sheet column above.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {contactColumnHints.map((col) => (
                    <Button
                      key={col.id}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const snippet = `{{contact.${col.id}}}`;
                        void navigator.clipboard.writeText(snippet).then(() => {
                          toast({
                            title: "Copied",
                            description: `${col.label}: ${snippet}`,
                          });
                        });
                      }}
                    >
                      {col.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {(() => {
              const letterKeys = new Set(["A", "B", "C", "D", "E"]);
              const hasLegacy =
                (["A", "B", "C", "D", "E"] as const).some((c) => str(localRow[c] ?? "").trim() !== "");
              const hasNamed = Object.keys(localRow).some((k) => !letterKeys.has(k));
              if (hasLegacy && hasNamed) {
                return (
                  <p
                    className={
                      variant === "canvas"
                        ? "text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5"
                        : "text-xs text-amber-800 dark:text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5"
                    }
                  >
                    You are using <strong>named columns</strong> (from Fetch fields) and <strong>Legacy A–E</strong> at the
                    same time. That can put values in the wrong place. Clear the Legacy A–E boxes unless you only use
                    A–E-style headers.
                  </p>
                );
              }
              return null;
            })()}

            {Object.keys(localRow).length === 0 ? (
              <p className={variant === "canvas" ? "text-xs text-gray-500" : "text-xs text-muted-foreground"}>
                No field keys yet — use Fetch fields or add legacy A–E columns below.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(localRow).map(([key]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{key}</Label>
                    <div className="flex gap-1">
                      <Input
                        className="h-9 flex-1 min-w-0"
                        value={localRow[key] ?? ""}
                        onChange={(e) => updateRowKey(key, e.target.value)}
                      />
                      {columnVariablePicker ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          title="Insert variable"
                          onClick={() =>
                            columnVariablePicker.open({
                              contextLabel: `Sheet column “${key}”`,
                              fieldKey: `row.${key}`,
                              onInsert: (snippet) => {
                                const prev = readRow(config);
                                mergeRow({ ...prev, [key]: (str(prev[key]) || "") + snippet });
                              },
                            })
                          }
                        >
                          <Database className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {actionId === "create-spreadsheet-row" ? (
              <>
                <p className="text-xs font-medium text-muted-foreground">Legacy columns A–E (optional)</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["A", "B", "C", "D", "E"] as const).map((col) => (
                    <div key={col} className="space-y-1">
                      <Label className="text-xs">Column {col}</Label>
                      <Input
                        className="h-9"
                        value={localRow[col] ?? ""}
                        onChange={(e) => updateRowKey(col, e.target.value)}
                        placeholder={col === "A" ? "{{contact.name}}" : undefined}
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
