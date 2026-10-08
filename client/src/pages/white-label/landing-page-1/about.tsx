// @ts-nocheck
import { WhiteLabelHeader } from "./components/header";
import { LandingFooter } from "./components/landing-footer";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { wlMarketingHref } from "@/lib/public-template";
import { applyWhiteLabelPlaceholders } from "@/lib/white-label-placeholders";
import "./lp-styles.css";

type AboutSection = {
  id: string;
  title: string;
  content: string;
  bgColor?: string;
};

type WhiteLabelAboutContent = {
  title?: string;
  subtitle?: string;
  sections?: AboutSection[];
};

const DEFAULT_SECTIONS: AboutSection[] = [
  {
    id: "default-1",
    title: "Welcome",
    content: `<p>
      Welcome to <strong>YourBrand</strong>, your trusted partner
      for innovative solutions designed to help businesses communicate smarter, faster, and at scale.
    </p>
    <p>
      At <strong>YourBrand</strong>, we empower startups, small businesses, and
      growing enterprises to leverage the power of automation, integration, and customer engagement to drive
      growth and build lasting customer relationships.
    </p>`,
  },
  {
    id: "default-2",
    title: "Who We Are",
    content: `<p>
      <strong>YourBrand</strong> is a technology-driven company focused on
      delivering reliable, scalable, and result-oriented
      solutions. We help businesses
      transform their operations into powerful sales, marketing, and
      customer support channels.
    </p>
    <p>
      Our mission is simple: to make business communication
      seamless, efficient, and conversion-focused using
      cutting-edge technology solutions.
    </p>`,
  },
  {
    id: "default-3",
    title: "What We Do",
    content: `<p>
      We provide end-to-end solutions, including:
    </p>
    <ul>
      <li>Business automation and workflow setup</li>
      <li>Bulk messaging and broadcasting</li>
      <li>Automated workflows and chatbots</li>
      <li>Customer support and CRM integrations</li>
      <li>Template creation and management</li>
      <li>Campaign management and performance tracking</li>
    </ul>
    <p>
      Whether you want to generate leads, send notifications,
      recover abandoned carts, or provide instant customer
      support, we have solutions tailored to your business
      needs.
    </p>`,
  },
  {
    id: "default-4",
    title: "Why Choose YourBrand",
    content: `<ul>
      <li>Official and compliant solutions</li>
      <li>Secure, reliable, and scalable infrastructure</li>
      <li>Easy-to-use automation tools and dashboard</li>
      <li>Dedicated onboarding and customer support</li>
      <li>Solutions tailored for businesses of all sizes</li>
    </ul>
    <p>
      We focus not just on technology, but on results—helping
      our clients increase engagement, improve response rates,
      and grow revenue.
    </p>`,
  },
  {
    id: "default-5",
    title: "Our Mission",
    content: `<p>
      To enable businesses of all sizes to build meaningful customer relationships through simple, secure, and scalable communication solutions. We are committed to providing innovative tools that help our clients succeed.
    </p>`,
  },
  {
    id: "default-6",
    title: "Our Vision",
    content: `<p>
      To become a leading solution provider by helping businesses communicate more effectively
      and build meaningful customer connections. We envision a future where every business can leverage technology to achieve their goals.
    </p>`,
  },
  {
    id: "default-7",
    title: "Our Commitment",
    content: `<ul>
      <li>Data privacy and security</li>
      <li>Transparent pricing and processes</li>
      <li>Continuous innovation</li>
      <li>Long-term client success</li>
      <li>Exceptional customer support</li>
    </ul>`,
  },
  {
    id: "default-8",
    title: "Get in Touch",
    content: `<p>
      If you're ready to grow your business with our solutions, <strong>YourBrand</strong> is here to help.
    </p>
    <p>
      <strong>Website:</strong> <a href="https://yourbrand.com" target="_blank" rel="noopener noreferrer">https://yourbrand.com</a><br />
      <strong>Email:</strong> <a href="mailto:support@yourbrand.com">support@yourbrand.com</a>
    </p>
    <p>
      Contact us today to learn how we can help transform your business communication.
    </p>`,
  },
];

function accentRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "22, 163, 74";
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

export default function WhiteLabelAboutPage() {
  const { config, companyProfile, homepage } = useWhiteLabelConfig();
  const aboutConfig = config?.["white-label-about"] as WhiteLabelAboutContent | undefined;
  const themeConfig = config?.theme as { websiteThemeColor?: string } | undefined;
  const accentColor = themeConfig?.websiteThemeColor || "#16a34a";
  const accent = accentRgb(accentColor);
  const brandName = (companyProfile?.name as string) || "YourBrand";
  const companyEmail = (companyProfile?.email as string) || "support@yourbrand.com";
  const companyWebsite = (companyProfile?.website as string) || "";

  const title = aboutConfig?.title || "About Us";
  const subtitle = aboutConfig?.subtitle || `Learn more about who we are and what we do at ${brandName}`;

  const processSection = (section: AboutSection) => ({
    ...section,
    content: applyWhiteLabelPlaceholders(section.content, {
      brandName,
      email: companyEmail,
      website: companyWebsite,
    }),
  });

  const sections =
    aboutConfig?.sections && aboutConfig.sections.length > 0
      ? aboutConfig.sections.map(processSection)
      : DEFAULT_SECTIONS.map(processSection);

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
            <p className="lp-section-label">About</p>
            <h1 className="lp-section-title">{title}</h1>
            <p className="lp-section-subtitle" style={{ marginTop: 12, maxWidth: 560, margin: "12px auto 0" }}>
              {subtitle}
            </p>
          </div>
        </section>

        {/* Content sections */}
        <section className="lp-section" style={{ background: "#fff", paddingTop: 0 }}>
          <div className="lp-section-inner">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {sections.map((section, index) => (
                <article
                  key={section.id || index}
                  className="lp-bento-cell"
                  style={{ padding: "28px 32px" }}
                >
                  <h2
                    style={{
                      fontSize: 22,
                      fontWeight: 840,
                      color: "var(--lp-text)",
                      marginBottom: 16,
                      letterSpacing: -0.5,
                    }}
                  >
                    {section.title}
                  </h2>
                  <div
                    className="lp-about-content"
                    dangerouslySetInnerHTML={{ __html: section.content }}
                  />
                </article>
              ))}
            </div>

            <p
              style={{
                fontSize: 13,
                color: "var(--lp-text-3)",
                textAlign: "center",
                marginTop: 40,
              }}
            >
              Powering Business Communication.
            </p>
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
