import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { findDialEntryForPrefix, type CountryDialEntry } from "@/lib/country-dial-codes";

type CountryCodeSelectProps = {
  entries: CountryDialEntry[];
  isLoading?: boolean;
  value: string;
  onValueChange: (dial: string) => void;
  className?: string;
  /** If true, trigger shows only +NN (narrow layouts). */
  compactTrigger?: boolean;
};

export function CountryCodeSelect({
  entries,
  isLoading,
  value,
  onValueChange,
  className,
  compactTrigger,
}: CountryCodeSelectProps) {
  const [open, setOpen] = React.useState(false);
  const dial = value?.startsWith("+") ? value : value ? `+${value.replace(/^\+/, "")}` : "+1";
  const selected = findDialEntryForPrefix(entries, dial);

  const triggerLabel = isLoading
    ? "Loading country codes…"
    : selected
      ? compactTrigger
        ? selected.dial
        : `${selected.dial} (${selected.country})`
      : dial || "Select code";

  const isItemSelected = (c: CountryDialEntry) =>
    selected?.iso === c.iso && selected?.dial === c.dial && selected?.country === c.country;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={isLoading}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,380px)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country, ISO, or code…" />
          <CommandList className="max-h-[min(60vh,320px)]">
            <CommandEmpty>{isLoading ? "Loading…" : "No country found."}</CommandEmpty>
            <CommandGroup>
              {entries.map((c) => (
                <CommandItem
                  key={`${c.iso}-${c.dial}-${c.country}`}
                  value={`${c.country} ${c.iso} ${c.dial} ${c.dial.replace("+", "")}`}
                  onSelect={() => {
                    onValueChange(c.dial);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", isItemSelected(c) ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono text-sm tabular-nums shrink-0">{c.dial}</span>
                  <span className="ml-2 min-w-0 truncate text-muted-foreground">{c.country}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
