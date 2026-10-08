import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { resolveWhiteLabelWebsiteLogo, whiteLabelLogoImageStyle, whiteLabelNavHeight } from "@/lib/white-label-logo";
import { wlMarketingHref } from "@/lib/public-template";
import "./../lp-styles.css";

type WhiteLabelHeaderProps = {
  brandName?: string;
  accentColor?: string;
};

const NAV_ITEMS = [
  { href: wlMarketingHref("features"), label: "Features" },
  { href: wlMarketingHref("pricing"), label: "Pricing" },
  { href: wlMarketingHref("testimonials"), label: "Testimonials" },
  { href: wlMarketingHref("about"), label: "About us" },
] as const;

export function WhiteLabelHeader({ brandName = "YourBrand", accentColor }: WhiteLabelHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { config } = useWhiteLabelConfig();

  const { logoUrl, logoSize } = resolveWhiteLabelWebsiteLogo(config);
  const navHeight = whiteLabelNavHeight(logoSize);

  useEffect(() => {
    const root = document.querySelector(".lp-root");
    if (!(root instanceof HTMLElement)) return;
    root.style.setProperty("--lp-nav-logo-height", `${logoSize}px`);
    root.style.setProperty("--lp-nav-height", `${navHeight}px`);
  }, [logoSize, navHeight]);

  const navItems = NAV_ITEMS;

  const headerStyle = {
    ...(accentColor ? { "--lp-accent-color": accentColor } : {}),
    "--lp-nav-logo-height": `${logoSize}px`,
    "--lp-nav-height": `${navHeight}px`,
  } as React.CSSProperties;

  return (
    <header className="lp-nav" style={headerStyle}>
      <div className="lp-nav-inner">
        <Link href={wlMarketingHref("")} className="lp-nav-brand">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={brandName}
              className="lp-nav-brand-logo"
              style={whiteLabelLogoImageStyle(logoSize)}
            />
          ) : null}
          {!logoUrl ? <span>{brandName}</span> : null}
        </Link>

        <nav className="lp-nav-links">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="lp-nav-actions">
          <Link href="/login" className="lp-btn lp-btn-ghost lp-hide-m">
            Log in
          </Link>
          <Link href="/signup" className="lp-btn lp-btn-cta">
            Get started
          </Link>
          <button
            type="button"
            className="lp-mobile-menu-btn"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="lp-mobile-menu absolute left-0 right-0 top-full shadow-lg">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
            <span className="block px-4 py-3 text-sm font-medium">Log in</span>
          </Link>
          <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
            <span className="block px-4 py-3 text-sm font-semibold" style={{ color: "var(--lp-accent)" }}>
              Get started
            </span>
          </Link>
        </div>
      ) : null}
    </header>
  );
}
