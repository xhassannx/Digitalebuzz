import type { ReactNode } from "react";

type RhPageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function RhPageHeader({ title, description, actions }: RhPageHeaderProps) {
  return (
    <header className="rh-page-hero rh-toolbar-mobile mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between md:gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold leading-8 tracking-[-0.4px] text-[#111c2d] sm:text-[30px] sm:leading-[38px] sm:tracking-[-0.6px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm leading-6 text-[#414754] sm:mt-2 sm:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
