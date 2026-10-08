// @ts-nocheck
import { Link } from "wouter";
import { WhiteLabelHeader } from "./components/header";
import { LandingFooter } from "./components/landing-footer";
import { LpFeatureCard, LP_FEATURE_ICONS } from "./components/lp-feature-cards";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { wlMarketingHref, wlSignupHref } from "@/lib/public-template";
import "./lp-styles.css";

const DEFAULT_FEATURE_CARDS = [
  { title: "Bulk Messaging", description: "Send thousands of personalized messages instantly with our powerful API integration." },
  { title: "AI Chatbot", description: "Automate customer interactions with intelligent chatbots that work 24/7." },
  { title: "Analytics Dashboard", description: "Track delivery rates, read receipts, and engagement metrics in real-time." },
  { title: "Auto Replies", description: "Set up automated responses to keep your customers engaged even when you're away." },
  { title: "Secure & Compliant", description: "Enterprise-grade security with GDPR and WhatsApp Business Policy compliance." },
  { title: "Easy Integration", description: "Simple API integration with comprehensive documentation and support." },
];

const FEATURE_ICONS = LP_FEATURE_ICONS;

function accentRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "22, 163, 74";
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

export default function FeaturesPage() {
  const { companyProfile, homepage, config } = useWhiteLabelConfig();
  const themeConfig = config?.theme as { websiteThemeColor?: string } | undefined;
  const accentColor = themeConfig?.websiteThemeColor || "#16a34a";
  const accent = accentRgb(accentColor);
  const brandName = (companyProfile?.name as string) || "YourBrand";

  const featureCardsFromConfig = Array.isArray(homepage?.featureCards)
    ? (homepage.featureCards as { title: string; description: string }[])
    : DEFAULT_FEATURE_CARDS;

  const features = FEATURE_ICONS.map((icon, i) => ({
    icon,
    title: featureCardsFromConfig[i]?.title ?? DEFAULT_FEATURE_CARDS[i]?.title ?? "Feature",
    description: featureCardsFromConfig[i]?.description ?? DEFAULT_FEATURE_CARDS[i]?.description ?? "",
  }));

  const featuresSectionTitle =
    (homepage?.featuresSectionTitle as string) ?? "Everything You Need to Succeed";
  const featuresSectionSubtitle =
    (homepage?.featuresSectionSubtitle as string) ??
    "Powerful features designed to help you communicate better, automate smarter, and grow faster.";

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
            <p className="lp-section-label">Features</p>
            <h1 className="lp-section-title">{featuresSectionTitle}</h1>
            <p className="lp-section-subtitle" style={{ marginTop: 12, maxWidth: 560, margin: "12px auto 0" }}>
              {featuresSectionSubtitle}
            </p>
          </div>
        </section>

        {/* Feature cards */}
        <section className="lp-section" style={{ background: "#fff", paddingTop: 0 }}>
          <div className="lp-section-inner">
            <div className="lp-three-col" style={{ gap: 16 }}>
              {features.map((feature, i) => (
                <LpFeatureCard
                  key={feature.title}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                  themeIndex={i}
                />
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
