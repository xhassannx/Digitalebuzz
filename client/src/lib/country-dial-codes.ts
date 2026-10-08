export type CountryDialEntry = {
  iso: string;
  country: string;
  dial: string;
};

export function findDialEntryForPrefix(
  entries: CountryDialEntry[],
  countryDial: string | undefined,
): CountryDialEntry | undefined {
  if (!countryDial || entries.length === 0) return undefined;
  const norm = countryDial.startsWith("+") ? countryDial : `+${countryDial.replace(/^\+/, "")}`;
  const exact = entries.filter((c) => c.dial === norm);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    if (norm === "+1") {
      const us = exact.find((c) => c.iso === "US");
      if (us) return us;
    }
    return exact[0];
  }
  const longest = [...entries].sort((a, b) => b.dial.length - a.dial.length);
  return longest.find((c) => norm.startsWith(c.dial));
}
