import { cn } from "@/lib/utils";

type RhBadgeProps = {
  children: React.ReactNode;
  tone?: "brand" | "neutral" | "success" | "warning";
  className?: string;
};

const tones = {
  brand: "bg-[var(--rh-brand-light)] text-[var(--rh-brand)]",
  neutral: "bg-[#f3f4f6] text-[#414754]",
  success: "bg-[#dcfce7] text-[#166534]",
  warning: "bg-[#fef3c7] text-[#92400e]",
};

export function RhBadge({ children, tone = "neutral", className }: RhBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
