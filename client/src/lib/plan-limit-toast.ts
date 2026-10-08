/**
 * Shared helper for plan-limit / upgrade-required API errors.
 */
export function getUpgradeRequiredMessage(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error || "");
  const lower = msg.toLowerCase();
  if (
    lower.includes("upgrade") ||
    lower.includes("limit reached") ||
    lower.includes("limit exceeded") ||
    lower.includes("no active subscription") ||
    lower.includes("subscription is missing or expired") ||
    lower.includes("upgrade your plan")
  ) {
    return msg.replace(/^\d+:\s*/, "").trim() || msg;
  }
  return null;
}

export function toastPlanLimitOrError(
  toast: (opts: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void,
  error: unknown,
  fallbackTitle = "Error",
) {
  const upgradeMsg = getUpgradeRequiredMessage(error);
  if (upgradeMsg) {
    toast({
      title: "Plan limit reached",
      description: `${upgradeMsg} Go to Billing to upgrade your plan.`,
      variant: "destructive",
    });
    return true;
  }
  toast({
    title: fallbackTitle,
    description: error instanceof Error ? error.message : "Something went wrong",
    variant: "destructive",
  });
  return false;
}
