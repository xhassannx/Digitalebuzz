/** Public booking calendar visual themes (applied via CSS vars on /book/:slug). */
export type BookingCalendarThemeId =
  | "emerald"
  | "ocean"
  | "forest"
  | "slate"
  | "amber";

export type BookingCalendarThemeTokens = {
  id: BookingCalendarThemeId;
  label: string;
  brand: string;
  brandHover: string;
  brandSoft: string;
};

export const BOOKING_CALENDAR_THEMES: BookingCalendarThemeTokens[] = [
  {
    id: "emerald",
    label: "Emerald",
    brand: "#047857",
    brandHover: "#036649",
    brandSoft: "#ecfdf5",
  },
  {
    id: "ocean",
    label: "Ocean",
    brand: "#0e7490",
    brandHover: "#155e75",
    brandSoft: "#ecfeff",
  },
  {
    id: "forest",
    label: "Forest",
    brand: "#3f6212",
    brandHover: "#365314",
    brandSoft: "#f7fee7",
  },
  {
    id: "slate",
    label: "Slate",
    brand: "#334155",
    brandHover: "#1e293b",
    brandSoft: "#f1f5f9",
  },
  {
    id: "amber",
    label: "Amber",
    brand: "#b45309",
    brandHover: "#92400e",
    brandSoft: "#fffbeb",
  },
];

export const DEFAULT_BOOKING_CALENDAR_THEME: BookingCalendarThemeId = "emerald";

export function resolveBookingCalendarTheme(
  theme: string | null | undefined,
): BookingCalendarThemeTokens {
  const id = String(theme || "").trim().toLowerCase();
  return (
    BOOKING_CALENDAR_THEMES.find((t) => t.id === id) ||
    BOOKING_CALENDAR_THEMES.find((t) => t.id === DEFAULT_BOOKING_CALENDAR_THEME)!
  );
}

export function isBookingCalendarThemeId(value: string): value is BookingCalendarThemeId {
  return BOOKING_CALENDAR_THEMES.some((t) => t.id === value);
}
