import { Link } from "wouter";
import { wlMarketingHref } from "@/lib/public-template";

const linkClass =
  "cursor-pointer hover:text-foreground hover:underline focus:outline-none focus:underline";

/**
 * Breadcrumb for Website Builder pages. "Home" links to the Website Builder
 * dashboard (/website). "Website" links to the live landing page preview (/white-label).
 */
export function WebsiteBuilderBreadcrumb({ currentPage }: { currentPage: string }) {
  return (
    <div className="text-sm text-muted-foreground">
      <Link href="/website" className={linkClass}>
        Home
      </Link>
      <span className="mx-2">›</span>
      <Link href={wlMarketingHref("")} className={linkClass}>
        Website
      </Link>
      <span className="mx-2">›</span>
      <span className="text-foreground font-medium">{currentPage}</span>
    </div>
  );
}
