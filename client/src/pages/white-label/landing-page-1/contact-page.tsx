// @ts-nocheck
import { useState } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { WhiteLabelHeader } from "./components/header";
import { LandingFooter } from "./components/landing-footer";
import { LpReveal } from "./components/lp-animations";
import { template4InputStyle } from "./components/template4-auth-layout";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { wlMarketingHref, wlSignupHref } from "@/lib/public-template";
import "./lp-styles.css";

type ContactConfig = {
  email?: string;
  phone?: string;
  address?: string;
};

function accentRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "22, 163, 74";
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--lp-text)",
  marginBottom: 8,
} as const;

export default function ContactPage() {
  const { toast } = useToast();
  const { config, companyProfile, homepage } = useWhiteLabelConfig();
  const themeConfig = config?.theme as { websiteThemeColor?: string } | undefined;
  const accentColor = themeConfig?.websiteThemeColor || "#16a34a";
  const accent = accentRgb(accentColor);
  const brandName = (companyProfile?.name as string) || "YourBrand";

  const contactConfig = config?.contact as ContactConfig | undefined;
  const contactEmail =
    contactConfig?.email ||
    (companyProfile?.email as string) ||
    (homepage?.footerContactEmail as string) ||
    "support@yourbrand.com";
  const contactPhone =
    contactConfig?.phone ||
    (companyProfile?.phone as string) ||
    (homepage?.footerContactPhone as string) ||
    "+1 (234) 567-890";
  const contactAddress =
    contactConfig?.address ||
    (homepage?.footerContactAddress as string) ||
    "123 Business St, Suite 100\nCity, State 12345";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Message sent!",
      description: "We'll get back to you soon.",
    });
    setFormData({
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
    });
  };

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

  const contactItems = [
    {
      icon: Mail,
      title: "Email",
      content: contactEmail,
      href: `mailto:${contactEmail}`,
    },
    {
      icon: Phone,
      title: "Phone",
      content: contactPhone,
      href: `tel:${contactPhone.replace(/\s/g, "")}`,
    },
    {
      icon: MapPin,
      title: "Address",
      content: contactAddress,
      href: null,
    },
  ];

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
            <p className="lp-section-label">Contact</p>
            <h1 className="lp-section-title">Get in Touch</h1>
            <p className="lp-section-subtitle" style={{ marginTop: 12, maxWidth: 560, margin: "12px auto 0" }}>
              Have questions? We&apos;d love to hear from you. Send us a message and we&apos;ll respond as soon as
              possible.
            </p>
          </div>
        </section>

        <section className="lp-section" style={{ background: "#fff", paddingTop: 0 }}>
          <div className="lp-section-inner">
            <div className="lp-two-col" style={{ alignItems: "start", gap: 20 }}>
              <LpReveal direction="left">
                <article className="lp-bento-cell" style={{ padding: "32px" }}>
                  <h2
                    style={{
                      fontSize: 22,
                      fontWeight: 840,
                      color: "var(--lp-text)",
                      marginBottom: 24,
                      letterSpacing: -0.5,
                    }}
                  >
                    Send us a message
                  </h2>
                  <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label htmlFor="name" style={labelStyle}>
                        Name
                      </label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Your name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        style={template4InputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="email" style={labelStyle}>
                        Email
                      </label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        style={template4InputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" style={labelStyle}>
                        Phone
                      </label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1 (234) 567-890"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        style={template4InputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="subject" style={labelStyle}>
                        Subject
                      </label>
                      <Input
                        id="subject"
                        type="text"
                        placeholder="What's this about?"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        required
                        style={template4InputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="message" style={labelStyle}>
                        Message
                      </label>
                      <Textarea
                        id="message"
                        placeholder="Your message..."
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        required
                        style={{ ...template4InputStyle, minHeight: 120, height: "auto", paddingTop: 12 }}
                      />
                    </div>
                    <button
                      type="submit"
                      className="lp-btn lp-btn-cta"
                      style={{ width: "100%", height: 48, fontSize: 15, borderRadius: 10, background: accentColor }}
                    >
                      Send Message
                      <Send className="ml-2 h-4 w-4" />
                    </button>
                  </form>
                </article>
              </LpReveal>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {contactItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <LpReveal key={item.title} direction="right" delay={index * 0.08}>
                      <article className="lp-bento-cell" style={{ padding: "24px 28px" }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            background: `rgba(${accent},0.1)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 16,
                          }}
                        >
                          <Icon className="h-5 w-5" style={{ color: accentColor }} />
                        </div>
                        <h3
                          style={{
                            fontSize: 18,
                            fontWeight: 800,
                            color: "var(--lp-text)",
                            marginBottom: 8,
                            letterSpacing: -0.3,
                          }}
                        >
                          {item.title}
                        </h3>
                        {item.href ? (
                          <a
                            href={item.href}
                            style={{
                              fontSize: 15,
                              color: accentColor,
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            {item.content}
                          </a>
                        ) : (
                          <p
                            style={{
                              fontSize: 15,
                              color: "var(--lp-text-2)",
                              lineHeight: 1.65,
                              margin: 0,
                              whiteSpace: "pre-line",
                            }}
                          >
                            {item.content}
                          </p>
                        )}
                      </article>
                    </LpReveal>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

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
                  Ready to Get Started?
                </h2>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, margin: 0 }}>
                  Start your free trial today. No credit card required.
                </p>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                <Link href={wlSignupHref()} className="lp-btn lp-btn-cta" style={{ fontSize: 15, padding: "13px 28px" }}>
                  Start Free Trial
                </Link>
                <Link
                  href="/signup"
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
                  Create an account →
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
