import type { ReactNode } from "react";

type RhEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function RhEmptyState({ icon, title, description, action }: RhEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e5e7eb] bg-white px-6 py-16 text-center">
      <div className="mb-4 text-[#9ca3af]">{icon}</div>
      <p className="text-base font-medium text-[#111c2d]">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-[#717786]">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
