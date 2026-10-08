import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarketingSiteHeader } from "@/components/marketing-site-header";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing-layout";
import {
  BookOpen,
  Database,
  Lock,
  Mail,
  Scale,
  Server,
  Shield,
} from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <MarketingSiteHeader />

      <div className="relative overflow-hidden border-b bg-gradient-to-br from-teal-500/12 via-background to-violet-500/10 dark:from-teal-500/15 dark:via-background dark:to-violet-500/12">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-500/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-violet-400/15 blur-3xl dark:bg-violet-500/10"
          aria-hidden
        />
        <div className={`${MARKETING_PAGE_SHELL} py-14 lg:py-16`}>
          <div className="mx-auto grid w-full min-w-0 max-w-4xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-10 lg:justify-items-center xl:max-w-5xl xl:gap-12">
            <div className="w-full min-w-0 max-w-lg justify-self-center space-y-4 lg:justify-self-end lg:text-left">
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                aria-hidden
              >
                <Shield className="h-5 w-5" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Privacy Policy
              </h1>
              <p className="text-lg text-muted-foreground">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="relative flex w-full min-w-0 max-w-sm justify-center justify-self-center lg:max-w-md lg:justify-self-start">
              <img
                src="/privacy-hero.png"
                alt=""
                className="h-auto w-full max-h-[min(28rem,70vh)] max-w-sm rounded-2xl border border-teal-500/20 bg-card/40 object-contain object-center shadow-xl ring-1 ring-black/5 dark:ring-white/10 lg:max-w-md"
              />
            </div>
          </div>
        </div>
      </div>

      <div className={`${MARKETING_PAGE_SHELL} py-12`}>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-teal-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                <BookOpen className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">1. Introduction</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                [Your Company Name] ("we," "our," or "us") is committed to
                protecting your privacy. This Privacy Policy explains how we
                collect, use, disclose, and safeguard your information when you
                use our WhatsApp Business API platform.
              </p>
            </CardContent>
          </Card>

          <Card className="border-violet-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                <Database className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">2. Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                We collect information that you provide directly to us,
                including:
              </p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-violet-500">
                <li>Account information (name, email, phone number)</li>
                <li>Business information and credentials</li>
                <li>Payment and billing information</li>
                <li>Messages and communications sent through our platform</li>
                <li>Usage data and analytics</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <Server className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">3. How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                We use the information we collect to:
              </p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-blue-500">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Monitor and analyze usage patterns</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <Lock className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">4. Data Security</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We implement appropriate technical and organizational security
                measures to protect your personal information. However, no
                method of transmission over the Internet is 100% secure.
              </p>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <Shield className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">5. Data Retention</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We retain your personal information for as long as necessary to
                provide our services and comply with legal obligations.
              </p>
            </CardContent>
          </Card>

          <Card className="border-rose-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                <Scale className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">6. Your Rights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                You have the right to:
              </p>
              <ul className="grid gap-2 sm:grid-cols-2 sm:gap-x-8">
                <li className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  Access your personal information
                </li>
                <li className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  Correct inaccurate data
                </li>
                <li className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  Request deletion of your data
                </li>
                <li className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  Object to processing of your data
                </li>
                <li className="flex items-start gap-2 text-muted-foreground sm:col-span-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  Data portability
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-violet-500/5 shadow-md backdrop-blur-sm md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Mail className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">7. Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>
                If you have questions about this Privacy Policy, please contact
                us at:
              </p>
              <p>
                Email: info@helicopticsolutions.com
                <br />
                Address: 86A, Bhagat Colony Sant Nagar Burari Delhi 110084
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
