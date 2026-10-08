import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";
import { WhiteLabelHeader } from "./components/header";
import { useLoginWithVerification } from "@/features/auth/useLoginWithVerification";

export default function WhiteLabelLoginPage() {
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
    if (emailFromQuery) form.setValue("email", emailFromQuery);
  }, [emailFromQuery, form]);

  const onGoogleLogin = () => {
    window.location.href = "/api/auth/google/authorize?redirectTo=/";
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(to top, rgba(48,207,208,0.1), rgba(51,8,103,0.1))' }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(48,207,208,0.15),transparent_50%)] animate-pulse" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(51,8,103,0.15),transparent_50%)] animate-pulse" style={{ animationDelay: '1s' }} />
      
      <div className="absolute top-20 left-10 w-96 h-96 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 animate-float" style={{ background: '#30cfd0' }} />
      <div className="absolute top-40 right-10 w-96 h-96 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 animate-float" style={{ background: '#330867', animationDelay: '2s' }} />

      <WhiteLabelHeader />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 relative z-10">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8 animate-fade-in-up">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 shadow-lg animate-pulse-glow" style={{ background: 'linear-gradient(to bottom right, #30cfd0, #330867)' }}>
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">
              <span 
                className="bg-clip-text text-transparent"
                style={{ 
                  background: 'linear-gradient(to right, #30cfd0, #330867)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {verificationEmail ? "Verify email" : "Welcome Back"}
              </span>
            </h1>
            <p className="text-muted-foreground">
              {verificationEmail
                ? `Enter the code sent to ${verificationEmail}`
                : "Log in to your account to continue"}
            </p>
          </div>

          <Card className="border-2 shadow-2xl" style={{ borderColor: 'rgba(48,207,208,0.3)' }}>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl" style={{ color: '#330867' }}>
                {verificationEmail ? "Email verification" : "Sign In"}
              </CardTitle>
              <CardDescription>
                {verificationEmail
                  ? "First-time login requires email verification"
                  : "Enter your credentials to access your account"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {verificationEmail ? (
                <div className="space-y-4">
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="h-11 pl-10 tracking-[0.3em] text-center font-semibold"
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full h-12"
                    style={{ background: 'linear-gradient(to right, #30cfd0, #330867)' }}
                    disabled={isLoading}
                    onClick={() => void onVerifyCode()}
                  >
                    {isLoading ? "Verifying..." : "Verify & Sign In"}
                  </Button>
                  <div className="flex justify-between text-sm">
                    <button type="button" style={{ color: '#30cfd0' }} disabled={isLoading} onClick={() => void onResendCode()}>
                      Resend code
                    </button>
                    <button type="button" className="text-muted-foreground" disabled={isLoading} onClick={cancelVerification}>
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
                            <FormLabel>Email address</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <Input type="email" placeholder="you@example.com" {...field} className="h-11 pl-10" />
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
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <Input
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Enter your password"
                                  {...field}
                                  className="h-11 pl-10"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full h-12"
                        style={{ background: 'linear-gradient(to right, #30cfd0, #330867)' }}
                        disabled={isLoading}
                      >
                        {isLoading ? "Logging in..." : <>Log In <ArrowRight className="ml-2 w-5 h-5" /></>}
                      </Button>
                    </form>
                  </Form>
                  <div className="mt-4 relative">
                    <Separator />
                    <span className="absolute left-1/2 -translate-x-1/2 -top-2 bg-background px-2 text-xs text-muted-foreground">or</span>
                  </div>
                  <Button type="button" variant="outline" className="w-full h-12 mt-4" disabled={isLoading} onClick={onGoogleLogin}>
                    Continue with Google
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <button type="button" onClick={() => setLocation("/signup")} className="font-medium hover:underline" style={{ color: '#30cfd0' }}>
                Create an account
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
