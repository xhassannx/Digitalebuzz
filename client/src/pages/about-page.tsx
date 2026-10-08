import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketingSiteHeader } from "@/components/marketing-site-header";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing-layout";
import { Users, Target, Zap, Shield, CheckCircle, Phone, Mail, Cloud, Eye, Rocket, Building2, Globe, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function AboutPage() {
  const whatWeDo = [
    "Send broadcast and bulk WhatsApp messages at scale",
    "Manage a shared WhatsApp inbox for teams",
    "Deploy 24×7 automated chat assistance (chatbots)",
    "Track performance with detailed productivity and conversation reports",
    "Integrate WhatsApp communication seamlessly into daily business workflows",
  ];

  const whyChooseUs = [
    "Cloud-based, secure, and scalable platform",
    "WhatsApp Business API–driven solutions",
    "Automation and analytics for better decision-making",
    "Transparent pricing and clear policies",
    "Dedicated customer support",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <MarketingSiteHeader />

      {/* Hero Section */}
      <section className="relative py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-green-50 via-white to-background dark:from-green-950/20 dark:via-background dark:to-background overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-green-200 dark:bg-green-800 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-green-200 dark:bg-green-800 rounded-full blur-3xl"></div>
        </div>
        
        <div className={`${MARKETING_PAGE_SHELL} relative z-10`}>
          <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-2 lg:gap-12">
            {/* Left Side - Text Content */}
            <div className="min-w-0 text-center lg:text-left">
              <div className="inline-block mb-4">
                <Badge className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-semibold rounded-full">
                  About Helicoptic Solutions
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold mb-6 leading-tight">
                <span className="bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent">
                  About Us
                </span>
                <br />
                <span className="text-gray-900 dark:text-white">
                  Helicoptic Solutions
                </span>
              </h1>
              <p className="text-lg sm:text-xl lg:text-2xl text-gray-700 dark:text-gray-300 leading-relaxed mb-8">
                Technology-driven company focused on simplifying and enhancing business communication
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/contact">
                  <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 h-auto text-base font-semibold">
                    Contact Us
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="lg" variant="outline" className="px-8 py-6 h-auto text-base font-semibold border-2">
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Right Side - Illustration */}
            <div className="flex min-w-0 items-center justify-center lg:justify-end">
              <div className="relative w-full max-w-lg min-w-0">
                <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/20 dark:to-green-950/20 rounded-3xl transform rotate-3"></div>
                <div className="relative bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl">
                  <img 
                    src="https://aizapy.com/wp-content/uploads/2025/09/undraw_goals_0pov.svg" 
                    alt="About Helicoptic Solutions" 
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Company Overview Section */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className={MARKETING_PAGE_SHELL}>
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="min-w-0 space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Building2 className="h-6 w-6 sm:h-7 sm:w-7 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  About Helicoptic Solutions
                </h2>
              </div>
              <div className="space-y-6 text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                <p>
                  <span className="font-semibold text-gray-900 dark:text-white">Helicoptic Solutions Pvt. Ltd.</span> is a technology-driven company focused on simplifying and enhancing business communication through secure, cloud-based solutions. We specialize in helping businesses manage, automate, and scale their customer conversations efficiently using the WhatsApp Business API.
                </p>
                <p>
                  Our platform is designed to bring all customer interactions into a single, unified interface, enabling teams to collaborate better, respond faster, and deliver consistent customer experiences. By combining automation, analytics, and intelligent messaging tools, we empower businesses to engage with their customers more effectively while improving productivity and operational efficiency.
                </p>
              </div>
            </div>
            <div className="flex min-w-0 items-center justify-center lg:justify-end">
              <div className="relative w-full min-w-0 max-w-md">
                <div className="absolute -inset-4 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/20 dark:to-green-950/20 rounded-2xl blur-xl opacity-50"></div>
                <div className="relative bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-gray-800 rounded-2xl p-6 shadow-xl border border-green-100 dark:border-green-900/30">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-md">
                      <Cloud className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Cloud-Based</p>
                    </div>
                    <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-md">
                      <Shield className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Secure</p>
                    </div>
                    <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-md">
                      <Zap className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Automated</p>
                    </div>
                    <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-md">
                      <Users className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Team Collaboration</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We Do Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-muted/30">
        <div className={MARKETING_PAGE_SHELL}>
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">What We Do</h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Helicoptic Solutions provides a robust communication platform that enables businesses to:
            </p>
          </div>
          <Card className="bg-white dark:bg-card shadow-lg">
            <CardContent className="p-6 sm:p-8">
              <ul className="space-y-4">
                {whatWeDo.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-base sm:text-lg text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 pt-6 border-t text-sm sm:text-base text-muted-foreground">
                Our services are built on industry-standard security practices and are hosted on reliable cloud infrastructure to ensure availability, scalability, and data protection.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Our Approach Section */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className={MARKETING_PAGE_SHELL}>
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <div className="text-center mb-10 sm:mb-12 md:text-left">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">Our Approach</h2>
              </div>
              <div className="space-y-6 text-base sm:text-lg text-muted-foreground leading-relaxed">
                <p>
                  We understand that modern businesses require fast, reliable, and compliant communication channels. Our platform is developed in alignment with WhatsApp Business and Meta policies, ensuring transparency, compliance, and reliability for our users.
                </p>
                <p>
                  We work closely with authorized WhatsApp Business Service Providers and continuously evolve our platform to adapt to changing technologies and customer needs.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <img 
                src="https://aizapy.com/wp-content/uploads/2025/09/undraw_visionary-technology_f6b3.svg" 
                alt="Visionary Technology" 
                className="w-full h-auto max-w-md"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-muted/30">
        <div className={MARKETING_PAGE_SHELL}>
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-6xl mx-auto">
            <Card className="bg-white dark:bg-card shadow-lg">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center justify-center mb-6">
                  <img 
                    src="https://aizapy.com/wp-content/uploads/2025/09/undraw_goals_0pov.svg" 
                    alt="Goals" 
                    className="w-full h-auto max-w-xs"
                  />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-center">Our Mission</h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed text-center">
                  To enable businesses of all sizes to build meaningful customer relationships through simple, secure, and scalable communication solutions.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-card shadow-lg">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center justify-center mb-6">
                  <img 
                    src="https://aizapy.com/wp-content/uploads/2025/09/undraw_visionary-technology_f6b3.svg" 
                    alt="Vision" 
                    className="w-full h-auto max-w-xs"
                  />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-center">Our Vision</h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed text-center">
                  To become a trusted communication technology partner for businesses by delivering innovative tools that improve customer engagement and operational efficiency.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className={MARKETING_PAGE_SHELL}>
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="flex items-center justify-center order-2 md:order-1">
              <img 
                src="https://aizapy.com/wp-content/uploads/2025/09/undraw_stepping-up_4q3b.svg" 
                alt="Stepping Up" 
                className="w-full h-auto max-w-md"
              />
            </div>
            <div className="order-1 md:order-2">
              <div className="text-center mb-10 sm:mb-12 md:text-left">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">Why Choose Helicoptic Solutions</h2>
              </div>
              <Card className="bg-white dark:bg-card shadow-lg">
                <CardContent className="p-6 sm:p-8">
                  <ul className="space-y-4">
                    {whyChooseUs.map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-base sm:text-lg text-muted-foreground leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-muted/30">
        <div className={MARKETING_PAGE_SHELL}>
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">Contact Us</h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Get in touch with our team
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-white dark:bg-card shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6 sm:p-8">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-green-50 dark:bg-green-950/20 flex items-center justify-center mb-4 sm:mb-6">
                  <Phone className="h-6 w-6 sm:h-7 sm:w-7 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Phone</h3>
                <a 
                  href="tel:+917011772828" 
                  className="text-lg sm:text-xl text-green-600 dark:text-green-400 hover:underline font-semibold"
                >
                  +91-7011772828
                </a>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-card shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6 sm:p-8">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-green-50 dark:bg-green-950/20 flex items-center justify-center mb-4 sm:mb-6">
                  <Mail className="h-6 w-6 sm:h-7 sm:w-7 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Email</h3>
                <a 
                  href="mailto:support@helicopticsolutions.com" 
                  className="text-base sm:text-lg text-green-600 dark:text-green-400 hover:underline break-all"
                >
                  info@helicopticsolutions.com
                </a>
              </CardContent>
            </Card>
          </div>
          <div className="mt-8 text-center">
            <Link href="/contact">
              <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 h-auto text-base sm:text-lg font-semibold">
                Get in Touch
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}


