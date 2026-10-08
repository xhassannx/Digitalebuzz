import { apiRequest, queryClient } from "@/lib/queryClient";

export type OnboardingCheckoutResult =
  | {
      gateway: "razorpay";
      orderId: string;
      amountMinor: number;
      currency: string;
      keyId: string;
      feeIds: string[];
    }
  | {
      gateway: "cashfree";
      paymentLinkUrl: string;
      linkId: string;
      amountMinor: number;
      currency: string;
      feeIds: string[];
    };

function invalidateOnboardingQueries() {
  queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-fees"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-fee-settlements"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-billing-alert"] });
  queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
  queryClient.invalidateQueries({ queryKey: ["/api/panel/customer-status"] });
}

export async function createOnboardingFeeOrder(ids: string[]): Promise<OnboardingCheckoutResult> {
  const res = await apiRequest("POST", "/api/admin/onboarding-fees/create-order", { ids });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || "Failed to start onboarding payment");
  return body as OnboardingCheckoutResult;
}

export function openOnboardingFeeCheckout(
  data: OnboardingCheckoutResult,
  opts?: {
    onPaid?: () => void;
    onVerifyError?: (message: string) => void;
    onCashfreeOpened?: () => void;
  }
): void {
  if (data.gateway === "cashfree") {
    window.open(data.paymentLinkUrl, "_blank", "noopener,noreferrer");
    invalidateOnboardingQueries();
    opts?.onCashfreeOpened?.();
    return;
  }

  const options: Record<string, unknown> = {
    key: data.keyId,
    amount: data.amountMinor,
    currency: data.currency,
    order_id: data.orderId,
    name: "Customer onboarding fee",
    description: "Pay licensor onboarding fee",
    handler: async (response: {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    }) => {
      try {
        const verifyRes = await apiRequest("POST", "/api/admin/onboarding-fees/verify", {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        const vBody = await verifyRes.json().catch(() => ({}));
        if (!verifyRes.ok) throw new Error(vBody.message || "Verification failed");
        invalidateOnboardingQueries();
        opts?.onPaid?.();
      } catch (e: unknown) {
        opts?.onVerifyError?.(e instanceof Error ? e.message : "Verification failed");
      }
    },
    theme: { color: "#0f172a" },
  };

  const open = () => {
    const RazorpayCtor = (window as Window & { Razorpay?: new (o: Record<string, unknown>) => { open: () => void } })
      .Razorpay;
    if (!RazorpayCtor) {
      opts?.onVerifyError?.("Razorpay checkout failed to load. Pay from Onboarding fees.");
      return;
    }
    new RazorpayCtor(options).open();
  };

  if (!(window as Window & { Razorpay?: unknown }).Razorpay) {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = open;
    script.onerror = () => opts?.onVerifyError?.("Could not load Razorpay. Pay from Onboarding fees.");
    document.body.appendChild(script);
  } else {
    open();
  }
}

export async function payOnboardingFeeIds(
  ids: string[],
  opts?: {
    onPaid?: () => void;
    onVerifyError?: (message: string) => void;
    onCashfreeOpened?: () => void;
  }
): Promise<OnboardingCheckoutResult> {
  const data = await createOnboardingFeeOrder(ids);
  openOnboardingFeeCheckout(data, opts);
  return data;
}
