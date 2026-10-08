// @ts-nocheck
import { WhiteLabelHeader } from "./components/header";
import { LandingFooter } from "./components/landing-footer";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { wlMarketingHref } from "@/lib/public-template";
import { applyWhiteLabelPlaceholders } from "@/lib/white-label-placeholders";
import "./lp-styles.css";

type PrivacySection = {
  id: string;
  title: string;
  content: string;
};

type WhiteLabelPrivacyContent = {
  title?: string;
  subtitle?: string;
  sections?: PrivacySection[];
};

const DEFAULT_PRIVACY_SECTIONS = [
  {
    id: "default-1",
    title: "Privacy Policy",
    content: `<p><strong>Effective Date:</strong> 13 January 2026</p>
<p>
  <strong>YourBrand</strong> ("we", "our", "us") operates the website{" "}
  <a href="https://yourbrand.com" target="_blank" rel="noopener noreferrer">
    https://yourbrand.com
  </a>.
  We provide WhatsApp Business API and related services. This Privacy Policy explains how we collect, use, disclose, and
  protect your information when you visit our website or use our services.
</p>
<p>
  By accessing or using our website and services, you agree
  to the collection and use of information in accordance with
  this Privacy Policy.
</p>`,
  },
  {
    id: "default-2",
    title: "1. Information We Collect",
    content: `<h4>1.1 Personal Information</h4>
<ul>
  <li>Full name</li>
  <li>Email address</li>
  <li>Phone number / WhatsApp number</li>
  <li>Business name and details</li>
  <li>Billing and payment information</li>
</ul>

<h4>1.2 Automatically Collected Information</h4>
<ul>
  <li>IP address</li>
  <li>Browser type and version</li>
  <li>Device information</li>
  <li>Pages visited and time spent</li>
  <li>Referring URLs</li>
</ul>

<h4>1.3 WhatsApp API Data</h4>
<p>
  While using our WhatsApp Business API services, we may
  process WhatsApp phone numbers, message templates, message
  logs (as required for service delivery), and metadata
  related to message delivery and performance.
</p>
<p>
  We do not read or store personal message content
  unnecessarily and process data strictly as required to
  provide our services.
</p>`,
  },
  {
    id: "default-3",
    title: "2. How We Use Your Information",
    content: `<ul>
  <li>Provide, operate, and maintain our services</li>
  <li>Set up and manage WhatsApp Business API accounts</li>
  <li>Communicate regarding inquiries, support, or updates</li>
  <li>Process payments and invoices</li>
  <li>Improve website performance and user experience</li>
  <li>Ensure compliance with legal and regulatory requirements</li>
</ul>`,
  },
  {
    id: "default-4",
    title: "3. Data Sharing and Disclosure",
    content: `<p>We do not sell, trade, or rent your personal information.</p>
<ul>
  <li>With WhatsApp / Meta Platforms Inc. for API operations</li>
  <li>With trusted service providers under confidentiality obligations</li>
  <li>To comply with legal obligations or government requests</li>
  <li>To protect the rights, property, or safety of our company</li>
</ul>`,
  },
  {
    id: "default-5",
    title: "4. Data Security",
    content: `<p>
  We implement appropriate technical and organizational measures
  to protect your data. However, no internet transmission is
  100% secure, and absolute security cannot be guaranteed.
</p>`,
  },
  {
    id: "default-6",
    title: "5. Data Retention",
    content: `<p>
  We retain personal information only as long as necessary to
  fulfill the purposes outlined in this policy and comply with
  legal requirements.
</p>`,
  },
  {
    id: "default-7",
    title: "6. Cookies and Tracking Technologies",
    content: `<ul>
  <li>Analyze website traffic</li>
  <li>Improve user experience</li>
  <li>Understand user behavior</li>
</ul>
<p>You can disable cookies through your browser settings.</p>`,
  },
  {
    id: "default-8",
    title: "7. Your Rights",
    content: `<ul>
  <li>Access your personal data</li>
  <li>Request correction or deletion</li>
  <li>Withdraw consent for data processing</li>
</ul>`,
  },
  {
    id: "default-9",
    title: "8. Third-Party Links",
    content: `<p>
  Our website may contain links to third-party websites. We are
  not responsible for their privacy practices and encourage
  reviewing their policies.
</p>`,
  },
  {
    id: "default-10",
    title: "9. Children's Privacy",
    content: `<p>
  Our services are not intended for individuals under 18 years
  of age. We do not knowingly collect personal data from
  children.
</p>`,
  },
  {
    id: "default-11",
    title: "10. Changes to This Privacy Policy",
    content: `<p>
  We may update this Privacy Policy periodically. Updates will
  be posted on this page with a revised effective date.
</p>`,
  },
  {
    id: "default-12",
    title: "11. Contact Us",
    content: `<p>
  <strong>YourBrand</strong><br />
  Website: <a href="https://yourbrand.com" target="_blank" rel="noopener noreferrer">https://yourbrand.com</a><br />
  Email: <a href="mailto:support@yourbrand.com">support@yourbrand.com</a>
</p>`,
  },
];

function accentRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "22, 163, 74";
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

export default function WhiteLabelPrivacyPage() {
  const { config, companyProfile, homepage } = useWhiteLabelConfig();
  const privacyConfig = config?.["white-label-privacy"] as WhiteLabelPrivacyContent | undefined;
  const themeConfig = config?.theme as { websiteThemeColor?: string } | undefined;
  const accentColor = themeConfig?.websiteThemeColor || "#16a34a";
  const accent = accentRgb(accentColor);
  const brandName = (companyProfile?.name as string) || "YourBrand";
  const companyEmail = (companyProfile?.email as string) || "support@yourbrand.com";
  const companyWebsite = (companyProfile?.website as string) || "";

  const hasCustomContent = privacyConfig?.sections && privacyConfig.sections.length > 0;
  const title = privacyConfig?.title || "Privacy Policy";
  const subtitle =
    privacyConfig?.subtitle || "Your privacy is important to us. Please review how we handle your data.";

  const sections = (hasCustomContent ? privacyConfig.sections! : DEFAULT_PRIVACY_SECTIONS).map((section) => ({
    ...section,
    content: applyWhiteLabelPlaceholders(section.content, {
      brandName,
      email: companyEmail,
      website: companyWebsite,
    }),
  }));

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
            <p className="lp-section-label">Privacy</p>
            <h1 className="lp-section-title">{title}</h1>
            <p className="lp-section-subtitle" style={{ marginTop: 12, maxWidth: 560, margin: "12px auto 0" }}>
              {subtitle}
            </p>
          </div>
        </section>

        <section className="lp-section" style={{ background: "#fff", paddingTop: 0 }}>
          <div className="lp-section-inner">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {sections.map((section, index) => (
                <article key={section.id || index} className="lp-bento-cell" style={{ padding: "28px 32px" }}>
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
                  <div className="lp-about-content" dangerouslySetInnerHTML={{ __html: section.content }} />
                </article>
              ))}
            </div>

            <p style={{ fontSize: 13, color: "var(--lp-text-3)", textAlign: "center", marginTop: 40 }}>
              This Privacy Policy is designed to comply with general data protection and WhatsApp Business API
              requirements.
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
