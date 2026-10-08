import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import {
  MessageSquare,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Mail,
  Phone,
  MapPin,
  Bot,
  BarChart3,
  Zap,
  Shield,
  Rocket,
  Star,
  TrendingUp,
  Users,
  Globe,
  Clock,
} from "lucide-react";
import { WhiteLabelHeader } from "./components/header";
import { useWhiteLabelConfig } from "@/hooks/useWhiteLabelConfig";

export default function WhiteLabelLandingPage2() {
  const { config } = useWhiteLabelConfig();
  
  // Get logo from white-label-logo page config
  const whiteLabelLogoConfig = config?.["white-label-logo"] as { logoUrl?: string; logoSize?: number } | undefined;
  const logoUrl = whiteLabelLogoConfig?.logoUrl;
  const logoSize = whiteLabelLogoConfig?.logoSize || 40;
  
  const features = [
    {
      icon: MessageSquare,
      title: "Bulk Messaging",
      description: "Send thousands of personalized messages instantly with our powerful API integration.",
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      icon: Bot,
      title: "AI Chatbot",
      description: "Automate customer interactions with intelligent chatbots that work 24/7.",
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Track delivery rates, read receipts, and engagement metrics in real-time.",
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      icon: Zap,
      title: "Auto Replies",
      description: "Set up automated responses to keep your customers engaged even when you're away.",
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
    {
      icon: Shield,
      title: "Secure & Compliant",
      description: "Enterprise-grade security with GDPR and WhatsApp Business Policy compliance.",
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-950",
    },
    {
      icon: Rocket,
      title: "Easy Integration",
      description: "Simple API integration with comprehensive documentation and support.",
      color: "text-indigo-500",
      bgColor: "bg-indigo-50 dark:bg-indigo-950",
    },
  ];

  const testimonials = [
    {
      quote: "This platform transformed our customer communication. We've seen a 300% increase in engagement rates.",
      name: "Sarah Johnson",
      role: "Marketing Director",
      company: "TechCorp Inc.",
      avatar: "SJ",
      rating: 5,
    },
    {
      quote: "The automation features saved us countless hours. Our team can now focus on what matters most.",
      name: "Michael Chen",
      role: "Operations Manager",
      company: "Retail Solutions",
      avatar: "MC",
      rating: 5,
    },
    {
      quote: "Best investment we've made. The ROI was visible within the first month of implementation.",
      name: "Emily Rodriguez",
      role: "CEO",
      company: "StartupHub",
      avatar: "ER",
      rating: 5,
    },
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "$49",
      period: "/month",
      description: "Perfect for small businesses",
      features: [
        "Up to 1,000 messages/month",
        "Basic chatbot",
        "Email support",
        "Analytics dashboard",
        "API access",
      ],
      popular: false,
    },
    {
      name: "Professional",
      price: "$149",
      period: "/month",
      description: "For growing businesses",
      features: [
        "Up to 10,000 messages/month",
        "Advanced chatbot",
        "Priority support",
        "Advanced analytics",
        "API access",
        "Custom integrations",
        "Team collaboration",
      ],
      popular: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large organizations",
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
      popular: false,
    },
  ];

  const benefits = [
    {
      icon: Rocket,
      title: "14-Day Free Trial",
      description: "Full access to all features, no credit card required",
    },
    {
      icon: Zap,
      title: "Instant Setup",
      description: "Get started in minutes with our easy onboarding",
    },
    {
      icon: Shield,
      title: "Cancel Anytime",
      description: "No long-term commitments, cancel whenever you want",
    },
    {
      icon: BarChart3,
      title: "Full Analytics",
      description: "Track your performance with comprehensive insights",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <WhiteLabelHeader />

      {/* Hero Section - Different Design */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950 dark:via-purple-950 dark:to-pink-950" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]" />
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Side - Content */}
              <div className="space-y-8">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-sm font-medium">
                  <Sparkles className="w-4 h-4 mr-2" />
                  New: AI-Powered Chatbot Integration
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                  <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Transform Your Business
                  </span>
                  <br />
                  <span className="text-foreground">Communication Today</span>
                </h1>
                <p className="text-lg sm:text-xl text-muted-foreground">
                  Powerful messaging platform that helps you connect with customers,
                  automate conversations, and grow your business effortlessly.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/free-trial">
                    <Button
                      size="lg"
                      className="text-lg px-8 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all"
                    >
                      Start Free Trial
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="/white-label/features">
                    <Button
                      size="lg"
                      variant="outline"
                      className="text-lg px-8 py-6 border-2"
                    >
                      Explore Features
                    </Button>
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground pt-4">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    No credit card required
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    14-day free trial
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    Cancel anytime
                  </div>
                </div>
              </div>

              {/* Right Side - Visual Element */}
              <div className="relative hidden lg:block">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-2xl blur-3xl opacity-20 animate-pulse" />
                  <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-8 shadow-2xl">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                          <MessageSquare className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="h-4 bg-white/30 rounded w-32 mb-2" />
                          <div className="h-3 bg-white/20 rounded w-24" />
                        </div>
                      </div>
                      <div className="space-y-2 pl-4">
                        <div className="h-3 bg-white/20 rounded w-full" />
                        <div className="h-3 bg-white/20 rounded w-3/4" />
                      </div>
                      <div className="flex space-x-2">
                        <div className="h-8 bg-white/30 rounded-lg w-24" />
                        <div className="h-8 bg-white/30 rounded-lg w-24" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 lg:py-32 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Why Choose Us?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to succeed, all in one platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <Card key={index} className="border-2 hover:shadow-lg transition-all">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-32 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Powerful Features
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Everything you need to communicate better, automate smarter, and grow faster.
            </p>
            <Link href="/white-label/features">
              <Button variant="outline" size="lg">
                View All Features
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="border-2 hover:border-primary transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1"
                >
                  <CardContent className="p-6">
                    <div
                      className={`w-12 h-12 ${feature.bgColor} rounded-lg flex items-center justify-center mb-4`}
                    >
                      <Icon className={`w-6 h-6 ${feature.color}`} />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary mb-2">
                10K+
              </div>
              <div className="text-sm sm:text-base text-muted-foreground">
                Active Users
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary mb-2">
                50M+
              </div>
              <div className="text-sm sm:text-base text-muted-foreground">
                Messages Sent
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary mb-2">
                99.9%
              </div>
              <div className="text-sm sm:text-base text-muted-foreground">
                Uptime
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary mb-2">
                24/7
              </div>
              <div className="text-sm sm:text-base text-muted-foreground">
                Support
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 lg:py-32 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Trusted by Businesses Worldwide
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              See what our customers have to say about their experience.
            </p>
            <Link href="/white-label/testimonials">
              <Button variant="outline" size="lg">
                Read More Testimonials
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card
                key={index}
                className="border-2 hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-5 h-5 text-yellow-400 fill-yellow-400"
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-6 italic">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold mr-4">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role}, {testimonial.company}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 lg:py-32 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Choose the plan that's right for your business. All plans include a 14-day free trial.
            </p>
            <Link href="/white-label/pricing">
              <Button variant="outline" size="lg">
                View Full Pricing Details
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card
                key={index}
                className={`border-2 relative ${
                  plan.popular
                    ? "border-primary shadow-xl scale-105"
                    : "hover:shadow-lg"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground mb-6">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-muted-foreground">{plan.period}</span>
                    )}
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.slice(0, 5).map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                    {plan.features.length > 5 && (
                      <li className="text-sm text-muted-foreground italic">
                        + {plan.features.length - 5} more features
                      </li>
                    )}
                  </ul>
                  <Link href="/white-label/pricing" className="block">
                    <Button
                      className={`w-full ${
                        plan.popular
                          ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                          : ""
                      }`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      View Details
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg sm:text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Join thousands of businesses that trust us to power their communication.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/free-trial">
              <Button
                size="lg"
                className="bg-white text-indigo-600 hover:bg-gray-100 text-lg px-8 py-6"
              >
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/white-label/contact">
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10 text-lg px-8 py-6"
              >
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Company Info */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="YourBrand"
                    style={{
                      width: `${logoSize}px`,
                      height: `${logoSize}px`,
                    }}
                    className="rounded-lg object-contain"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                )}
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  YourBrand
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Powerful messaging platform for modern businesses. Connect,
                automate, and grow.
              </p>
              <div className="flex space-x-4">
                <a
                  href="#"
                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                  aria-label="Twitter"
                >
                  <Twitter className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/white-label/features"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="/white-label/pricing"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/white-label/login"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Login
                  </Link>
                </li>
                <li>
                  <Link
                    href="/free-trial"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Free Trial
                  </Link>
                </li>
              </ul>
            </div>

            {/* Resources Links */}
            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    API Reference
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="font-semibold mb-4">Contact</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start">
                  <Mail className="w-5 h-5 text-muted-foreground mr-2 mt-0.5 flex-shrink-0" />
                  <a
                    href="mailto:support@yourbrand.com"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    support@yourbrand.com
                  </a>
                </li>
                <li className="flex items-start">
                  <Phone className="w-5 h-5 text-muted-foreground mr-2 mt-0.5 flex-shrink-0" />
                  <a
                    href="tel:+1234567890"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    +1 (234) 567-890
                  </a>
                </li>
                <li className="flex items-start">
                  <MapPin className="w-5 h-5 text-muted-foreground mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    123 Business St, Suite 100<br />
                    City, State 12345
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t pt-8 mt-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} YourBrand. All rights reserved.
              </p>
              <div className="flex space-x-6 text-sm">
                <Link
                  href="/white-label/privacy"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/white-label/terms"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Terms of Service
                </Link>
                <a
                  href="#"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  Cookie Policy
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

