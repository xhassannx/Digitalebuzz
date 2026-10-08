import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type RhSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

export function RhSearchField({
  value,
  onChange,
  placeholder = "Search…",
  className,
  "aria-label": ariaLabel,
}: RhSearchFieldProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-11 w-full rounded-xl border border-[#e5e7eb] bg-white pl-10 pr-4 text-sm text-[#111c2d] placeholder:text-[#6b7280] shadow-sm outline-none ring-[var(--rh-brand)] focus-visible:ring-2"
      />
    </div>
  );
}
