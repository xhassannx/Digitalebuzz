// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

type SyncResult = {
  success: boolean;
  steps: { step: string; success: boolean; output?: string; error?: string }[];
  error?: string;
};

const STEP_LABELS: Record<string, string> = {
  "git stash": "Stashing changes",
  "git pull": "Fetching updates",
  "git stash pop": "Restoring changes",
  "npm install": "Installing",
  "db:push": "Database sync",
  "npm run build": "Building",
  "pm2 restart": "Restarting",
};

const STEP_ORDER = ["git stash", "git pull", "git stash pop", "npm install", "db:push", "npm run build", "pm2 restart"];

function getStepLabel(stepName: string): string {
  return STEP_LABELS[stepName] ?? stepName;
}

export default function UpdatesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncMutation = useMutation({
    mutationFn: async (): Promise<SyncResult> => {
      const res = await apiRequest("POST", "/api/updates/sync");
      const data: SyncResult = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncResult(data);
        throw new Error(data?.error || "Update failed");
      }
      return data;
    },
    onSuccess: (data) => {
      setSyncResult(data);
      setProgressPercent(100);
      queryClient.invalidateQueries({ queryKey: ["/api/updates/status"] });
    },
    onError: () => {
      setProgressPercent(100);
    },
  });

  useEffect(() => {
    if (syncMutation.isPending) {
      setProgressPercent(0);
      setSyncResult(null);
      let p = 0;
      progressInterval.current = setInterval(() => {
        p = Math.min(p + 2, 90);
        setProgressPercent(p);
      }, 800);
    }
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    };
  }, [syncMutation.isPending]);

  if (user && !user.isSaaSOwner) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardContent className="pt-0">
              <Button onClick={() => setLocation("/dashboard")} variant="outline" className="w-full">
                Go to Dashboard
              </Button>
            </CardContent>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Updates</h1>
      </div>

      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">Two-way auto sync</AlertTitle>
        <AlertDescription>
          Your customer portal (CUSTOMER_API_BASE_URL) can trigger deploy on this panel. Call{" "}
          <code className="text-xs bg-muted px-1 rounded">POST /api/updates/sync-remote</code> with header{" "}
          <code className="text-xs bg-muted px-1 rounded">X-Production-Key: PRODUCTION_KEY</code> or{" "}
          <code className="text-xs bg-muted px-1 rounded">Authorization: Bearer PRODUCTION_KEY</code>. Use{" "}
          <code className="text-xs bg-muted px-1 rounded">GET /api/updates/status-remote</code> with the same auth to read panel status.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Deploy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {(syncMutation.isPending || (syncResult && progressPercent >= 100)) && (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {syncMutation.isPending ? "In progress" : syncResult?.success ? "Completed" : "Failed"}
                </span>
                <span className="font-medium tabular-nums">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <ul className="space-y-2 text-sm">
                {STEP_ORDER.map((stepName, i) => {
                  const stepResult = syncResult?.steps?.find((s) => s.step === stepName);
                  const done = stepResult != null;
                  const success = stepResult?.success ?? null;
                  const label = getStepLabel(stepName);
                  return (
                    <li key={stepName} className="flex items-center gap-3">
                      {syncMutation.isPending && !done ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                      ) : success === true ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : success === false ? (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border-2 border-muted shrink-0" />
                      )}
                      <span className={success === false ? "text-destructive" : ""}>
                        {label}
                        {syncMutation.isPending && done && " — Done"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {!syncMutation.isPending && !syncResult && (
            <div className="py-2">
              <Button
                onClick={() => syncMutation.mutate()}
                size="lg"
                className="min-w-[140px]"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Deploy
              </Button>
            </div>
          )}

          {!syncMutation.isPending && syncResult && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => syncMutation.mutate()} size="lg" className="min-w-[140px]">
                <RefreshCw className="h-4 w-4 mr-2" />
                Deploy again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {syncResult && progressPercent >= 100 && !syncResult.success && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Update failed</AlertTitle>
          <AlertDescription asChild>
            <div className="mt-2 space-y-2">
              {syncResult.error && <p>{syncResult.error}</p>}
              <ul className="list-disc list-inside space-y-1 text-sm">
                {syncResult.steps
                  .filter((s) => !s.success)
                  .map((s, i) => (
                    <li key={i}>
                      {getStepLabel(s.step)}: {s.error || "Failed"}
                    </li>
                  ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {syncResult && progressPercent >= 100 && syncResult.success && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-200">Update completed</AlertTitle>
          <AlertDescription>Your application is now running the latest version.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
