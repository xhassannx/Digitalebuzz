import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { queryClient } from "@/lib/queryClient";

/**
 * Lets the licensor / source provider sign in as the installation SaaS owner using PRODUCTION_KEY
 * (same secret the customer portal uses for this instance). See docs/LICENSOR_REMOTE_API.md.
 */
export default function LicensorAccessPage() {
  const [, setLocation] = useLocation();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/remote/admin-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Production-Key": key.trim(),
        },
        credentials: "include",
        body: JSON.stringify({ redirect: "/admin/onboarding-fees" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || body.message || res.statusText);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      const path = typeof body.suggested_redirect === "string" ? body.suggested_redirect : "/admin";
      setLocation(path.startsWith("/") ? path : `/${path}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Licensor access</CardTitle>
          <CardDescription>
            For the source-code / licensor team only. Enter the installation production key (same value as{" "}
            <code className="text-xs">PRODUCTION_KEY</code> for this whitelabel). You are signed in as the platform SaaS
            owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {err ? (
              <Alert variant="destructive">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="licensor-pk">Production key</Label>
              <Input
                id="licensor-pk"
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="From env / customer portal"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || !key.trim()}>
              {busy ? "Signing in…" : "Sign in as platform admin"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/** When already logged in, /licensor-access is unnecessary — send to admin. */
export function LicensorAccessRedirectIfAuthed() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/admin/onboarding-fees");
  }, [setLocation]);
  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">Redirecting…</div>
  );
}
