// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  publicSubscriptionCheckoutSchema,
  type PublicSubscriptionCheckoutInput,
  type Plan,
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type BillingOptions = { razorpay: boolean; stripe: boolean };

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
}

export function usePublicSubscriptionCheckout(accentColor = "#16a34a") {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [submitting, setSubmitting] = useState(false);

  const queryString = useMemo(() => (location.includes("?") ? location.split("?")[1] : ""), [location]);
  const paymentStatus = useMemo(() => new URLSearchParams(queryString).get("payment"), [queryString]);

  useEffect(() => {
    if (paymentStatus === "success") {
      toast({
        title: "Payment received",
        description: "Your subscription will activate shortly. Sign in with your email and password to use the panel.",
      });
    }
    if (paymentStatus === "cancelled") {
      toast({
        title: "Checkout cancelled",
        description: "No charge was made. You can try again when ready.",
        variant: "destructive",
      });
    }
  }, [paymentStatus, toast]);

  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/public/plans"],
    queryFn: async () => {
      const res = await fetch("/api/public/plans");
      if (!res.ok) throw new Error("Failed to load plans");
      return res.json();
    },
  });

  const { data: billingOptions, isLoading: billingLoading } = useQuery<BillingOptions>({
    queryKey: ["/api/public/subscription-billing-options"],
    queryFn: async () => {
      const res = await fetch("/api/public/subscription-billing-options");
      if (!res.ok) return { razorpay: false, stripe: false };
      return res.json();
    },
  });

  const paidPlans = useMemo(
    () => plans.filter((p) => p.priceMonthly > 0 || p.priceQuarterly > 0 || p.priceYearly > 0),
    [plans],
  );

  const form = useForm<PublicSubscriptionCheckoutInput>({
    resolver: zodResolver(publicSubscriptionCheckoutSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      organizationName: "",
      phone: "",
      planId: "",
      billingCycle: "monthly",
      paymentGateway: "razorpay",
    },
  });

  useEffect(() => {
    if (paidPlans.length && !form.getValues("planId")) {
      form.setValue("planId", paidPlans[0].id);
    }
  }, [paidPlans, form]);

  useEffect(() => {
    if (billingOptions?.razorpay && !billingOptions?.stripe) {
      form.setValue("paymentGateway", "razorpay");
    } else if (!billingOptions?.razorpay && billingOptions?.stripe) {
      form.setValue("paymentGateway", "stripe");
    }
  }, [billingOptions, form]);

  const openRazorpayAndVerify = async (checkout: Record<string, unknown>, planLabel: string) => {
    await loadRazorpayScript();
    if (!window.Razorpay) throw new Error("Razorpay failed to load");

    const keyId = checkout.keyId as string;
    const verifyUrl = "/api/public/verify-razorpay-subscription";

    const runVerify = async (body: Record<string, string | undefined>) => {
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err?.error || err?.message || "Verification failed");
      }
    };

    if (checkout.subscription && typeof (checkout.subscription as { id?: string }).id === "string") {
      const sub = checkout.subscription as { id: string };
      const options = {
        key: keyId,
        subscription_id: sub.id,
        name: planLabel,
        description: "Subscription",
        handler: async (response: Record<string, string>) => {
          try {
            await runVerify({
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast({
              title: "Subscription activated",
              description: "Sign in with your email and password to open the panel.",
            });
            setLocation("/login");
          } catch (e: unknown) {
            toast({
              variant: "destructive",
              title: "Verification failed",
              description: e instanceof Error ? e.message : "Try again or contact support.",
            });
          }
        },
        theme: { color: accentColor },
      };
      new window.Razorpay!(options).open();
      return;
    }

    if (checkout.order && typeof (checkout.order as { id?: string }).id === "string") {
      const order = checkout.order as { id: string; amount: number; currency: string };
      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: planLabel,
        description: "Subscription",
        handler: async (response: Record<string, string>) => {
          try {
            await runVerify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast({
              title: "Payment successful",
              description: "Sign in with your email and password to open the panel.",
            });
            setLocation("/login");
          } catch (e: unknown) {
            toast({
              variant: "destructive",
              title: "Verification failed",
              description: e instanceof Error ? e.message : "Try again or contact support.",
            });
          }
        },
        theme: { color: accentColor },
      };
      new window.Razorpay!(options).open();
      return;
    }

    throw new Error("Unexpected Razorpay checkout response");
  };

  const onSubmit = async (values: PublicSubscriptionCheckoutInput) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/subscription-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.error || res.statusText);
      }

      if (data.requiresPayment === false) {
        toast({
          title: "Plan activated",
          description: "Sign in with your email and password to open the panel.",
        });
        setLocation("/login");
        return;
      }

      if (values.paymentGateway === "stripe" && typeof data.url === "string") {
        window.location.href = data.url;
        return;
      }

      if (values.paymentGateway === "razorpay") {
        const plan = paidPlans.find((p) => p.id === values.planId);
        await openRazorpayAndVerify(data, plan?.displayName || "Subscription");
        return;
      }
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Checkout failed",
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    const sym = currency === "INR" ? "₹" : "$";
    return `${sym}${(cents / 100).toFixed(2)}`;
  };

  const noGateway = billingOptions && !billingOptions.razorpay && !billingOptions.stripe;

  return {
    form,
    submitting,
    plansLoading,
    billingLoading,
    paidPlans,
    billingOptions,
    noGateway,
    onSubmit,
    formatPrice,
  };
}
