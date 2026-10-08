// @ts-nocheck
import { WhiteLabelHeader } from "./components/header";
import { LandingFooter } from "./components/landing-footer";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { wlMarketingHref } from "@/lib/public-template";
import { applyWhiteLabelPlaceholders } from "@/lib/white-label-placeholders";
import "./lp-styles.css";

type TermsSection = {
  id: string;
  title: string;
  content: string;
};

type WhiteLabelTermsContent = {
  title?: string;
  subtitle?: string;
  sections?: TermsSection[];
};

const DEFAULT_TERMS_SECTIONS = [
  {
    id: "default-1",
    title: "Terms and Condition",
    content: `<p><strong>Effective Date:</strong> 13 January 2026</p>
<p>
  Welcome to <strong>YourBrand</strong>. These Terms and
  Conditions ("Terms") govern your access to and use of our
  website{" "}
  <a href="https://yourbrand.com" target="_blank" rel="noopener noreferrer">
    https://yourbrand.com
  </a>{" "}
  and our WhatsApp Business API–related products and services.
</p>
<p>
  By accessing our website or using our services, you agree
  to be bound by these Terms. If you do not agree, please do
  not use our website or services.
</p>`,
  },
  {
    id: "default-2",
    title: "1. About Our Services",
    content: `<p>
  We provide WhatsApp Business API onboarding,
  messaging automation, broadcasting, and related
  communication services for businesses.
</p>`,
  },
  {
    id: "default-3",
    title: "2. Eligibility",
    content: `<ul>
  <li>You are at least 18 years of age</li>
  <li>You have the legal authority to enter into a binding agreement</li>
  <li>You are using our services for lawful business purposes only</li>
</ul>`,
  },
  {
    id: "default-4",
    title: "3. Services",
    content: `<ul>
  <li>Services are provided on a subscription or usage basis</li>
  <li>WhatsApp Business API approval is subject to Meta / WhatsApp policies</li>
  <li>We do not guarantee WhatsApp API approval</li>
  <li>We may modify, suspend, or discontinue services at any time</li>
</ul>`,
  },
  {
    id: "default-5",
    title: "4. User Responsibilities",
    content: `<ul>
  <li>Provide accurate and complete onboarding information</li>
  <li>Use WhatsApp API only for opted-in users</li>
  <li>Comply with applicable laws and WhatsApp policies</li>
  <li>Avoid spam, misleading, illegal, or abusive content</li>
</ul>
<p>
  Any misuse may result in immediate suspension or
  termination of services.
</p>`,
  },
  {
    id: "default-6",
    title: "5. WhatsApp Policies Compliance",
    content: `<ul>
  <li>Usage is governed by Meta / WhatsApp policies</li>
  <li>Message templates must be approved by WhatsApp</li>
  <li>WhatsApp may suspend numbers for violations</li>
  <li>We are not responsible for suspensions caused by policy breaches</li>
</ul>`,
  },
  {
    id: "default-7",
    title: "6. Payments and Billing",
    content: `<ul>
  <li>All prices are as stated unless otherwise indicated</li>
  <li>Payments must be made in advance</li>
  <li>Failure to pay may result in service suspension</li>
  <li>Prices are subject to change with prior notice</li>
</ul>`,
  },
  {
    id: "default-8",
    title: "7. Refund and Cancellation Policy",
    content: `<ul>
  <li>Payments are non-refundable unless explicitly stated</li>
  <li>Cancellations must be requested before renewal</li>
  <li>No refunds for partial usage or unused periods</li>
</ul>`,
  },
  {
    id: "default-9",
    title: "8. Data Privacy",
    content: `<p>
  Your use of our services is governed by our Privacy Policy.
  By using our services, you consent to data collection and
  processing as described therein.
</p>`,
  },
  {
    id: "default-10",
    title: "9. Intellectual Property",
    content: `<p>
  All content, branding, software, and materials are the
  intellectual property of our company. Unauthorized use is
  strictly prohibited.
</p>`,
  },
  {
    id: "default-11",
    title: "10. Limitation of Liability",
    content: `<ul>
  <li>Indirect, incidental, or consequential damages</li>
  <li>Loss of data, revenue, or business opportunities</li>
  <li>WhatsApp or Meta service disruptions</li>
</ul>
<p>
  Total liability shall not exceed the amount paid in the
  preceding three months.
</p>`,
  },
  {
    id: "default-12",
    title: "11. Indemnification",
    content: `<p>
  You agree to indemnify and hold harmless our company from claims
  arising from misuse of services or violation of these Terms.
</p>`,
  },
  {
    id: "default-13",
    title: "12. Termination",
    content: `<p>
  We may suspend or terminate access without prior notice for
  violations of these Terms or applicable laws.
</p>`,
  },
  {
    id: "default-14",
    title: "13. Governing Law and Jurisdiction",
    content: `<p>
  These Terms are governed by applicable laws. All disputes
  are subject to relevant jurisdiction.
</p>`,
  },
  {
    id: "default-15",
    title: "14. Changes to Terms",
    content: `<p>
  We may update these Terms periodically. Continued use
  indicates acceptance of the revised Terms.
</p>`,
  },
  {
    id: "default-16",
    title: "15. Contact Information",
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

export default function WhiteLabelTermsPage() {
  const { config, companyProfile, homepage } = useWhiteLabelConfig();
  const termsConfig = config?.["white-label-terms"] as WhiteLabelTermsContent | undefined;
  const themeConfig = config?.theme as { websiteThemeColor?: string } | undefined;
  const accentColor = themeConfig?.websiteThemeColor || "#16a34a";
  const accent = accentRgb(accentColor);
  const brandName = (companyProfile?.name as string) || "YourBrand";
  const companyEmail = (companyProfile?.email as string) || "support@yourbrand.com";
  const companyWebsite = (companyProfile?.website as string) || "";

  const hasCustomContent = termsConfig?.sections && termsConfig.sections.length > 0;
  const title = termsConfig?.title || "Terms & Conditions";
  const subtitle = termsConfig?.subtitle || "Please read these terms carefully before using our services.";

  const sections = (hasCustomContent ? termsConfig.sections! : DEFAULT_TERMS_SECTIONS).map((section) => ({
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
            <p className="lp-section-label">Terms</p>
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
              These Terms and Conditions align with WhatsApp Business API and legal standards.
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
