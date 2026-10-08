import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Users,
  Target,
  Zap,
  Shield,
  CheckCircle,
  Phone,
  Mail,
  Eye,
  Rocket,
  Building2,
  Globe,
  ArrowRight,
  X,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  MapPin,
  Send,
  Heart,
  Play,
  Gift,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingSiteHeader } from "@/components/marketing-site-header";
import {
  MARKETING_LOGO_IMG_CLASS,
  MARKETING_PAGE_SHELL,
} from "@/lib/marketing-layout";

const AI_TOUR_YOUTUBE_ID = "80TPEPa_qrY";

const PARTNER_DEMO_BOOKING_URL = "https://link.webgearz.com/widget/bookings/wa/demo";

const getYouTubeEmbedUrl = (videoId: string, autoplay = false) => {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    controls: "1",
  });

  // Helps YouTube map the embedding site in production environments.
  if (typeof window !== "undefined") {
    params.set("origin", window.location.origin);
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
};

/** Placeholder carousel items (not real businesses). Set per-card youtubeId when you have real testimonial videos. */
const VOICE_CAROUSEL_PLACEHOLDERS = [
  {
    title: "Aurora Textiles",
    subtitle: "Scaling repeat orders with WhatsApp-first follow-ups | Aurora Textiles",
    image: "https://picsum.photos/seed/voice1/800/1200",
    youtubeId: AI_TOUR_YOUTUBE_ID,
  },
  {
    title: "Harbor Cafe",
    subtitle: "From walk-ins to booked tables — a 6-week growth snapshot | Harbor Cafe",
    image: "https://picsum.photos/seed/voice2/800/1200",
    youtubeId: AI_TOUR_YOUTUBE_ID,
  },
  {
    title: "Northline Clinic",
    subtitle: "Patient reminders and FAQs handled automatically | Northline Clinic",
    image: "https://picsum.photos/seed/voice3/800/1200",
    youtubeId: AI_TOUR_YOUTUBE_ID,
  },
  {
    title: "PixelCraft Studio",
    subtitle: "Lead capture that actually replies while you’re on shoots | PixelCraft",
    image: "https://picsum.photos/seed/voice4/800/1200",
    youtubeId: AI_TOUR_YOUTUBE_ID,
  },
  {
    title: "GreenLeaf Organics",
    subtitle: "D2C orders and support on one thread | GreenLeaf Organics",
    image: "https://picsum.photos/seed/voice5/800/1200",
    youtubeId: AI_TOUR_YOUTUBE_ID,
  },
  {
    title: "Urban Fit Gym",
    subtitle: "Membership renewals and class bookings on autopilot | Urban Fit",
    image: "https://picsum.photos/seed/voice6/800/1200",
    youtubeId: AI_TOUR_YOUTUBE_ID,
  },
];

/** Placeholder “review screenshot” images (replace with real assets when available) */
const REAL_STORIES_CARDS = [
  {
    screenshotUrl: "https://picsum.photos/seed/reviewshot1/400/720",
    attribution: "— Priya N., Founder — Bloom Retail, Pune",
  },
  {
    screenshotUrl: "https://picsum.photos/seed/reviewshot2/400/720",
    attribution: "— Rahul K., Owner — Metro Foods, Delhi",
  },
  {
    screenshotUrl: "https://picsum.photos/seed/reviewshot3/400/720",
    attribution: "— Anjali S., Director — Swift Logistics, Bangalore",
  },
];

/** Hero images for “Why Partner” cards (earnings, support, scale) */
const WHY_PARTNER_CARD_IMAGES = [
  {
    src: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=480&h=300&q=80",
    alt: "Finance, commissions, and revenue growth",
  },
  {
    src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=480&h=300&q=80",
    alt: "Team collaboration, training, and partner support",
  },
  {
    src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=480&h=300&q=80",
    alt: "Scalable growth, analytics, and expanding business",
  },
] as const;

export default function PartnerPage() {
  const [aiTourVideoPlaying, setAiTourVideoPlaying] = useState(false);
  const [voiceReelModal, setVoiceReelModal] = useState<{
    youtubeId: string;
    title: string;
  } | null>(null);

  const scrollToSectionId = (id: string) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${id}`);
    }
  };

  useEffect(() => {
    if (!voiceReelModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVoiceReelModal(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [voiceReelModal]);
  const integrationTools = [
    { name: "OpenAI", iconUrl: "https://www.google.com/s2/favicons?sz=128&domain_url=openai.com" },
    { name: "Google Gemini", iconUrl: "https://cdn.simpleicons.org/googlegemini/4285F4" },
    { name: "WhatsApp Business", iconUrl: "https://cdn.simpleicons.org/whatsapp/25D366" },
    { name: "Meta Leads", iconUrl: "https://cdn.simpleicons.org/facebook/1877F2" },
    { name: "Google Calendar", iconUrl: "https://cdn.simpleicons.org/googlecalendar/4285F4" },
    { name: "Google Sheets", iconUrl: "https://cdn.simpleicons.org/googlesheets/34A853" },
    { name: "Google Contacts", iconUrl: "/icons/google-contact.png" },
    { name: "Shopify", iconUrl: "https://cdn.simpleicons.org/shopify/95BF47" },
    { name: "Woo Commerce", iconUrl: "https://cdn.simpleicons.org/woocommerce/96588A" },
    { name: "Trade India", iconUrl: "https://www.google.com/s2/favicons?sz=128&domain_url=tradeindia.com" },
    { name: "IndiaMART", iconUrl: "https://www.google.com/s2/favicons?sz=128&domain_url=indiamart.com" },
    { name: "ExportersIndia", iconUrl: "https://www.google.com/s2/favicons?sz=128&domain_url=exportersindia.com" },
    { name: "Calendly", iconUrl: "https://cdn.simpleicons.org/calendly/006BFF" },
    { name: "Telegram", iconUrl: "https://cdn.simpleicons.org/telegram/26A5E4" },
    { name: "Pabbly Connect", iconUrl: "https://www.google.com/s2/favicons?sz=128&domain_url=connect.pabbly.com" },
    { name: "Razorpay", iconUrl: "https://cdn.simpleicons.org/razorpay/0C5ADB" },
    { name: "HTTP Mails & SMS", iconUrl: "https://cdn.simpleicons.org/maildotru/EF3F56" },
    { name: "HTTP API", iconUrl: "https://cdn.simpleicons.org/postman/FF6C37" },
    { name: "API Endpoints", iconUrl: "https://cdn.simpleicons.org/fastapi/009688" },
    { name: "Webhooks", iconUrl: "https://cdn.simpleicons.org/socketdotio/010101" },
    { name: "n8n", iconUrl: "https://cdn.simpleicons.org/n8n/EA4B71" },
    { name: "Zoom Webhook", iconUrl: "https://cdn.simpleicons.org/zoom/2D8CFF" },
    { name: "Just Dial", iconUrl: "https://www.google.com/s2/favicons?sz=128&domain_url=justdial.com" },
    { name: "Make", iconUrl: "https://botcommerce.b-cdn.net/wp-content/uploads/2025/03/make.svg" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <MarketingSiteHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 sm:py-16 lg:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-blue-500/5"></div>

        {/* Floating Elements */}
        <div className="absolute top-20 right-10 w-20 h-20 bg-teal-400/10 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute bottom-20 left-10 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

        <div className={MARKETING_PAGE_SHELL}>
          <div className="grid items-center gap-8 sm:gap-12 lg:grid-cols-2">
            {/* Left Content */}
            <div className="min-w-0 space-y-5 sm:space-y-8 animate-fade-in-up">
              <Badge className="bg-teal-500/10 text-teal-700 hover:bg-teal-500/20 border-teal-200 w-fit text-xs sm:text-sm lg:text-xs py-0.5">
                <Rocket className="w-3 h-3 mr-1" />
                Partner Program
              </Badge>

              <div className="space-y-3 sm:space-y-4">
                <h1 className="text-3xl sm:text-4xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                  Unlock New Revenue Streams:
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-blue-600 block mt-1.5 sm:mt-2">
                    Become an Helicoptic Partner 
                  </span>
                </h1>

                <p className="text-base sm:text-lg lg:text-base text-gray-600 leading-relaxed max-w-xl">
                  Choose the perfect partnership to grow your business and earn generous commissions while helping clients succeed.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  asChild
                  className="min-h-8 sm:min-h-9 lg:min-h-10 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-5 py-2.5 sm:px-6 sm:py-4 lg:px-6 lg:py-3.5 h-auto text-sm sm:text-base lg:text-sm shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <a
                    href={PARTNER_DEMO_BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Join the Partner Program
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 lg:h-4 lg:w-4 shrink-0" />
                  </a>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="min-h-8 sm:min-h-9 lg:min-h-10 border-2 border-teal-600 text-teal-700 hover:bg-teal-50 px-5 py-2.5 sm:px-6 sm:py-4 lg:px-6 lg:py-3.5 h-auto text-sm sm:text-base lg:text-sm transition-all duration-300"
                >
                  <a href="tel:+917011772828">
                    <Phone className="h-4 w-4 sm:h-5 sm:w-5 lg:h-4 lg:w-4 shrink-0" />
                    Call Now
                  </a>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:gap-6 pt-3 sm:pt-4 lg:gap-x-5">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 lg:w-4 lg:h-4 text-teal-600 shrink-0" />
                  <span className="text-xs sm:text-sm lg:text-xs text-gray-600">No upfront costs</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 lg:w-4 lg:h-4 text-teal-600 shrink-0" />
                  <span className="text-xs sm:text-sm lg:text-xs text-gray-600">11:00 AM – 7:00 PM support</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 lg:w-4 lg:h-4 text-teal-600 shrink-0" />
                  <span className="text-xs sm:text-sm lg:text-xs text-gray-600">Fast payouts</span>
                </div>
              </div>
            </div>

            {/* Right Image */}
          <div className="relative min-w-0 animate-fade-in-right">
  <div className="relative z-10 mx-auto w-full max-w-xl">
    {/* Illustration Container */}
    <div className="relative rounded-3xl shadow-2xl bg-white/90 backdrop-blur-md overflow-hidden">
      <img
        src="/partner-hero-whatsapp.png"
        alt="Partnership Illustration"
        className="w-full h-[420px] lg:h-[480px] object-cover transform hover:scale-105 transition-transform duration-500"
      />
    </div>

    {/* Floating Stats Cards */}
    <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-4 sm:p-5 lg:p-4 animate-float">
      <div className="flex items-center gap-3 sm:gap-4 lg:gap-3">
        <div className="bg-teal-100 p-2.5 sm:p-3 lg:p-2.5 rounded-lg lg:rounded-xl">
          <Users className="w-5 h-5 sm:w-6 sm:h-6 lg:w-5 lg:h-5 text-teal-600" />
        </div>
        <div>
          <p className="text-xl sm:text-2xl lg:text-lg font-bold text-gray-900 leading-none">250+</p>
          <p className="text-xs sm:text-sm lg:text-xs text-gray-600 mt-0.5">Active Partners</p>
        </div>
      </div>
    </div>

    <div className="absolute -top-6 -right-6 bg-white rounded-2xl shadow-xl p-4 sm:p-5 lg:p-4 animate-float-delay">
      <div className="flex items-center gap-3 sm:gap-4 lg:gap-3">
        <div className="bg-blue-100 p-2.5 sm:p-3 lg:p-2.5 rounded-lg lg:rounded-xl">
          <Zap className="w-5 h-5 sm:w-6 sm:h-6 lg:w-5 lg:h-5 text-blue-600" />
        </div>
        <div>
          <p className="text-xl sm:text-2xl lg:text-lg font-bold text-gray-900 leading-none">30%</p>
          <p className="text-xs sm:text-sm lg:text-xs text-gray-600 mt-0.5">Commission</p>
        </div>
      </div>
    </div>
  </div>

  {/* Decorative Elements */}
  <div className="absolute inset-0">
    <div className="absolute top-0 right-0 w-28 h-28 bg-teal-400/20 rounded-full blur-xl"></div>
    <div className="absolute bottom-0 left-0 w-36 h-36 bg-blue-400/20 rounded-full blur-xl"></div>
  </div>
</div>

          </div>
        </div>
      </section>

      {/* Why Partner Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-white">
        <div className={MARKETING_PAGE_SHELL}>
          <div className="text-center mb-10 sm:mb-14 md:mb-16 animate-fade-in-up px-1 sm:px-0">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4">
              Why Partner with <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-blue-600">Helicoptic?</span>
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Join a thriving ecosystem of partners earning substantial revenue while delivering exceptional value to their clients
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-3.5 sm:gap-5 md:gap-6 max-w-xs sm:max-w-md mx-auto w-full md:max-w-none md:mx-0">
            {/* Card 1 */}
            <Card className="group hover:shadow-2xl transition-all duration-500 border sm:border-2 hover:border-teal-500 hover:-translate-y-2 animate-fade-in-up overflow-hidden">
              <CardContent className="p-0 flex flex-col">
                <div className="relative w-full shrink-0">
                  <img
                    src={WHY_PARTNER_CARD_IMAGES[0].src}
                    alt={WHY_PARTNER_CARD_IMAGES[0].alt}
                    className="h-40 sm:h-44 md:h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="pointer-events-none absolute top-2 right-2 w-6 h-6 sm:w-8 sm:h-8 bg-teal-400/25 rounded-full blur-md" aria-hidden />
                </div>

                <div className="px-4 sm:px-5 md:px-6 pt-4 sm:pt-5 md:pt-5 pb-4 sm:pb-5 md:pb-6">
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-1.5 sm:mb-2.5">Maximized Earnings</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  Earn high commissions and recurring revenue with our industry-leading partner compensation structure. Your success is our success.
                </p>

                <div className="mt-3 sm:mt-5 space-y-1 sm:space-y-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600 shrink-0" />
                    <span>Up to 30% commission</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600 shrink-0" />
                    <span>Recurring revenue share</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600 shrink-0" />
                    <span>Performance bonuses</span>
                  </div>
                </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2 */}
            <Card className="group hover:shadow-2xl transition-all duration-500 border sm:border-2 hover:border-blue-500 hover:-translate-y-2 animate-fade-in-up delay-200 overflow-hidden">
              <CardContent className="p-0 flex flex-col">
                <div className="relative w-full shrink-0">
                  <img
                    src={WHY_PARTNER_CARD_IMAGES[1].src}
                    alt={WHY_PARTNER_CARD_IMAGES[1].alt}
                    className="h-40 sm:h-44 md:h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="pointer-events-none absolute top-2 right-2 w-6 h-6 sm:w-8 sm:h-8 bg-blue-400/25 rounded-full blur-md" aria-hidden />
                </div>

                <div className="px-4 sm:px-5 md:px-6 pt-4 sm:pt-5 md:pt-5 pb-4 sm:pb-5 md:pb-6">
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-1.5 sm:mb-2.5">Dedicated Support</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  Get personalized training and resources from our expert team. We're committed to helping you succeed every step of the way.
                </p>

                <div className="mt-3 sm:mt-5 space-y-1 sm:space-y-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
                    <span>Onboarding & training</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
                    <span>Marketing materials</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
                    <span>10:00 AM – 7:00 PM partner portal</span>
                  </div>
                </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 3 */}
            <Card className="group hover:shadow-2xl transition-all duration-500 border sm:border-2 hover:border-purple-500 hover:-translate-y-2 animate-fade-in-up delay-300 overflow-hidden">
              <CardContent className="p-0 flex flex-col">
                <div className="relative w-full shrink-0">
                  <img
                    src={WHY_PARTNER_CARD_IMAGES[2].src}
                    alt={WHY_PARTNER_CARD_IMAGES[2].alt}
                    className="h-40 sm:h-44 md:h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="pointer-events-none absolute top-2 right-2 w-6 h-6 sm:w-8 sm:h-8 bg-purple-400/25 rounded-full blur-md" aria-hidden />
                </div>

                <div className="px-4 sm:px-5 md:px-6 pt-4 sm:pt-5 md:pt-5 pb-4 sm:pb-5 md:pb-6">
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-1.5 sm:mb-2.5">Scalable Solutions</h3>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  Tailored offerings to grow with your business. From startups to enterprises, we have solutions that scale with your ambitions.
                </p>

                <div className="mt-3 sm:mt-5 space-y-1 sm:space-y-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 shrink-0" />
                    <span>Flexible pricing tiers</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 shrink-0" />
                    <span>White-label options</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 shrink-0" />
                    <span>Custom integrations</span>
                  </div>
                </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Partnership Offerings Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-br from-gray-50 to-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-teal-400/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/5 rounded-full blur-3xl"></div>
        
        <div className={MARKETING_PAGE_SHELL}>
          <div className="text-center mb-10 sm:mb-14 md:mb-16 animate-fade-in-up">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4">
              Our Partnership Offerings
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-1">
              Choose the partnership model that aligns with your business goals
            </p>
          </div>

          {/* Partnership Cards */}
          <div className="grid lg:grid-cols-2 gap-5 sm:gap-8 max-w-md sm:max-w-2xl mx-auto w-full lg:max-w-6xl">
            {/* Affiliate Partner Card */}
            <Card className="group hover:shadow-2xl transition-all duration-500 border sm:border-2 hover:border-teal-500 bg-white overflow-hidden animate-fade-in-left">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-400/10 rounded-full blur-2xl transform translate-x-16 -translate-y-16"></div>
              
              <CardContent className="p-4 sm:p-6 md:p-8 relative">
                <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
                  <Badge className="bg-teal-500 text-white hover:bg-teal-600 px-2 py-0.5 text-xs sm:px-4 sm:py-2 sm:text-sm shrink-0">
                    Most Popular
                  </Badge>
                  <div className="bg-teal-100 p-2 sm:p-3 rounded-lg sm:rounded-xl shrink-0">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
                  </div>
                </div>

                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">Affiliate Partner</h3>
                <p className="text-gray-600 text-sm sm:text-base mb-4 sm:mb-6 leading-relaxed">
                  Turn your network into income. Share your referral link and earn generous commissions for every successful referral.
                </p>

                {/* Commission Badge */}
                <div className="bg-gradient-to-r from-teal-50 to-green-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 border border-teal-200 sm:border-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Commission Rate</p>
                      <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-teal-600 leading-tight">30%</p>
                    </div>
                    <div className="text-right min-w-0">
                      <p className="text-[11px] sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Minimum Payout</p>
                      <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 leading-tight">₹999</p>
                    </div>
                  </div>
                </div>

                {/* Illustration — three steps */}
                <div className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-teal-400/20 rounded-full blur-xl"></div>
                  <div className="flex items-center justify-center gap-1.5 sm:gap-4 relative">
                    <div className="flex flex-col items-center min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white rounded-full shadow-md sm:shadow-lg flex items-center justify-center mb-1 sm:mb-2">
                        <Users className="w-4 h-4 sm:w-6 sm:h-6 text-teal-600" />
                      </div>
                      <p className="text-[10px] sm:text-xs text-gray-600 font-medium text-center leading-tight px-0.5">Your Network</p>
                    </div>
                    <ArrowRight className="w-4 h-4 sm:w-8 sm:h-8 text-teal-600 animate-pulse shrink-0" />
                    <div className="flex flex-col items-center min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-12 sm:h-12 bg-teal-600 rounded-full shadow-md sm:shadow-lg flex items-center justify-center mb-1 sm:mb-2">
                        <Target className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <p className="text-[10px] sm:text-xs text-gray-600 font-medium text-center leading-tight px-0.5">New Customers</p>
                    </div>
                    <ArrowRight className="w-4 h-4 sm:w-8 sm:h-8 text-green-600 animate-pulse shrink-0" />
                    <div className="flex flex-col items-center min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-12 sm:h-12 bg-green-600 rounded-full shadow-md sm:shadow-lg flex items-center justify-center mb-1 sm:mb-2">
                        <span className="text-white font-bold text-sm sm:text-base">₹</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-gray-600 font-medium text-center leading-tight px-0.5">Earn 30%</p>
                    </div>
                  </div>
                </div>

                {/* Benefits */}
                <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">Earn 30% recurring commission for as long as they stay</p>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">No support worries - we handle onboarding and setup</p>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">Quarterly payouts (minimum ₹999)</p>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">Track leads and earnings in real-time dashboard</p>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">Marketing materials and referral tools provided</p>
                  </div>
                </div>

                <Button
                  asChild
                  className="w-full min-h-9 sm:min-h-11 h-auto bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white py-3 sm:py-4 md:py-6 text-sm sm:text-base md:text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <a href={PARTNER_DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer">
                    Become an Affiliate Partner
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  </a>
                </Button>
              </CardContent>
            </Card>

             {/* White-Labelled Partner Card */}
            <Card className="group hover:shadow-2xl transition-all duration-500 border sm:border-2 hover:border-blue-500 bg-white overflow-hidden animate-fade-in-right">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl transform translate-x-16 -translate-y-16"></div>
              
              <CardContent className="p-4 sm:p-6 md:p-8 relative">
                <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
                  <Badge className="bg-blue-500 text-white hover:bg-blue-600 px-2 py-0.5 text-xs sm:px-4 sm:py-2 sm:text-sm shrink-0">
                    Enterprise Solution
                  </Badge>
                  <div className="bg-blue-100 p-2 sm:p-3 rounded-lg sm:rounded-xl shrink-0">
                    <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                </div>

                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">White-Labelled Solution</h3>
                <p className="text-gray-600 text-sm sm:text-base mb-4 sm:mb-6 leading-relaxed">
                  Launch your own WhatsApp Marketing platform with your brand identity. We handle the technology, you own the customer experience.
                </p>

                {/* Features Grid — four boxes, tighter on mobile */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg sm:rounded-xl p-2.5 sm:p-4 border border-blue-100">
                    <Globe className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 mb-1 sm:mb-2" />
                    <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-tight">Custom Domain</p>
                    <p className="text-[10px] sm:text-xs text-gray-600 leading-snug mt-0.5">Your brand URL</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg sm:rounded-xl p-2.5 sm:p-4 border border-purple-100">
                    <Eye className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600 mb-1 sm:mb-2" />
                    <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-tight">Your Brand Logo</p>
                    <p className="text-[10px] sm:text-xs text-gray-600 leading-snug mt-0.5">Complete branding</p>
                  </div>
                  <div className="bg-gradient-to-br from-pink-50 to-red-50 rounded-lg sm:rounded-xl p-2.5 sm:p-4 border border-pink-100">
                    <Target className="w-4 h-4 sm:w-6 sm:h-6 text-pink-600 mb-1 sm:mb-2" />
                    <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-tight">Custom Pricing</p>
                    <p className="text-[10px] sm:text-xs text-gray-600 leading-snug mt-0.5">Set your rates</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-lg sm:rounded-xl p-2.5 sm:p-4 border border-green-100">
                    <Shield className="w-4 h-4 sm:w-6 sm:h-6 text-green-600 mb-1 sm:mb-2" />
                    <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-tight">Full Control</p>
                    <p className="text-[10px] sm:text-xs text-gray-600 leading-snug mt-0.5">Manage everything</p>
                  </div>
                </div>

                {/* Illustration */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/20 rounded-full blur-xl"></div>
                  <div className="text-center relative">
                    <div className="inline-flex items-center gap-2 sm:gap-3 bg-white rounded-lg sm:rounded-xl shadow-md sm:shadow-lg px-3 py-2 sm:px-6 sm:py-4 mb-2 sm:mb-3 max-w-full">
                      <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 shrink-0" />
                      <div className="text-left min-w-0">
                        <p className="text-[11px] sm:text-sm text-gray-600">Your Brand Name</p>
                        <p className="text-sm sm:text-lg font-bold text-gray-900 truncate">TechHub Studios</p>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2">Powered by Helicoptic Technology</p>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <p className="text-[10px] sm:text-xs text-gray-600">WhatsApp API Active</p>
                    </div>
                  </div>
                </div>

                {/* Benefits */}
                <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">Custom domain, logo, and pricing structure</p>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">Full WhatsApp Business API integration</p>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">We manage backend infrastructure and updates</p>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">You own and control the customer relationship</p>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">Advanced analytics and automation features</p>
                  </div>
                </div>

                <Button
                  asChild
                  className="w-full min-h-9 sm:min-h-11 h-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 sm:py-4 md:py-6 text-sm sm:text-base md:text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <a href={PARTNER_DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer">
                    Launch Your Platform
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Comparison Note */}
          <div className="mt-8 sm:mt-12 max-w-3xl mx-auto">
           <Card className="relative overflow-hidden border-2 border-teal-200 bg-gradient-to-br from-teal-50 via-blue-50 to-indigo-50 shadow-lg sm:shadow-2xl transition-all duration-500 group rounded-2xl sm:rounded-3xl">
  <CardContent className="p-4 sm:p-6 lg:p-8">
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 relative z-10 text-center sm:text-left">

      {/* Icon */}
      <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-md group-hover:scale-110 transition-transform duration-300 shrink-0">
        <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7 text-teal-600" />
      </div>

      {/* Content */}
      <div className="flex-1 w-full min-w-0">
        <h4 className="text-base sm:text-lg font-extrabold text-gray-900 mb-2 leading-snug">
          Not sure which option is right for you?
        </h4>

        <p className="text-gray-600 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-5 max-w-xl mx-auto sm:mx-0">
          Our partnership experts help you identify the best model based on your business goals, audience, and earning expectations — with clear guidance and zero pressure.
        </p>

        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
          <Button
            asChild
            className="w-full sm:w-auto min-h-8 sm:min-h-9 h-auto bg-gradient-to-r from-teal-600 to-teal-700 text-white px-4 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base shadow-md sm:shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 sm:hover:-translate-y-1"
          >
            <a href={PARTNER_DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer">
              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 shrink-0" />
              Schedule Free Consultation
            </a>
          </Button>

        </div>
      </div>
    </div>

    {/* Decorative Background Elements */}
    <div className="absolute -top-10 -right-10 w-24 h-24 sm:w-32 sm:h-32 bg-teal-300/20 rounded-full blur-2xl"></div>
    <div className="absolute -bottom-10 -left-10 w-28 h-28 sm:w-40 sm:h-40 bg-blue-300/20 rounded-full blur-2xl"></div>
  </CardContent>
</Card>

          </div>
        </div>
      </section>

      {/* Integrations Block */}
      <section
        id="integrations"
        className="py-14 sm:py-16 bg-gradient-to-br from-slate-50 via-white to-teal-50 scroll-mt-20 md:scroll-mt-24"
      >
        <div className={MARKETING_PAGE_SHELL}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-center text-gray-900 mb-6 sm:mb-8 md:mb-10 tracking-tight leading-tight px-1">
              Integrate Your Favorite Tools
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {integrationTools.map((tool) => {
                return (
                  <div
                    key={tool.name}
                    className="bg-white rounded-xl border border-gray-200 shadow-[0_1px_0_rgba(0,0,0,0.06)] px-4 py-3.5 flex items-center gap-3 min-h-[68px]"
                  >
                    <div className="h-10 w-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
                      <img
                        src={tool.iconUrl}
                        alt={`${tool.name} icon`}
                        className="h-6 w-6 object-contain"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = "none";
                          const sibling = target.nextElementSibling as HTMLElement | null;
                          if (sibling) sibling.style.display = "flex";
                        }}
                      />
                      <span
                        className="hidden h-6 w-6 items-center justify-center text-xs font-semibold text-gray-600"
                        aria-hidden="true"
                      >
                        {tool.name.charAt(0)}
                      </span>
                    </div>
                    <p className="text-sm leading-4.5 font-medium text-gray-700">{tool.name}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 sm:mt-10 flex justify-center">
              <Button
                asChild
                className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-10 py-3.5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-md"
              >
                <a href={PARTNER_DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer">
                  <span className="leading-tight text-center">
                    <span className="block text-base font-bold">🏆 Become A Seller</span>
                    <span className="block text-sm font-medium text-white/90 mt-0.5">
                      Get Your Own Seller Platform
                    </span>
                  </span>
                </a>
              </Button>
            </div>
        </div>
      </section>

      {/* AI-powered tour: heading, YouTube video, Free Live Demo (reference #tour / #demo) */}
      <section
        id="tour"
        className="scroll-mt-20 md:scroll-mt-24 py-14 sm:py-20 bg-white border-t border-gray-100"
      >
        <div className={MARKETING_PAGE_SHELL}>
          <div className="max-w-4xl mx-auto text-center mb-10 sm:mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight mb-6">
              Meet Your WhatsApp SaaS CRM For Success
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-3xl mx-auto">
              Turn WhatsApp conversations into qualified leads with a CRM built for speed. Automate follow-ups, tag and track customers, and close faster with a WhatsApp-first SaaS experience.
            </p>
          </div>

          <div className="max-w-4xl mx-auto mb-10 sm:mb-14">
            <div className="relative aspect-video rounded-2xl overflow-hidden border border-gray-200 shadow-[0_8px_30px_rgba(0,0,0,0.08)] bg-black">
              <iframe
                title="Helicoptic AI platform tour"
                className="absolute inset-0 h-full w-full"
                src={getYouTubeEmbedUrl(AI_TOUR_YOUTUBE_ID, aiTourVideoPlaying)}
                loading="eager"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />

              {!aiTourVideoPlaying && (
                <button
                  type="button"
                  onClick={() => setAiTourVideoPlaying(true)}
                  className="group relative z-10 flex h-full w-full items-center justify-center text-left"
                  aria-label="Play video: Meet Your AI-Powered Platform"
                >
                  <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/35" />
                  <span className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-white/95 text-gray-900 shadow-lg ring-4 ring-white/40 transition-transform hover:scale-105">
                    <Play className="h-8 w-8 sm:h-10 sm:w-10 fill-current ml-1" aria-hidden />
                  </span>
                </button>
              )}
            </div>
          </div>

          <div id="demo" className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="shrink-0 text-blue-600">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-blue-100 bg-blue-50/80">
                    <Gift className="h-7 w-7 stroke-[1.5]" stroke="currentColor" fill="none" />
                  </div>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h4 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
                    Free Live Demo
                  </h4>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    Helicoptic offers a lifetime free plan so you can test all features as your customers would. Once you subscribe as a reseller, you can fully replace the branding with your own, including logo, domain, colors, language, pricing, and more.
                  </p>
                  <a
                    href={PARTNER_DEMO_BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 font-semibold underline underline-offset-4 hover:text-blue-700"
                  >
                    Get Started Free
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Voices of Real Business Owners — carousel (placeholder content) */}
      <section
        className="relative w-full flex flex-col overflow-hidden my-[60px] md:my-[90px]"
        aria-labelledby="voices-heading"
      >
        <div className="flex flex-col gap-5 md:gap-10">
          <div
            className={`${MARKETING_PAGE_SHELL} flex flex-col gap-5 md:gap-6 md:items-center`}
          >
            <div className="w-full max-w-[976px] font-semibold text-[32px] sm:text-[40px] md:text-[48px] leading-[120%] tracking-[-0.03em] md:text-center text-gray-900">
              <h2 id="voices-heading">Voices of Real Business Owners</h2>
            </div>
          </div>

          <div
            className={`${MARKETING_PAGE_SHELL} overflow-x-auto overflow-y-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
          >
            <div className="flex gap-6 md:gap-[30px] w-max animate-voice-carousel hover:[animation-play-state:paused]">
              {[...VOICE_CAROUSEL_PLACEHOLDERS, ...VOICE_CAROUSEL_PLACEHOLDERS].map((item, idx) => (
                <button
                  key={`${item.title}-${idx}`}
                  type="button"
                  onClick={() =>
                    setVoiceReelModal({
                      youtubeId: item.youtubeId,
                      title: item.subtitle,
                    })
                  }
                  className="w-[270px] h-[357px] md:w-[375px] md:h-[496px] relative group shrink-0 cursor-pointer text-left rounded-[12px] md:rounded-[20px] overflow-hidden border border-gray-200/80 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`Play video: ${item.title}`}
                >
                  <div className="h-full w-full">
                    <img
                      alt=""
                      src={item.image}
                      width={375}
                      height={496}
                      loading="lazy"
                      decoding="async"
                      className="bg-cover bg-center h-full w-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="flex h-[50px] w-[50px] md:h-[70px] md:w-[70px] items-center justify-center rounded-full bg-white/30 backdrop-blur-sm">
                      <Play className="h-6 w-6 md:h-9 md:w-9 text-white fill-white ml-0.5" aria-hidden />
                    </div>
                  </div>
                  <div className="absolute top-0 left-0 right-0 p-3 md:p-4 text-white bg-gradient-to-b from-black/70 to-transparent rounded-t-[12px] md:rounded-t-[20px]">
                    <p className="text-sm md:text-base font-semibold line-clamp-1">{item.title}</p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 text-white bg-gradient-to-t from-black/70 to-transparent rounded-b-[12px] md:rounded-b-[20px]">
                    <p className="text-xs md:text-sm font-medium line-clamp-3 leading-snug">{item.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className={`${MARKETING_PAGE_SHELL} flex justify-center`}>
            <Button
              asChild
              className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-10 py-3.5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-md"
            >
              <a
                href={PARTNER_DEMO_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Book Free Demo
              </a>
            </Button>
          </div>
        </div>

        {voiceReelModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-reel-modal-title"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              aria-label="Close video"
              onClick={() => setVoiceReelModal(null)}
            />
            <div
              className="relative z-10 w-full max-w-5xl rounded-lg bg-black shadow-2xl ring-1 ring-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-zinc-950 px-4 py-3 sm:px-5">
                <p
                  id="voice-reel-modal-title"
                  className="text-left text-sm font-medium text-white/95 line-clamp-2 sm:text-base pr-2"
                >
                  {voiceReelModal.title}
                </p>
                <button
                  type="button"
                  onClick={() => setVoiceReelModal(null)}
                  className="shrink-0 rounded-md p-2 text-white/90 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  key={voiceReelModal.youtubeId}
                  title="Partner testimonial video"
                  className="absolute inset-0 h-full w-full"
                  src={getYouTubeEmbedUrl(voiceReelModal.youtubeId, true)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Real Stories, Real Results — review-style cards (placeholder screenshots) */}
      <section
        className="py-16 sm:py-20 bg-white border-t border-gray-100"
        aria-labelledby="real-stories-heading"
      >
        <div className={MARKETING_PAGE_SHELL}>
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14">
            <h2
              id="real-stories-heading"
              className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4"
            >
              Real Stories, Real Results
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              See how Helicoptic has helped business owners like you grow their businesses.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 max-w-6xl mx-auto">
            {REAL_STORIES_CARDS.map((card) => (
              <div
                key={card.attribution}
                className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="px-5 pt-5 pb-2">
                  <span className="text-4xl font-serif text-gray-800 leading-none select-none" aria-hidden>
                    &ldquo;
                  </span>
                </div>
                <div className="px-5 pb-4 flex-1 min-h-0">
                  <img
                    src={card.screenshotUrl}
                    alt=""
                    width={400}
                    height={720}
                    loading="lazy"
                    decoding="async"
                    className="w-full rounded-xl border border-gray-100 bg-gray-50 object-cover object-top max-h-[340px] sm:max-h-[380px] shadow-[0_1px_0_rgba(0,0,0,0.06)]"
                  />
                </div>
                <div className="mt-auto bg-indigo-100 px-5 py-4 text-center text-sm sm:text-base font-semibold text-gray-900 border-t border-indigo-200/60">
                  {card.attribution}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Financial Freedom Calculator (Per Month) */}
      <section className="py-10 sm:py-12 md:py-14 bg-transparent">
        <div className={MARKETING_PAGE_SHELL}>
            <div className="flex flex-col-reverse lg:flex-row lg:items-center gap-5 sm:gap-8 lg:gap-10">
              <div className="lg:w-1/2 max-w-md lg:max-w-none mx-auto lg:mx-0 w-full lg:px-0">
              <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3 sm:mb-4 leading-snug">
                How Close Are You To Financial Freedom?
              </h3>

              <p className="text-gray-600 text-xs sm:text-sm md:text-base leading-relaxed mb-4 sm:mb-5">
                This would be your monthly revenue if you charge an average of Rs.10000 per customer. Just 3 customers cover your reseller subscription.
                Sell worldwide to reach your goals faster.
              </p>

              <ul className="space-y-2 sm:space-y-2.5 mb-5 sm:mb-6">
                <li className="flex items-start gap-2 sm:gap-3">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-gray-700 font-medium text-xs sm:text-sm leading-snug">
                    10 customers = Rs. 100,000.00 per month
                  </span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-gray-700 font-medium text-xs sm:text-sm leading-snug">
                    50 customers = Rs. 500000.00 per month
                  </span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-gray-700 font-medium text-xs sm:text-sm leading-snug">
                    100 customers = Rs. 1,000,000.00 per month
                  </span>
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-gray-700 font-medium text-xs sm:text-sm leading-snug">
                    200 customers = Rs. 2,000,000.00 per month
                  </span>
                </li>
              </ul>

              <Button
                asChild
                className="min-h-0 h-auto bg-gradient-to-r from-teal-600 to-teal-700 text-white px-5 sm:px-10 py-2.5 sm:py-3.5 text-sm sm:text-base shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-md w-full sm:w-auto"
              >
                <a href={PARTNER_DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer">
                  <span className="leading-tight text-center block">
                    <span className="block text-sm sm:text-base font-bold">🏆 Become A Seller</span>
                    <span className="block text-xs sm:text-sm font-medium text-white/90 mt-0.5">
                      Get Your Own WhatsApp SaaS CRM
                    </span>
                  </span>
                </a>
              </Button>
              </div>

              <div className="lg:w-1/2 flex justify-center lg:justify-end shrink-0 w-full">
                <img
                  src="/finance-accounting-paper-desk-using.png"
                  alt="Professional working with calculator, documents, and laptop"
                  className="w-full max-w-sm sm:max-w-md lg:max-w-lg h-auto object-contain rounded-xl sm:rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200 bg-white"
                  loading="lazy"
                />
              </div>
            </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gradient-to-br from-teal-50 via-white to-blue-50 relative overflow-hidden">
        <div className="absolute top-20 left-20 w-64 h-64 bg-teal-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

        <div className={MARKETING_PAGE_SHELL}>
          {/* <div className="text-center mb-16 animate-fade-in-up">
            <Badge className="bg-teal-500/10 text-teal-700 hover:bg-teal-500/20 border-teal-200 mb-4">
              Success Stories
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              What Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-blue-600">Partners Say</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Join hundreds of successful partners who are growing their businesses with us
            </p>
          </div> */}

          {/* <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          
            <Card className="group hover:shadow-2xl transition-all duration-500 border-2 hover:border-teal-500 bg-white overflow-hidden animate-fade-in-up hover:-translate-y-2">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    R
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Rajesh Kumar</h4>
                    <p className="text-sm text-gray-600">Affiliate Partner</p>
                    <div className="flex items-center gap-1 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="text-yellow-400 text-sm">★</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -top-2 -left-2 text-6xl text-teal-200 opacity-50">"</div>
                  <p className="text-gray-700 leading-relaxed relative z-10 italic">
                    The affiliate program has been a game-changer for my consulting business. I've earned over ₹2.5 lakhs in just 6 months by referring clients who genuinely benefit from Helicoptic's platform.
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-gray-600">Monthly Earnings</p>
                      <p className="font-bold text-teal-600 text-lg">₹42,000+</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-600">Referrals</p>
                      <p className="font-bold text-gray-900 text-lg">18</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

           
            <Card className="group hover:shadow-2xl transition-all duration-500 border-2 hover:border-blue-500 bg-white overflow-hidden animate-fade-in-up delay-200 hover:-translate-y-2">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    P
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Priya Sharma</h4>
                    <p className="text-sm text-gray-600">White-Label Partner</p>
                    <div className="flex items-center gap-1 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="text-yellow-400 text-sm">★</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -top-2 -left-2 text-6xl text-blue-200 opacity-50">"</div>
                  <p className="text-gray-700 leading-relaxed relative z-10 italic">
                    Launching our white-labeled platform was seamless. We now serve 50+ clients under our brand while Helicoptic handles all the technical complexities. Our revenue has grown 300% in one year!
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-gray-600">Active Clients</p>
                      <p className="font-bold text-blue-600 text-lg">50+</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-600">Growth</p>
                      <p className="font-bold text-gray-900 text-lg">300%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          
            <Card className="group hover:shadow-2xl transition-all duration-500 border-2 hover:border-purple-500 bg-white overflow-hidden animate-fade-in-up delay-300 hover:-translate-y-2">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    A
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Amit Patel</h4>
                    <p className="text-sm text-gray-600">Affiliate Partner</p>
                    <div className="flex items-center gap-1 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="text-yellow-400 text-sm">★</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -top-2 -left-2 text-6xl text-purple-200 opacity-50">"</div>
                  <p className="text-gray-700 leading-relaxed relative z-10 italic">
                    The support team is incredible! They helped me onboard my first 10 clients and the recurring commissions keep growing. It's truly passive income that keeps paying month after month.
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-gray-600">Partnership Duration</p>
                      <p className="font-bold text-purple-600 text-lg">14 Months</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-600">Total Earned</p>
                      <p className="font-bold text-gray-900 text-lg">₹4.2L</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div> */}

          {/* Stats Banner removed */}
        </div>
      </section>

      {/* How It Works */}
<section className="w-full py-20 bg-gradient-to-r from-[#064e3b] to-[#022c22] text-white">
  <div className={MARKETING_PAGE_SHELL}>
    <h2 className="text-center text-4xl font-bold mb-14 animate-fade-in-up">
      How It Works
    </h2>

    <div className="grid md:grid-cols-4 gap-6">
      {[
        {
          title: "Sign Up",
          desc: "Fill out a quick application form to get started.",
          icon: <Users className="w-8 h-8" />,
        },
        {
          title: "Onboarding",
          desc: "Receive training, tools, and dedicated support.",
          icon: <Shield className="w-8 h-8" />,
        },
        {
          title: "Start Earning",
          desc: "Refer clients or sell under your brand and earn.",
          icon: <Zap className="w-8 h-8" />,
        },
        {
          title: "Grow Together",
          desc: "Scale your business with long-term revenue.",
          icon: <Rocket className="w-8 h-8" />,
        },
      ].map((item, i) => (
        <div
          key={i}
          className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 hover:scale-105 transition-all duration-300 animate-fade-in-up"
        >
          <div className="w-14 h-14 bg-teal-500 rounded-xl flex items-center justify-center mb-4">
            {item.icon}
          </div>
          <h4 className="text-xl font-semibold mb-2">{item.title}</h4>
          <p className="text-white/80 text-sm">{item.desc}</p>
        </div>
      ))}
    </div>

  </div>
</section>



{/* Partner Registration */}
<section className="w-full py-20 bg-white">
  <div className={`${MARKETING_PAGE_SHELL} grid items-center gap-10 lg:grid-cols-2 lg:gap-12`}>

    {/* Left Content */}
    <div className="min-w-0 animate-fade-in-up">
      <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
        Select Your Partnership Type &
        <span className="text-teal-600 block">Register</span>
      </h2>
      <p className="text-gray-600 max-w-md">
        Apply for our partnership program and start earning with India’s fastest
        growing WhatsApp Business platform.
      </p>
    </div>

    {/* Form */}
    <Card className="shadow-2xl border-2 animate-fade-in-right">
      <CardContent className="p-8 space-y-4">
        <select className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-teal-500">
          <option>Select partnership type</option>
          <option>Affiliate Partner</option>
          <option>White-Label Partner</option>
        </select>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input className="border rounded-lg px-4 py-3" placeholder="Company Name" />
          <input className="border rounded-lg px-4 py-3" placeholder="Contact Name" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input className="border rounded-lg px-4 py-3" placeholder="Email Address" />
          <input className="border rounded-lg px-4 py-3" placeholder="Phone Number" />
        </div>

        <div className="flex items-start gap-2 text-sm text-gray-600">
          <input type="checkbox" className="mt-1" />
          <span>I agree to the Terms & Conditions</span>
        </div>

        <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white py-5 text-lg">
          Submit Application
        </Button>
      </CardContent>
    </Card>
  </div>
</section>

{/* FAQs */}
<section className="py-20 bg-gradient-to-br from-teal-50 to-green-50">
  <div className={MARKETING_PAGE_SHELL}>
    <div className="max-w-4xl mx-auto w-full">
    <h2 className="mb-10 text-center text-3xl font-bold sm:mb-12 sm:text-4xl animate-fade-in-up">
      FAQs
    </h2>

    {[
      {
        q: "What is the appointment criteria for partners?",
        a: "Partners a  re appointed as a non-exclusive source for referrals of the Services and Partner hereby accepts such appointment. Partner shall have the opportunity, independently or in conjunction with Helicoptic , to identify or recommend the Helicoptic platform to Qualified Referral (as defined below).",
      },
      {
        q: "Who are qualified referral partners at Helicoptic?",
        a: "Partner is eligible to receive a referral commission only if Partner submits a referral to Helicoptic and the referred customer converts to a paying client and which meets the requirements described under this Agreement (“Qualified Referral”).",
      },
      {
        q: "What are the negotiation rights for partnership program on Helicoptic?",
        a: "All contracts for Services between Helicoptic and a Qualified Referral will be conducted solely by Helicoptic. Partner agrees to not negotiate terms or make commitments on behalf of Helicoptic. Helicoptic shall collect all the subscription charges for the Services directly from the Qualified Referral.",
      },
      {
        q: "What is the conversion period of partner program on Helicoptic?",
        a: "Partner shall be entitled to a commission, only if a Qualified Referral signs up as an Helicoptic paying customer within three (3) months (“Conversion Period”) from the date a referral is submitted by Partner. On a case by case basis, the Parties may mutually agree in written format to waive or extend the Conversion Period for a particular referral.",
      },
      {
        q: "What are the eligible product plans of Helicoptic's partneship program?",
        a: "Qualified referrals who sign up as Helicoptic paying customers with a subscription term equal or greater than one (1) month are eligible for referral commission. For clarity, this means that monthly and annual plans of Helicoptic’s products are eligible for referral commission.",
      },
    ].map((item, i) => (
      <details
        key={i}
        className="bg-white rounded-xl shadow-md p-6 mb-4 cursor-pointer transition-all hover:shadow-xl"
      >
        <summary className="font-semibold text-gray-900 text-lg">
          {item.q}
        </summary>
        <p className="mt-3 text-gray-600">{item.a}</p>
      </details>
    ))}
    </div>
  </div>
</section>

      {/* Footer */}
      <footer className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,197,94,0.08)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.08)_0%,transparent_50%)]"></div>
        <div className={`${MARKETING_PAGE_SHELL} py-10 sm:py-14 lg:py-16`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8 lg:gap-8 mb-8 sm:mb-10 lg:mb-12">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <img
                  src="/logo-main_footer.png"
                  alt="Helicoptic Logo"
                  className={MARKETING_LOGO_IMG_CLASS}
                />
              </div>
              <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">
                Product By Helicoptic - Empowering businesses with seamless
                WhatsApp communication solutions.
              </p>
              <div className="flex gap-2 sm:gap-3 pt-2">
                <a
                  href="https://www.facebook.com/holosoft.llc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-gray-800 hover:bg-blue-600 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg group"
                  aria-label="Facebook"
                >
                  <Facebook className="h-5 w-5 text-gray-300 group-hover:text-white transition-colors" />
                </a>
                <a
                  href="https://www.instagram.com/helicopticsolutions/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 w-10 rounded-lg bg-gray-800 hover:bg-gradient-to-br hover:from-purple-600 hover:to-pink-600 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg group"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5 text-gray-300 group-hover:text-white transition-colors" />
                </a>
                <a
                  href="https://www.linkedin.com/in/helicoptic-solutions-610ba6282/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 w-10 rounded-lg bg-gray-800 hover:bg-blue-700 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg group"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-5 w-5 text-gray-300 group-hover:text-white transition-colors" />
                </a>
                <a
                  href="https://www.youtube.com/@HelicopticSolutions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 w-10 rounded-lg bg-gray-800 hover:bg-red-600 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg group"
                  aria-label="YouTube"
                >
                  <Youtube className="h-5 w-5 text-gray-300 group-hover:text-white transition-colors" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-base sm:text-lg mb-4 sm:mb-6 text-white flex items-center gap-2">
                <span className="h-1 w-6 sm:w-8 bg-gradient-to-r from-green-500 to-green-400 rounded-full"></span>
                Quick Links
              </h4>
              <ul className="space-y-2 sm:space-y-3">
                <li>
                  <Link
                    href="/"
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-xs sm:text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>Home</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>Pricing</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/about"
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>About Us</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>Contact Us</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/partner-with-us"
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>Partner With Us</span>
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-base sm:text-lg mb-4 sm:mb-6 text-white flex items-center gap-2">
                <span className="h-1 w-6 sm:w-8 bg-gradient-to-r from-green-500 to-green-400 rounded-full"></span>
                Legal
              </h4>
              <ul className="space-y-2 sm:space-y-3">
                <li>
                  <Link
                    href="/privacy"
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>Privacy Policy</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>Terms and Conditions</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/service-level-agreement"
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>Service Level Agreement</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/refund-policy"
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>Refund Policy</span>
                  </Link>
                </li>
                <li>
                  <a
                    href="/#features"
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>Features</span>
                  </a>
                </li>
                <li>
                  <a
                    href="#integrations"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSectionId("integrations");
                    }}
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>Integrations</span>
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-base sm:text-lg mb-4 sm:mb-6 text-white flex items-center gap-2">
                <span className="h-1 w-6 sm:w-8 bg-gradient-to-r from-green-500 to-green-400 rounded-full"></span>
                Contact Us
              </h4>
              <ul className="space-y-3 sm:space-y-4">
                <li className="flex items-start gap-2 sm:gap-3 text-gray-300 text-xs sm:text-sm">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>R29, Laxmi Nagar, New Delhi - 110092</span>
                </li>
                <li className="flex items-center gap-2 sm:gap-3 text-gray-300 text-xs sm:text-sm">
                  <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-green-400 flex-shrink-0" />
                  <a href="tel:+919931210401" className="hover:text-white transition-colors">
                    +91-7011 772 828
                  </a>
                </li>
                <li className="flex items-center gap-2 sm:gap-3 text-gray-300 text-xs sm:text-sm">
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-green-400 flex-shrink-0" />
                  <a
                    href="mailto:sales@helicopticsolutions.com"
                    className="hover:text-white transition-colors break-all"
                  >
                    info@helicopticsolutions.com
                  </a>
                </li>
                <li className="flex items-center gap-2 sm:gap-3 text-gray-300 text-xs sm:text-sm">
                  <Send className="h-4 w-4 sm:h-5 sm:w-5 text-green-400 flex-shrink-0" />
                  <span>Working Hours: 11:00 AM - 7:00 PM</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-base sm:text-lg mb-4 sm:mb-6 text-white flex items-center gap-2">
                <span className="h-1 w-6 sm:w-8 bg-gradient-to-r from-green-500 to-green-400 rounded-full"></span>
                Registration
              </h4>
              <ul className="space-y-3 sm:space-y-4">
                <li className="flex items-start gap-2 sm:gap-3 text-gray-300 text-xs sm:text-sm">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Registration Number : 07AAECH6917Q3ZW</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 sm:mt-10 lg:mt-12 pt-6 sm:pt-8 border-t border-gray-700">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
              <p className="text-gray-400 text-xs sm:text-sm text-center md:text-left">
                Copyright© <span className="text-white font-semibold">Helicoptic</span>{" "}
                {new Date().getFullYear()}. All rights reserved.
              </p>
              <div className="flex items-center gap-2 text-gray-400 text-xs sm:text-sm">
                <span>Made with</span>
                <Heart className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 fill-red-500" />
                <span>by Helicoptic</span>
              </div>
            </div>
          </div>
        </div>
      </footer>


      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-in-right {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out;
        }

        .animate-fade-in-right {
          animation: fade-in-right 0.8s ease-out;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-float-delay {
          animation: float 3s ease-in-out infinite 1.5s;
        }

        .delay-200 {
          animation-delay: 0.2s;
        }

        .delay-300 {
          animation-delay: 0.3s;
        }

        .delay-1000 {
          animation-delay: 1s;
        }
      `}</style>
    </div>
  );
}


