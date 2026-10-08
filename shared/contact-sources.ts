/** Canonical contact/lead source values (Contacts page filter & forms). */
export const CONTACT_SOURCE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "facebook", label: "Facebook" },
  { value: "import", label: "Import" },
  { value: "api", label: "API" },
  { value: "website", label: "Website" },
  { value: "indiamart", label: "IndiaMart" },
  { value: "google_ads", label: "Google Ads" },
  { value: "linkedin", label: "LinkedIn" },
] as const;

export type ContactSourceOption = { value: string; label: string };

export function contactSourceLabel(value: string | null | undefined): string {
  if (!value) return "-";
  const option = CONTACT_SOURCE_OPTIONS.find(
    (opt) => opt.value.toLowerCase() === value.toLowerCase(),
  );
  return option?.label ?? value.replace(/_/g, " ");
}
