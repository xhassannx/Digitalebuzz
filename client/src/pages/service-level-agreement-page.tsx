import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarketingSiteHeader } from "@/components/marketing-site-header";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing-layout";
import {
  AlertTriangle,
  Clock,
  Handshake,
  Headphones,
  Info,
  Lightbulb,
  Mail,
  MessageSquareWarning,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";

export default function ServiceLevelAgreementPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <MarketingSiteHeader />

      <div className="relative overflow-hidden border-b bg-gradient-to-br from-emerald-500/12 via-background to-teal-500/10 dark:from-emerald-500/15 dark:via-background dark:to-teal-500/12">
        <div
          className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-teal-400/15 blur-3xl dark:bg-teal-500/10"
          aria-hidden
        />
        <div className={`${MARKETING_PAGE_SHELL} py-14 lg:py-16`}>
          <div className="mx-auto grid w-full min-w-0 max-w-4xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-10 lg:justify-items-center xl:max-w-5xl xl:gap-12">
            <div className="order-2 w-full min-w-0 max-w-lg justify-self-center space-y-4 lg:order-1 lg:justify-self-end lg:text-left">
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                aria-hidden
              >
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Service Level Agreement
              </h1>
              <p className="text-lg text-muted-foreground">
                Helicoptic Solutions – Customer Support &amp; Issue Resolution
                Policy
              </p>
              <p className="text-muted-foreground">
                Effective Date: 25th June 2026
              </p>
            </div>
            <div className="order-1 flex w-full min-w-0 max-w-sm justify-center justify-self-center lg:order-2 lg:max-w-md lg:justify-self-start">
              <img
                src="/terms-hero.png"
                alt=""
                className="h-auto w-full max-h-[min(28rem,70vh)] rounded-2xl border border-emerald-500/20 bg-card/40 object-contain object-center shadow-xl ring-1 ring-black/5 dark:ring-white/10"
              />
            </div>
          </div>
        </div>
      </div>

      <div className={`${MARKETING_PAGE_SHELL} py-12`}>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-emerald-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <Handshake className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">Our Commitment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                At Helicoptic Solutions, we are committed to providing reliable
                support and timely issue resolution for all our customers.
              </p>
              <p>
                To ensure transparency and efficient support, every technical
                request, complaint, or service request is handled according to
                the Service Level Agreement (SLA) mentioned below.
              </p>
            </CardContent>
          </Card>

          <Card className="border-teal-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                <Ticket className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">
                How to Raise a Support Request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Customers can raise a support request through any of the
                following channels:
              </p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-teal-500">
                <li>Support Ticket Portal</li>
                <li>WhatsApp Support</li>
                <li>Email Support</li>
                <li>Customer Dashboard</li>
                <li>Live Chat (if available)</li>
              </ul>
              <p className="text-muted-foreground">
                After your request is received, a ticket will be created and
                assigned to our technical team. Each ticket receives a unique
                Ticket ID for tracking.
              </p>
            </CardContent>
          </Card>

          <Card className="border-rose-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                <AlertTriangle className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">
                Issue Priority Levels – Priority 1 (Critical)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Examples:</p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-rose-500">
                <li>Complete server outage</li>
                <li>Application inaccessible</li>
                <li>Login system completely down</li>
                <li>API not working for all users</li>
                <li>Data loss affecting multiple users</li>
              </ul>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  First Response Time:
                </span>{" "}
                Within 1 Hour
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  Estimated Resolution Time:
                </span>{" "}
                4–8 Business Hours
              </p>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <MessageSquareWarning className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">
                Issue Priority Levels – Priority 2 (High)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Examples:</p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-amber-500">
                <li>Important feature not working</li>
                <li>WhatsApp API integration issue</li>
                <li>Embedded Signup issue</li>
                <li>Payment integration issue</li>
                <li>CRM functionality affected</li>
              </ul>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  First Response Time:
                </span>{" "}
                Within 2 Business Hours
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  Estimated Resolution Time:
                </span>{" "}
                8–24 Business Hours
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <Info className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">
                Issue Priority Levels – Priority 3 (Medium)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Examples:</p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-blue-500">
                <li>Minor feature malfunction</li>
                <li>Automation issue</li>
                <li>Report issue</li>
                <li>Template-related issue</li>
                <li>User management issue</li>
              </ul>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  First Response Time:
                </span>{" "}
                Within 4 Business Hours
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  Estimated Resolution Time:
                </span>{" "}
                1–3 Business Days
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-500/15 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400">
                <Lightbulb className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">
                Issue Priority Levels – Priority 4 (Low)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Examples:</p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-slate-500">
                <li>UI improvements</li>
                <li>Feature requests</li>
                <li>Cosmetic issues</li>
                <li>Documentation requests</li>
                <li>Enhancement suggestions</li>
              </ul>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  First Response Time:
                </span>{" "}
                Within 1 Business Day
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  Estimated Resolution Time:
                </span>{" "}
                3–10 Business Days (depending on complexity)
              </p>
            </CardContent>
          </Card>

          <Card className="border-violet-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                <Clock className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">Support Working Hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">
                  Monday – Friday
                </span>
              </p>
              <p>11:00 AM – 7:00 PM (IST)</p>
              <p>
                Support requests received outside business hours will be
                processed on the next working day.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sky-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                <Info className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">Resolution Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>Please note that every issue is different.</p>
              <p>The actual resolution time depends on:</p>
              <ul className="list-disc space-y-2 pl-5 marker:text-sky-500">
                <li>Issue complexity</li>
                <li>
                  Third-party dependencies (Meta, Google, Payment Gateway,
                  Hosting, etc.)
                </li>
                <li>Reproducibility of the issue</li>
                <li>Availability of required information</li>
                <li>Server or infrastructure conditions</li>
              </ul>
              <p>
                Our team will always share the expected resolution timeline after
                reviewing your ticket.
              </p>
            </CardContent>
          </Card>

          <Card className="border-indigo-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                <Lightbulb className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">Feature Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                New features, enhancements, custom developments, or product
                improvements are not covered under standard technical support.
              </p>
              <p>
                Such requests will be reviewed separately and may require
                additional development time or charges.
              </p>
            </CardContent>
          </Card>

          <Card className="border-teal-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                <Users className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">Customer Responsibilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                To help us resolve your issue faster, please provide:
              </p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-teal-500">
                <li>Ticket ID</li>
                <li>Detailed issue description</li>
                <li>Screenshots or screen recordings</li>
                <li>Error messages (if any)</li>
                <li>Steps to reproduce the issue</li>
                <li>Browser/device information (if applicable)</li>
              </ul>
              <p className="text-muted-foreground">
                Incomplete information may delay the resolution process.
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                <AlertTriangle className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">Third-Party Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Some services depend on external platforms, including:
              </p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-orange-500">
                <li>Meta (WhatsApp Cloud API)</li>
                <li>Google APIs</li>
                <li>Payment Gateways</li>
                <li>Cloud Hosting Providers</li>
                <li>Domain &amp; DNS Providers</li>
              </ul>
              <p className="text-muted-foreground">
                Delays caused by third-party providers are outside the direct
                control of Helicoptic Solutions. We will coordinate with the
                respective provider wherever applicable.
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <Headphones className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">
                Communication During Resolution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                For every active ticket, our support team will provide:
              </p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-blue-500">
                <li>Ticket acknowledgment</li>
                <li>Issue priority</li>
                <li>Estimated resolution timeline</li>
                <li>Progress updates (when required)</li>
                <li>Resolution confirmation</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <Info className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">Important Notice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                While we strive to resolve issues as quickly as possible, instant
                resolution cannot be guaranteed for every request.
              </p>
              <p>
                Some issues require investigation, testing, coordination with
                third-party services, or product updates.
              </p>
              <p>
                We appreciate your patience and cooperation during the resolution
                process.
              </p>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <Handshake className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">Our Commitment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                At Helicoptic Solutions, our goal is to provide:
              </p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-emerald-500">
                <li>Professional Support</li>
                <li>Transparent Communication</li>
                <li>Timely Resolution</li>
                <li>Reliable Service</li>
                <li>Continuous Product Improvement</li>
              </ul>
              <p className="text-muted-foreground">
                Your satisfaction remains our highest priority.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-gradient-to-br from-emerald-500/5 via-card to-teal-500/5 shadow-md backdrop-blur-sm md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Mail className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">Contact Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p className="font-medium text-foreground">Helicoptic Solutions</p>
              <p>
                Email:{" "}
                <a
                  href="mailto:info@helicopticsolutions.com"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  info@helicopticsolutions.com
                </a>
              </p>
              <p>
                Phone:{" "}
                <a
                  href="tel:+917011772828"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  +91 7011772828
                </a>
              </p>
              <p>Support Hours: Monday–Friday | 11:00 AM – 7:00 PM (IST)</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
