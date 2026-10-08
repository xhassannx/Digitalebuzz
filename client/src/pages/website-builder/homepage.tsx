import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WebsiteBuilderBreadcrumb } from "@/components/website-builder-breadcrumb";
import { Save, Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteBuilderPage } from "@/hooks/useWebsiteBuilderPage";
import {
  WHITELABEL_HOMEPAGE_HERO_DEFAULTS,
  WHITELABEL_HOMEPAGE_STATS_DEFAULTS,
  resolveHomepageHeroField,
  resolveHomepageStats,
} from "@shared/white-label-homepage-defaults";

type StatItem = { value: string; label: string };
type TestimonialItem = { quote: string; name: string; role: string; company: string; avatar: string };
type PricingPlan = { name: string; price: string; period: string; description: string; features: string[]; popular: boolean };
type FooterLink = { href: string; label: string };

type HomepageContent = {
  heroBadge?: string;
  heroHeadline1?: string;
  heroHeadline2?: string;
  heroSubtitle?: string;
  ctaPrimaryText?: string;
  ctaSecondaryText?: string;
  highlights?: string[];
  featureCards?: { title: string; description: string }[];
  faqs?: { question: string; answer: string }[];
  // Features section (below hero)
  featuresSectionTitle?: string;
  featuresSectionSubtitle?: string;
  featuresSectionButtonText?: string;
  // Stats
  stats?: StatItem[];
  // Testimonials
  testimonialsSectionTitle?: string;
  testimonialsSectionSubtitle?: string;
  testimonialsSectionButtonText?: string;
  testimonials?: TestimonialItem[];
  // Pricing
  pricingSectionTitle?: string;
  pricingSectionSubtitle?: string;
  pricingSectionButtonText?: string;
  pricingPlans?: PricingPlan[];
  // CTA section
  ctaSectionTitle?: string;
  ctaSectionSubtitle?: string;
  ctaSectionPrimaryButtonText?: string;
  ctaSectionSecondaryButtonText?: string;
  // Footer
  footerTagline?: string;
  footerProductLinks?: FooterLink[];
  footerResourceLinks?: FooterLink[];
  footerContactEmail?: string;
  footerContactPhone?: string;
  footerContactAddress?: string;
  footerCopyright?: string;
  footerLegalLinks?: FooterLink[];
};

const defaultStats: StatItem[] = WHITELABEL_HOMEPAGE_STATS_DEFAULTS.map((s) => ({ ...s }));

const defaultTestimonials: TestimonialItem[] = [
  { quote: "This platform transformed our customer communication. We've seen a 300% increase in engagement rates.", name: "Sarah Johnson", role: "Marketing Director", company: "TechCorp Inc.", avatar: "SJ" },
  { quote: "The automation features saved us countless hours. Our team can now focus on what matters most.", name: "Michael Chen", role: "Operations Manager", company: "Retail Solutions", avatar: "MC" },
  { quote: "Best investment we've made. The ROI was visible within the first month of implementation.", name: "Emily Rodriguez", role: "CEO", company: "StartupHub", avatar: "ER" },
];

const defaultPricingPlans: PricingPlan[] = [
  { name: "Starter", price: "$49", period: "/month", description: "Perfect for small businesses", features: ["Up to 1,000 messages/month", "Basic chatbot", "Email support", "Analytics dashboard", "API access"], popular: false },
  { name: "Professional", price: "$149", period: "/month", description: "For growing businesses", features: ["Up to 10,000 messages/month", "Advanced chatbot", "Priority support", "Advanced analytics", "API access", "Custom integrations", "Team collaboration"], popular: true },
  { name: "Enterprise", price: "Custom", period: "", description: "For large organizations", features: ["Unlimited messages", "AI-powered chatbot", "24/7 dedicated support", "Custom analytics", "White-label options", "SLA guarantee"], popular: false },
];

const defaultContent: HomepageContent = {
  heroBadge: "✨ New: AI-Powered Chatbot Integration",
  heroHeadline1: WHITELABEL_HOMEPAGE_HERO_DEFAULTS.heroHeadline1,
  heroHeadline2: WHITELABEL_HOMEPAGE_HERO_DEFAULTS.heroHeadline2,
  heroSubtitle: "Powerful messaging platform that helps you connect with customers, automate conversations, and grow your business effortlessly.",
  ctaPrimaryText: "Start Free Trial",
  ctaSecondaryText: "Learn More",
  highlights: ["No credit card required", "14-day free trial", "Cancel anytime"],
  featureCards: [
    { title: "Bulk Messaging", description: "Send thousands of personalized messages instantly with our powerful API integration." },
    { title: "AI Chatbot", description: "Automate customer interactions with intelligent chatbots that work 24/7." },
    { title: "Analytics Dashboard", description: "Track delivery rates, read receipts, and engagement metrics in real time." },
  ],
  faqs: [{ question: "", answer: "" }],
  featuresSectionTitle: "Everything You Need to Succeed",
  featuresSectionSubtitle: "Powerful features designed to help you communicate better, automate smarter, and grow faster.",
  featuresSectionButtonText: "View All Features",
  stats: defaultStats,
  testimonialsSectionTitle: "Loved by Businesses Worldwide",
  testimonialsSectionSubtitle: "See what our customers have to say about their experience.",
  testimonialsSectionButtonText: "Read More Testimonials",
  testimonials: defaultTestimonials,
  pricingSectionTitle: "Simple, Transparent Pricing",
  pricingSectionSubtitle: "Choose the plan that's right for your business. All plans include a 14-day free trial.",
  pricingSectionButtonText: "View Full Pricing Details",
  pricingPlans: defaultPricingPlans,
  ctaSectionTitle: "Ready to Get Started?",
  ctaSectionSubtitle: "Join thousands of businesses that trust us to power their communication.",
  ctaSectionPrimaryButtonText: "Start Free Trial",
  ctaSectionSecondaryButtonText: "Contact Sales",
  footerTagline: "Powerful messaging platform for modern businesses. Connect, automate, and grow.",
  footerProductLinks: [
    { href: "/white-label/features", label: "Features" },
    { href: "/white-label/login", label: "Login" },
    { href: "/signup", label: "Sign Up" },
  ],
  footerResourceLinks: [
    { href: "/white-label/pricing", label: "Pricing" },
  ],
  footerContactEmail: "support@yourbrand.com",
  footerContactPhone: "+1 (234) 567-890",
  footerContactAddress: "123 Business St, Suite 100\nCity, State 12345",
  footerCopyright: "All rights reserved.",
  footerLegalLinks: [
    { href: "#", label: "Privacy Policy" },
    { href: "#", label: "Terms of Service" },
  ],
};

export default function HomePage() {
  const { toast } = useToast();
  const [hero, setHero] = useState({
    heroBadge: defaultContent.heroBadge ?? "",
    heroHeadline1: defaultContent.heroHeadline1 ?? "",
    heroHeadline2: defaultContent.heroHeadline2 ?? "",
    heroSubtitle: defaultContent.heroSubtitle ?? "",
    ctaPrimaryText: defaultContent.ctaPrimaryText ?? "",
    ctaSecondaryText: defaultContent.ctaSecondaryText ?? "",
  });
  const [highlights, setHighlights] = useState<string[]>(defaultContent.highlights ?? []);
  const [featureCards, setFeatureCards] = useState<{ title: string; description: string }[]>(
    defaultContent.featureCards ?? []
  );
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>(
    defaultContent.faqs ?? [{ question: "", answer: "" }]
  );
  const [featuresSection, setFeaturesSection] = useState({
    title: defaultContent.featuresSectionTitle ?? "",
    subtitle: defaultContent.featuresSectionSubtitle ?? "",
    buttonText: defaultContent.featuresSectionButtonText ?? "",
  });
  const [stats, setStats] = useState<StatItem[]>(defaultContent.stats ?? defaultStats);
  const [testimonialsSection, setTestimonialsSection] = useState({
    title: defaultContent.testimonialsSectionTitle ?? "",
    subtitle: defaultContent.testimonialsSectionSubtitle ?? "",
    buttonText: defaultContent.testimonialsSectionButtonText ?? "",
  });
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>(defaultContent.testimonials ?? defaultTestimonials);
  const [pricingSection, setPricingSection] = useState({
    title: defaultContent.pricingSectionTitle ?? "",
    subtitle: defaultContent.pricingSectionSubtitle ?? "",
    buttonText: defaultContent.pricingSectionButtonText ?? "",
  });
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>(defaultContent.pricingPlans ?? defaultPricingPlans);
  const [ctaSection, setCtaSection] = useState({
    title: defaultContent.ctaSectionTitle ?? "",
    subtitle: defaultContent.ctaSectionSubtitle ?? "",
    primaryButtonText: defaultContent.ctaSectionPrimaryButtonText ?? "",
    secondaryButtonText: defaultContent.ctaSectionSecondaryButtonText ?? "",
  });
  const [footer, setFooter] = useState({
    tagline: defaultContent.footerTagline ?? "",
    productLinks: (defaultContent.footerProductLinks ?? []) as FooterLink[],
    resourceLinks: (defaultContent.footerResourceLinks ?? []) as FooterLink[],
    contactEmail: defaultContent.footerContactEmail ?? "",
    contactPhone: defaultContent.footerContactPhone ?? "",
    contactAddress: defaultContent.footerContactAddress ?? "",
    copyright: defaultContent.footerCopyright ?? "",
    legalLinks: (defaultContent.footerLegalLinks ?? []) as FooterLink[],
  });

  const { content, save, isSaving } = useWebsiteBuilderPage<HomepageContent>("homepage");

  useEffect(() => {
    const c = content;
    if (!c || typeof c !== "object" || Object.keys(c).length === 0) return;
    // Merge API data with defaults so all sections (including footer) are prefilled when API returns empty/missing fields
    setHero({
      heroBadge: c.heroBadge ?? defaultContent.heroBadge ?? "",
      heroHeadline1: resolveHomepageHeroField("heroHeadline1", c.heroHeadline1),
      heroHeadline2: resolveHomepageHeroField("heroHeadline2", c.heroHeadline2),
      heroSubtitle: c.heroSubtitle ?? defaultContent.heroSubtitle ?? "",
      ctaPrimaryText: c.ctaPrimaryText ?? defaultContent.ctaPrimaryText ?? "",
      ctaSecondaryText: c.ctaSecondaryText ?? defaultContent.ctaSecondaryText ?? "",
    });
    setHighlights(Array.isArray(c.highlights) && c.highlights.length ? c.highlights : (defaultContent.highlights ?? []));
    setFeatureCards(Array.isArray(c.featureCards) && c.featureCards.length ? c.featureCards : (defaultContent.featureCards ?? []));
    setFaqs(Array.isArray(c.faqs) && c.faqs.length ? c.faqs : (defaultContent.faqs ?? [{ question: "", answer: "" }]));
    setFeaturesSection({
      title: c.featuresSectionTitle ?? defaultContent.featuresSectionTitle ?? "",
      subtitle: c.featuresSectionSubtitle ?? defaultContent.featuresSectionSubtitle ?? "",
      buttonText: c.featuresSectionButtonText ?? defaultContent.featuresSectionButtonText ?? "",
    });
    setStats(resolveHomepageStats(c.stats));
    setTestimonialsSection({
      title: c.testimonialsSectionTitle ?? defaultContent.testimonialsSectionTitle ?? "",
      subtitle: c.testimonialsSectionSubtitle ?? defaultContent.testimonialsSectionSubtitle ?? "",
      buttonText: c.testimonialsSectionButtonText ?? defaultContent.testimonialsSectionButtonText ?? "",
    });
    setTestimonials(Array.isArray(c.testimonials) && c.testimonials.length ? c.testimonials : (defaultContent.testimonials ?? defaultTestimonials));
    setPricingSection({
      title: c.pricingSectionTitle ?? defaultContent.pricingSectionTitle ?? "",
      subtitle: c.pricingSectionSubtitle ?? defaultContent.pricingSectionSubtitle ?? "",
      buttonText: c.pricingSectionButtonText ?? defaultContent.pricingSectionButtonText ?? "",
    });
    setPricingPlans(Array.isArray(c.pricingPlans) && c.pricingPlans.length ? c.pricingPlans : (defaultContent.pricingPlans ?? defaultPricingPlans));
    setCtaSection({
      title: c.ctaSectionTitle ?? defaultContent.ctaSectionTitle ?? "",
      subtitle: c.ctaSectionSubtitle ?? defaultContent.ctaSectionSubtitle ?? "",
      primaryButtonText: c.ctaSectionPrimaryButtonText ?? defaultContent.ctaSectionPrimaryButtonText ?? "",
      secondaryButtonText: c.ctaSectionSecondaryButtonText ?? defaultContent.ctaSectionSecondaryButtonText ?? "",
    });
    setFooter({
      tagline: (c.footerTagline ?? defaultContent.footerTagline) ?? "",
      productLinks: (Array.isArray(c.footerProductLinks) && c.footerProductLinks.length ? c.footerProductLinks : (defaultContent.footerProductLinks ?? [])) as FooterLink[],
      resourceLinks: (Array.isArray(c.footerResourceLinks) && c.footerResourceLinks.length ? c.footerResourceLinks : (defaultContent.footerResourceLinks ?? [])) as FooterLink[],
      contactEmail: (c.footerContactEmail ?? defaultContent.footerContactEmail) ?? "",
      contactPhone: (c.footerContactPhone ?? defaultContent.footerContactPhone) ?? "",
      contactAddress: (c.footerContactAddress ?? defaultContent.footerContactAddress) ?? "",
      copyright: (c.footerCopyright ?? defaultContent.footerCopyright) ?? "",
      legalLinks: (Array.isArray(c.footerLegalLinks) && c.footerLegalLinks.length ? c.footerLegalLinks : (defaultContent.footerLegalLinks ?? [])) as FooterLink[],
    });
  }, [content]);

  const handleSave = () => {
    save(
      {
      ...hero,
      highlights,
      featureCards,
      faqs: faqs.filter((f) => f.question.trim() || f.answer.trim()),
      featuresSectionTitle: featuresSection.title,
      featuresSectionSubtitle: featuresSection.subtitle,
      featuresSectionButtonText: featuresSection.buttonText,
      stats,
      testimonialsSectionTitle: testimonialsSection.title,
      testimonialsSectionSubtitle: testimonialsSection.subtitle,
      testimonialsSectionButtonText: testimonialsSection.buttonText,
      testimonials,
      pricingSectionTitle: pricingSection.title,
      pricingSectionSubtitle: pricingSection.subtitle,
      pricingSectionButtonText: pricingSection.buttonText,
      pricingPlans,
      ctaSectionTitle: ctaSection.title,
      ctaSectionSubtitle: ctaSection.subtitle,
      ctaSectionPrimaryButtonText: ctaSection.primaryButtonText,
      ctaSectionSecondaryButtonText: ctaSection.secondaryButtonText,
      footerTagline: footer.tagline,
      footerProductLinks: footer.productLinks,
      footerResourceLinks: footer.resourceLinks,
      footerContactEmail: footer.contactEmail,
      footerContactPhone: footer.contactPhone,
      footerContactAddress: footer.contactAddress,
      footerCopyright: footer.copyright,
      footerLegalLinks: footer.legalLinks,
      },
      {
        onSuccess: () => {
          toast({ title: "Landing Page Saved", description: "Your landing page content has been saved." });
        },
        onError: (e: Error) => {
          toast({ title: "Error", description: e.message, variant: "destructive" });
        },
      }
    );
  };

  const addHighlight = () => setHighlights([...highlights, ""]);
  const removeHighlight = (i: number) => setHighlights(highlights.filter((_, idx) => idx !== i));
  const setHighlight = (i: number, v: string) => {
    const next = [...highlights];
    next[i] = v;
    setHighlights(next);
  };

  const addFeature = () => setFeatureCards([...featureCards, { title: "", description: "" }]);
  const removeFeature = (i: number) => setFeatureCards(featureCards.filter((_, idx) => idx !== i));
  const setFeature = (i: number, field: "title" | "description", v: string) => {
    const next = [...featureCards];
    next[i] = { ...next[i], [field]: v };
    setFeatureCards(next);
  };

  const addFaq = () => setFaqs([...faqs, { question: "", answer: "" }]);
  const removeFaq = (i: number) => setFaqs(faqs.filter((_, idx) => idx !== i));
  const handleFaqChange = (index: number, field: "question" | "answer", value: string) => {
    const updated = [...faqs];
    updated[index] = { ...updated[index], [field]: value };
    setFaqs(updated);
  };

  const setStat = (i: number, field: "value" | "label", v: string) => {
    const next = [...stats];
    next[i] = { ...next[i], [field]: v };
    setStats(next);
  };
  const addStat = () => setStats([...stats, { value: "", label: "" }]);
  const removeStat = (i: number) => setStats(stats.filter((_, idx) => idx !== i));

  const setTestimonial = (i: number, field: keyof TestimonialItem, v: string) => {
    const next = [...testimonials];
    next[i] = { ...next[i], [field]: v };
    setTestimonials(next);
  };
  const addTestimonial = () => setTestimonials([...testimonials, { quote: "", name: "", role: "", company: "", avatar: "" }]);
  const removeTestimonial = (i: number) => setTestimonials(testimonials.filter((_, idx) => idx !== i));

  const setPricingPlan = (i: number, field: keyof PricingPlan, v: string | string[] | boolean) => {
    const next = [...pricingPlans];
    (next[i] as Record<string, unknown>)[field] = v;
    setPricingPlans(next);
  };
  const setPricingPlanFeature = (planIdx: number, featureIdx: number, v: string) => {
    const next = [...pricingPlans];
    const features = [...(next[planIdx].features ?? [])];
    features[featureIdx] = v;
    next[planIdx] = { ...next[planIdx], features };
    setPricingPlans(next);
  };
  const addPricingPlanFeature = (planIdx: number) => {
    const next = [...pricingPlans];
    next[planIdx] = { ...next[planIdx], features: [...(next[planIdx].features ?? []), ""] };
    setPricingPlans(next);
  };
  const removePricingPlanFeature = (planIdx: number, featureIdx: number) => {
    const next = [...pricingPlans];
    next[planIdx] = { ...next[planIdx], features: (next[planIdx].features ?? []).filter((_, i) => i !== featureIdx) };
    setPricingPlans(next);
  };

  const setFooterProductLink = (i: number, field: "href" | "label", v: string) => {
    const next = [...footer.productLinks];
    next[i] = { ...next[i], [field]: v };
    setFooter({ ...footer, productLinks: next });
  };
  const setFooterResourceLink = (i: number, field: "href" | "label", v: string) => {
    const next = [...footer.resourceLinks];
    next[i] = { ...next[i], [field]: v };
    setFooter({ ...footer, resourceLinks: next });
  };
  const setFooterLegalLink = (i: number, field: "href" | "label", v: string) => {
    const next = [...footer.legalLinks];
    next[i] = { ...next[i], [field]: v };
    setFooter({ ...footer, legalLinks: next });
  };

  return (
    <div className="p-6 md:p-8 max-w-[95%] mx-auto space-y-8">
      <WebsiteBuilderBreadcrumb currentPage="Landing Page" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit complete Landing Page content</h1>
        <Badge variant="outline">Website Builder</Badge>
      </div>

      {/* Hero Section */}
      <SectionHeader title="Hero Section (White-label template)" />
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Hero content</CardTitle>
          <CardDescription>This appears at the top of your white-label landing page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Badge / Tagline</label>
            <input
              value={hero.heroBadge}
              onChange={(e) => setHero({ ...hero, heroBadge: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. New: AI-Powered Chatbot"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Headline line 1</label>
            <input
              value={hero.heroHeadline1}
              onChange={(e) => setHero({ ...hero, heroHeadline1: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Transform Your Business"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Headline line 2</label>
            <input
              value={hero.heroHeadline2}
              onChange={(e) => setHero({ ...hero, heroHeadline2: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Communication"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subtitle / Description</label>
            <textarea
              rows={3}
              value={hero.heroSubtitle}
              onChange={(e) => setHero({ ...hero, heroSubtitle: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Short description under the headline"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Primary button text</label>
              <input
                value={hero.ctaPrimaryText}
                onChange={(e) => setHero({ ...hero, ctaPrimaryText: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Start Free Trial"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Secondary button text</label>
              <input
                value={hero.ctaSecondaryText}
                onChange={(e) => setHero({ ...hero, ctaSecondaryText: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Learn More"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Highlights (e.g. checkmarks under CTAs)</label>
            {highlights.map((h, i) => (
              <div key={i} className="flex gap-2 mt-2">
                <input
                  value={h}
                  onChange={(e) => setHighlight(i, e.target.value)}
                  className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. No credit card required"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeHighlight(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addHighlight}>
              <Plus className="mr-2 h-4 w-4" /> Add highlight
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feature cards (shown on white-label) */}
      <SectionHeader title="Feature cards (Hero + Features grid)" />
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Feature cards</CardTitle>
          <CardDescription>Cards shown on the landing page (hero and features section). Add up to 6 for full page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {featureCards.map((f, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-2 relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => removeFeature(i)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
              <input
                value={f.title}
                onChange={(e) => setFeature(i, "title", e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Card title"
              />
              <textarea
                rows={2}
                value={f.description}
                onChange={(e) => setFeature(i, "description", e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Card description"
              />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addFeature}>
            <Plus className="mr-2 h-4 w-4" /> Add feature card
          </Button>
        </CardContent>
      </Card>

      {/* Features Section (title/subtitle) */}
      <SectionHeader title="Features section (below hero)" />
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Features section heading</CardTitle>
          <CardDescription>Title and subtitle for the &quot;Everything You Need&quot; block.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Section title</label>
            <input
              value={featuresSection.title}
              onChange={(e) => setFeaturesSection({ ...featuresSection, title: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Everything You Need to Succeed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Section subtitle</label>
            <textarea
              rows={2}
              value={featuresSection.subtitle}
              onChange={(e) => setFeaturesSection({ ...featuresSection, subtitle: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Powerful features designed to..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Button text</label>
            <input
              value={featuresSection.buttonText}
              onChange={(e) => setFeaturesSection({ ...featuresSection, buttonText: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="View All Features"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <SectionHeader title="Stats section" />
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Stats (e.g. 250+ businesses, 1.2M+ messages)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={s.value}
                onChange={(e) => setStat(i, "value", e.target.value)}
                className="w-24 border rounded-md px-3 py-2 text-sm"
                placeholder="250+"
              />
              <input
                value={s.label}
                onChange={(e) => setStat(i, "label", e.target.value)}
                className="flex-1 border rounded-md px-3 py-2 text-sm"
                placeholder="Active Users"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeStat(i)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addStat}>
            <Plus className="mr-2 h-4 w-4" /> Add stat
          </Button>
        </CardContent>
      </Card>

      {/* Testimonials */}
      <SectionHeader title="Testimonials section" />
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Testimonials heading &amp; items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Section title</label>
            <input
              value={testimonialsSection.title}
              onChange={(e) => setTestimonialsSection({ ...testimonialsSection, title: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Loved by Businesses Worldwide"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Section subtitle</label>
            <input
              value={testimonialsSection.subtitle}
              onChange={(e) => setTestimonialsSection({ ...testimonialsSection, subtitle: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Button text</label>
            <input
              value={testimonialsSection.buttonText}
              onChange={(e) => setTestimonialsSection({ ...testimonialsSection, buttonText: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Read More Testimonials"
            />
          </div>
          {testimonials.map((t, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-2 relative">
              <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => removeTestimonial(i)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
              <input value={t.quote} onChange={(e) => setTestimonial(i, "quote", e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Quote" />
              <div className="grid grid-cols-2 gap-2">
                <input value={t.name} onChange={(e) => setTestimonial(i, "name", e.target.value)} className="border rounded-md px-3 py-2 text-sm" placeholder="Name" />
                <input value={t.role} onChange={(e) => setTestimonial(i, "role", e.target.value)} className="border rounded-md px-3 py-2 text-sm" placeholder="Role" />
                <input value={t.company} onChange={(e) => setTestimonial(i, "company", e.target.value)} className="border rounded-md px-3 py-2 text-sm" placeholder="Company" />
                <input value={t.avatar} onChange={(e) => setTestimonial(i, "avatar", e.target.value)} className="border rounded-md px-3 py-2 text-sm" placeholder="Avatar (e.g. SJ)" />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addTestimonial}>
            <Plus className="mr-2 h-4 w-4" /> Add testimonial
          </Button>
        </CardContent>
      </Card>

     

      {/* CTA Section */}
      <SectionHeader title="CTA section (Ready to Get Started?)" />
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Call-to-action block</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input value={ctaSection.title} onChange={(e) => setCtaSection({ ...ctaSection, title: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Ready to Get Started?" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subtitle</label>
            <textarea rows={2} value={ctaSection.subtitle} onChange={(e) => setCtaSection({ ...ctaSection, subtitle: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Primary button text</label>
              <input value={ctaSection.primaryButtonText} onChange={(e) => setCtaSection({ ...ctaSection, primaryButtonText: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Start Free Trial" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Secondary button text</label>
              <input value={ctaSection.secondaryButtonText} onChange={(e) => setCtaSection({ ...ctaSection, secondaryButtonText: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Contact Sales" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <SectionHeader title="Footer" />
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Footer content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tagline / short description</label>
            <textarea rows={2} value={footer.tagline} onChange={(e) => setFooter({ ...footer, tagline: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Product links (href, label)</label>
            {footer.productLinks.map((link, i) => (
              <div key={i} className="flex gap-2 mt-2">
                <input value={link.href} onChange={(e) => setFooterProductLink(i, "href", e.target.value)} className="w-48 border rounded-md px-3 py-2 text-sm" placeholder="href" />
                <input value={link.label} onChange={(e) => setFooterProductLink(i, "label", e.target.value)} className="flex-1 border rounded-md px-3 py-2 text-sm" placeholder="label" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Resource links (href, label)</label>
            {footer.resourceLinks.map((link, i) => (
              <div key={i} className="flex gap-2 mt-2">
                <input value={link.href} onChange={(e) => setFooterResourceLink(i, "href", e.target.value)} className="w-48 border rounded-md px-3 py-2 text-sm" placeholder="href" />
                <input value={link.label} onChange={(e) => setFooterResourceLink(i, "label", e.target.value)} className="flex-1 border rounded-md px-3 py-2 text-sm" placeholder="label" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Contact email</label>
              <input value={footer.contactEmail} onChange={(e) => setFooter({ ...footer, contactEmail: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact phone</label>
              <input value={footer.contactPhone} onChange={(e) => setFooter({ ...footer, contactPhone: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact address (multiline)</label>
              <textarea rows={2} value={footer.contactAddress} onChange={(e) => setFooter({ ...footer, contactAddress: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Copyright text (e.g. All rights reserved.)</label>
            <input value={footer.copyright} onChange={(e) => setFooter({ ...footer, copyright: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Legal links (Privacy, Terms, etc.)</label>
            {footer.legalLinks.map((link, i) => (
              <div key={i} className="flex gap-2 mt-2">
                <input value={link.href} onChange={(e) => setFooterLegalLink(i, "href", e.target.value)} className="w-48 border rounded-md px-3 py-2 text-sm" placeholder="href" />
                <input value={link.label} onChange={(e) => setFooterLegalLink(i, "label", e.target.value)} className="flex-1 border rounded-md px-3 py-2 text-sm" placeholder="label" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FAQ Section */}
      <SectionHeader title="FAQ Section" />
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>FAQ Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {faqs.map((faq, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3 relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 text-red-500"
                onClick={() => removeFaq(index)}
              >
                <Trash2 size={16} />
              </Button>
              <div>
                <label className="text-sm font-medium">Question</label>
                <input
                  value={faq.question}
                  onChange={(e) => handleFaqChange(index, "question", e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Answer</label>
                <textarea
                  rows={3}
                  value={faq.answer}
                  onChange={(e) => handleFaqChange(index, "answer", e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addFaq}>
            <Plus className="mr-2 h-4 w-4" /> Add FAQ
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Landing Page
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-orange-200 dark:bg-orange-900/40 rounded-full py-1 px-4 text-sm font-medium text-center">
      {title}
    </div>
  );
}
