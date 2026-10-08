import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Circle, ExternalLink } from "lucide-react";

export type OnboardingStep = {
  id: string;
  label: string;
  status: "ok" | "warn" | "manual" | "fail" | "skip";
  detail?: string;
};

export type WhatsAppOnboardingPayload = {
  wabaIds?: string[];
  businessPortfolioId?: string | null;
  phoneNumberId?: string | null;
  steps: OnboardingStep[];
  readyForMessaging?: boolean;
};

function statusIcon(status: OnboardingStep["status"]) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />;
  if (status === "fail") return <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />;
  if (status === "warn") return <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />;
  if (status === "manual") return <Circle className="h-4 w-4 text-blue-600 shrink-0" />;
  return <Circle className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function statusBadge(status: OnboardingStep["status"]) {
  const map: Record<string, string> = {
    ok: "Done",
    warn: "Check",
    manual: "Your action",
    fail: "Failed",
    skip: "Skipped",
  };
  const variant =
    status === "ok"
      ? "default"
      : status === "fail"
        ? "destructive"
        : status === "manual"
          ? "secondary"
          : "outline";
  return <Badge variant={variant as any}>{map[status] || status}</Badge>;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onboarding: WhatsAppOnboardingPayload | null;
};

export function WhatsAppOnboardingChecklistDialog({ open, onOpenChange, onboarding }: Props) {
  if (!onboarding?.steps?.length) return null;

  const manualCount = onboarding.steps.filter((s) => s.status === "manual").length;
  const failCount = onboarding.steps.filter((s) => s.status === "fail").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>WhatsApp connection checklist</DialogTitle>
          <DialogDescription>
            {onboarding.readyForMessaging
              ? "API connection looks healthy. Review any Check / Your action items below (credit-line orgs can skip Meta partner-card steps)."
              : "Some API steps need attention before sending. Fix Failed / Check items first."}
          </DialogDescription>
        </DialogHeader>

        {(onboarding.wabaIds?.length || onboarding.businessPortfolioId) && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            {onboarding.wabaIds?.length ? (
              <p>
                <span className="font-medium">WABA:</span> {onboarding.wabaIds.join(", ")}
              </p>
            ) : null}
            {onboarding.businessPortfolioId ? (
              <p>
                <span className="font-medium">Customer business ID:</span> {onboarding.businessPortfolioId}
              </p>
            ) : null}
            {onboarding.phoneNumberId ? (
              <p>
                <span className="font-medium">Phone number ID:</span> {onboarding.phoneNumberId}
              </p>
            ) : null}
          </div>
        )}

        <ul className="space-y-3">
          {onboarding.steps.map((step) => (
            <li key={step.id} className="flex gap-3 items-start text-sm">
              {statusIcon(step.status)}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{step.label}</span>
                  {statusBadge(step.status)}
                </div>
                {step.detail ? (
                  <p className="text-muted-foreground mt-1 break-words">{step.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        {(manualCount > 0 || failCount > 0) && (
          <p className="text-sm text-muted-foreground">
            In Meta Business Manager: add your tech partner under Partners, then assign your portfolio payment
            method to this WhatsApp account under Billing.
          </p>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" asChild>
            <a
              href="https://business.facebook.com/settings/whatsapp-business-accounts"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Meta billing
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </a>
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
