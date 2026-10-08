import type { HTMLAttributes, ReactNode } from "react";
import { tokens } from "../../tokens";
import { cn } from "@/lib/utils";

type RhPageLayoutProps = {
  children: ReactNode;
  className?: string;
  fullBleed?: boolean;
} & HTMLAttributes<HTMLDivElement>;

export function RhPageLayout({
  children,
  className,
  fullBleed,
  ...rest
}: RhPageLayoutProps) {
  return (
    <div
      className={cn(
        fullBleed
          ? "flex h-full min-h-0 flex-col"
          : "rh-page-shell min-h-full w-full max-w-full px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8",
        className,
      )}
      style={{ fontFamily: tokens.font.sans }}
      {...rest}
    >
      {children}
    </div>
  );
}
