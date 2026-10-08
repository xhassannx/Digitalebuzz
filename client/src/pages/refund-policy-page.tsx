import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarketingSiteHeader } from "@/components/marketing-site-header";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing-layout";
import {
  Ban,
  Banknote,
  Headphones,
  RotateCcw,
  ShieldCheck,
  Wrench,
} from "lucide-react";

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <MarketingSiteHeader />

      <div className="relative overflow-hidden border-b bg-gradient-to-br from-sky-500/12 via-background to-emerald-500/10 dark:from-sky-500/15 dark:via-background dark:to-emerald-500/12">
        <div
          className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-500/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10"
          aria-hidden
        />
        <div className={`${MARKETING_PAGE_SHELL} py-14 lg:py-16`}>
          <div className="mx-auto grid w-full min-w-0 max-w-4xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-10 lg:justify-items-center xl:max-w-5xl xl:gap-12">
            <div className="order-2 w-full min-w-0 max-w-lg justify-self-center space-y-4 lg:order-1 lg:justify-self-end lg:text-left">
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                aria-hidden
              >
                <RotateCcw className="h-5 w-5" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Refund Policy
              </h1>
              <p className="text-lg text-muted-foreground">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="order-1 flex w-full min-w-0 max-w-sm justify-center justify-self-center lg:order-2 lg:max-w-md lg:justify-self-start">
              <img
                src="/refund-hero.png"
                alt=""
                className="h-auto w-full max-h-[min(28rem,70vh)] rounded-2xl border border-sky-500/20 bg-card/40 object-contain object-center shadow-xl ring-1 ring-black/5 dark:ring-white/10"
              />
            </div>
          </div>
        </div>
      </div>

      <div className={`${MARKETING_PAGE_SHELL} py-12`}>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-sky-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                <ShieldCheck className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">
                Refund Policy – WhatsApp API White Label Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                At Helicoptic Solutions, we strive to deliver high-quality
                WhatsApp API white label solutions and ensure customer
                satisfaction. This Refund Policy outlines the conditions under
                which refunds may be granted.
              </p>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <Banknote className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">1. Eligibility for Refund</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Refunds are applicable under the following conditions:
              </p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-emerald-500">
                <li>A refund request is made within 3 days of purchase, or</li>
                <li>The white label setup process has not yet started.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <Wrench className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">
                2. Technical Issues &amp; Feature Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                If any promised feature is not functioning as committed, our
                first priority will always be to identify and resolve the
                issue.
              </p>
              <p>
                We will actively work to fix the problem as soon as it is
                reported, with resolution time depending on the nature and
                complexity of the issue.
              </p>
              <p>
                If we are unable to resolve the issue within a reasonable
                timeframe based on the problem, you will be eligible for a full
                refund.
              </p>
            </CardContent>
          </Card>

          <Card className="border-rose-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                <Ban className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">3. Non-Refundable Situations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Refunds will not be provided in the following cases:
              </p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-rose-500">
                <li>
                  If the white label setup process has already been completed.
                </li>
                <li>
                  If the issue arises due to third-party restrictions, policy
                  changes, or user-side misconfigurations.
                </li>
                <li>
                  If the refund request is made after the 3-day of purchase.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <RotateCcw className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">4. Refund Process</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                Approved refunds will be processed within 15 business days.
              </p>
              <p>
                The refund will be issued through the original payment method
                used at the time of purchase.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-gradient-to-br from-sky-500/5 via-card to-emerald-500/5 shadow-md backdrop-blur-sm md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Headphones className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">
                5. Contact for Refund Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                To request a refund or report an issue, please contact our
                support team at:
              </p>
              <p>
                <a
                  href="mailto:info@helicopticsolutions.com"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  info@helicopticsolutions.com
                </a>
                <br />
                <a
                  href="tel:+917011772828"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  +91-7011772828
                </a>
              </p>
              <p>
                We are committed to providing reliable services and will always
                prioritize resolving your concerns before initiating a refund.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
