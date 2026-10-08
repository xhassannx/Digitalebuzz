import type { ReactNode } from "react";
import { tokens } from "../tokens";

type RatehonkPageShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  /** Full-height pages (inbox, flows) skip extra header padding */
  fullBleed?: boolean;
};

export function RatehonkPageShell({
  title,
  description,
  children,
  fullBleed = false,
}: RatehonkPageShellProps) {
  if (fullBleed) {
    return (
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
        data-ratehonk-page={title}
        style={{ fontFamily: tokens.font.sans }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className="min-h-full px-6 py-6 md:px-8 md:py-8"
      data-ratehonk-page={title}
      style={{ fontFamily: tokens.font.sans }}
    >
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#111c2d] md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-[#717786] md:text-base">{description}</p>
        ) : null}
      </header>
      <div className="ratehonk-page-content">{children}</div>
    </div>
  );
}
