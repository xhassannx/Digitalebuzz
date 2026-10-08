import { ArrowUp } from "lucide-react";

export function NovaGrowthBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-[#ecfdf3] px-1.5 py-0.5 text-[11px] font-semibold text-[#16a34a]">
      {value}
      <ArrowUp className="h-3 w-3" strokeWidth={2.5} />
    </span>
  );
}
