"use client";

import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

type PayPayload = {
  status: string;
  currency: string;
  amount: number;
  amountDisplay: string;
  description: string | null;
  payUrl: string | null;
  panelUrl: string | null;
  gatewayPaymentId?: string | null;
};

export default function PayLinkPage() {
  const [, params] = useRoute("/pay/:token");
  const token = params?.token;
  const [data, setData] = useState<PayPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("Invalid link");
      return;
    }
    let cancelled = false;
    const qs = typeof window !== "undefined" ? window.location.search : "";
    fetch(`/api/public/pay/${encodeURIComponent(token)}${qs}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (!ok) {
          setError(typeof j.message === "string" ? j.message : "Could not load payment");
        } else {
          setData(j as PayPayload);
          const paid = (j as PayPayload).status === "paid";
          if (paid && typeof window !== "undefined" && window.location.search) {
            window.history.replaceState({}, "", `/pay/${encodeURIComponent(token)}`);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError("Network error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="rounded-xl border bg-card p-8 max-w-md text-center shadow-sm">
          <XCircle className="h-12 w-12 mx-auto text-destructive mb-3" />
          <p className="font-semibold">{error || "Something went wrong"}</p>
        </div>
      </div>
    );
  }

  const paid = data.status === "paid";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="rounded-xl border bg-card p-8 max-w-md w-full shadow-sm space-y-4">
        {paid ? (
          <>
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
            <h1 className="text-xl font-bold text-center">Payment received</h1>
            <p className="text-center text-muted-foreground">Thank you. {data.amountDisplay}</p>
            {data.gatewayPaymentId ? (
              <p className="text-sm text-center font-mono text-muted-foreground break-all">
                Transaction ID: {data.gatewayPaymentId}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-center">Complete payment</h1>
            {data.description ? (
              <p className="text-sm text-center text-muted-foreground">{data.description}</p>
            ) : null}
            <p className="text-2xl font-bold text-center">{data.amountDisplay}</p>
            {data.payUrl ? (
              <Button asChild className="w-full" size="lg">
                <a href={data.payUrl} target="_blank" rel="noopener noreferrer">
                  Pay securely
                </a>
              </Button>
            ) : (
              <p className="text-sm text-center text-destructive">Payment link unavailable.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
