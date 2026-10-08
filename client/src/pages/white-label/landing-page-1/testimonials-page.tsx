// @ts-nocheck
import { Link } from "wouter";
import { Star } from "lucide-react";
import { WhiteLabelHeader } from "./components/header";
import { LandingFooter } from "./components/landing-footer";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { wlMarketingHref, wlSignupHref } from "@/lib/public-template";
import "./lp-styles.css";

const DEFAULT_TESTIMONIALS = [
  {
    quote:
      "This platform transformed our customer communication. We've seen a 300% increase in engagement rates.",
    name: "Sarah Johnson",
    role: "Marketing Director",
    company: "TechCorp Inc.",
    avatar: "SJ",
  },
  {
    quote:
      "The automation features saved us countless hours. Our team can now focus on what matters most.",
    name: "Michael Chen",
    role: "Operations Manager",
    company: "Retail Solutions",
    avatar: "MC",
  },
  {
    quote:
      "Best investment we've made. The ROI was visible within the first month of implementation.",
    name: "Emily Rodriguez",
    role: "CEO",
    company: "StartupHub",
    avatar: "ER",
  },
];

function accentRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "22, 163, 74";
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

export default function TestimonialsPage() {
  const { companyProfile, homepage, config } = useWhiteLabelConfig();
  const themeConfig = config?.theme as { websiteThemeColor?: string } | undefined;
  const accentColor = themeConfig?.websiteThemeColor || "#16a34a";
  const accent = accentRgb(accentColor);
  const brandName = (companyProfile?.name as string) || "YourBrand";

  const testimonialsSectionTitle =
    (homepage?.testimonialsSectionTitle as string) ?? "Loved by Businesses Worldwide";
  const testimonialsSectionSubtitle =
    (homepage?.testimonialsSectionSubtitle as string) ??
    "See what our customers have to say about their experience.";
  const testimonials = (
    Array.isArray(homepage?.testimonials) ? homepage.testimonials : DEFAULT_TESTIMONIALS
  ) as typeof DEFAULT_TESTIMONIALS;

  const ctaSectionTitle = (homepage?.ctaSectionTitle as string) ?? "Ready to Get Started?";
  const ctaSectionSubtitle =
    (homepage?.ctaSectionSubtitle as string) ??
    "Join thousands of businesses that trust us to power their communication.";
  const ctaSectionPrimaryButtonText =
    (homepage?.ctaSectionPrimaryButtonText as string) ?? "Start Free Trial";
  const ctaSectionSecondaryButtonText =
    (homepage?.ctaSectionSecondaryButtonText as string) ?? "Contact Sales";

  const footerTagline =
    (homepage?.footerTagline as string) ??
    "Powerful messaging platform for modern businesses. Connect, automate, and grow.";
  const footerProductLinks = (Array.isArray(homepage?.footerProductLinks)
    ? homepage.footerProductLinks
    : [
        { href: wlMarketingHref("features"), label: "Features" },
        { href: "/login", label: "Login" },
        { href: "/signup", label: "Sign Up" },
      ]) as { href: string; label: string }[];
  const footerResourceLinks = (Array.isArray(homepage?.footerResourceLinks)
    ? homepage.footerResourceLinks
    : [
        { href: wlMarketingHref("pricing"), label: "Pricing" },
        { href: wlMarketingHref("about"), label: "About" },
        { href: wlMarketingHref("testimonials"), label: "Testimonials" },
      ]) as { href: string; label: string }[];
  const footerCopyright = (homepage?.footerCopyright as string) ?? "All rights reserved.";
  const footerLegalLinks = (Array.isArray(homepage?.footerLegalLinks)
    ? homepage.footerLegalLinks
    : [
        { href: wlMarketingHref("privacy"), label: "Privacy Policy" },
        { href: wlMarketingHref("terms"), label: "Terms of Service" },
      ]) as { href: string; label: string }[];

  const rootStyle = { "--lp-accent-color": accentColor } as React.CSSProperties;

  return (
    <div className="lp-root" style={rootStyle}>
      <WhiteLabelHeader brandName={brandName} accentColor={accentColor} />

      <main>
        {/* Page hero */}
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            paddingTop: 120,
            paddingBottom: 64,
            background: "linear-gradient(160deg, #fff9f5 0%, #ffffff 40%, #f0f4ff 100%)",
          }}
        >
          <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
            <div
              style={{
                position: "absolute",
                top: -80,
                right: -60,
                width: 420,
                height: 420,
                borderRadius: "50%",
                background: `radial-gradient(circle, rgba(${accent},0.12) 0%, transparent 65%)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: "radial-gradient(circle, rgba(140,140,140,0.35) 1.5px, transparent 1.5px)",
                backgroundSize: "32px 32px",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(68% 60% at 50% 47%, rgba(255,252,250,0.98) 30%, transparent 100%)",
              }}
            />
          </div>

          <div className="lp-section-inner" style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
            <p className="lp-section-label">Testimonials</p>
            <h1 className="lp-section-title">{testimonialsSectionTitle}</h1>
            <p className="lp-section-subtitle" style={{ marginTop: 12, maxWidth: 560, margin: "12px auto 0" }}>
              {testimonialsSectionSubtitle}
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 20 }}>
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5" style={{ color: accentColor, fill: accentColor }} />
              ))}
            </div>
          </div>
        </section>

        {/* Testimonial cards */}
        <section className="lp-section" style={{ background: "#fff", paddingTop: 0 }}>
          <div className="lp-section-inner">
            <div className="lp-three-col" style={{ gap: 16 }}>
              {testimonials.map((t) => (
                <article key={t.name} className="lp-bento-cell" style={{ padding: "32px 28px" }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4" style={{ color: accentColor, fill: accentColor }} />
                    ))}
                  </div>
                  <p
                    style={{
                      fontSize: 15,
                      color: "var(--lp-text-2)",
                      lineHeight: 1.75,
                      marginBottom: 28,
                      fontStyle: "italic",
                    }}
                  >
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: `rgba(${accent},0.1)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 800,
                        color: accentColor,
                      }}
                    >
                      {t.avatar}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--lp-text)" }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "var(--lp-text-3)" }}>
                        {t.role}, {t.company}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="lp-section" style={{ background: "#fff", paddingTop: 0 }}>
          <div className="lp-section-inner">
            <div
              style={{
                background: "var(--lp-text)",
                borderRadius: 20,
                padding: "72px 56px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 40,
                flexWrap: "wrap",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -80,
                  right: -80,
                  width: 360,
                  height: 360,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, rgba(${accent},0.15) 0%, transparent 65%)`,
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", zIndex: 1 }}>
                <h2
                  style={{
                    fontSize: "clamp(1.8rem, 3vw, 2.6rem)",
                    fontWeight: 860,
                    letterSpacing: -1.5,
                    color: "#fff",
                    lineHeight: 1.2,
                    marginBottom: 12,
                  }}
                >
                  {ctaSectionTitle}
                </h2>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, margin: 0 }}>
                  {ctaSectionSubtitle}
                </p>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                <Link href={wlSignupHref()} className="lp-btn lp-btn-cta" style={{ fontSize: 15, padding: "13px 28px" }}>
                  {ctaSectionPrimaryButtonText}
                </Link>
                <Link
                  href={wlMarketingHref("contact")}
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.55)",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    padding: "13px 0",
                  }}
                >
                  {ctaSectionSecondaryButtonText}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter
        brandName={brandName}
        footerTagline={footerTagline}
        footerProductLinks={footerProductLinks}
        footerResourceLinks={footerResourceLinks}
        footerCopyright={footerCopyright}
        footerLegalLinks={footerLegalLinks}
        accentColor={accentColor}
      />
    </div>
  );
}
