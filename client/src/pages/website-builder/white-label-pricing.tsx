// @ts-nocheck
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { WebsiteBuilderBreadcrumb } from "@/components/website-builder-breadcrumb";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PricingPlan = {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  popular: boolean;
  features: string[];
};

type WhiteLabelPricingContent = {
  title?: string;
  subtitle?: string;
  ctaTitle?: string;
  ctaSubtitle?: string;
  ctaButtonText?: string;
  ctaButtonLink?: string;
  plans?: PricingPlan[];
};

const DEFAULT_PLANS: PricingPlan[] = [
  {
    id: "default-1",
    name: "Starter",
    price: "$49",
    period: "/month",
    description: "Perfect for small businesses",
    popular: false,
    features: [
      "Up to 1,000 messages/month",
      "Basic chatbot",
      "Email support",
      "Analytics dashboard",
      "API access",
    ],
  },
  {
    id: "default-2",
    name: "Professional",
    price: "$149",
    period: "/month",
    description: "For growing businesses",
    popular: true,
    features: [
      "Up to 10,000 messages/month",
      "Advanced chatbot",
      "Priority support",
      "Advanced analytics",
      "API access",
      "Custom integrations",
      "Team collaboration",
    ],
  },
  {
    id: "default-3",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations",
    popular: false,
    features: [
      "Unlimited messages",
      "AI-powered chatbot",
      "24/7 dedicated support",
      "Custom analytics",
      "White-label options",
      "SLA guarantee",
      "Custom integrations",
      "Dedicated account manager",
    ],
  },
];

export default function WhiteLabelPricingPage() {
  const { toast } = useToast();
  const { content, save, isSaving, isLoading } = useWebsiteBuilderPage<WhiteLabelPricingContent>("white-label-pricing");

  const [form, setForm] = useState({
    title: "Simple, Transparent Pricing",
    subtitle: "Choose the plan that's right for your business. All plans include a 14-day free trial.",
    ctaTitle: "Ready to Get Started?",
    ctaSubtitle: "Start your free trial today. No credit card required.",
    ctaButtonText: "Start Free Trial",
    ctaButtonLink: "/signup",
    plans: DEFAULT_PLANS,
  });

  useEffect(() => {
    if (content) {
      setForm({
        title: content.title || "Simple, Transparent Pricing",
        subtitle: content.subtitle || "Choose the plan that's right for your business. All plans include a 14-day free trial.",
        ctaTitle: content.ctaTitle || "Ready to Get Started?",
        ctaSubtitle: content.ctaSubtitle || "Start your free trial today. No credit card required.",
        ctaButtonText: content.ctaButtonText || "Start Free Trial",
        ctaButtonLink: content.ctaButtonLink || "/signup",
        plans: content.plans && content.plans.length > 0 ? content.plans : DEFAULT_PLANS,
      });
    }
  }, [content]);

  const updatePlan = (planId: string, field: keyof PricingPlan, value: any) => {
    setForm((prev) => ({
      ...prev,
      plans: prev.plans.map((plan) =>
        plan.id === planId ? { ...plan, [field]: value } : plan
      ),
    }));
  };

  const updateFeature = (planId: string, featureIndex: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      plans: prev.plans.map((plan) => {
        if (plan.id === planId) {
          const newFeatures = [...plan.features];
          newFeatures[featureIndex] = value;
          return { ...plan, features: newFeatures };
        }
        return plan;
      }),
    }));
  };

  const addFeature = (planId: string) => {
    setForm((prev) => ({
      ...prev,
      plans: prev.plans.map((plan) =>
        plan.id === planId
          ? { ...plan, features: [...plan.features, ""] }
          : plan
      ),
    }));
  };

  const removeFeature = (planId: string, featureIndex: number) => {
    setForm((prev) => ({
      ...prev,
      plans: prev.plans.map((plan) => {
        if (plan.id === planId) {
          const newFeatures = plan.features.filter((_, i) => i !== featureIndex);
          return { ...plan, features: newFeatures };
        }
        return plan;
      }),
    }));
  };

  const addPlan = () => {
    const newPlan: PricingPlan = {
      id: `plan-${Date.now()}`,
      name: "New Plan",
      price: "$0",
      period: "/month",
      description: "Plan description",
      popular: false,
      features: ["Feature 1"],
    };
    setForm((prev) => ({
      ...prev,
      plans: [...prev.plans, newPlan],
    }));
  };

  const removePlan = (planId: string) => {
    setForm((prev) => ({
      ...prev,
      plans: prev.plans.filter((plan) => plan.id !== planId),
    }));
  };

  const handleSave = () => {
    save({
      title: form.title,
      subtitle: form.subtitle,
      ctaTitle: form.ctaTitle,
      ctaSubtitle: form.ctaSubtitle,
      ctaButtonText: form.ctaButtonText,
      ctaButtonLink: form.ctaButtonLink,
      plans: form.plans.filter((plan) => plan.name.trim() && plan.price.trim()),
    });
    toast({ title: "Saved successfully", description: "Pricing page updated" });
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-6">
      <WebsiteBuilderBreadcrumb />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">White Label Pricing</h1>
          <p className="text-muted-foreground mt-1">
            Manage your pricing plans and display settings
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hero Section</CardTitle>
          <CardDescription>Configure the title and subtitle for your pricing page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Simple, Transparent Pricing"
            />
          </div>
          <div>
            <Label>Subtitle</Label>
            <Textarea
              value={form.subtitle}
              onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
              placeholder="Choose the plan that's right for your business..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pricing Plans</CardTitle>
              <CardDescription>Add and manage your pricing plans</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={addPlan}>
              <Plus className="mr-2 h-4 w-4" /> Add Plan
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {form.plans.map((plan, index) => (
            <Card key={plan.id} className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Plan {index + 1}</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePlan(plan.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Plan Name</Label>
                    <Input
                      value={plan.name}
                      onChange={(e) => updatePlan(plan.id, "name", e.target.value)}
                      placeholder="e.g., Starter"
                    />
                  </div>
                  <div>
                    <Label>Popular Plan</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      <input
                        type="checkbox"
                        checked={plan.popular}
                        onChange={(e) => updatePlan(plan.id, "popular", e.target.checked)}
                        className="h-4 w-4"
                      />
                      <Label className="text-sm">Mark as popular</Label>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Price</Label>
                    <Input
                      value={plan.price}
                      onChange={(e) => updatePlan(plan.id, "price", e.target.value)}
                      placeholder="e.g., $49 or Custom"
                    />
                  </div>
                  <div>
                    <Label>Period</Label>
                    <Input
                      value={plan.period}
                      onChange={(e) => updatePlan(plan.id, "period", e.target.value)}
                      placeholder="e.g., /month"
                    />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={plan.description}
                    onChange={(e) => updatePlan(plan.id, "description", e.target.value)}
                    placeholder="e.g., Perfect for small businesses"
                  />
                </div>
                <div>
                  <Label>Features</Label>
                  <div className="space-y-2 mt-2">
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center gap-2">
                        <Input
                          value={feature}
                          onChange={(e) => updateFeature(plan.id, featureIndex, e.target.value)}
                          placeholder="Feature description"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFeature(plan.id, featureIndex)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addFeature(plan.id)}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add Feature
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Call-to-Action Section</CardTitle>
          <CardDescription>Configure the CTA section at the bottom of the pricing page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>CTA Title</Label>
            <Input
              value={form.ctaTitle}
              onChange={(e) => setForm((prev) => ({ ...prev, ctaTitle: e.target.value }))}
              placeholder="Ready to Get Started?"
            />
          </div>
          <div>
            <Label>CTA Subtitle</Label>
            <Textarea
              value={form.ctaSubtitle}
              onChange={(e) => setForm((prev) => ({ ...prev, ctaSubtitle: e.target.value }))}
              placeholder="Start your free trial today..."
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Button Text</Label>
              <Input
                value={form.ctaButtonText}
                onChange={(e) => setForm((prev) => ({ ...prev, ctaButtonText: e.target.value }))}
                placeholder="Start Free Trial"
              />
            </div>
            <div>
              <Label>Button Link</Label>
              <Input
                value={form.ctaButtonLink}
                onChange={(e) => setForm((prev) => ({ ...prev, ctaButtonLink: e.target.value }))}
                placeholder="/signup"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving || isLoading}>
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </>
        )}
      </Button>
    </div>
  );
}
