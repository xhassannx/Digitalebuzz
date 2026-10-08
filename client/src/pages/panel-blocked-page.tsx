import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, XCircle, CalendarOff, Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type PanelBlockedPageProps = {
  code: string;
  error: string;
  expired_at?: string;
  data_deletion_at?: string;
  retention_days?: number;
};

export default function PanelBlockedPage({
  code,
  error,
  expired_at,
  data_deletion_at,
  retention_days = 90,
}: PanelBlockedPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isExpired = code === "SUBSCRIPTION_EXPIRED";
  const isInactive = code === "ACCOUNT_INACTIVE";
  const isOutstandingLimit = code === "ONBOARDING_OUTSTANDING_LIMIT";
  const isSaaSOwner = !!user?.isSaaSOwner;

  const submitActivationRequest = async () => {
    setRequesting(true);
    try {
      const res = await fetch("/api/panel/request-account-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || body?.error || res.statusText);
      }
      toast({
        title: "Request sent",
        description: typeof body?.message === "string" ? body.message : "Your licensor has been notified.",
      });
      setNote("");
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Could not send request",
        description: e instanceof Error ? e.message : "Try again or contact your licensor directly.",
      });
    } finally {
      setRequesting(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {
      /* still clear client session */
    }
    queryClient.clear();
    window.location.href = "/login";
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
      <Card className="w-full max-w-md border border-red-200 bg-white text-slate-900 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            {isExpired ? (
              <CalendarOff className="h-7 w-7 text-red-600" />
            ) : (
              <XCircle className="h-7 w-7 text-red-600" />
            )}
          </div>
          <CardTitle className="text-2xl text-red-600">
            {isExpired
              ? "Subscription Expired"
              : isInactive
                ? "Account inactive"
                : isOutstandingLimit
                  ? "Onboarding fees due"
                  : "Access restricted"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 bg-white">
          <p className="text-center text-sm text-slate-600">
            {isExpired
              ? "Your organization's subscription has expired"
              : error}
          </p>
          <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-900 [&>svg]:text-red-600">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-red-900">
              {isExpired
                ? "Renew required"
                : isOutstandingLimit
                  ? "Payment required"
                  : "Panel access suspended"}
            </AlertTitle>
            <AlertDescription className="space-y-2 text-red-900/90">
              <p>
                {isExpired
                  ? "Your subscription has expired. Please renew or upgrade your subscription to continue using the application."
                  : error}
              </p>
              {isExpired ? (
                <p>
                  If you don&apos;t renew or upgrade your plan, your data will be deleted after{" "}
                  <strong>
                    {Math.max(1, Math.round((retention_days || 90) / 30))} month
                    {Math.round((retention_days || 90) / 30) === 1 ? "" : "s"}
                  </strong>
                  {data_deletion_at
                    ? ` (on or after ${new Date(data_deletion_at).toLocaleDateString()}).`
                    : "."}
                </p>
              ) : null}
            </AlertDescription>
          </Alert>
          {isExpired && expired_at && (
            <p className="text-sm text-center text-slate-600">
              Subscription ended on: <strong className="text-slate-900">{new Date(expired_at).toLocaleDateString()}</strong>
            </p>
          )}
          {isExpired && (
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full bg-red-600 text-white hover:bg-red-700">
                <Link href="/billing">Go to Billing</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                disabled={loggingOut}
                onClick={() => void handleLogout()}
              >
                {loggingOut ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                Log Out
              </Button>
            </div>
          )}
          {isOutstandingLimit && isSaaSOwner && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-900">Pay onboarding fees to unlock menus</p>
              <p className="text-sm text-slate-600">
                Unpaid onboarding fees have reached your outstanding limit. Your customers can still sign up and log in.
                Pay below — your admin menus unlock automatically once outstanding drops below the limit.
              </p>
              <Button asChild className="w-full bg-red-600 text-white hover:bg-red-700">
                <Link href="/admin/onboarding-fees">Open onboarding fees &amp; pay</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                disabled={loggingOut}
                onClick={() => void handleLogout()}
              >
                {loggingOut ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                Log Out
              </Button>
            </div>
          )}
          {isOutstandingLimit && !isSaaSOwner && (
            <p className="text-sm text-slate-600">
              This installation is locked because onboarding fees are over the outstanding limit. Ask your{" "}
              <strong>platform owner</strong> to open <strong>Onboarding fees</strong> and pay, then refresh.
            </p>
          )}
          {isInactive && isSaaSOwner && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-900">Pay onboarding fees</p>
              <p className="text-sm text-slate-600">
                Your licensor has stopped this whitelabel. Customer logins are blocked. Pay outstanding onboarding fees
                — after payment, customer logins start automatically.
              </p>
              <Button asChild className="w-full">
                <Link href="/admin/onboarding-fees">Open onboarding fees & pay</Link>
              </Button>
              <p className="text-sm font-medium text-slate-900 pt-2">If it does not auto-start</p>
              <p className="text-sm text-slate-600">
                Send a reactivation request to your licensor (email if configured on the server).
              </p>
              <Textarea
                placeholder="Optional message to your licensor (payment reference, etc.)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="resize-none text-sm bg-white"
              />
              <Button type="button" variant="secondary" className="w-full" disabled={requesting} onClick={submitActivationRequest}>
                {requesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Request account reactivation
              </Button>
            </div>
          )}
          {isInactive && !isSaaSOwner && (
            <p className="text-sm text-slate-600">
              This installation is inactive. Please contact your <strong>platform owner</strong> — they must pay onboarding
              fees and ask the licensor to reactivate the account before the panel works again.
            </p>
          )}
          <p className="text-center text-xs text-slate-500">
            Need help? Contact support for assistance
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
