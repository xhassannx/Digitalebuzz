// @ts-nocheck
import { Link } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import type { PublicSubscriptionCheckoutInput } from "@shared/schema";
import { usePublicSubscriptionCheckout } from "@/hooks/usePublicSubscriptionCheckout";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { wlMarketingHref } from "@/lib/public-template";
import { WhiteLabelHeader } from "./components/header";
import { LandingFooter } from "./components/landing-footer";
import { LpReveal } from "./components/lp-animations";
import { template4InputStyle } from "./components/template4-auth-layout";
import "./lp-styles.css";

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

export default function WhiteLabelSubscribePage() {
  const { config, companyProfile, homepage } = useWhiteLabelConfig();
  const themeConfig = config?.theme as { websiteThemeColor?: string } | undefined;
  const accentColor = themeConfig?.websiteThemeColor || "#16a34a";
  const accent = accentRgb(accentColor);
  const brandName = (companyProfile?.name as string) || "YourBrand";

  const {
    form,
    submitting,
    plansLoading,
    billingLoading,
    paidPlans,
    billingOptions,
    noGateway,
    onSubmit,
    formatPrice,
  } = usePublicSubscriptionCheckout(accentColor);

  const selectedPlanId = form.watch("planId");

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
            paddingBottom: 48,
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
            <p className="lp-section-label">Subscribe</p>
            <h1 className="lp-section-title">Choose your plan</h1>
            <p className="lp-section-subtitle" style={{ marginTop: 12, maxWidth: 640, margin: "12px auto 0" }}>
              Purchase a plan without signing in first. We create or match your account by email, then attach the
              subscription automatically.
            </p>
            <p style={{ fontSize: 13, color: "var(--lp-text-3)", marginTop: 12, maxWidth: 520, margin: "12px auto 0" }}>
              Already have an account? Use the same email and password so the plan is added to your existing workspace.
            </p>
          </div>
        </section>

        <section className="lp-section" style={{ background: "#fff", paddingTop: 0 }}>
          <div className="lp-section-inner" style={{ maxWidth: 960 }}>
            {noGateway && !billingLoading ? (
              <LpReveal direction="up">
                <div
                  className="lp-bento-cell"
                  style={{
                    padding: "20px 24px",
                    marginBottom: 20,
                    border: "1px solid #fcd34d",
                    background: "#fffbeb",
                  }}
                >
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>
                    Payments not configured
                  </h2>
                  <p style={{ fontSize: 14, color: "#a16207", margin: 0, lineHeight: 1.6 }}>
                    The platform owner must connect Razorpay or Stripe for organization subscription billing under
                    Integrations. Then this page will enable checkout.
                  </p>
                </div>
              </LpReveal>
            ) : null}

            <div
              className="lp-subscribe-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 20,
              }}
            >
              <LpReveal direction="left">
                <article className="lp-bento-cell" style={{ padding: "24px 28px" }}>
                  <h2 style={{ fontSize: 20, fontWeight: 840, color: "var(--lp-text)", marginBottom: 6 }}>Plans</h2>
                  <p style={{ fontSize: 13, color: "var(--lp-text-2)", marginBottom: 20 }}>
                    Prices follow your panel currency (USD list; Razorpay settles in INR).
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto" }}>
                    {plansLoading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--lp-text-2)" }}>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                      </div>
                    ) : paidPlans.length === 0 ? (
                      <p style={{ fontSize: 14, color: "var(--lp-text-2)", margin: 0 }}>No paid plans are available yet.</p>
                    ) : (
                      paidPlans.map((plan) => {
                        const selected = selectedPlanId === plan.id;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => form.setValue("planId", plan.id)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              borderRadius: 12,
                              border: selected ? `2px solid ${accentColor}` : "1px solid var(--lp-border)",
                              background: selected ? `rgba(${accent},0.06)` : "#fff",
                              padding: "14px 16px",
                              cursor: "pointer",
                              transition: "border-color 0.15s, background 0.15s",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--lp-text)" }}>
                              {selected ? <CheckCircle2 className="h-4 w-4" style={{ color: accentColor }} /> : null}
                              {plan.displayName}
                            </div>
                            <div style={{ fontSize: 13, color: "var(--lp-text-2)", marginTop: 6 }}>
                              From {formatPrice(plan.priceMonthly, plan.currency || "USD")}/mo
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </article>
              </LpReveal>

              <LpReveal direction="right" delay={0.08}>
                <article className="lp-bento-cell" style={{ padding: "28px 32px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <CreditCard className="h-5 w-5" style={{ color: accentColor }} />
                    <h2 style={{ fontSize: 20, fontWeight: 840, color: "var(--lp-text)", margin: 0 }}>Account & payment</h2>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--lp-text-2)", marginBottom: 24 }}>
                    Required to assign the subscription to the right customer.
                  </p>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel style={labelStyle}>First name</FormLabel>
                              <FormControl>
                                <Input {...field} autoComplete="given-name" style={template4InputStyle} />
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
                              <FormLabel style={labelStyle}>Last name</FormLabel>
                              <FormControl>
                                <Input {...field} autoComplete="family-name" style={template4InputStyle} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel style={labelStyle}>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" autoComplete="email" style={template4InputStyle} />
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
                            <FormLabel style={labelStyle}>Password</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" autoComplete="new-password" style={template4InputStyle} />
                            </FormControl>
                            <p style={{ fontSize: 12, color: "var(--lp-text-3)", marginTop: 6 }}>
                              New accounts use this password to sign in.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="organizationName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel style={labelStyle}>Organization</FormLabel>
                            <FormControl>
                              <Input {...field} autoComplete="organization" style={template4InputStyle} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel style={labelStyle}>Phone</FormLabel>
                            <FormControl>
                              <Input {...field} autoComplete="tel" style={template4InputStyle} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div>
                        <span style={labelStyle}>Billing period</span>
                        <RadioGroup
                          value={form.watch("billingCycle")}
                          onValueChange={(v) =>
                            form.setValue("billingCycle", v as PublicSubscriptionCheckoutInput["billingCycle"])
                          }
                          className="flex flex-wrap gap-4"
                        >
                          {(["monthly", "quarterly", "yearly"] as const).map((c) => (
                            <div key={c} className="flex items-center space-x-2">
                              <RadioGroupItem value={c} id={`wl-cycle-${c}`} />
                              <Label htmlFor={`wl-cycle-${c}`} className="font-normal capitalize">
                                {c}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>

                      {billingOptions?.razorpay && billingOptions?.stripe ? (
                        <div>
                          <span style={labelStyle}>Payment method</span>
                          <RadioGroup
                            value={form.watch("paymentGateway")}
                            onValueChange={(v) =>
                              form.setValue("paymentGateway", v as PublicSubscriptionCheckoutInput["paymentGateway"])
                            }
                            className="flex flex-wrap gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="razorpay" id="wl-gw-rz" />
                              <Label htmlFor="wl-gw-rz" className="font-normal">
                                Razorpay (INR)
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="stripe" id="wl-gw-st" />
                              <Label htmlFor="wl-gw-st" className="font-normal">
                                Stripe (USD)
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>
                      ) : null}

                      <button
                        type="submit"
                        className="lp-btn lp-btn-cta"
                        style={{
                          width: "100%",
                          height: 48,
                          fontSize: 15,
                          borderRadius: 10,
                          background: accentColor,
                          marginTop: 4,
                        }}
                        disabled={submitting || !!noGateway || paidPlans.length === 0}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing…
                          </>
                        ) : (
                          "Continue to payment"
                        )}
                      </button>

                      <p style={{ textAlign: "center", fontSize: 14, color: "var(--lp-text-2)", margin: 0 }}>
                        <Link href="/login" style={{ color: accentColor, fontWeight: 600, textDecoration: "none" }}>
                          Sign in instead
                        </Link>
                      </p>
                    </form>
                  </Form>
                </article>
              </LpReveal>
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
