// @ts-nocheck
import { Link } from "wouter";
import { CheckCircle } from "lucide-react";
import { WhiteLabelHeader } from "./components/header";
import { LandingFooter } from "./components/landing-footer";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { wlMarketingHref, wlSignupHref } from "@/lib/public-template";
import "./lp-styles.css";

type PricingPlan = {
  id?: string;
  name: string;
  price: string;
  period: string;
  description: string;
  popular: boolean;
  features: string[];
};

type WhiteLabelPricingContent = {
  title?: string;
  subtitle?: string;
  ctaTitle?: string;
  ctaSubtitle?: string;
  ctaButtonText?: string;
  ctaButtonLink?: string;
  plans?: PricingPlan[];
};

const DEFAULT_PLANS: PricingPlan[] = [
  {
    name: "Starter",
    price: "$49",
    period: "/month",
    description: "Perfect for small businesses",
    features: [
      "Up to 1,000 messages/month",
      "Basic chatbot",
      "Email support",
      "Analytics dashboard",
      "API access",
    ],
    popular: false,
  },
  {
    name: "Professional",
    price: "$149",
    period: "/month",
    description: "For growing businesses",
    features: [
      "Up to 10,000 messages/month",
      "Advanced chatbot",
      "Priority support",
      "Advanced analytics",
      "API access",
      "Custom integrations",
      "Team collaboration",
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations",
    features: [
      "Unlimited messages",
      "AI-powered chatbot",
      "24/7 dedicated support",
      "Custom analytics",
      "White-label options",
      "SLA guarantee",
      "Custom integrations",
      "Dedicated account manager",
    ],
    popular: false,
  },
];

function accentRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "22, 163, 74";
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

export default function PricingPage() {
  const { config, companyProfile, homepage } = useWhiteLabelConfig();
  const pricingConfig = config?.["white-label-pricing"] as WhiteLabelPricingContent | undefined;
  const themeConfig = config?.theme as { websiteThemeColor?: string } | undefined;
  const accentColor = themeConfig?.websiteThemeColor || "#16a34a";
  const accent = accentRgb(accentColor);
  const brandName = (companyProfile?.name as string) || "YourBrand";

  const title = pricingConfig?.title || "Simple, Transparent Pricing";
  const subtitle =
    pricingConfig?.subtitle ||
    "Choose the plan that's right for your business. All plans include a 14-day free trial.";
  const ctaTitle = pricingConfig?.ctaTitle || "Ready to Get Started?";
  const ctaSubtitle = pricingConfig?.ctaSubtitle || "Start your free trial today. No credit card required.";
  const ctaButtonText = pricingConfig?.ctaButtonText || "Start Free Trial";
  const ctaButtonLink = wlSignupHref(pricingConfig?.ctaButtonLink);

  const pricingPlans =
    pricingConfig?.plans && pricingConfig.plans.length > 0 ? pricingConfig.plans : DEFAULT_PLANS;

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
          id="pricing"
          style={{
            position: "relative",
            overflow: "hidden",
            paddingTop: 120,
            paddingBottom: 64,
            background: "linear-gradient(160deg, #fff9f5 0%, #ffffff 40%, #f0f4ff 100%)",
            scrollMarginTop: "calc(var(--lp-nav-height, 64px) + 8px)",
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
            <p className="lp-section-label">Pricing</p>
            <h1 className="lp-section-title">{title}</h1>
            <p className="lp-section-subtitle" style={{ marginTop: 12, maxWidth: 560, margin: "12px auto 0" }}>
              {subtitle}
            </p>
          </div>
        </section>

        {/* Pricing cards */}
        <section className="lp-section" style={{ background: "#fff", paddingTop: 0 }}>
          <div className="lp-section-inner">
            <div className="lp-three-col">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className="lp-bento-cell"
                  style={{
                    padding: 28,
                    border: plan.popular ? `2px solid ${accentColor}` : undefined,
                    boxShadow: plan.popular ? `0 12px 40px rgba(${accent},0.12)` : undefined,
                  }}
                >
                  {plan.popular ? (
                    <div style={{ fontSize: 11, fontWeight: 700, color: accentColor, marginBottom: 8 }}>
                      Most Popular
                    </div>
                  ) : null}
                  <div style={{ fontSize: 20, fontWeight: 840, color: "var(--lp-text)", marginBottom: 6 }}>
                    {plan.name}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--lp-text-2)", marginBottom: 16 }}>{plan.description}</p>
                  <div style={{ marginBottom: 20 }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: accentColor, letterSpacing: -1 }}>
                      {plan.price}
                    </span>
                    {plan.period ? (
                      <span style={{ fontSize: 14, color: "var(--lp-text-3)", marginLeft: 4 }}>{plan.period}</span>
                    ) : null}
                  </div>
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "0 0 24px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--lp-text-2)", alignItems: "flex-start" }}
                      >
                        <CheckCircle className="h-4 w-4 shrink-0" style={{ color: accentColor, marginTop: 1 }} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className="lp-btn"
                    style={{
                      width: "100%",
                      textAlign: "center",
                      padding: "10px 16px",
                      border: `1px solid ${plan.popular ? accentColor : "var(--lp-border)"}`,
                      background: plan.popular ? accentColor : "#fff",
                      color: plan.popular ? "#fff" : "var(--lp-text)",
                    }}
                  >
                    Get Started
                  </Link>
                </div>
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
                  {ctaTitle}
                </h2>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, margin: 0 }}>
                  {ctaSubtitle}
                </p>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                <Link href={ctaButtonLink} className="lp-btn lp-btn-cta" style={{ fontSize: 15, padding: "13px 28px" }}>
                  {ctaButtonText}
                </Link>
                <Link
                  href="/subscribe"
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
                  Buy subscription online
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
