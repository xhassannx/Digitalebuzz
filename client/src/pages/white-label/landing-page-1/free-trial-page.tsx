import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle,
  ArrowRight,
  Shield,
  Zap,
  BarChart3,
  Rocket,
} from "lucide-react";
import { WhiteLabelHeader } from "./components/header";
import { LandingFooter } from "./components/landing-footer";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { wlMarketingHref } from "@/lib/public-template";
import "./lp-styles.css";

function accentRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "22, 163, 74";
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

export default function FreeTrialPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { config, companyProfile, homepage } = useWhiteLabelConfig();

  const themeConfig = config?.theme as { websiteThemeColor?: string } | undefined;
  const accentColor = themeConfig?.websiteThemeColor || "#16a34a";
  const accent = accentRgb(accentColor);
  const brandName = (companyProfile?.name as string) || "YourBrand";

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

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      organizationName: "",
      phone: "",
    },
  });

  const onSubmit = async (data: SignupInput) => {
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/signup", { ...data, isTrial: true });

      toast({
        title: "Free trial started!",
        description: "Please log in to verify your email and activate your trial.",
      });

      setLocation(`/login?email=${encodeURIComponent(data.email)}`);
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message || "Failed to start free trial. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    {
      icon: Rocket,
      title: "14-Day Free Trial",
      description: "Full access to all features, no credit card required",
    },
    {
      icon: Zap,
      title: "Instant Setup",
      description: "Get started in minutes with our easy onboarding",
    },
    {
      icon: Shield,
      title: "Cancel Anytime",
      description: "No long-term commitments, cancel whenever you want",
    },
    {
      icon: BarChart3,
      title: "Full Analytics",
      description: "Track your performance with comprehensive insights",
    },
  ];

  const inputStyle: React.CSSProperties = {
    height: 44,
    borderRadius: 10,
    border: "1px solid var(--lp-border)",
    background: "#fff",
  };

  const rootStyle = { "--lp-accent-color": accentColor } as React.CSSProperties;

  return (
    <div className="lp-root" style={rootStyle}>
      <WhiteLabelHeader brandName={brandName} accentColor={accentColor} />

      <main>
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            paddingTop: 96,
            paddingBottom: 72,
            minHeight: "calc(100vh - var(--lp-nav-height, 64px))",
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
                bottom: -100,
                left: -80,
                width: 380,
                height: 380,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 65%)",
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

          <div className="lp-section-inner" style={{ position: "relative", zIndex: 1 }}>
            <div className="lp-two-col" style={{ gap: 40, alignItems: "start" }}>
              {/* Left — benefits */}
              <div>
                <p className="lp-section-label">Free Trial</p>
                <h1 className="lp-section-title" style={{ marginBottom: 14 }}>
                  Start Your Free Trial
                </h1>
                <p className="lp-section-subtitle" style={{ marginBottom: 36, maxWidth: 480 }}>
                  Join thousands of businesses that trust us to power their communication. No credit card
                  required. Cancel anytime.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 36 }}>
                  {benefits.map((benefit) => {
                    const Icon = benefit.icon;
                    return (
                      <div
                        key={benefit.title}
                        className="lp-bento-cell"
                        style={{
                          display: "flex",
                          gap: 14,
                          alignItems: "flex-start",
                          padding: "16px 18px",
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: `rgba(${accent},0.1)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Icon className="h-5 w-5" style={{ color: accentColor }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--lp-text)", marginBottom: 2 }}>
                            {benefit.title}
                          </div>
                          <div style={{ fontSize: 13, color: "var(--lp-text-2)", lineHeight: 1.5 }}>
                            {benefit.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, color: "var(--lp-text-2)" }}>
                  {["No credit card required", "14-day free trial", "Cancel anytime"].map((text) => (
                    <div key={text} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle className="h-4 w-4" style={{ color: accentColor }} />
                      {text}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — form */}
              <div style={{ position: "sticky", top: 88 }}>
                <div
                  className="lp-bento-cell"
                  style={{
                    padding: 32,
                    boxShadow: "0 12px 40px rgba(0,0,0,0.06)",
                  }}
                >
                  <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 840, color: "var(--lp-text)", marginBottom: 6 }}>
                      Create Your Account
                    </h2>
                    <p style={{ fontSize: 14, color: "var(--lp-text-2)", margin: 0 }}>
                      Start your 14-day free trial. No credit card required.
                    </p>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input placeholder="John" {...field} style={inputStyle} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Doe" {...field} style={inputStyle} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mobile Number</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="+91 9876543210" {...field} style={inputStyle} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john@example.com" {...field} style={inputStyle} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="organizationName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Organization Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Acme Inc." {...field} style={inputStyle} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="At least 8 characters" {...field} style={inputStyle} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="lp-btn lp-btn-cta"
                        style={{
                          width: "100%",
                          height: 48,
                          fontSize: 15,
                          borderRadius: 10,
                          background: accentColor,
                        }}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          "Creating Account..."
                        ) : (
                          <>
                            Start Free Trial
                            <ArrowRight className="ml-2 h-5 w-5" />
                          </>
                        )}
                      </Button>

                      <p style={{ fontSize: 12, textAlign: "center", color: "var(--lp-text-3)", margin: 0 }}>
                        By signing up, you agree to our{" "}
                        <Link href={wlMarketingHref("terms")} style={{ color: accentColor, fontWeight: 600 }}>
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link href={wlMarketingHref("privacy")} style={{ color: accentColor, fontWeight: 600 }}>
                          Privacy Policy
                        </Link>
                      </p>
                    </form>
                  </Form>
                </div>

                <p style={{ marginTop: 20, textAlign: "center", fontSize: 14, color: "var(--lp-text-2)" }}>
                  Already have an account?{" "}
                  <Link href="/login" style={{ color: accentColor, fontWeight: 600 }}>
                    Sign in here
                  </Link>
                </p>
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
