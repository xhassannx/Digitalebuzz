import { CONTACT_SOURCE_OPTIONS } from "./contact-sources";

export type LeadSourceOption = { value: string; label: string; fromIntegration?: boolean };

/** Lead source dropdown options — same list as Contacts page. */
export function buildLeadSourceOptions(): LeadSourceOption[] {
  return CONTACT_SOURCE_OPTIONS.map((s) => ({ value: s.value, label: s.label }));
}

export function leadSourceLabel(value: string, options: LeadSourceOption[]): string {
  return options.find((o) => o.value === value)?.label ?? value.replace(/_/g, " ");
}
