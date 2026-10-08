import { cn } from "@/lib/utils";

export type RhScrollTabOption<T extends string> = {
  value: T;
  label: string;
};

type RhScrollTabsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: RhScrollTabOption<T>[];
  className?: string;
};

export function RhScrollTabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: RhScrollTabsProps<T>) {
  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto border-b border-[#e5e7eb] pb-3 scrollbar-thin",
        className,
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--rh-brand-light)] text-[var(--rh-brand)]"
                : "text-[#414754] hover:bg-[#f3f4f6]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
