import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { LoginInput } from "@shared/schema";

type LoginApiResponse = {
  requiresVerification?: boolean;
  email?: string;
  message?: string;
  debugCode?: string;
  user?: { id: string; email?: string };
};

export function useLoginWithVerification() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");

  const finishLoginRedirect = () => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    const safeRedirect =
      redirect && redirect.startsWith("/") && !redirect.startsWith("//") && redirect !== "/"
        ? redirect
        : "/dashboard";
    window.location.replace(safeRedirect);
  };

  const onPasswordLogin = async (data: LoginInput) => {
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", data);
      const body = (await res.json()) as LoginApiResponse;

      if (body.requiresVerification) {
        setVerificationEmail(body.email || data.email);
        setVerificationCode("");
        toast({
          title: "Verification required",
          description:
            body.message ||
            "We sent a verification code to your email. Enter it to finish signing in.",
        });
        if (body.debugCode) {
          console.info("[Login] Dev verification code:", body.debugCode);
        }
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      finishLoginRedirect();
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password.",
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
        title: "Email verified",
        description: "You are now signed in.",
      });
      setVerificationEmail(null);
      setVerificationCode("");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      finishLoginRedirect();
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
      const body = (await res.json()) as LoginApiResponse;
      toast({
        title: "Code sent",
        description: body.message || "A new verification code was sent to your email.",
      });
      if (body.debugCode) {
        console.info("[Login] Dev verification code:", body.debugCode);
      }
    } catch (error: any) {
      toast({
        title: "Could not resend",
        description: error.message || "Please try logging in again.",
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

  return {
    isLoading,
    verificationEmail,
    verificationCode,
    setVerificationCode,
    onPasswordLogin,
    onVerifyCode,
    onResendCode,
    cancelVerification,
    setLocation,
  };
}
