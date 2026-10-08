import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

type OnboardingBillingAlert = {
  limitMinor: number | null;
  outstandingMinor: number;
  overLimit: boolean;
  billingCurrency: string | null;
};

/** `amountMinor` is smallest units (e.g. paise); display like the onboarding fees table (major units). */
function formatMajorFromMinor(minor: number, currency: string | null): string {
  const c = (currency || "INR").toUpperCase();
  const major = minor / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(major);
  } catch {
    return `${c} ${major.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export function OnboardingOutstandingBanner() {
  const { user } = useAuth();
  const { data } = useQuery<OnboardingBillingAlert>({
    queryKey: ["/api/admin/onboarding-billing-alert"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!user?.isSaaSOwner,
    retry: false,
  });

  if (!data?.overLimit) return null;

  const unpaid = formatMajorFromMinor(data.outstandingMinor, data.billingCurrency);
  const limit =
    data.limitMinor != null ? formatMajorFromMinor(data.limitMinor, data.billingCurrency) : "—";

  return (
    <div className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        <AlertTitle className="text-amber-900 dark:text-amber-100">Onboarding fees over your outstanding limit</AlertTitle>
        <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-amber-900/90 dark:text-amber-50/90">
            Unpaid onboarding fees (pending + failed, running total) are <strong>{unpaid}</strong>, at or above the
            portal outstanding limit of <strong>{limit}</strong>. Your customers can still use the panel. Pay now to
            unlock admin menus.
          </span>
          <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-600/50">
            <Link href="/admin/onboarding-fees">Open onboarding fees</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
