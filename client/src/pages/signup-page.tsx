import { useState } from "react";
import { shouldShowWhiteLabelAuthChrome, useStripLegacyWhiteLabelAuthQuery } from "@/lib/public-template";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";
import { IndustrialLoginLayout } from "@/components/auth/industrial-login-layout";
import {
  Template4AuthCard,
  Template4AuthLayout,
  template4InputStyle,
} from "@/pages/white-label/landing-page-1/components/template4-auth-layout";
import { resolveWhiteLabelWebsiteLogo } from "@/lib/white-label-logo";
import { ArrowRight, Mail, Lock, Phone, Building, User, Eye, EyeOff, ShieldCheck } from "lucide-react";

type SignupApiResponse = {
  requiresVerification?: boolean;
  email?: string;
  message?: string;
  emailSent?: boolean;
  debugCode?: string;
};

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");

  useStripLegacyWhiteLabelAuthQuery();

  const { config, organizationId, companyProfile } = useWhiteLabelConfig();
  const { logoUrl: signupLogoUrl, logoSize: signupLogoSize } = resolveWhiteLabelWebsiteLogo(config, 48);
  const tenantName = "Automate Conversations";

  const isWhiteLabelEnabled = shouldShowWhiteLabelAuthChrome(organizationId);

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

  const finishSignupLogin = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    window.location.replace("/dashboard");
  };

  const onSubmit = async (data: SignupInput) => {
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/signup", data);
      const body = (await res.json()) as SignupApiResponse;

      if (body.requiresVerification) {
        setVerificationEmail(body.email || data.email);
        setVerificationCode("");
        toast({
          title: "Check your email",
          description:
            body.message ||
            "We sent a 6-digit verification code. Enter it to finish signing up.",
          variant: body.emailSent === false ? "destructive" : "default",
        });
        if (body.debugCode) {
          console.info("[Signup] Dev verification code:", body.debugCode);
        }
        return;
      }

      toast({
        title: "Account created!",
        description: "Please log in with your email and password.",
      });
      setLocation(`/login?email=${encodeURIComponent(data.email)}`);
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onVerifyCode = async () => {
    if (!verificationEmail) return;
    const code = verificationCode.trim();
    if (!/^\d{6}$/.test(code)) {
      toast({
        title: "Invalid code",
        description: "Enter the 6-digit code from your email.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/verify-login-code", {
        email: verificationEmail,
        code,
      });
      toast({
        title: "Welcome!",
        description: "Your email is verified and you are now signed in.",
      });
      setVerificationEmail(null);
      setVerificationCode("");
      await finishSignupLogin();
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid or expired code.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onResendCode = async () => {
    if (!verificationEmail) return;
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/resend-login-code", {
        email: verificationEmail,
      });
      const body = (await res.json()) as SignupApiResponse;
      toast({
        title: "Code sent",
        description: body.message || "A new verification code was sent to your email.",
        variant: body.emailSent === false ? "destructive" : "default",
      });
      if (body.debugCode) {
        console.info("[Signup] Dev verification code:", body.debugCode);
      }
    } catch (error: any) {
      toast({
        title: "Could not resend",
        description: error.message || "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const cancelVerification = () => {
    setVerificationEmail(null);
    setVerificationCode("");
  };

  const industrialInputClass =
    "pl-10 h-11 text-white placeholder:text-white/20 transition-all outline-none bg-[#111] border-white/10 rounded-md focus-visible:ring-2 focus-visible:ring-[var(--login-primary)] focus-visible:border-[var(--login-primary)]";
  const industrialInputCompactClass =
    "h-11 text-white placeholder:text-white/20 transition-all outline-none bg-[#111] border-white/10 rounded-md px-3 focus-visible:ring-2 focus-visible:ring-[var(--login-primary)] focus-visible:border-[var(--login-primary)]";
  const industrialLabelClass =
    "text-white/70 font-semibold text-xs uppercase tracking-wider";

  // Template 4: white-label marketing auth chrome
  if (isWhiteLabelEnabled) {
    const brandName = (companyProfile?.name as string) || "YourBrand";
    const accentColor =
      (config?.theme as { websiteThemeColor?: string } | undefined)?.websiteThemeColor || "#16a34a";

    return (
      <Template4AuthLayout brandName={brandName} accentColor={accentColor} maxWidth={480}>
        <Template4AuthCard
          title={verificationEmail ? "Verify email" : "Sign Up"}
          description={
            verificationEmail
              ? `Enter the 6-digit code sent to ${verificationEmail}`
              : "Fill in your details to create your account"
          }
          titleTestId="text-signup-title"
          footer={
            !verificationEmail ? (
              <p style={{ fontSize: 14, color: "var(--lp-text-2)", margin: 0 }}>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  style={{
                    color: accentColor,
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                  data-testid="link-login"
                >
                  Log in
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
                verify your email and finish signing up.
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
                data-testid="button-verify-signup"
              >
                {isLoading ? "Verifying..." : "Verify & Continue"}
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
                  Back to sign up
                </button>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="John"
                              {...field}
                              data-testid="input-first-name"
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
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Doe"
                              {...field}
                              data-testid="input-last-name"
                              className="pl-10"
                              style={template4InputStyle}
                            />
                          </div>
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
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="tel"
                            placeholder="+91 9876543210"
                            {...field}
                            data-testid="input-phone"
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="john@example.com"
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
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
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
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
                        <div className="relative">
                          <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="My Company"
                            {...field}
                            data-testid="input-organization-name"
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
                  style={{
                    width: "100%",
                    height: 48,
                    fontSize: 15,
                    borderRadius: 10,
                    background: accentColor,
                  }}
                  disabled={isLoading}
                  data-testid="button-signup"
                >
                  {isLoading ? (
                    "Creating account..."
                  ) : (
                    <>
                      Sign Up
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
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
      loginCardLabel={verificationEmail ? "Email Verification" : "User Sign Up"}
      panelStatusText={verificationEmail ? "Awaiting Verification" : "Awaiting Registration"}
      panelHeading={verificationEmail ? "Verify Email" : "Create Account"}
      logoUrl={signupLogoUrl}
      logoSize={signupLogoSize}
      fullPageScroll
      footerExtra={
        verificationEmail ? null : (
          <p className="text-center text-sm sm:text-base text-white">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setLocation("/login")}
              className="text-[var(--login-primary)] hover:underline font-semibold"
              data-testid="link-login"
            >
              Log in
            </button>
          </p>
        )
      }
    >
      <div className="flex flex-col gap-5 rounded-lg border-0 shadow-none bg-transparent">
        <div className="space-y-1 pb-2">
          <h3
            className="text-2xl text-white font-black uppercase tracking-tight italic"
            data-testid="text-signup-title"
          >
            {verificationEmail ? "Verify your email" : "Create your account"}
          </h3>
          <p className="text-sm text-white/50">
            {verificationEmail
              ? "Enter the code from your email to finish signing up"
              : "Sign up to start using WhatsApp SaaS platform"}
          </p>
        </div>

        {verificationEmail ? (
          <div className="space-y-4">
            <p className="text-sm text-white/60">
              We sent a 6-digit code to{" "}
              <span className="font-medium text-white">{verificationEmail}</span>. Enter it to verify
              your email and get signed in.
            </p>
            <div>
              <label className={industrialLabelClass}>Verification code</label>
              <div className="relative mt-1.5">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className={`${industrialInputClass} tracking-[0.35em] text-center font-semibold`}
                  data-testid="input-verification-code"
                />
              </div>
            </div>
            <Button
              type="button"
              className="w-full h-11 font-bold text-white bg-[var(--login-primary)] hover:opacity-90 rounded-sm"
              disabled={isLoading}
              onClick={() => void onVerifyCode()}
              data-testid="button-verify-signup"
            >
              {isLoading ? "Verifying..." : "Verify & Continue"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-[var(--login-primary)] hover:underline font-semibold"
                disabled={isLoading}
                onClick={() => void onResendCode()}
              >
                Resend code
              </button>
              <button
                type="button"
                className="text-white/50 hover:text-white hover:underline"
                disabled={isLoading}
                onClick={cancelVerification}
              >
                Back to sign up
              </button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={industrialLabelClass}>First Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John"
                          {...field}
                          data-testid="input-first-name"
                          className={industrialInputCompactClass}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={industrialLabelClass}>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Doe"
                          {...field}
                          data-testid="input-last-name"
                          className={industrialInputCompactClass}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={industrialLabelClass}>Mobile Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"
                          aria-hidden
                        />
                        <Input
                          type="tel"
                          placeholder="+91 9876543210"
                          {...field}
                          data-testid="input-phone"
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
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="organizationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={industrialLabelClass}>Organization Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Building
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"
                          aria-hidden
                        />
                        <Input
                          placeholder="My Company"
                          {...field}
                          data-testid="input-organization-name"
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
                className="w-full h-11 font-bold text-white transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--login-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808] bg-[var(--login-primary)] hover:opacity-90 rounded-sm mt-2"
                disabled={isLoading}
                data-testid="button-signup"
              >
                {isLoading ? (
                  "Creating account..."
                ) : (
                  <>
                    Sign up
                    <ArrowRight className="h-4 w-4" />
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
