import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle, Star } from "lucide-react";
import { WhiteLabelHeader } from "./components/header";
import { LandingFooter } from "./components/landing-footer";
import { LpHeroParallaxStage, LpReveal } from "./components/lp-animations";
import { LpFeatureCard } from "./components/lp-feature-cards";
import { LpIntegrationGrid } from "./components/lp-integration-grid";
import { LANDING_INTEGRATION_ITEMS } from "@/lib/landing-integrations";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { wlMarketingHref, wlSignupHref } from "@/lib/public-template";
import {
  WHITELABEL_HOMEPAGE_HERO_DEFAULTS,
  resolveHomepageHeroField,
  resolveHomepageStats,
} from "@shared/white-label-homepage-defaults";
import "./lp-styles.css";

const DEFAULT_HERO = {
  heroBadge: "New: AI-Powered Chatbot Integration",
  heroHeadline1: WHITELABEL_HOMEPAGE_HERO_DEFAULTS.heroHeadline1,
  heroHeadline2: WHITELABEL_HOMEPAGE_HERO_DEFAULTS.heroHeadline2,
  heroSubtitle:
    "Send bulk campaigns, auto-reply to customers, and manage your team inbox — one platform, no code, no contracts.",
  ctaPrimaryText: "Start free — no card needed",
  ctaSecondaryText: "See features ↓",
  highlights: ["No credit card required", "14-day free trial", "Cancel anytime"],
};

const DEFAULT_FEATURE_CARDS = [
  { title: "Bulk Messaging", description: "Send thousands of personalized messages instantly with our powerful API integration." },
  { title: "AI Chatbot", description: "Automate customer interactions with intelligent chatbots that work 24/7." },
  { title: "Analytics Dashboard", description: "Track delivery rates, read receipts, and engagement metrics in real-time." },
  { title: "Auto Replies", description: "Set up automated responses to keep your customers engaged even when you're away." },
  { title: "Secure & Compliant", description: "Enterprise-grade security with GDPR and WhatsApp Business Policy compliance." },
  { title: "Easy Integration", description: "Simple API integration with comprehensive documentation and support." },
];

const STAT_CARD_CLASSES = ["lp-stat-card-blue", "lp-stat-card-green", "lp-stat-card-purple", "lp-stat-card-peach"];

/** Modest campaign sample numbers for the Broadcast feature card. */
const FEATURE_CAMPAIGN_STATS = [
  { value: "2,840", label: "Sent" },
  { value: "1,920", label: "Opened" },
  { value: "640", label: "Replied" },
];

const DEFAULT_STEPS = [
  { num: "01", title: "Connect WhatsApp", text: "Link your WhatsApp Business number in minutes — no developer needed.", tint: "#fff7ed", border: "#ffedd5", color: "#16a34a" },
  { num: "02", title: "Import Contacts", text: "Upload a CSV, sync your store, or pull from your CRM.", tint: "#faf5ff", border: "#ede9fe", color: "#7c3aed" },
  { num: "03", title: "Build Campaign or Bot", text: "Pick a template, personalize it, and schedule or trigger on behaviour.", tint: "#eff6ff", border: "#dbeafe", color: "#2563eb" },
  { num: "04", title: "Watch Revenue Grow", text: "Messages go out, bots handle replies, and your dashboard shows results live.", tint: "#f0fdf4", border: "#bbf7d0", color: "#16a34a" },
];

const TICKER_ITEMS = LANDING_INTEGRATION_ITEMS.map((item) => item.displayName);

const DEFAULT_TESTIMONIALS = [
  { quote: "This platform transformed our customer communication. We've seen a huge increase in engagement rates.", name: "Sarah Johnson", role: "Marketing Director", company: "TechCorp Inc.", avatar: "SJ" },
  { quote: "The automation features saved us countless hours. Our team can now focus on what matters most.", name: "Michael Chen", role: "Operations Manager", company: "Retail Solutions", avatar: "MC" },
  { quote: "Best investment we've made. The ROI was visible within the first month of implementation.", name: "Emily Rodriguez", role: "CEO", company: "StartupHub", avatar: "ER" },
];

const DEFAULT_PRICING_PLANS = [
  { name: "Starter", price: "$49", period: "/month", description: "Perfect for small businesses", features: ["Up to 1,000 messages/month", "Basic chatbot", "Email support"], popular: false },
  { name: "Professional", price: "$149", period: "/month", description: "For growing businesses", features: ["Up to 10,000 messages/month", "Advanced chatbot", "Priority support"], popular: true },
  { name: "Enterprise", price: "Custom", period: "", description: "For large organizations", features: ["Unlimited messages", "AI-powered chatbot", "24/7 dedicated support"], popular: false },
];

function accentRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "22, 163, 74";
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

export default function WhiteLabelLandingPage() {
  const reduceMotion = useReducedMotion();
  const { companyProfile, homepage, config } = useWhiteLabelConfig();
  const themeConfig = config?.theme as { websiteThemeColor?: string } | undefined;
  const accentColor = themeConfig?.websiteThemeColor || "#16a34a";
  const accent = accentRgb(accentColor);

  const brandName = (companyProfile?.name as string) || "YourBrand";
  const heroBadge = (homepage?.heroBadge as string) ?? DEFAULT_HERO.heroBadge;
  const heroHeadline1 = resolveHomepageHeroField("heroHeadline1", homepage?.heroHeadline1);
  const heroHeadline2 = resolveHomepageHeroField("heroHeadline2", homepage?.heroHeadline2);
  const heroSubtitle = (homepage?.heroSubtitle as string) ?? DEFAULT_HERO.heroSubtitle;
  const ctaPrimaryText = (homepage?.ctaPrimaryText as string) ?? DEFAULT_HERO.ctaPrimaryText;
  const ctaSecondaryText = (homepage?.ctaSecondaryText as string) ?? DEFAULT_HERO.ctaSecondaryText;
  const featureCardsFromConfig = Array.isArray(homepage?.featureCards)
    ? (homepage.featureCards as { title: string; description: string }[])
    : DEFAULT_FEATURE_CARDS;
  const features = featureCardsFromConfig.map((card, i) => ({
    title: card.title ?? DEFAULT_FEATURE_CARDS[i]?.title ?? "Feature",
    description: card.description ?? DEFAULT_FEATURE_CARDS[i]?.description ?? "",
  }));

  const featuresSectionTitle = (homepage?.featuresSectionTitle as string) ?? "Everything you need to sell on WhatsApp at scale";
  const featuresSectionSubtitle =
    (homepage?.featuresSectionSubtitle as string) ??
    "Powerful features designed to help you communicate better, automate smarter, and grow faster.";
  const featuresSectionButtonText = (homepage?.featuresSectionButtonText as string) ?? "View All Features";

  const stats = resolveHomepageStats(homepage?.stats);
  const heroStats = stats.slice(0, 3);

  const testimonialsSectionTitle = (homepage?.testimonialsSectionTitle as string) ?? "Loved by businesses";
  const testimonialsSectionSubtitle =
    (homepage?.testimonialsSectionSubtitle as string) ?? "See what our customers have to say about their experience.";
  const testimonialsSectionButtonText = (homepage?.testimonialsSectionButtonText as string) ?? "Read More Testimonials";
  const testimonials = (Array.isArray(homepage?.testimonials) ? homepage.testimonials : DEFAULT_TESTIMONIALS) as typeof DEFAULT_TESTIMONIALS;

  const pricingConfig = config?.["white-label-pricing"] as { title?: string; subtitle?: string; plans?: typeof DEFAULT_PRICING_PLANS } | undefined;
  const pricingSectionTitle = pricingConfig?.title || (homepage?.pricingSectionTitle as string) || "Simple, Transparent Pricing";
  const pricingSectionSubtitle =
    pricingConfig?.subtitle ||
    (homepage?.pricingSectionSubtitle as string) ||
    "Choose the plan that's right for your business. All plans include a 14-day free trial.";
  const pricingSectionButtonText = (homepage?.pricingSectionButtonText as string) ?? "View Full Pricing Details";
  const pricingPlans =
    pricingConfig?.plans && pricingConfig.plans.length > 0
      ? pricingConfig.plans
      : ((Array.isArray(homepage?.pricingPlans) ? homepage.pricingPlans : DEFAULT_PRICING_PLANS) as typeof DEFAULT_PRICING_PLANS);

  const ctaSectionTitle = (homepage?.ctaSectionTitle as string) ?? "Ready to put your WhatsApp business on autopilot?";
  const ctaSectionSubtitle =
    (homepage?.ctaSectionSubtitle as string) ?? "No credit card required · Cancel anytime";
  const ctaSectionPrimaryButtonText = (homepage?.ctaSectionPrimaryButtonText as string) ?? "Start free today";
  const ctaSectionSecondaryButtonText = (homepage?.ctaSectionSecondaryButtonText as string) ?? "Already have an account →";

  const footerTagline = (homepage?.footerTagline as string) ?? "Powerful messaging platform for modern businesses. Connect, automate, and grow.";
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

      <main style={{ minHeight: "100vh" }}>
        {/* Hero */}
        <section
          className="lp-hero-section"
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
            paddingTop: "var(--lp-nav-height, 64px)",
            background: "linear-gradient(160deg, #fff9f5 0%, #ffffff 40%, #f0f4ff 100%)",
          }}
        >
          <div className="lp-hero-bg" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
            <div className="lp-hero-bg-glow lp-hero-bg-glow-accent" style={{ position: "absolute", top: -100, right: -80, width: 560, height: 560, borderRadius: "50%", background: `radial-gradient(circle, rgba(${accent},0.13) 0%, transparent 65%)` }} />
            <div className="lp-hero-bg-glow" style={{ position: "absolute", bottom: -120, left: -80, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 65%)" }} />
            <div className="lp-hero-bg-dots" style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(140,140,140,0.35) 1.5px, transparent 1.5px)", backgroundSize: "32px 32px" }} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(68% 60% at 50% 47%, rgba(255,252,250,0.98) 30%, transparent 100%)" }} />
          </div>

          <LpHeroParallaxStage messagesValue="2,840">
            <motion.div
              style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 640, width: "100%", padding: "0 8px" }}
              initial={reduceMotion ? false : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            >
            {heroBadge ? (
              <div style={{ display: "inline-block", fontSize: 12, fontWeight: 600, color: accentColor, background: `rgba(${accent},0.1)`, border: `1px solid rgba(${accent},0.2)`, borderRadius: 999, padding: "6px 14px", marginBottom: 20 }}>
                {heroBadge}
              </div>
            ) : null}
            <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.2rem)", fontWeight: 900, lineHeight: 1.06, letterSpacing: -3, color: "var(--lp-text)", marginBottom: 20 }}>
              {heroHeadline1}
              <br />
              <span style={{ color: accentColor }}>{heroHeadline2}</span>
            </h1>
            <p style={{ fontSize: 17, color: "var(--lp-text-2)", lineHeight: 1.72, maxWidth: 500, margin: "0 auto 32px" }}>{heroSubtitle}</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 }}>
              <Link href={wlSignupHref()} className="lp-btn lp-btn-cta" style={{ fontSize: 15, padding: "13px 30px" }}>
                {ctaPrimaryText}
              </Link>
              <a href="#features" className="lp-btn lp-btn-ghost" style={{ fontSize: 14 }}>
                {ctaSecondaryText}
              </a>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
              {heroStats.map((stat, i) => (
                <div key={i}>
                  <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: -0.5, color: "var(--lp-text)" }}>{stat.value}</div>
                  <div style={{ fontSize: 12, color: "var(--lp-text-3)", marginTop: 1 }}>{stat.label}</div>
                </div>
              ))}
            </div>
            </motion.div>
          </LpHeroParallaxStage>
        </section>

        {/* Ticker */}
        <div style={{ borderTop: "1px solid var(--lp-border)", borderBottom: "1px solid var(--lp-border)", padding: "16px 0" }}>
          <div className="lp-ticker-wrap">
            <div className="lp-ticker-track">
              {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((name, i) => (
                <span key={`${name}-${i}`} style={{ display: "inline-block", padding: "0 28px", fontSize: 13, fontWeight: 600, color: "var(--lp-text-3)", whiteSpace: "nowrap" }}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Features */}
        <section id="features" className="lp-section" style={{ background: "#fff" }}>
          <div className="lp-section-inner">
            <LpReveal direction="up">
            <div style={{ marginBottom: 48 }}>
              <p className="lp-section-label">Features</p>
              <h2 className="lp-section-title" style={{ maxWidth: 560, marginBottom: 12 }}>{featuresSectionTitle}</h2>
              <p className="lp-section-subtitle" style={{ maxWidth: 560 }}>{featuresSectionSubtitle}</p>
            </div>
            </LpReveal>

            <div className="lp-two-col" style={{ marginBottom: 14 }}>
              <LpReveal direction="left">
              <div className="lp-bento-cell" style={{ padding: 32, background: "#fff7ed", border: `1px solid rgba(${accent},0.19)` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Broadcast Campaigns</div>
                <div style={{ fontSize: 21, fontWeight: 840, letterSpacing: -0.8, lineHeight: 1.25, marginBottom: 10, color: "var(--lp-text)" }}>
                  {features[0]?.title || "Reach customers in a single click"}
                </div>
                <p style={{ fontSize: 14, color: "var(--lp-text-2)", lineHeight: 1.65, marginBottom: 24, maxWidth: 420 }}>
                  {features[0]?.description}
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {FEATURE_CAMPAIGN_STATS.map((stat, i) => (
                    <div key={stat.label} style={{ background: "#fff", border: `1px solid rgba(${accent},0.15)`, borderRadius: 10, padding: "10px 16px", minWidth: 90 }}>
                      <div style={{ fontSize: 17, fontWeight: 900, color: i === 0 ? "var(--lp-text)" : accentColor }}>{stat.value}</div>
                      <div style={{ fontSize: 10, color: "var(--lp-text-3)", marginTop: 2 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              </LpReveal>

              <LpReveal direction="right" delay={0.08}>
              <div className="lp-bento-cell" style={{ padding: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>AI Chatbot</div>
                <div style={{ fontSize: 18, fontWeight: 840, letterSpacing: -0.5, lineHeight: 1.3, marginBottom: 12, color: "var(--lp-text)" }}>
                  {features[1]?.title || "Handle queries automatically"}
                </div>
                <p style={{ fontSize: 13, color: "var(--lp-text-2)", lineHeight: 1.65, marginBottom: 12 }}>{features[1]?.description}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ background: "#dcf8c6", borderRadius: "10px 10px 2px", padding: "7px 11px", fontSize: 12, border: "1px solid var(--lp-border)" }}>Where is my order?</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={{ background: "var(--lp-bg-off)", borderRadius: "10px 10px 10px 2px", padding: "7px 11px", fontSize: 12, border: "1px solid var(--lp-border)" }}>Order ships today — track it here →</div>
                  </div>
                </div>
              </div>
              </LpReveal>
            </div>

            <div className="lp-three-col">
              {features.slice(2, 5).map((feature, i) => {
                const directions: Array<"up" | "left" | "right"> = ["left", "up", "right"];
                return (
                  <LpReveal key={feature.title} direction={directions[i] || "up"} delay={i * 0.08}>
                    <LpFeatureCard
                      title={feature.title}
                      description={feature.description}
                      themeIndex={i + 2}
                    />
                  </LpReveal>
                );
              })}
            </div>

            <LpReveal direction="up" delay={0.1}>
            <div style={{ marginTop: 32, textAlign: "center" }}>
              <Link href={wlMarketingHref("features")} className="lp-btn lp-btn-ghost" style={{ border: `1px solid var(--lp-border)`, padding: "10px 20px" }}>
                {featuresSectionButtonText}
              </Link>
            </div>
            </LpReveal>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="lp-section" style={{ background: "var(--lp-bg-off)" }}>
          <div className="lp-section-inner">
            <LpReveal direction="up">
            <div style={{ marginBottom: 48 }}>
              <p className="lp-section-label">How it works</p>
              <h2 className="lp-section-title" style={{ maxWidth: 520 }}>From zero to automated in 10 minutes</h2>
            </div>
            </LpReveal>

            <div className="lp-four-col" style={{ marginBottom: 14 }}>
              {DEFAULT_STEPS.map((step, i) => (
                <LpReveal key={step.num} direction={i % 2 === 0 ? "left" : "right"} delay={i * 0.06}>
                <div className="lp-bento-cell" style={{ padding: 24, background: step.tint, border: `1px solid ${step.border}` }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: step.color, letterSpacing: -1, marginBottom: 14 }}>{step.num}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--lp-text)", marginBottom: 8 }}>{step.title}</div>
                  <p style={{ fontSize: 13, color: "var(--lp-text-2)", lineHeight: 1.65, margin: 0 }}>{step.text}</p>
                </div>
                </LpReveal>
              ))}
            </div>

            <div className="lp-two-col" style={{ gridTemplateColumns: "5fr 7fr" }}>
              <LpReveal direction="left">
              <div className="lp-bento-cell" style={{ padding: 12, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, height: "100%" }}>
                  {stats.slice(0, 4).map((stat, i) => (
                    <div key={i} className={`lp-stat-card ${STAT_CARD_CLASSES[i % STAT_CARD_CLASSES.length]}`}>
                      <div className="lp-stat-card-value">{stat.value}</div>
                      <div className="lp-stat-card-label">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              </LpReveal>
              <LpReveal direction="right" delay={0.08}>
              <div className="lp-bento-cell" style={{ padding: 40, background: "var(--lp-text)", border: "none", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
                <div style={{ fontSize: 22, fontWeight: 840, letterSpacing: -1, color: "#fff", lineHeight: 1.3 }}>{ctaSectionTitle}</div>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, margin: 0 }}>{ctaSectionSubtitle}</p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Link href={wlSignupHref()} className="lp-btn lp-btn-cta">{ctaSectionPrimaryButtonText}</Link>
                  <a href="#features" style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.5)", textDecoration: "none", display: "flex", alignItems: "center" }}>
                    {ctaSecondaryText}
                  </a>
                </div>
              </div>
              </LpReveal>
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section id="integrations" className="lp-section" style={{ background: "var(--lp-bg-off)" }}>
          <div className="lp-section-inner">
            <div className="lp-integrations-stack">
              <LpReveal direction="up">
                <div className="lp-integrations-intro">
                  <p className="lp-section-label">Integrations</p>
                  <h2 className="lp-section-title" style={{ marginBottom: 18 }}>Plugs into every tool you already use</h2>
                  <p className="lp-section-subtitle" style={{ maxWidth: 640 }}>
                    Native integrations with popular platforms. Connect your store, CRM, and payment tools in one click.
                  </p>
                </div>
              </LpReveal>
              <LpIntegrationGrid />
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="lp-section" style={{ background: "#fff" }}>
          <div className="lp-section-inner">
            <LpReveal direction="up">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 56, flexWrap: "wrap", gap: 16 }}>
              <div>
                <p className="lp-section-label">What customers say</p>
                <h2 className="lp-section-title">{testimonialsSectionTitle}</h2>
                <p className="lp-section-subtitle" style={{ marginTop: 12, maxWidth: 520 }}>{testimonialsSectionSubtitle}</p>
              </div>
              <div className="lp-hide-m" style={{ display: "flex", gap: 4 }}>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5" style={{ color: accentColor, fill: accentColor }} />
                ))}
              </div>
            </div>
            </LpReveal>

            <div className="lp-three-col" style={{ gap: 1, background: "var(--lp-border)", borderRadius: 16, overflow: "hidden" }}>
              {testimonials.slice(0, 3).map((t, i) => (
                <LpReveal key={t.name} direction={i === 0 ? "left" : i === 2 ? "right" : "up"} delay={i * 0.08}>
                <div style={{ background: "#fff", padding: "32px 28px" }}>
                  <p style={{ fontSize: 15, color: "var(--lp-text-2)", lineHeight: 1.75, marginBottom: 28, fontStyle: "italic" }}>&ldquo;{t.quote}&rdquo;</p>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--lp-bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "var(--lp-text-2)" }}>
                      {t.avatar}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--lp-text)" }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "var(--lp-text-3)" }}>{t.role}, {t.company}</div>
                    </div>
                  </div>
                </div>
                </LpReveal>
              ))}
            </div>

            <LpReveal direction="up" delay={0.1}>
            <div style={{ marginTop: 32, textAlign: "center" }}>
              <Link href={wlMarketingHref("testimonials")} className="lp-btn lp-btn-ghost" style={{ border: `1px solid var(--lp-border)`, padding: "10px 20px" }}>
                {testimonialsSectionButtonText}
              </Link>
            </div>
            </LpReveal>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="lp-section" style={{ background: "#fff", paddingBottom: 0 }}>
          <div className="lp-section-inner">
            <LpReveal direction="up">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 52, flexWrap: "wrap", gap: 16 }}>
              <div>
                <p className="lp-section-label">Get Started</p>
                <h2 className="lp-section-title">{pricingSectionTitle}</h2>
                <p className="lp-section-subtitle" style={{ marginTop: 12, maxWidth: 520 }}>{pricingSectionSubtitle}</p>
              </div>
              <Link href={wlMarketingHref("pricing")} className="lp-btn lp-btn-ghost lp-hide-m" style={{ border: `1px solid var(--lp-border)`, padding: "10px 20px" }}>
                {pricingSectionButtonText}
              </Link>
            </div>
            </LpReveal>

            <div className="lp-three-col" style={{ marginBottom: 48 }}>
              {pricingPlans.slice(0, 3).map((plan, i) => (
                <LpReveal key={plan.name} direction={i === 0 ? "left" : i === 2 ? "right" : "up"} delay={i * 0.08}>
                <div
                  className="lp-bento-cell"
                  style={{
                    padding: 28,
                    border: plan.popular ? `2px solid ${accentColor}` : undefined,
                    boxShadow: plan.popular ? `0 12px 40px rgba(${accent},0.12)` : undefined,
                  }}
                >
                  {plan.popular ? (
                    <div style={{ fontSize: 11, fontWeight: 700, color: accentColor, marginBottom: 8 }}>Most Popular</div>
                  ) : null}
                  <div style={{ fontSize: 20, fontWeight: 840, color: "var(--lp-text)", marginBottom: 6 }}>{plan.name}</div>
                  <p style={{ fontSize: 13, color: "var(--lp-text-2)", marginBottom: 16 }}>{plan.description}</p>
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: accentColor, letterSpacing: -1 }}>{plan.price}</span>
                    {plan.period ? <span style={{ fontSize: 14, color: "var(--lp-text-3)", marginLeft: 4 }}>{plan.period}</span> : null}
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {(plan.features ?? []).slice(0, 4).map((f) => (
                      <li key={f} style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--lp-text-2)" }}>
                        <CheckCircle className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={wlMarketingHref("pricing")} className="lp-btn" style={{ width: "100%", textAlign: "center", padding: "10px 16px", border: `1px solid ${plan.popular ? accentColor : "var(--lp-border)"}`, background: plan.popular ? accentColor : "#fff", color: plan.popular ? "#fff" : "var(--lp-text)" }}>
                    View Details
                  </Link>
                </div>
                </LpReveal>
              ))}
            </div>

            <LpReveal direction="up" delay={0.12}>
            <div style={{ background: "var(--lp-text)", borderRadius: "20px 20px 0 0", padding: "72px 56px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 40, flexWrap: "wrap", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -80, right: -80, width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, rgba(${accent},0.15) 0%, transparent 65%)`, pointerEvents: "none" }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <h2 style={{ fontSize: "clamp(1.8rem, 3vw, 2.6rem)", fontWeight: 860, letterSpacing: -1.5, color: "#fff", lineHeight: 1.2, marginBottom: 12 }}>{ctaSectionTitle}</h2>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, margin: 0 }}>{ctaSectionSubtitle}</p>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                <Link href={wlSignupHref()} className="lp-btn lp-btn-cta" style={{ fontSize: 15, padding: "13px 28px" }}>{ctaSectionPrimaryButtonText}</Link>
                <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.55)", textDecoration: "none", display: "flex", alignItems: "center", padding: "13px 0" }}>
                  {ctaSectionSecondaryButtonText}
                </Link>
              </div>
            </div>
            </LpReveal>
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
