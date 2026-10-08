import { cn } from "@/lib/utils";
import { NovaSparkline } from "./NovaSparkline";

export function NovaMetricCard({
  title,
  value,
  sparkline,
  sparkVariant = "up",
  valueClassName,
  sparkColor,
}: {
  title: string;
  value: string;
  sparkline?: number[];
  sparkVariant?: "up" | "down";
  valueClassName?: string;
  sparkColor?: string;
}) {
  const defaultColor = sparkVariant === "down" ? "#ef4444" : "#2563eb";

  return (
    <div className="nova-metric-card flex min-h-[104px] flex-col rounded-[14px] border border-[#eceef2] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <p className="text-[13px] font-medium leading-snug text-[#6b7280]">{title}</p>
      <p
        className={cn(
          "mt-1 text-[22px] font-bold leading-none tracking-tight text-[#1f2937]",
          valueClassName,
        )}
      >
        {value}
      </p>
      <div className="mt-auto pt-1.5">
        <NovaSparkline
          values={sparkline ?? []}
          color={sparkColor ?? defaultColor}
          variant={sparkVariant}
        />
      </div>
    </div>
  );
}
