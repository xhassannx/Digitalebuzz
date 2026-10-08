import { useEffect, useState } from "react";
import { shouldShowWhiteLabelAuthChrome, useStripLegacyWhiteLabelAuthQuery } from "@/lib/public-template";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Lock, Mail, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { IndustrialLoginLayout } from "@/components/auth/industrial-login-layout";
import {
  Template4AuthCard,
  Template4AuthLayout,
  template4InputStyle,
} from "@/pages/white-label/landing-page-1/components/template4-auth-layout";
import { resolveWhiteLabelWebsiteLogo } from "@/lib/white-label-logo";
import { useLoginWithVerification } from "@/features/auth/useLoginWithVerification";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const {
    isLoading,
    verificationEmail,
    verificationCode,
    setVerificationCode,
    onPasswordLogin,
    onVerifyCode,
    onResendCode,
    cancelVerification,
    setLocation,
  } = useLoginWithVerification();

  useStripLegacyWhiteLabelAuthQuery();

  const { config, organizationId, companyProfile } = useWhiteLabelConfig();
  const { logoUrl: loginLogoUrl, logoSize: loginLogoSize } = resolveWhiteLabelWebsiteLogo(config, 48);
  const tenantName = "Automate Conversations";

  /** Template 4 + org: gradient WL chrome. Templates 1–3: industrial login at `/login`. */
  const isWhiteLabelEnabled = shouldShowWhiteLabelAuthChrome(organizationId);

  const emailFromQuery =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("email") || ""
      : "";

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: emailFromQuery,
      password: "",
    },
  });

  useEffect(() => {
    if (emailFromQuery) {
      form.setValue("email", emailFromQuery);
    }
  }, [emailFromQuery, form]);

  const onGoogleLogin = () => {
    window.location.href = "/api/auth/google/authorize?redirectTo=/dashboard";
  };

  // Template 4: white-label marketing auth chrome
  if (isWhiteLabelEnabled) {
    const brandName = (companyProfile?.name as string) || "YourBrand";
    const accentColor =
      (config?.theme as { websiteThemeColor?: string } | undefined)?.websiteThemeColor || "#16a34a";

    return (
      <Template4AuthLayout brandName={brandName} accentColor={accentColor}>
        <Template4AuthCard
          title={verificationEmail ? "Verify email" : "Sign In"}
          description={
            verificationEmail
              ? `Enter the 6-digit code sent to ${verificationEmail}`
              : "Enter your credentials to access your account"
          }
          titleTestId="text-login-title"
          footer={
            !verificationEmail ? (
              <p style={{ fontSize: 14, color: "var(--lp-text-2)", margin: 0 }}>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setLocation("/signup")}
                  style={{
                    color: accentColor,
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                  data-testid="link-signup"
                >
                  Create an account
                </button>
              </p>
            ) : null
          }
        >
          {verificationEmail ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--lp-text-2)",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid var(--lp-border)",
                }}
              >
                We sent a 6-digit code to <strong>{verificationEmail}</strong>. Enter it below to
                verify your email (required only on your first login).
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Verification code</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="6-digit code"
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="pl-10 tracking-[0.3em] text-center font-semibold"
                    style={template4InputStyle}
                    data-testid="input-verification-code"
                  />
                </div>
              </div>
              <Button
                type="button"
                className="lp-btn lp-btn-cta"
                style={{
                  width: "100%",
                  height: 48,
                  fontSize: 15,
                  borderRadius: 10,
                  background: accentColor,
                }}
                disabled={isLoading}
                onClick={() => void onVerifyCode()}
                data-testid="button-verify-login"
              >
                {isLoading ? "Verifying..." : "Verify & Sign In"}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="hover:underline"
                  style={{ color: accentColor }}
                  disabled={isLoading}
                  onClick={() => void onResendCode()}
                >
                  Resend code
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  disabled={isLoading}
                  onClick={cancelVerification}
                >
                  Back to login
                </button>
              </div>
            </div>
          ) : (
            <>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onPasswordLogin)}
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}
                >
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
                              data-testid="input-email"
                              className="pl-10"
                              style={template4InputStyle}
                            />
                          </div>
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
                        <div className="flex items-center justify-between">
                          <FormLabel>Password</FormLabel>
                          <button
                            type="button"
                            onClick={() => setLocation("/forgot-password")}
                            className="text-sm hover:underline"
                            style={{ color: accentColor }}
                            data-testid="link-forgot-password"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
                              {...field}
                              data-testid="input-password"
                              className="pl-10 pr-10"
                              style={template4InputStyle}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
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
                    data-testid="button-login"
                  >
                    {isLoading ? (
                      "Logging in..."
                    ) : (
                      <>
                        Log In
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>

              <div style={{ margin: "20px 0", textAlign: "center", fontSize: 12, color: "var(--lp-text-3)" }}>
                or
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                style={{ height: 48, borderRadius: 10, border: "1px solid var(--lp-border)" }}
                disabled={isLoading}
                data-testid="button-google-login"
                onClick={onGoogleLogin}
              >
                <GoogleIcon className="mr-2 h-4 w-4" />
                Continue with Google
              </Button>
            </>
          )}
        </Template4AuthCard>
      </Template4AuthLayout>
    );
  }

  const industrialInputClass =
    "pl-10 h-11 text-white placeholder:text-white/20 transition-all outline-none bg-[#111] border-white/10 rounded-md focus-visible:ring-2 focus-visible:ring-[var(--login-primary)] focus-visible:border-[var(--login-primary)]";
  const industrialLabelClass = "text-white/70 font-semibold text-xs uppercase tracking-wider";

  return (
    <IndustrialLoginLayout
      tenantName={tenantName}
      portalLabel="User Portal"
      heroTitleLine1="Power of"
      heroTitleLine2="Meta API"
      logoUrl={loginLogoUrl}
      logoSize={loginLogoSize}
      footerExtra={
        <p className="text-center text-sm sm:text-base text-white">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={() => setLocation("/signup")}
            className="text-[var(--login-primary)] hover:underline font-semibold"
            data-testid="link-signup"
          >
            Create an account
          </button>
        </p>
      }
    >
      <div className="flex flex-col gap-6 rounded-lg border-0 shadow-none bg-transparent">
        <div className="space-y-1 pb-4">
          <h3
            className="text-2xl text-white font-black uppercase tracking-tight italic"
            data-testid="text-login-title"
          >
            {verificationEmail ? "Verify email" : "Welcome back"}
          </h3>
          <p className="text-sm text-white/50">
            {verificationEmail
              ? `Enter the 6-digit code sent to ${verificationEmail}`
              : "Enter your credentials to access your account"}
          </p>
        </div>

        {verificationEmail ? (
          <div className="space-y-4">
            <div>
              <label className={industrialLabelClass}>Verification code</label>
              <div className="relative mt-1.5">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className={`${industrialInputClass} tracking-[0.35em] text-center`}
                  data-testid="input-verification-code"
                />
              </div>
            </div>
            <Button
              type="button"
              className="w-full h-11 bg-[var(--login-primary)] hover:bg-[var(--login-primary)]/90 text-white font-semibold"
              disabled={isLoading}
              onClick={() => void onVerifyCode()}
              data-testid="button-verify-login"
            >
              {isLoading ? "Verifying..." : "Verify & Sign In"}
            </Button>
            <div className="flex items-center justify-between text-sm text-white/60">
              <button
                type="button"
                className="hover:text-white"
                disabled={isLoading}
                onClick={() => void onResendCode()}
              >
                Resend code
              </button>
              <button
                type="button"
                className="hover:text-white"
                disabled={isLoading}
                onClick={cancelVerification}
              >
                Back to login
              </button>
            </div>
          </div>
        ) : (
          <>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onPasswordLogin)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={industrialLabelClass}>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"
                            aria-hidden
                          />
                          <Input
                            type="email"
                            placeholder="name@company.com"
                            {...field}
                            data-testid="input-email"
                            className={industrialInputClass}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={industrialLabelClass}>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"
                            aria-hidden
                          />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            {...field}
                            data-testid="input-password"
                            className={`${industrialInputClass} pr-16`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-sm font-semibold text-[var(--login-primary)] hover:text-white transition-colors cursor-pointer"
                            tabIndex={-1}
                          >
                            {showPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </FormControl>
                      <div className="flex justify-end my-1">
                        <button
                          type="button"
                          onClick={() => setLocation("/forgot-password")}
                          className="text-sm sm:text-base text-white hover:text-[var(--login-primary)] transition-colors cursor-pointer outline-none focus-visible:text-[var(--login-primary)] focus-visible:underline"
                          data-testid="link-forgot-password"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-11 font-bold text-white transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--login-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808] bg-[var(--login-primary)] hover:opacity-90 rounded-sm mt-4"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? (
                    "Signing in..."
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </Form>

            <div className="relative">
              <Separator className="bg-white/10" />
              <span className="absolute left-1/2 -translate-x-1/2 -top-2 bg-[#0c0c0c] px-2 text-xs text-white/40">
                or
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 border-white/10 bg-[#111] text-white hover:bg-[#1a1a1a] hover:text-white"
              disabled={isLoading}
              data-testid="button-google-login"
              onClick={onGoogleLogin}
            >
              <GoogleIcon className="h-4 w-4 mr-2" />
              Continue with Google
            </Button>
          </>
        )}
      </div>
    </IndustrialLoginLayout>
  );
}
