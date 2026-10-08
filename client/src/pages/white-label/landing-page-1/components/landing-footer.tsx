import type { CSSProperties } from "react";
import { Link } from "wouter";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { resolveWhiteLabelWebsiteLogo, whiteLabelLogoImageStyle } from "@/lib/white-label-logo";
import { wlMarketingHref } from "@/lib/public-template";

type LandingFooterProps = {
  brandName: string;
  footerTagline: string;
  footerProductLinks: { href: string; label: string }[];
  footerResourceLinks: { href: string; label: string }[];
  footerCopyright: string;
  footerLegalLinks: { href: string; label: string }[];
  accentColor?: string;
};

function isPlaceholderBrand(text: string): boolean {
  return /^your\s*brand$/i.test(text.trim());
}

const EXCLUDED_FOOTER_RESOURCE_LABELS = new Set(["documentation", "api reference", "guides", "blog"]);
const EXCLUDED_FOOTER_LEGAL_LABELS = new Set(["cookie policy"]);

type FooterLink = { href: string; label: string };

function isPricingFooterLink(link: FooterLink): boolean {
  return link.label.trim().toLowerCase() === "pricing";
}

function normalizeFooterColumns(productLinks: FooterLink[], resourceLinks: FooterLink[]) {
  const pricingFromProduct = productLinks.filter(isPricingFooterLink);
  const product = productLinks.filter((link) => !isPricingFooterLink(link));
  const pricingFromResources = resourceLinks.filter(isPricingFooterLink);
  const resourcesWithoutPricing = resourceLinks.filter((link) => !isPricingFooterLink(link));
  const pricingLink = pricingFromResources[0] ?? pricingFromProduct[0];
  const resources = pricingLink ? [pricingLink, ...resourcesWithoutPricing] : resourcesWithoutPricing;
  return { product, resources };
}

export function LandingFooter({
  brandName,
  footerTagline,
  footerProductLinks,
  footerResourceLinks,
  footerCopyright,
  footerLegalLinks,
  accentColor,
}: LandingFooterProps) {
  const { config } = useWhiteLabelConfig();
  const { logoUrl, logoSize } = resolveWhiteLabelWebsiteLogo(config);

  const { product: normalizedProductLinks, resources: normalizedResourceLinks } = normalizeFooterColumns(
    footerProductLinks,
    footerResourceLinks,
  );

  const productLinks = normalizedProductLinks.filter((link) => !isPlaceholderBrand(link.label));
  const resourceLinks = normalizedResourceLinks.filter(
    (link) =>
      !isPlaceholderBrand(link.label) &&
      !EXCLUDED_FOOTER_RESOURCE_LABELS.has(link.label.trim().toLowerCase()),
  );
  const copyrightBrand = isPlaceholderBrand(brandName) ? "" : brandName;
  const legalLinks = footerLegalLinks.filter(
    (link) => !EXCLUDED_FOOTER_LEGAL_LABELS.has(link.label.trim().toLowerCase()),
  );

  const linkStyle: CSSProperties = {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    textDecoration: "none",
  };

  return (
    <footer
      style={{
        background: "var(--lp-text)",
        color: "rgba(255,255,255,0.6)",
        padding: "64px 32px 36px",
        ...(accentColor ? ({ "--lp-accent-color": accentColor } as React.CSSProperties) : {}),
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div
          className="lp-three-col"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 40,
            paddingBottom: 48,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div>
            <Link href={wlMarketingHref("")} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, textDecoration: "none" }}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={copyrightBrand || "Logo"}
                  style={whiteLabelLogoImageStyle(logoSize, 0.85)}
                />
              ) : copyrightBrand ? (
                <span style={{ fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: "-0.3px" }}>{copyrightBrand}</span>
              ) : null}
            </Link>
            <p style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 280 }}>{footerTagline}</p>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
              Product
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 9, padding: 0, margin: 0 }}>
              {productLinks.map((link) => (
                <li key={link.href + link.label}>
                  <Link href={link.href} style={linkStyle}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
              Resources
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 9, padding: 0, margin: 0 }}>
              {resourceLinks.map((link) => (
                <li key={link.href + link.label}>
                  <Link href={link.href} style={linkStyle}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ paddingTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12 }}>
            © {new Date().getFullYear()}
            {copyrightBrand ? ` ${copyrightBrand}.` : ""} {footerCopyright}
          </span>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {legalLinks.map((link) =>
              link.href === "#" ? (
                <a key={link.label} href={link.href} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} href={link.href} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>
                  {link.label}
                </Link>
              ),
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
