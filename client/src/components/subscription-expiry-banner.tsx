import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";
import { resolveApiUrl } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import "./subscription-expiry-banner.css";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type ExpiryBannerResponse = {
  currentPeriodEnd?: string | null;
  accessActive?: boolean;
};

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

function clearBannerLayoutOffset() {
  document.documentElement.removeAttribute("data-subscription-expiry-banner");
  document.documentElement.style.removeProperty("--subscription-expiry-banner-h");
}

/** Matches reference: "01 days 21:18:47" */
export function formatSubscriptionCountdown(msRemaining: number): string {
  const totalSec = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${pad2(days)} days ${pad2(hours)}:${pad2(mins)}:${pad2(secs)}`;
}

/**
 * Full-width red countdown bar above the panel header / sidebar logo.
 * Visible when the active plan period ends within 7 days.
 */
export function SubscriptionExpiryBanner() {
  const { isAuthenticated } = useAuth();
  const bannerRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  const { data } = useQuery<ExpiryBannerResponse>({
    queryKey: ["/api/subscriptions/expiry-banner"],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl("/api/subscriptions/expiry-banner"), {
        credentials: "include",
      });
      if (!res.ok) return { currentPeriodEnd: null, accessActive: false };
      return res.json();
    },
    enabled: !!isAuthenticated,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
  });

  const periodEndMs = useMemo(() => {
    if (!data?.currentPeriodEnd) return null;
    const t = new Date(data.currentPeriodEnd).getTime();
    return Number.isNaN(t) ? null : t;
  }, [data?.currentPeriodEnd]);

  const msRemaining = periodEndMs == null ? null : periodEndMs - now;
  const showBanner =
    msRemaining != null &&
    msRemaining > 0 &&
    msRemaining <= SEVEN_DAYS_MS &&
    data?.accessActive !== false;

  useEffect(() => {
    if (!showBanner) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [showBanner]);

  // Push fixed sidebar below this bar so logo / site name stay visible
  useEffect(() => {
    if (!showBanner) {
      clearBannerLayoutOffset();
      return;
    }

    const el = bannerRef.current;
    const apply = () => {
      const h = el?.offsetHeight ?? 0;
      document.documentElement.setAttribute("data-subscription-expiry-banner", "1");
      document.documentElement.style.setProperty("--subscription-expiry-banner-h", `${h}px`);
    };

    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    if (el && ro) ro.observe(el);
    window.addEventListener("resize", apply);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
      clearBannerLayoutOffset();
    };
  }, [showBanner]);

  if (!showBanner || msRemaining == null) return null;

  return (
    <div
      ref={bannerRef}
      className={cn(
        "subscription-expiry-banner sticky top-0 shrink-0 z-[60] flex w-full items-center justify-center gap-3",
        "bg-[#e11d48] px-3 py-2 text-white shadow-sm",
      )}
      role="status"
      aria-live="polite"
      data-testid="banner-subscription-expiry"
    >
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-white" aria-hidden />
        <p className="text-center text-sm font-medium tracking-wide text-white">
          Your subscription ends in {formatSubscriptionCountdown(msRemaining)}
        </p>
        <Link
          href="/billing"
          className="inline-flex h-7 shrink-0 items-center justify-center rounded-full bg-white px-3.5 text-xs font-bold text-slate-900 shadow-sm hover:bg-slate-100"
          data-testid="link-choose-plan-banner"
        >
          Choose plan
        </Link>
      </div>
    </div>
  );
}
