import { useState } from "react";
import { shouldShowWhiteLabelAuthChrome, useStripLegacyWhiteLabelAuthQuery } from "@/lib/public-template";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { IndustrialLoginLayout } from "@/components/auth/industrial-login-layout";
import {
  Template4AuthCard,
  Template4AuthLayout,
  accentRgb,
  template4InputStyle,
} from "@/pages/white-label/landing-page-1/components/template4-auth-layout";
import { ArrowRight, Lock, Mail } from "lucide-react";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);

  useStripLegacyWhiteLabelAuthQuery();

  const { config, organizationId, companyProfile } = useWhiteLabelConfig();
  const whiteLabelLogo = config?.["white-label-logo"] as {
    logoUrl?: string;
    logoSize?: number;
  } | undefined;
  const brandingLogos = config?.["branding-logos"] as {
    websiteLogo?: { url?: string };
    panelLogo?: { url?: string };
  } | undefined;
  const logoUrl =
    whiteLabelLogo?.logoUrl?.trim() ||
    brandingLogos?.websiteLogo?.url?.trim() ||
    brandingLogos?.panelLogo?.url?.trim() ||
    undefined;
  const logoSize = whiteLabelLogo?.logoSize || 48;
  const tenantName = "Automate Conversations";

  const isWhiteLabelEnabled = shouldShowWhiteLabelAuthChrome(organizationId);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsLoading(true);
    setResetLink(null);
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      const body = await res.json().catch(() => ({}));
      setIsSubmitted(true);
      if (body.resetLink) {
        setResetLink(body.resetLink);
        toast({
          title: "Email could not be sent",
          description: "Use the link below to reset your password (development fallback).",
          variant: "default",
        });
      } else {
        toast({
          title: "Reset link sent",
          description: "If an account exists with this email, you will receive a password reset link.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const industrialInputClass =
    "pl-10 h-11 text-white placeholder:text-white/20 transition-all outline-none bg-[#111] border-white/10 rounded-md focus-visible:ring-2 focus-visible:ring-[var(--login-primary)] focus-visible:border-[var(--login-primary)]";
  const industrialLabelClass =
    "text-white/70 font-semibold text-xs uppercase tracking-wider";

  const submittedContent = (
  <>
    <p className="text-sm text-white/50 leading-relaxed">
      {resetLink
        ? "Email could not be sent (check SMTP config). Use this link to reset your password:"
        : "If an account exists with the email address you provided, you will receive a password reset link shortly."}
    </p>
    {resetLink && (
      <a
        href={resetLink}
        className="block w-full rounded-md border border-[var(--login-primary)] bg-[color-mix(in_srgb,var(--login-primary)_10%,transparent)] px-4 py-3 text-sm font-medium text-[var(--login-primary)] hover:bg-[color-mix(in_srgb,var(--login-primary)_18%,transparent)] break-all"
      >
        Reset password (open link)
      </a>
    )}
    <Button
      type="button"
      onClick={() => setLocation("/login")}
      className="w-full h-11 font-bold text-white transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--login-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808] bg-[var(--login-primary)] hover:opacity-90 rounded-sm"
      variant="default"
    >
      Back to login
      <ArrowRight className="h-4 w-4 ml-2" />
    </Button>
  </>
  );

  if (isWhiteLabelEnabled) {
    const brandName = (companyProfile?.name as string) || "YourBrand";
    const accentColor =
      (config?.theme as { websiteThemeColor?: string } | undefined)?.websiteThemeColor || "#16a34a";
    const accent = accentRgb(accentColor);

    return (
      <Template4AuthLayout brandName={brandName} accentColor={accentColor}>
        <Template4AuthCard
          title={isSubmitted ? "Check your email" : "Forgot password"}
          description={
            isSubmitted
              ? "We've sent password reset instructions if an account exists for that email"
              : "Enter your email address and we'll send you a link to reset your password"
          }
          footer={
            <p style={{ fontSize: 14, color: "var(--lp-text-2)", margin: 0 }}>
              Remember your password?{" "}
              <button
                type="button"
                onClick={() => setLocation("/login")}
                style={{ color: accentColor, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}
              >
                Log in
              </button>
            </p>
          }
        >
          {isSubmitted ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 14, color: "var(--lp-text-2)", margin: 0 }}>
                {resetLink
                  ? "Email could not be sent (check SMTP config). Use this link to reset your password:"
                  : "If an account exists with the email address you provided, you will receive a password reset link shortly."}
              </p>
              {resetLink && (
                <a
                  href={resetLink}
                  style={{
                    display: "block",
                    width: "100%",
                    borderRadius: 10,
                    border: `1px solid ${accentColor}`,
                    background: `rgba(${accent}, 0.08)`,
                    padding: "12px 16px",
                    fontSize: 14,
                    fontWeight: 500,
                    color: accentColor,
                    wordBreak: "break-all",
                    textAlign: "center",
                  }}
                >
                  Reset password (open link)
                </a>
              )}
              <Button
                type="button"
                className="lp-btn lp-btn-cta"
                style={{ width: "100%", height: 48, fontSize: 15, borderRadius: 10, background: accentColor }}
                onClick={() => setLocation("/login")}
              >
                Back to login
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            {...field}
                            className="pl-10"
                            style={template4InputStyle}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="lp-btn lp-btn-cta"
                  style={{ width: "100%", height: 48, fontSize: 15, borderRadius: 10, background: accentColor }}
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send reset link"}
                </Button>
              </form>
            </Form>
          )}
        </Template4AuthCard>
      </Template4AuthLayout>
    );
  }

  return (
    <IndustrialLoginLayout
      tenantName={tenantName}
      portalLabel="User Portal"
      heroTitleLine1="Power of"
      heroTitleLine2="Meta API"
      loginCardLabel="Forgot Password"
      panelStatusText="Password Recovery"
      panelHeading="Reset Password"
      logoUrl={logoUrl}
      logoSize={logoSize}
      footerExtra={
        <p className="text-center text-sm sm:text-base text-white">
          Remember your password?{" "}
          <button
            type="button"
            onClick={() => setLocation("/login")}
            className="text-[var(--login-primary)] hover:underline font-semibold"
          >
            Log in
          </button>
        </p>
      }
    >
      <div className="flex flex-col gap-6 rounded-lg border-0 shadow-none bg-transparent">
        <div className="space-y-1 pb-4">
          <h3 className="text-2xl text-white font-black uppercase tracking-tight italic">
            {isSubmitted ? "Check your email" : "Forgot password"}
          </h3>
          <p className="text-sm text-white/50">
            {isSubmitted
              ? "We've sent password reset instructions if an account exists for that email"
              : "Enter your email address and we'll send you a link to reset your password"}
          </p>
        </div>

        {isSubmitted ? (
          <div className="space-y-4">{submittedContent}</div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={industrialLabelClass}>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" aria-hidden />
                        <Input
                          type="email"
                          placeholder="name@company.com"
                          {...field}
                          className={industrialInputClass}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 font-bold text-white transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--login-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808] bg-[var(--login-primary)] hover:opacity-90 rounded-sm mt-4"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : (
                  <>
                    Send reset link
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </Form>
        )}
      </div>
    </IndustrialLoginLayout>
  );
}
