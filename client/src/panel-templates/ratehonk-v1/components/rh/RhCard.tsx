import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type RhCardProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
};

export function RhCard({ children, className, onClick, style }: RhCardProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={style}
      className={cn(
        "w-full rounded-xl border border-[#e5e7eb] bg-white p-4 text-left shadow-sm transition-shadow",
        onClick && "cursor-pointer hover:shadow-md",
        className,
      )}
    >
      {children}
    </Comp>
  );
}
