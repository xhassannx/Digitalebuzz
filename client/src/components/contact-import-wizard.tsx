import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Upload, Check, ChevronDown, Loader2, Send, Info, FileSpreadsheet, ChevronRight, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export type FieldMapping = {
  field: string;
  csvHeader: string | null;
  type?: string;
  required?: boolean;
  label?: string;
};

type ValidationResult = {
  valid: number;
  invalid: number;
  total: number;
  duplicateContactNumbers: number;
  invalidEmailAddresses: number;
  invalidTextFields: number;
  invalidContactNumbers: number;
  errors?: Array<{ row: number; error: string }>;
};

const FIELD_TYPE_DISPLAY: Record<string, string> = {
  phone: "PHONE",
  name: "TEXT",
  email: "TEXT",
  tags: "TEXT",
  status: "SELECT",
  wabaPhoneNumber: "TEXT",
  formName: "SELECT",
  pageName: "SELECT",
  city: "TEXT",
  usingWhatsappTool: "TEXT",
  businessOwner: "TEXT",
  areYouA: "TEXT",
  pricing: "NUMBER",
};

const AVAILABLE_FIELDS: FieldMapping[] = [
  { field: "phone", csvHeader: null, type: "string", required: true, label: "Phone" },
  { field: "name", csvHeader: null, type: "string", required: true, label: "Name" },
  { field: "email", csvHeader: null, type: "string", required: false, label: "Email" },
  { field: "tags", csvHeader: null, type: "string", required: false, label: "Tags" },
  { field: "status", csvHeader: null, type: "string", required: false, label: "Status" },
  { field: "wabaPhoneNumber", csvHeader: null, type: "string", required: false, label: "WABA Phone Number" },
  { field: "formName", csvHeader: null, type: "string", required: false, label: "Form Name" },
  { field: "pageName", csvHeader: null, type: "string", required: false, label: "Page Name" },
  { field: "city", csvHeader: null, type: "string", required: false, label: "City" },
  { field: "usingWhatsappTool", csvHeader: null, type: "string", required: false, label: "Are You Using Any Whatsapp Marketing Tool ?" },
  { field: "businessOwner", csvHeader: null, type: "string", required: false, label: "Are you a Business Owner?" },
  { field: "areYouA", csvHeader: null, type: "string", required: false, label: "Are You A?" },
  { field: "pricing", csvHeader: null, type: "number", required: false, label: "Pricing" },
];

/** Normalize header for matching: trim, lower case, collapse spaces */
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Possible CSV header names (normalized) that map to each field. First match wins. */
const HEADER_ALIASES: Record<string, string[]> = {
  phone: ["phone", "phone number", "phonenumber", "mobile", "contact number", "tel", "telephone", "whatsapp number"],
  name: ["name", "contact name", "full name", "contact", "customer name", "client name"],
  email: ["email", "email address", "e-mail", "email id"],
  tags: ["tags", "tag"],
  status: ["status"],
  wabaPhoneNumber: ["waba phone number", "waba phonenumber", "waba"],
  formName: ["form name", "formname", "form"],
  pageName: ["page name", "pagename", "page"],
  city: ["city", "location"],
  usingWhatsappTool: ["are you using any whatsapp marketing tool", "using whatsapp tool", "whatsapp marketing tool", "whatsapp tool"],
  businessOwner: ["are you a business owner", "business owner", "businessowner"],
  areYouA: ["are you a", "are you"],
  pricing: ["pricing", "price"],
};

function autoFillMappings(headers: string[], fields: FieldMapping[]): FieldMapping[] {
  const used = new Set<string>();
  const normalizedHeaders = headers.map((h) => ({ original: h, normalized: normalizeHeader(h) }));

  return fields.map((f) => {
    const aliases = [f.field, ...(f.label ? [f.label.replace(/\s*\*\s*/, "").trim()] : []), ...(HEADER_ALIASES[f.field] ?? [])];
    const normalizedAliases = new Set(aliases.map(normalizeHeader));

    for (const { original, normalized } of normalizedHeaders) {
      if (used.has(original)) continue;
      if (normalizedAliases.has(normalized)) {
        used.add(original);
        return { ...f, csvHeader: original };
      }
    }
    return { ...f, csvHeader: null };
  });
}

/** RFC-style CSV cell escaping for sample file download */
function escapeCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  if (/[",\n\r]/.test(value)) return `"${escaped}"`;
  return escaped;
}

/** Headers match import field labels so “Map Headers” auto-fills for most users */
const SAMPLE_CSV_FILENAME = "contacts-import-sample.csv";

function downloadContactsImportSampleCsv() {
  const rows: string[][] = [
    ["Phone", "Name", "Email", "Tags", "Status", "WABA Phone Number"],
    [
      "919876543210",
      "Alex Sample",
      "alex.sample@example.com",
      "vip, wholesale",
      "Not Assigned",
      "983763371487832",
    ],
    ["918888777666", "Jordan Demo", "jordan.demo@example.com", "newsletter", "Not Assigned", ""],
  ];
  const body = rows.map((r) => r.map(escapeCsvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = SAMPLE_CSV_FILENAME;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type ContactImportWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importMode?: "direct" | "broadcast";
  onImportComplete: (importedIds: string[], finalImportMode: "direct" | "broadcast") => void;
  onImportAndBroadcastRequest?: (file: File, mappings: FieldMapping[], validCount: number) => void;
};

export function ContactImportWizard({
  open,
  onOpenChange,
  importMode = "direct",
  onImportComplete,
  onImportAndBroadcastRequest,
}: ContactImportWizardProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>(() =>
    AVAILABLE_FIELDS.map((f) => ({ ...f, csvHeader: null }))
  );
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [skipValidationIssues, setSkipValidationIssues] = useState(false);

  const parseHeadersMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/contacts/import/parse-headers", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      return res.json();
    },
    onSuccess: (data: { headers: string[] }) => {
      if (data?.headers && Array.isArray(data.headers)) {
        setCsvHeaders(data.headers);
        setMappings(autoFillMappings(data.headers, AVAILABLE_FIELDS.map((f) => ({ ...f, csvHeader: null }))));
        setCurrentStep(2);
      } else {
        toast({ title: "Error", description: "Invalid response from server", variant: "destructive" });
      }
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to parse CSV", variant: "destructive" });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async ({ file, mappings: m }: { file: File; mappings: FieldMapping[] }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mappings", JSON.stringify(m));
      const res = await fetch("/api/contacts/import/validate", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      return res.json();
    },
    onSuccess: (data: ValidationResult) => {
      setValidationResult(data);
      setCurrentStep(3);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Validation failed", variant: "destructive" });
    },
  });

  const finalImportMutation = useMutation({
    mutationFn: async ({ file, mappings: m }: { file: File; mappings: FieldMapping[] }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mappings", JSON.stringify(m));
      const res = await fetch("/api/contacts/import/final", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      return res.json();
    },
    onSuccess: (data: { importedContactIds?: string[] }) => {
      const ids = data.importedContactIds ?? [];
      onImportComplete(ids, "direct");
      onOpenChange(false);
      toast({ title: "Success", description: `Imported ${ids.length} contact(s).` });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Import failed", variant: "destructive" });
    },
  });

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({ title: "Error", description: "Please upload a CSV file.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "Error", description: "File size must be 10MB or less.", variant: "destructive" });
      return;
    }
    setCsvFile(file);
    setValidationResult(null);
    setSkipValidationIssues(false);
    parseHeadersMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const canImport =
    validationResult &&
    validationResult.valid > 0 &&
    (!(validationResult.invalid > 0) || skipValidationIssues);
  const hasValidationIssues = (validationResult?.invalid ?? 0) > 0;

  const handleDirectImport = () => {
    if (!csvFile || !canImport) return;
    finalImportMutation.mutate({ file: csvFile, mappings });
  };

  const handleImportAndBroadcast = () => {
    if (!csvFile || !canImport || !onImportAndBroadcastRequest || !validationResult) return;
    onImportAndBroadcastRequest(csvFile, mappings, validationResult.valid);
    onOpenChange(false);
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setCsvFile(null);
    setCsvHeaders([]);
    setMappings(AVAILABLE_FIELDS.map((f) => ({ ...f, csvHeader: null })));
    setValidationResult(null);
    setSkipValidationIssues(false);
  };

  const [instructionsOpen, setInstructionsOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetWizard();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden gap-0 p-0">
        <div className="shrink-0 px-6 pt-6">
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
          </DialogHeader>

          {/* Step indicator - horizontal stepper with circles and connecting line */}
          <div className="flex items-center w-full mb-6">
          <div className="flex items-center">
            <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${currentStep === 1 ? "bg-orange-500 text-white" : currentStep > 1 ? "bg-orange-500 text-white" : "border-2 border-orange-500 text-muted-foreground"}`}>
              {currentStep > 1 ? <Check className="w-4 h-4" /> : "1"}
            </span>
            <span className={`ml-2 text-sm font-medium ${currentStep >= 1 ? "text-foreground" : "text-muted-foreground"}`}>Upload CSV</span>
          </div>
          <div className={`flex-1 h-0.5 mx-2 min-w-[24px] ${currentStep >= 2 ? "bg-orange-500" : "bg-muted"}`} />
          <div className="flex items-center">
            <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${currentStep === 2 ? "bg-orange-500 text-white" : currentStep > 2 ? "bg-orange-500 text-white" : "border-2 border-orange-500/50 text-muted-foreground"}`}>
              {currentStep > 2 ? <Check className="w-4 h-4" /> : "2"}
            </span>
            <span className={`ml-2 text-sm font-medium ${currentStep >= 2 ? "text-foreground" : "text-muted-foreground"}`}>Map Headers</span>
          </div>
          <div className={`flex-1 h-0.5 mx-2 min-w-[24px] ${currentStep >= 3 ? "bg-orange-500" : "bg-muted"}`} />
          <div className="flex items-center">
            <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${currentStep === 3 ? "bg-orange-500 text-white" : "border-2 border-orange-500/50 text-muted-foreground"}`}>
              3
            </span>
            <span className={`ml-2 text-sm font-medium ${currentStep >= 3 ? "text-foreground" : "text-muted-foreground"}`}>Verify</span>
          </div>
        </div>
        </div>

        <div className="rh-dialog-scroll-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
        {/* Step 1: Upload CSV */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen}>
              <div className="rounded-lg border bg-muted/30 p-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between text-left font-medium">
                  <span className="flex items-center gap-2">
                    Import Instructions
                    <span className="text-amber-500" aria-hidden>💡</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${instructionsOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Please review these requirements before uploading your CSV file:</p>
                    <div>
                      <p className="font-medium text-foreground">Phone Number (Required)</p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>Country code is mandatory (Example for India: 91)</li>
                        <li>Full number format: [Country Code][Phone Number]</li>
                        <li className="text-green-600">✔ Correct: 917599808080</li>
                        <li className="text-red-600">❌ Incorrect: 7599808080 (missing country code)</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Contact Name (Required)</p>
                      <p>Select a column to use as contact name</p>
                      <p className="flex items-center gap-1 mt-1"><span className="text-amber-500">💡</span> Tip: If you don&apos;t have names in your CSV, you can map the phone number column as the contact name</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">File Requirements</p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>Upload a CSV file format only</li>
                        <li>First row must contain column headers</li>
                        <li>Maximum file size: 10MB</li>
                      </ul>
                    </div>
                    <p className="flex items-center gap-1 pt-1"><span className="text-amber-500">💡</span> Tip: Make sure all phone numbers include the country code to avoid import errors</p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadContactsImportSampleCsv();
                }}
              >
                <Download className="h-4 w-4" />
                Download sample file
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-orange-500/50 rounded-lg p-12 text-center cursor-pointer hover:bg-orange-500/5 transition-colors"
            >
              {parseHeadersMutation.isPending ? (
                <Loader2 className="w-14 h-14 mx-auto animate-spin text-green-600 mb-4" />
              ) : (
                <FileSpreadsheet className="w-14 h-14 mx-auto text-green-600 mb-4" />
              )}
              <p className="text-base font-semibold text-foreground">
                {parseHeadersMutation.isPending ? "Parsing CSV..." : "Drag & Drop CSV file"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Maximum file size allowed 10MB</p>
              <p className="text-sm font-medium text-muted-foreground my-2">OR</p>
              <p className="text-sm text-muted-foreground">Click anywhere inside the dashed box to browse files</p>
              {csvFile && !parseHeadersMutation.isPending && (
                <p className="text-xs text-muted-foreground mt-2 font-medium">{csvFile.name}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Map Headers */}
        {currentStep === 2 && (
          <div className="space-y-4">
            {csvHeaders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading headers...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Column</TableHead>
                    <TableHead>CSV Headers</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((m, idx) => (
                    <TableRow key={m.field}>
                      <TableCell>
                        {m.label ?? m.field}
                        {m.required && <span className="text-destructive ml-1">*</span>}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={m.csvHeader ?? undefined}
                          onValueChange={(value) => {
                            const next = [...mappings];
                            next[idx] = { ...next[idx], csvHeader: value || null };
                            setMappings(next);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Header" />
                          </SelectTrigger>
                          <SelectContent>
                            {csvHeaders.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {FIELD_TYPE_DISPLAY[m.field] ?? "TEXT"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => csvFile && validateMutation.mutate({ file: csvFile, mappings })}
                disabled={validateMutation.isPending || mappings.filter((m) => m.required).some((m) => !m.csvHeader)}
              >
                {validateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Verify Data
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Verify */}
        {currentStep === 3 && validationResult && (
          <div className="space-y-4">
            <div>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h4 className="text-lg font-semibold mb-2">Validation Summary</h4>
                  <p className="text-sm text-muted-foreground">
                    {validationResult.valid} contact{validationResult.valid !== 1 ? "s" : ""} validated successfully
                    {validationResult.invalid > 0 && `, ${validationResult.invalid} require attention`}.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <span className="inline-flex items-center rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white">
                    Valid Entries: {validationResult.valid}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-red-500/90 px-3 py-1 text-sm font-medium text-white">
                    Validation Issues: {validationResult.invalid}
                  </span>
                </div>
              </div>
              {hasValidationIssues && (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    Please review and correct the validation issues or proceed by skipping them.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <Card className="bg-red-500/10 border-red-500/30">
                      <CardContent className="p-3 flex items-center gap-2">
                        <Info className="w-4 h-4 shrink-0" />
                        <span className="text-sm">Duplicate Contact Numbers: {validationResult.duplicateContactNumbers}</span>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-500/10 border-red-500/30">
                      <CardContent className="p-3 flex items-center gap-2">
                        <Info className="w-4 h-4 shrink-0" />
                        <span className="text-sm">Invalid Email Addresses: {validationResult.invalidEmailAddresses}</span>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-500/10 border-red-500/30">
                      <CardContent className="p-3 flex items-center gap-2">
                        <Info className="w-4 h-4 shrink-0" />
                        <span className="text-sm">Invalid Text Fields: {validationResult.invalidTextFields}</span>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-500/10 border-red-500/30">
                      <CardContent className="p-3 flex items-center gap-2">
                        <Info className="w-4 h-4 shrink-0" />
                        <span className="text-sm">Invalid Contact Numbers: {validationResult.invalidContactNumbers}</span>
                      </CardContent>
                    </Card>
                  </div>
                  <Button
                    variant="outline"
                    className="mb-3"
                    onClick={() => setSkipValidationIssues(true)}
                  >
                    <ChevronRight className="w-4 h-4 mr-2" />
                    Skip Validation Issues
                  </Button>
                </>
              )}
            </div>
            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Back
              </Button>
              {onImportAndBroadcastRequest ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="bg-orange-500 hover:bg-orange-600"
                      disabled={!canImport || finalImportMutation.isPending}
                    >
                      Import
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDirectImport} disabled={!canImport}>
                      Direct Import
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleImportAndBroadcast} disabled={!canImport}>
                      <Send className="w-4 h-4 mr-2" />
                      Import & Broadcast
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  onClick={handleDirectImport}
                  disabled={!canImport || finalImportMutation.isPending}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {finalImportMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Import
                </Button>
              )}
            </div>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
