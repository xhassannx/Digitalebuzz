// @ts-nocheck
import { Link } from "wouter";
import { usePublicSubscriptionCheckout } from "@/hooks/usePublicSubscriptionCheckout";
import { MarketingSiteHeader } from "@/components/marketing-site-header";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, Loader2, CreditCard } from "lucide-react";
import type { PublicSubscriptionCheckoutInput } from "@shared/schema";

export default function PublicSubscribePage() {
  const {
    form,
    submitting,
    plansLoading,
    billingLoading,
    paidPlans,
    billingOptions,
    noGateway,
    onSubmit,
    formatPrice,
  } = usePublicSubscriptionCheckout();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <MarketingSiteHeader />
      <div className={`${MARKETING_PAGE_SHELL} py-10 md:py-14`}>
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Subscribe</h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto">
              Purchase a plan without signing in first. We create or match your account by email, then attach the
              subscription and payment to that account automatically.
            </p>
            <p className="text-xs text-muted-foreground">
              Already have an account? Use the same email and password so the plan is added to your existing workspace.
            </p>
          </div>

          {noGateway && !billingLoading && (
            <Card className="border-amber-200 bg-amber-50/80">
              <CardHeader>
                <CardTitle className="text-amber-900 text-lg">Payments not configured</CardTitle>
                <CardDescription className="text-amber-900/80">
                  The platform owner must connect Razorpay or Stripe for organization subscription billing under
                  Integrations. Then this page will enable checkout.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="grid md:grid-cols-5 gap-8">
            <Card className="md:col-span-2 border-muted">
              <CardHeader>
                <CardTitle className="text-lg">Plans</CardTitle>
                <CardDescription>Prices follow your panel currency (USD list; Razorpay settles in INR).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[480px] overflow-y-auto">
                {plansLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : paidPlans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No paid plans are available yet.</p>
                ) : (
                  paidPlans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => form.setValue("planId", plan.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        form.watch("planId") === plan.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-2">
                        {form.watch("planId") === plan.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        {plan.displayName}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        From {formatPrice(plan.priceMonthly, plan.currency || "USD")}/mo
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Account & payment
                </CardTitle>
                <CardDescription>Required to assign the subscription to the right customer.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First name</FormLabel>
                            <FormControl>
                              <Input {...field} autoComplete="given-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last name</FormLabel>
                            <FormControl>
                              <Input {...field} autoComplete="family-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" autoComplete="email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" autoComplete="new-password" />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-muted-foreground">New accounts use this password to sign in.</p>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="organizationName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="organization" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="tel" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <Label>Billing period</Label>
                      <RadioGroup
                        value={form.watch("billingCycle")}
                        onValueChange={(v) => form.setValue("billingCycle", v as PublicSubscriptionCheckoutInput["billingCycle"])}
                        className="flex flex-wrap gap-4"
                      >
                        {(["monthly", "quarterly", "yearly"] as const).map((c) => (
                          <div key={c} className="flex items-center space-x-2">
                            <RadioGroupItem value={c} id={`cycle-${c}`} />
                            <Label htmlFor={`cycle-${c}`} className="font-normal capitalize">
                              {c}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    {billingOptions?.razorpay && billingOptions?.stripe && (
                      <div className="space-y-2">
                        <Label>Payment method</Label>
                        <RadioGroup
                          value={form.watch("paymentGateway")}
                          onValueChange={(v) =>
                            form.setValue("paymentGateway", v as PublicSubscriptionCheckoutInput["paymentGateway"])
                          }
                          className="flex flex-wrap gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="razorpay" id="gw-rz" />
                            <Label htmlFor="gw-rz" className="font-normal">
                              Razorpay (INR)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="stripe" id="gw-st" />
                            <Label htmlFor="gw-st" className="font-normal">
                              Stripe (USD)
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={submitting || !!noGateway || paidPlans.length === 0}>
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing…
                        </>
                      ) : (
                        "Continue to payment"
                      )}
                    </Button>
                    <p className="text-center text-sm text-muted-foreground">
                      <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                        Sign in instead
                      </Link>
                    </p>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
