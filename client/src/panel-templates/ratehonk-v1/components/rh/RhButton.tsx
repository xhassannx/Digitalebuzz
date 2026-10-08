import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type RhButtonVariant = "primary" | "secondary" | "ghost" | "outline";

type RhButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: RhButtonVariant;
  children: ReactNode;
};

const variants: Record<RhButtonVariant, string> = {
  primary: "bg-[var(--rh-brand)] text-white hover:bg-[var(--rh-brand-hover)]",
  secondary: "bg-[var(--rh-brand-light)] text-[var(--rh-brand)] hover:bg-[#cddaff]",
  outline: "border border-[#e5e7eb] bg-white text-[#111c2d] hover:bg-[#f9fafb]",
  ghost: "text-[#414754] hover:bg-[#f3f4f6]",
};

export function RhButton({
  variant = "primary",
  className,
  children,
  disabled,
  ...props
}: RhButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
