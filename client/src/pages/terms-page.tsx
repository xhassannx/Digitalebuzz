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
  BookMarked,
  CreditCard,
  FileCheck,
  Gavel,
  Layers,
  Mail,
  Sparkles,
  UserCircle,
  XCircle,
} from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <MarketingSiteHeader />

      <div className="relative overflow-hidden border-b bg-gradient-to-br from-violet-500/12 via-background to-blue-500/10 dark:from-violet-500/15 dark:via-background dark:to-blue-500/12">
        <div
          className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-500/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-blue-400/15 blur-3xl dark:bg-blue-500/10"
          aria-hidden
        />
        <div className={`${MARKETING_PAGE_SHELL} py-14 lg:py-16`}>
          <div className="mx-auto grid w-full min-w-0 max-w-4xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-10 lg:justify-items-center xl:max-w-5xl xl:gap-12">
            <div className="order-2 w-full min-w-0 max-w-lg justify-self-center space-y-4 lg:order-1 lg:justify-self-end lg:text-left">
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                aria-hidden
              >
                <FileCheck className="h-5 w-5" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Terms and Conditions
              </h1>
              <p className="text-lg text-muted-foreground">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="order-1 flex w-full min-w-0 max-w-sm justify-center justify-self-center lg:order-2 lg:max-w-md lg:justify-self-start">
              <img
                src="/terms-hero.png"
                alt=""
                className="h-auto w-full max-h-[min(28rem,70vh)] rounded-2xl border border-violet-500/20 bg-card/40 object-contain object-center shadow-xl ring-1 ring-black/5 dark:ring-white/10"
              />
            </div>
          </div>
        </div>
      </div>

      <div className={`${MARKETING_PAGE_SHELL} py-12`}>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-violet-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                <Sparkles className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">1. Acceptance of Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                By accessing and using our WhatsApp Business API platform, you
                accept and agree to be bound by these Terms and Conditions. If
                you do not agree, please do not use our services.
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <Layers className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">2. Description of Service</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We provide a platform that enables businesses to send and manage
                WhatsApp messages through Meta's WhatsApp Business API. Our
                service includes messaging, campaign management, analytics, and
                related features.
              </p>
            </CardContent>
          </Card>

          <Card className="border-teal-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                <UserCircle className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">3. User Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">To use our services, you must:</p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-teal-500">
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Be responsible for all activities under your account</li>
                <li>Notify us immediately of any unauthorized access</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-rose-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                <Ban className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">4. Acceptable Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">You agree not to:</p>
              <ul className="list-disc space-y-2 pl-5 text-muted-foreground marker:text-rose-500">
                <li>
                  Send spam, unsolicited messages, or violate WhatsApp's policies
                </li>
                <li>Use the service for illegal or unauthorized purposes</li>
                <li>Interfere with or disrupt the service</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <CreditCard className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">5. Payment Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Subscription fees are billed in advance on a monthly or annual
                basis. All fees are non-refundable except as required by law. We
                reserve the right to change our pricing with 30 days notice.
              </p>
            </CardContent>
          </Card>

          <Card className="border-indigo-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                <BookMarked className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">6. Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                All content, features, and functionality of our platform are
                owned by us and protected by copyright, trademark, and other
                intellectual property laws.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-500/15 text-slate-600 dark:bg-slate-500/25 dark:text-slate-400">
                <Gavel className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">7. Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                To the maximum extent permitted by law, we shall not be liable for
                any indirect, incidental, special, or consequential damages
                arising from your use of our services.
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-500/20 bg-card/80 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                <XCircle className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">8. Termination</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We may terminate or suspend your account immediately, without
                prior notice, for conduct that we believe violates these Terms or
                is harmful to other users, us, or third parties.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-gradient-to-br from-violet-500/5 via-card to-blue-500/5 shadow-md backdrop-blur-sm md:col-span-2">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Mail className="h-6 w-6" aria-hidden />
              </div>
              <CardTitle className="text-xl">9. Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>If you have questions about these Terms, please contact us at:</p>
              <p>
                Email: info@helicopticsolutions.com
                <br />
                Address: R29, Laxmi Nagar, New Delhi - 110092
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
