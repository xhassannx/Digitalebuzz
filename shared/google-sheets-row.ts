/** Slug for {{trigger.*}} paths (no spaces — dot-path safe). */
export function slugifySheetHeaderKey(header: string, columnIndex0: number): string {
  const base = String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || `col${columnIndex0 + 1}`;
}

/** Build trigger row object from header row + one data row (includes col1… and slug keys). */
export function buildSheetRowTriggerFields(
  headers: string[],
  cells: unknown[],
  rowIndex1Based?: number
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (rowIndex1Based != null) row.row = rowIndex1Based;

  const usedKeys = new Set<string>();
  const maxLen = Math.max(headers.length, cells.length);

  for (let i = 0; i < maxLen; i++) {
    const value = cells[i] ?? "";
    row[`col${i + 1}`] = value;
    row[`column_${i + 1}`] = value;

    const header = String(headers[i] ?? "").trim();
    let key = slugifySheetHeaderKey(header, i);
    if (usedKeys.has(key)) {
      let n = 2;
      while (usedKeys.has(`${key}_${n}`)) n++;
      key = `${key}_${n}`;
    }
    usedKeys.add(key);
    row[key] = value;
  }

  // Convenience aliases for WhatsApp Send Template "To" field
  const phone = extractPhoneFromSheetRow(row);
  if (phone) {
    row.phone = phone;
    const digits = phone.replace(/\D/g, "");
    if (digits) row.phoneE164 = digits.length >= 10 ? `+${digits}` : phone;
  }

  const name = extractNameFromSheetRow(row);
  if (name) row.name = name;

  return row;
}

const PHONE_KEY_RE =
  /whatsapp|phone|mobile|contact_number|contactnumber|contact_no|cell|tel|handphone|mob/i;
const NAME_KEY_RE =
  /^(name|full_name|fullname|customer_name|contact_name|first_name|registrant|attendee|participant)$/i;

/** Read phone from a sheet row object (slug keys + colN + common header slugs). */
export function extractPhoneFromSheetRow(row: Record<string, unknown>): string {
  for (const key of ["phone", "phoneE164", "whatsapp", "mobile", "contact_number"]) {
    const v = row[key];
    if (v != null && String(v).trim()) return normalizeSheetPhoneValue(String(v));
  }
  for (const [k, v] of Object.entries(row)) {
    if (v == null || String(v).trim() === "") continue;
    if (k === "row" || k.startsWith("col") || k.startsWith("column_")) continue;
    if (PHONE_KEY_RE.test(k)) return normalizeSheetPhoneValue(String(v));
  }
  // Last resort: first column that looks like a phone number (10+ digits)
  for (const [k, v] of Object.entries(row)) {
    if (k === "row" || v == null) continue;
    const s = String(v).trim();
    const digits = s.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15 && !NAME_KEY_RE.test(k)) {
      return normalizeSheetPhoneValue(s);
    }
  }
  return "";
}

export function extractNameFromSheetRow(row: Record<string, unknown>): string {
  for (const key of ["name", "full_name", "customer_name", "contact_name"]) {
    const v = row[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  for (const [k, v] of Object.entries(row)) {
    if (v == null || String(v).trim() === "") continue;
    if (NAME_KEY_RE.test(k)) return String(v).trim();
  }
  return "";
}

/** Strip formatting; return digits (and handle Excel scientific notation). */
export function normalizeSheetPhoneValue(raw: string): string {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (/^\d+(\.\d+)?e\+\d+$/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) s = String(Math.round(n));
  }
  return s.replace(/\D/g, "");
}

export type SheetColumnVariable = {
  label: string;
  snippet: string;
  hint?: string;
};

function sheetColumnLetter(index0: number): string {
  let n = index0;
  let label = "";
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

/** Variables for flow builder Insert variable picker. */
export function sheetColumnVariablesFromHeaders(headers: string[]): SheetColumnVariable[] {
  const items: SheetColumnVariable[] = [];
  const usedKeys = new Set<string>();

  headers.forEach((raw, i) => {
    const header = String(raw ?? "").trim();
    const label = header || `Column ${i + 1}`;
    let key = slugifySheetHeaderKey(header, i);
    if (usedKeys.has(key)) {
      let n = 2;
      while (usedKeys.has(`${key}_${n}`)) n++;
      key = `${key}_${n}`;
    }
    usedKeys.add(key);

    items.push({
      label,
      snippet: `{{trigger.${key}}}`,
      hint: `Column ${sheetColumnLetter(i)} · also {{trigger.col${i + 1}}}`,
    });
  });

  if (/whatsapp|phone|mobile/.test(items.map((x) => x.label).join(" "))) {
    items.unshift({
      label: "Phone (auto-detected from sheet)",
      snippet: "{{trigger.phone}}",
      hint: "First column whose header looks like WhatsApp / phone / mobile",
    });
  }

  items.push({
    label: "Full row (JSON)",
    snippet: "{{raw}}",
    hint: "Entire trigger payload including row, spreadsheetId, rowIndex",
  });

  return items;
}
