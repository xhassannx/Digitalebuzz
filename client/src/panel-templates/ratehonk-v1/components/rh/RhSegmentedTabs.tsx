import { cn } from "@/lib/utils";

export type RhTabOption<T extends string> = {
  value: T;
  label: string;
};

type RhSegmentedTabsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: RhTabOption<T>[];
  className?: string;
};

export function RhSegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: RhSegmentedTabsProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex w-full max-w-full rounded-xl border border-[#e5e7eb] bg-white p-1 sm:max-w-2xl",
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
              "min-w-0 flex-1 rounded-[10px] px-2 py-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
              active
                ? "bg-[var(--rh-brand-light)] text-[var(--rh-brand)] shadow-sm"
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
