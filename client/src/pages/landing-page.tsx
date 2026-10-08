import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  MessageSquare,
  Shield,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Users,
  Globe,
  Bot,
  Star,
  Play,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  ShoppingCart,
  GraduationCap,
  Truck,
  Briefcase,
  Home,
  Heart,
  Car,
  Plane,
  Scissors,
  UtensilsCrossed,
  Sparkles,
  Building2,
  User,
  Zap,
  BarChart3,
  Mail,
  Megaphone,
  Video,
  Package,
  Workflow,
  Calendar,
  CreditCard,
  Code,
  Cloud,
  Sheet,
  TrendingUp,
  Phone,
  MapPin,
  Send,
} from "lucide-react";
import { MarketingSiteHeader } from "@/components/marketing-site-header";
import {
  MARKETING_LOGO_IMG_CLASS,
  MARKETING_PAGE_SHELL,
} from "@/lib/marketing-layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

export default function LandingPage() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const [currentReviewPage, setCurrentReviewPage] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollerInnerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const autoScrollRef = useRef<number | null>(null);

  const { data: bookDemo } = useQuery<{
    configured?: boolean;
    path?: string | null;
    slug?: string | null;
  }>({
    queryKey: ["/api/public/book-demo"],
    queryFn: async () => {
      const res = await fetch("/api/public/book-demo");
      if (!res.ok) return { configured: false };
      return res.json();
    },
    staleTime: 60_000,
  });
  const bookDemoHref =
    bookDemo?.configured && (bookDemo.path || bookDemo.slug)
      ? bookDemo.path || `/book/${bookDemo.slug}`
      : null;

  useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  // Drag scrolling handlers for logo scroller
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollerRef.current) return;
    setIsDragging(true);
    setIsPaused(true);
    setStartX(e.pageX - scrollerRef.current.offsetLeft);
    setScrollLeft(scrollerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!scrollerRef.current) return;
    setIsDragging(true);
    setIsPaused(true);
    setStartX(e.touches[0].pageX - scrollerRef.current.offsetLeft);
    setScrollLeft(scrollerRef.current.scrollLeft);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !scrollerRef.current) return;
    const x = e.touches[0].pageX - scrollerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleScroll = () => {
    if (!isPaused) {
      setIsPaused(true);
    }
  };

  // Helicoptic Solutions testimonials
  const testimonials = [
    {
      quote: "Never going back to any others",
      name: "Customer",
      role: "Business Owner",
    },
    {
      quote: "Helicoptic Solutions is an absolute must have!",
      name: "Customer",
      role: "Marketing Manager",
    },
    {
      quote: "Helicoptic Solutions is best in industry",
      name: "Customer",
      role: "CEO",
    },
    {
      quote: "Helicoptic Solutions Where Innovation Meets Excellence",
      name: "Customer",
      role: "Operations Head",
    },
  ];

  // Company logos for scroller
  const companyLogos = [
    {
      name: "bloggistan®",
      image:
        "https://aizapy.com/wp-content/uploads/2025/10/bloggistan-logo.png",
    },
    {
      name: "DAYITWA Education",
      image: "https://aizapy.com/wp-content/uploads/2025/10/dayitwa-logo.png",
    },
    {
      name: "Delhi Institute Of Digital Marketing®",
      image: "https://aizapy.com/wp-content/uploads/2025/10/didm-logo.jpg",
    },
    {
      name: "Online Strikers",
      image:
        "https://aizapy.com/wp-content/uploads/2025/10/onlinestrikers-logo.png",
    },
    {
      name: "SELLMERGER",
      image:
        "https://aizapy.com/wp-content/uploads/2025/10/sellmerger-logo-scaled-1.png",
    },
    {
      name: "Biz Molecules",
      image:
        "https://aizapy.com/wp-content/uploads/2025/10/bizmolecule-logo.jpeg",
    },
  ];

  // Before & After - matching Helicoptic Solutions exactly
  const beforeAfter = {
    before: [
      { text: "No. get blocked When send bulk messages" },
      { text: "Wasting time on manual replies" },
      { text: "No messages delivery or read tracking" },
      { text: "Customer Messages missed by team" },
      { text: "Broadcast limit 256 contacts only" },
      { text: "No followup messages" },
      { text: "No proper customer data management system" },
      { text: "missed appointments or booking reminders" },
      { text: "No link click or purchase tracking" },
      { text: "No system to integrate with lead source" },
    ],
    after: [
      { text: "Send 100000+ bulk messages without getting banned" },
      {
        text: "With auto-replies and chatbot, every lead gets instant response",
      },
      {
        text: "API dashboard shows full delivery, read and reply tracking report",
      },
      { text: "Multi-agent login to manage replies from one number" },
      { text: "With API, send 10000+ personalized messages in one click" },
      { text: "API allows scheduled follow-ups on day1, day3, day5, etc." },
      { text: "Complete customer data management system" },
      { text: "Automated appointment and booking reminders" },
      { text: "Full link click and purchase tracking" },
      { text: "Easy integration with all lead sources" },
    ],
  };

  // Industries matching Helicoptic Solutions with WhatsApp-related images
  const industries = [
    {
      icon: Building2,
      title: "Real Estate",
      description:
        "Use WhatsApp Business with Helicoptic Solutions to acquire, engage, convert prospects & retain customers effortlessly.",
      image:
        "https://aizapy.com/wp-content/uploads/2025/09/insdustry-real-estate-banner-2.png",
      chatBubble: {
        messages: [
          "Hi! I'm interested in viewing the property.",
          "Great! I can help you schedule a viewing. When would be convenient?",
        ],
        buttons: ["Schedule Viewing", "Property Details"],
      },
    },
    {
      icon: Heart,
      title: "Health & Wellness",
      description:
        "Improve patient satisfaction with Helicoptic Solutions through automated bookings, updates, and personalized offers.",
      image: "https://aizapy.com/wp-content/uploads/2025/09/helth-1.png",
      chatBubble: {
        messages: [
          "Hi, (Name). How can I help you today?",
          "Please select an option:",
        ],
        buttons: ["Book Appointment", "View Services", "Check Status"],
      },
    },
    {
      icon: Car,
      title: "Automotive Industry",
      description:
        "WhatsApp Business API simplifies customer communication, promotions to service bookings and updates.",
      image: "https://aizapy.com/wp-content/uploads/2025/09/automobile-1-1.png",
      chatBubble: {
        messages: [
          "Your car service is due! Book now and get 20% off.",
          "Would you like to schedule?",
        ],
        buttons: ["Book Service", "View Offers"],
      },
    },
    {
      icon: Home,
      title: "Home Decor & Furnishing",
      description:
        "Boost your home decor and furnishing business through end-to-end commerce using Helicoptic Solutions.",
      image: "https://aizapy.com/wp-content/uploads/2025/09/homedecor-1-1.png",
      chatBubble: {
        messages: ["Explore our new collection!", "View our catalog"],
        buttons: ["Browse Catalog", "Shop Now"],
      },
    },
    {
      icon: Briefcase,
      title: "Marketing Agencies",
      description:
        "WhatsApp helps marketing agencies empower clients to stand out in today's crowded digital landscape.",
      image: "https://aizapy.com/wp-content/uploads/2025/09/market.webp",
      chatBubble: {
        messages: [
          "Hope you're loving the supplement toner! It's time to restock.",
          "Buy Now",
        ],
        buttons: ["Buy Now", "View Details"],
      },
    },
    {
      icon: GraduationCap,
      title: "Education",
      description:
        "Boost course enrollments with Helicoptic Solutions and keep students informed through WhatsApp updates.",
      image: "https://aizapy.com/wp-content/uploads/2025/09/education-1.png",
      chatBubble: {
        messages: ["Hi, (Name). How can I help you today?", "Please select:"],
        buttons: [
          "Course details",
          "Application status",
          "Arrange appointment",
        ],
      },
    },
    {
      icon: User,
      title: "Freelancer & Consultants",
      description:
        "Discover how businesses and freelancers use WhatsApp to craft personalized and engaging customer journeys.",
      image: "https://aizapy.com/wp-content/uploads/2025/09/market.webp",
      chatBubble: {
        messages: [
          "Hello, I'd like to avail some of your design services.",
          "Happy to help! Here's my website where you can find all my services listed out.",
        ],
        buttons: ["Website"],
      },
    },
    {
      icon: Plane,
      title: "Travel & Tourism",
      description:
        "Streamline your travel business with Helicoptic Solutions simplify bookings, automate support, and boost customer satisfaction.",
      image: "https://aizapy.com/wp-content/uploads/2025/09/e-commerce-1.png",
      chatBubble: {
        messages: [
          "Hey Jane, anything else you'd like to add to your travel package?",
          "Please add the sunset cruise for Wednesday.",
          "Travel Itinerary",
        ],
        buttons: ["Payment Link"],
      },
    },
    {
      icon: Scissors,
      title: "Spa & Salons",
      description:
        "Grow your Spa & Salon business with scheduling, payments, and catalogs all through WhatsApp.",
      image: "https://aizapy.com/wp-content/uploads/2025/09/helth-1.png",
      chatBubble: {
        messages: [
          "Broadcast Message - Sent to 3031 customers",
          "Hey Jane, We're running a 15% off on all our services for the next 72 hours. Explore our catalog!",
        ],
        buttons: ["Explore Catalog"],
      },
    },
    {
      icon: UtensilsCrossed,
      title: "Restaurants Businesses",
      description:
        "Streamline orders, payments, menu sharing, and more with WhatsApp for quick, easy customer interactions.",
      image: "https://aizapy.com/wp-content/uploads/2025/09/e-commerce-1.png",
      chatBubble: {
        messages: ["Hi! Would you like to place an order?", "View our menu"],
        buttons: ["View Menu", "Order Now"],
      },
    },
    {
      icon: ShoppingCart,
      title: "E-commerce",
      description:
        "Scale your D2C brand with Helicoptic Solutions using end-to-end commerce and WhatsApp catalog sharing.",
      image: "https://aizapy.com/wp-content/uploads/2025/09/e-commerce-1.png",
      chatBubble: {
        messages: ["Your order #1234 has been shipped!", "Track your order"],
        buttons: ["Track Order", "View Details"],
      },
    },
    {
      icon: Sparkles,
      title: "Beauty & Cosmetics",
      description:
        "Discover how top brands use WhatsApp Business API to acquire, engage, and convert shoppers effortlessly.",
      image: "https://aizapy.com/wp-content/uploads/2025/09/homedecor-1-1.png",
      chatBubble: {
        messages: [
          "New arrivals! Check out our latest beauty products.",
          "Shop now",
        ],
        buttons: ["Shop Now", "View Collection"],
      },
    },
  ];

  // Features matching Helicoptic Solutions
  const features = [
    {
      icon: Bot,
      title: "AI-Driven CRM",
      description:
        "Accelerate sales and support with AI that predicts customer needs and never misses a follow-up.",
      bullets: [
        "Maximize productivity through AI-powered automation and smart lead prioritization",
        "Turn data into action with real-time analytics and deep customer insights",
      ],
      imageUrl:
        "https://aizapy.com/wp-content/uploads/2024/01/AI-Driven-CRM.png",
    },
    {
      icon: Users,
      title: "Centralized Team Inbox",
      description:
        "Simplify customer communication with a single inbox your whole team can access.",
      bullets: [
        "Collaborate smarter with a shared inbox that makes managing customer conversations effortless",
        "Boost productivity with internal notes, smart collision alerts, and seamless real-time teamwork",
      ],
      imageUrl:
        "https://aizapy.com/wp-content/uploads/2024/01/Centralized-Team-Inbox.png",
    },
    {
      icon: Megaphone,
      title: "Drip Campaign",
      description:
        "Automatically engage leads with personalized messages delivered at the perfect moment.",
      bullets: [
        "Keep conversations going with smart, trigger-based email and WhatsApp messaging",
        "Nurture cold leads into long-term customers using automated follow-up workflows",
      ],
      imageUrl:
        "https://aizapy.com/wp-content/uploads/2024/01/Drip-Campaign.png",
    },
  ];

  // Integrations - using original app/product icons from public/icons/ folder
  // Maps integration names to actual file names in the icons folder
  // All 16 icons from the icons folder are included
  const getIconPath = (name: string): string => {
    // Map integration names to actual file names (with extensions)
    const iconFileMap: Record<string, string> = {
      Gmail: "gmail.ico",
      Facebook: "facebook.svg",
      Shopify: "shopify.svg",
      Zoom: "zoom.ico",
      Instagram: "insta.png",
      "Google Calendar": "calendar_31_2x.png",
      "Trade India": "trade.ico",
      WooCommerce: "woocommerce.svg",
      "Google Sheets": "icon_1_spreadsheet_x32.png",
      Tally: "tally.ico",
      Zoho: "zoho.ico",
      Amazon: "amazon.png",
      Canva: "canva.png",
      LinkedIn: "linkedin.png",
      Stripe: "stripe.png",
      Twitter: "twitter.png",
    };

    // If exact match found, use it
    if (iconFileMap[name]) {
      return `/icons/${iconFileMap[name]}`;
    }

    // Otherwise, try to construct filename from name
    const baseName = name.toLowerCase().replace(/\s+/g, "-").replace(/\./g, "");
    // Try common extensions in order
    return `/icons/${baseName}.png`;
  };

  // All 16 integrations matching all icons in the folder (4 rows x 4 columns)
  const integrations = [
    { name: "Gmail", bgColor: "bg-white dark:bg-white" },
    { name: "Facebook", bgColor: "bg-white dark:bg-white" },
    { name: "Shopify", bgColor: "bg-white dark:bg-white" },
    { name: "Zoom", bgColor: "bg-white dark:bg-white" },
    { name: "Instagram", bgColor: "bg-white dark:bg-white" },
    { name: "Google Calendar", bgColor: "bg-white dark:bg-white" },
    { name: "Trade India", bgColor: "bg-white dark:bg-white" },
    { name: "WooCommerce", bgColor: "bg-white dark:bg-white" },
    { name: "Google Sheets", bgColor: "bg-white dark:bg-white" },
    { name: "Tally", bgColor: "bg-white dark:bg-white" },
    { name: "Zoho", bgColor: "bg-white dark:bg-white" },
    { name: "Amazon", bgColor: "bg-white dark:bg-white" },
    { name: "Canva", bgColor: "bg-white dark:bg-white" },
    { name: "LinkedIn", bgColor: "bg-white dark:bg-white" },
    { name: "Stripe", bgColor: "bg-white dark:bg-white" },
    { name: "Twitter", bgColor: "bg-white dark:bg-white" },
  ];

  // Reviews matching the design
  const reviews = [
    {
      name: "Priya Singh",
      role: "Marketing Manager",
      text: "With Helicoptic Solutions, our team collaboration and lead management have become seamless. The unified inbox and real-time analytics make decision-making much faster.",
      rating: 4.5,
      image:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&auto=format&q=80",
    },
    {
      name: "Amit Kumar",
      role: "Operations Head",
      text: "The priority support from Helicoptic Solutions' team is exceptional. We get instant help whenever needed, and the platform itself is intuitive and reliable.",
      rating: 4.5,
      image:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&auto=format&q=80",
    },
    {
      name: "Neha Bhatiya",
      role: "Business Owner",
      text: "Helicoptic Solutions' AI-powered automation has boosted our engagement and productivity. From smart replies to lead capture, everything works perfectly and saves us valuable time.",
      rating: 5,
      image:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&auto=format&q=80",
    },
    {
      name: "Rahul Mehta",
      role: "CEO",
      text: "Helicoptic Solutions' features like real-time collaboration, intelligent workflows, and predictive analytics have transformed how we work. Truly a game-changer!",
      rating: 5,
      image:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&auto=format&q=80",
    },
    {
      name: "Sneha Patel",
      role: "Sales Director",
      text: "The automation features have increased our sales conversion rate by 40%. The lead tracking and follow-up system is incredibly efficient.",
      rating: 5,
      image:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&auto=format&q=80",
    },
    {
      name: "Vikram Sharma",
      role: "CTO",
      text: "Integration was seamless and the API documentation is excellent. Our development team was up and running in no time.",
      rating: 4.5,
      image:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&auto=format&q=80",
    },
    {
      name: "Anjali Desai",
      role: "Customer Success Manager",
      text: "The multi-agent support feature has revolutionized our customer service. Response times have improved dramatically.",
      rating: 5,
      image:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&auto=format&q=80",
    },
    {
      name: "Rajesh Kumar",
      role: "Founder",
      text: "Best investment we made this year. The ROI has been incredible and our customer engagement has never been better.",
      rating: 5,
      image:
        "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&auto=format&q=80",
    },
    {
      name: "Meera Nair",
      role: "Product Manager",
      text: "The analytics dashboard provides insights we never had before. It's helped us make data-driven decisions.",
      rating: 4.5,
      image:
        "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&auto=format&q=80",
    },
  ];

  // Pagination logic for reviews - show 3 at a time
  const reviewsPerPage = 3;
  const totalReviewPages = Math.ceil(reviews.length / reviewsPerPage);
  const startIndex = currentReviewPage * reviewsPerPage;
  const endIndex = startIndex + reviewsPerPage;
  const currentReviews = reviews.slice(startIndex, endIndex);

  // FAQ matching Helicoptic Solutions
  const faqs = [
    {
      question: "What does Helicoptic Solutions API do?",
      answer:
        "Helicoptic Solutions API provides businesses with a WhatsApp marketing software they can use to Broadcast & automate messages, run Click to WhatsApp Ads, build Chatbots, showcase catalogues, provide multi-agent Live chat support, collect payments within WhatsApp and much more.",
    },
    {
      question:
        "Is Helicoptic Solutions API an Official WhatsApp Marketing Software?",
      answer:
        "As a trusted tech provider, Helicoptic Solutions delivers enterprise-grade solutions built on official WhatsApp Business APIs.",
    },
    {
      question:
        "Can I Integrate Helicoptic Solutions API With My Existing System?",
      answer:
        "Yes, Helicoptic Solutions API offers API integration, allowing you to connect with your existing systems and applications for a unified workflow.",
    },
    {
      question: "Is Helicoptic Solutions API Secure?",
      answer:
        "Absolutely. Helicoptic Solutions API is built with robust security features to protect your data and ensure privacy in all communications.",
    },
    {
      question: "Can I Use an Existing Number With Helicoptic Solutions API?",
      answer:
        "Yes, you can use your existing WhatsApp application number or existing WhatsApp API number with Helicoptic Solutions API.",
    },
    {
      question: "How do we pay for WhatsApp messages?",
      answer:
        "To make payments, you need to add your Credit/Debit Card (Visa/MasterCard) with international usage enabled.",
    },
    {
      question:
        "Can I Manage Multiple Teams and Users in Helicoptic Solutions API?",
      answer:
        "Helicoptic Solutions API provides robust organization, user, and team management features, allowing you to assign roles, set permissions, and ensure efficient collaboration across your business.",
    },
    {
      question: "Can I Get a Refund?",
      answer:
        "A refund on the subscription charge will only be applicable if the WhatsApp API fails to start on the dashboard.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <MarketingSiteHeader />

      {/* Hero Section - Redesigned with Animations */}
      <section className="relative overflow-hidden ">
        {/* Grid Pattern Background */}
        <div
          className="absolute inset-0 -z-10 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute inset-0 -z-10 bg-white dark:bg-background" />

        <div className={MARKETING_PAGE_SHELL}>
          <div className="grid min-h-0 items-center gap-6 py-8 sm:py-10 lg:grid-cols-2 lg:gap-8 lg:py-12 lg:min-h-[min(90svh,650px)]">
            {/* Left Side - Content with Enhanced Animations and Gradients */}
            <div className="order-2 flex min-w-0 flex-col justify-center space-y-4 lg:order-1 lg:space-y-6">
              {/* Top Badges - Animated with Gradient Borders */}
              <div
                className="flex flex-wrap items-center gap-2 lg:gap-3 animate-fade-in-up"
                style={{ animationDelay: "0.1s" }}
              >
                <Badge
                  className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-full bg-white dark:bg-card font-medium text-xs lg:text-sm hover:scale-105 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl"
                  style={{
                    boxShadow:
                      "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                  }}
                >
                  <MessageSquare
                    className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4 animate-pulse inline-block"
                    style={{ color: "#4fb576" }}
                  />
                  <span
                    style={{
                      backgroundImage:
                        "linear-gradient(to top, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    Powered by Official WhatsApp Business API
                  </span>
                </Badge>
                <Badge
                  className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-full bg-white dark:bg-card font-medium text-xs lg:text-sm hover:scale-105 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl"
                  style={{
                    boxShadow:
                      "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                  }}
                >
                  <span
                    className="mr-1.5 lg:mr-2 text-sm lg:text-lg font-bold animate-spin-slow inline-block"
                    style={{
                      backgroundImage:
                        "linear-gradient(to top, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    ∞
                  </span>
                  <span
                    style={{
                      backgroundImage:
                        "linear-gradient(to top, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    Meta Business Partners
                  </span>
                </Badge>
              </div>

              {/* Main Headline - Animated with Gradient Colors */}
              <div className="space-y-2 lg:space-y-3">
                <h1
                  className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight animate-fade-in-up"
                  style={{ animationDelay: "0.2s" }}
                >
                  <span
                    className="inline-block animate-slide-in-left"
                    style={{
                      backgroundImage:
                        "linear-gradient(to top, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    100% Ban Proof Meta Verified API
                  </span>
                </h1>
                <h2
                  className="text-2xl sm:text-3xl lg:text-4xl font-bold animate-fade-in-up"
                  style={{ animationDelay: "0.4s" }}
                >
                  <span
                    className="inline-block animate-gradient-text"
                    style={{
                      backgroundImage:
                        "linear-gradient(to top, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      backgroundSize: "200% auto",
                      animation: "gradient-x 3s ease infinite",
                    }}
                  >
                    Send Unlimited WhatsApp Messages
                  </span>
                </h2>
                <h3
                  className="text-xl sm:text-2xl lg:text-3xl font-bold animate-fade-in-up"
                  style={{ animationDelay: "0.6s" }}
                >
                  <span
                    className="inline-block animate-bounce-subtle"
                    style={{
                      backgroundImage:
                        "linear-gradient(to top, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    Just in 1 Click
                  </span>
                </h3>
              </div>

              {/* Description - Animated with Smaller Text and Gradient */}
              <p
                className="text-xs sm:text-sm lg:text-base max-w-xl animate-fade-in-up leading-relaxed"
                style={{ animationDelay: "0.8s" }}
              >
                <span
                  className="inline-block animate-fade-in-up"
                  style={{
                    backgroundImage:
                      "linear-gradient(to top, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    opacity: 0.8,
                  }}
                >
                  World's most trusted and affordable complete business
                  automation API platform
                </span>
              </p>

              {/* CTA Buttons - Animated with Gradient and Smaller Size */}
              <div
                className="flex flex-col sm:flex-row items-start gap-3 animate-fade-in-up"
                style={{ animationDelay: "1s" }}
              >
                <Link href="/signup" className="group">
                  <div
                    className="inline-block rounded-lg p-[2px]"
                    style={{
                      backgroundImage:
                        "linear-gradient(to top, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                      boxShadow:
                        "0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    <Button
                      size="sm"
                      className="text-xs sm:text-sm px-4 sm:px-5 py-2.5 sm:py-3 h-auto text-white rounded-lg transition-all duration-300 font-semibold transform hover:scale-105 hover:-translate-y-1 bg-green-600 hover:bg-green-700 w-full"
                    >
                      <span className="flex items-center">
                        Try Helicoptic Solutions for FREE
                        <ArrowRight className="ml-1.5 sm:ml-2 h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform duration-300 text-white" />
                      </span>
                    </Button>
                  </div>
                </Link>
                <div className="relative group">
                  <Link href="/signup">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs sm:text-sm px-4 sm:px-5 py-2.5 sm:py-3 h-auto border-2 bg-gradient-to-r from-white to-cyan-50 dark:from-card dark:to-cyan-950/20 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-950/20 transition-all duration-300 font-semibold flex flex-col items-center hover:scale-105 hover:-translate-y-1"
                      style={{
                        borderImage:
                          "linear-gradient(to top, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%) 1",
                        borderImageSlice: 1,
                        boxShadow:
                          "0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)",
                      }}
                    >
                      <span className="flex items-center">
                        <span
                          className="font-bold"
                          style={{
                            backgroundImage:
                              "linear-gradient(to top, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                          }}
                        >
                          Switch and Save
                        </span>
                        <ArrowRight
                          className="ml-1.5 sm:ml-2 h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform duration-300"
                          style={{ color: "#4c7788" }}
                        />
                      </span>
                      <span className="text-[10px] sm:text-xs mt-0.5 font-normal bg-gradient-to-r from-gray-500 via-gray-400 to-gray-500 dark:from-gray-400 dark:via-gray-300 dark:to-gray-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-x">
                        only for existing API users
                      </span>
                    </Button>
                  </Link>
                  <Badge className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 border-0 px-2 py-0.5 text-[10px] font-bold rounded shadow-md animate-pulse hover:animate-none">
                    <span className="bg-gradient-to-r from-white to-orange-50 bg-clip-text text-transparent">
                      OFFER
                    </span>
                  </Badge>
                </div>
              </div>

              {/* Bottom Badge - Animated with Gradient */}
              <div
                className="pt-1 animate-fade-in-up"
                style={{ animationDelay: "1.2s" }}
              >
                <Badge className="relative px-2 py-1.5 sm:px-3 lg:px-4 lg:py-2 rounded-full bg-gradient-to-r from-white to-cyan-50 dark:from-card dark:to-cyan-950/20 font-medium text-[10px] sm:text-xs lg:text-sm shadow-sm hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden w-full sm:w-auto max-w-full">
                  <div
                    className="absolute inset-0 rounded-full opacity-20 animate-gradient-x bg-[length:200%_auto]"
                    style={{
                      backgroundImage:
                        "linear-gradient(to top, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                    }}
                  ></div>
                  <div
                    className="relative border-2 rounded-full px-2 py-1.5 sm:px-3 lg:px-4 lg:py-2 bg-gradient-to-r from-white to-cyan-50 dark:from-card dark:to-cyan-950/20 flex items-center gap-1 sm:gap-1.5"
                    style={{ borderColor: "#4c7788" }}
                  >
                    <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 lg:h-4 lg:w-4 fill-yellow-400 text-yellow-400 animate-spin-slow flex-shrink-0" />
                    <span
                      className="whitespace-normal sm:whitespace-nowrap break-words sm:break-normal"
                      style={{
                        backgroundImage:
                          "linear-gradient(to top, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      Best Alternative to Wati, AiSensy, Double Tick and
                      Interakt
                    </span>
                  </div>
                </Badge>
              </div>
            </div>

            {/* Right Side - Image with Floating Logos and Contact Box */}
            <div className="relative order-1 mt-6 flex min-w-0 w-full flex-col items-start justify-start overflow-visible sm:mt-8 sm:items-center sm:justify-center lg:order-2 lg:mt-0">
              {/* Main container with grid background like reference */}
              <div className="relative w-full max-w-[280px] sm:max-w-[340px] lg:max-w-[480px] overflow-visible pl-0 sm:px-4 lg:px-0">
                {/* Grid background matching reference */}
                <div
                  className="absolute inset-0 -z-10 opacity-20"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
                    `,
                    backgroundSize: "30px 30px",
                  }}
                />

                {/* Centered image with surrounding icons */}
                <div className="relative overflow-visible">
                  {/* Professional Woman Image - Matching reference layout */}
                  <div className="relative mx-auto w-[240px] h-[320px] sm:w-[280px] sm:h-[380px] lg:w-[360px] lg:h-[480px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl animate-fade-in-right hover:scale-105 transition-transform duration-500 bg-white">
                    <img
                      src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=600&fit=crop&crop=face&auto=format&q=80"
                      alt="Professional business woman"
                      className="w-full h-full object-cover object-center"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src =
                          "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=600&fit=crop&crop=face&auto=format&q=80";
                      }}
                    />
                  </div>

                  {/* Floating Icons - Positioned like reference image (on sides, not corners) */}
                  {/* WhatsApp Icon - Top Left Side */}
                  <div className="absolute top-2 -left-2 sm:top-8 sm:-left-4 lg:top-12 lg:-left-8 w-10 h-10 sm:w-14 sm:h-14 lg:w-20 lg:h-20 bg-green-500 rounded-xl sm:rounded-2xl lg:rounded-3xl flex items-center justify-center shadow-2xl animate-float hover:scale-110 transition-transform duration-300 cursor-pointer group z-20 p-1.5 sm:p-2 lg:p-3">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
                      alt="WhatsApp"
                      className="h-full w-full object-contain group-hover:scale-125 transition-transform duration-300"
                    />
                  </div>

                  {/* Facebook Icon - Bottom Left Side with more space from image */}
                  <a
                    href="https://www.facebook.com/holosoft.llc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-20 -left-2 sm:bottom-32 sm:-left-4 lg:bottom-40 lg:-left-20 w-10 h-10 sm:w-14 sm:h-14 lg:w-20 lg:h-20 bg-blue-500 rounded-xl sm:rounded-2xl lg:rounded-3xl flex items-center justify-center shadow-2xl animate-float-delayed hover:scale-110 transition-transform duration-300 cursor-pointer group z-20"
                  >
                    <Facebook className="h-5 w-5 sm:h-7 sm:w-7 lg:h-10 lg:w-10 text-white group-hover:scale-125 transition-transform duration-300" />
                  </a>

                  {/* Shopify Icon - Top Right Side */}
                  <div className="absolute top-2 -right-2 sm:top-8 sm:-right-4 lg:top-12 lg:-right-8 w-10 h-10 sm:w-14 sm:h-14 lg:w-20 lg:h-20 bg-white dark:bg-gray-100 rounded-xl sm:rounded-2xl lg:rounded-3xl flex items-center justify-center shadow-2xl animate-float hover:scale-110 transition-transform duration-300 cursor-pointer group z-20 p-1.5 sm:p-2 lg:p-3 border border-gray-200">
                    <img
                      src="/icons/shopify.svg"
                      alt="Shopify"
                      className="h-full w-full object-contain group-hover:scale-125 transition-transform duration-300"
                    />
                  </div>

                  {/* Instagram Icon - Bottom Right Side with more space from image */}
                  <div className="absolute bottom-20 -right-2 sm:bottom-32 sm:-right-4 lg:bottom-40 lg:-right-20 w-10 h-10 sm:w-14 sm:h-14 lg:w-20 lg:h-20 bg-white dark:bg-gray-100 rounded-xl sm:rounded-2xl lg:rounded-3xl flex items-center justify-center shadow-2xl animate-float-delayed hover:scale-110 transition-transform duration-300 cursor-pointer group z-20 p-1.5 sm:p-2 lg:p-3 border border-gray-200">
                    <img
                      src="/icons/insta.png"
                      alt="Instagram"
                      className="h-full w-full object-contain group-hover:scale-125 transition-transform duration-300"
                    />
                  </div>

                  {/* Contact Information Box - Overlapping image from bottom, matching reference */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 -mb-2 sm:-mb-2 lg:-mb-3 z-30 w-[75%] sm:w-[70%] lg:w-[65%]">
                    <div className="bg-green-700 dark:bg-green-800 rounded-md sm:rounded-lg lg:rounded-xl p-1.5 sm:p-2 lg:p-2.5 shadow-xl animate-fade-in-up hover:scale-105 transition-transform duration-300">
                      <div className="text-white space-y-1 sm:space-y-1.5 lg:space-y-2">
                        <div className="flex items-center gap-1 sm:gap-1.5">
                          <div className="bg-white/20 rounded-full p-0.5 sm:p-1 lg:p-1.5">
                            <Phone className="h-2 w-2 sm:h-2.5 sm:w-2.5 lg:h-3 lg:w-3 animate-pulse" />
                          </div>
                          <p className="text-[8px] sm:text-[9px] lg:text-[10px] font-semibold uppercase tracking-wide">
                            FOR FURTHER INQUIRIES CALL
                          </p>
                        </div>
                        <a
                          href="tel:+919931210401"
                          className="block text-xs sm:text-sm lg:text-base font-bold hover:underline transition-all duration-300 hover:text-green-200"
                        >
                          +91 7011 772 828
                        </a>
                        {bookDemoHref ? (
                          <Link href={bookDemoHref} className="block">
                            <Button
                              size="sm"
                              className="w-full bg-green-600 hover:bg-green-500 text-white font-medium rounded-md lg:rounded-lg text-[9px] sm:text-[10px] lg:text-xs py-1 sm:py-1.5 lg:py-2 transition-all duration-300 hover:scale-105 hover:shadow-md border border-green-500 h-auto"
                            >
                              Book Free Demo
                            </Button>
                          </Link>
                        ) : (
                          <a
                            href="https://link.webgearz.com/widget/bookings/wa/demo"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <Button
                              size="sm"
                              className="w-full bg-green-600 hover:bg-green-500 text-white font-medium rounded-md lg:rounded-lg text-[9px] sm:text-[10px] lg:text-xs py-1 sm:py-1.5 lg:py-2 transition-all duration-300 hover:scale-105 hover:shadow-md border border-green-500 h-auto"
                            >
                              Book Free Demo
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonials Section - Below Hero */}
          <div id="testimonials" className="mt-12 sm:mt-16 lg:mt-20">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-7xl mx-auto">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="text-center space-y-3">
                  {/* 5 Yellow Stars */}
                  <div className="flex items-center justify-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-3 w-3 text-yellow-400 fill-yellow-400"
                      />
                    ))}
                  </div>
                  {/* Testimonial Text */}
                  <p className="text-[10px] sm:text-xs font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                    "{testimonial.quote}"
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Company Logos Scroller */}
          <div className="mt-8 sm:mt-12 lg:mt-16 bg-white dark:bg-gray-900 py-6 sm:py-8">
            <div
              ref={scrollerRef}
              className="relative overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onScroll={handleScroll}
            >
              <div
                ref={scrollerInnerRef}
                className={`flex gap-8 sm:gap-12 lg:gap-16 select-none ${
                  isPaused ? "" : "animate-scroll"
                }`}
                style={{ width: "max-content" }}
              >
                {/* First set of logos */}
                {companyLogos.map((logo, index) => (
                  <div
                    key={`logo-1-${index}`}
                    className="flex-shrink-0 flex items-center justify-center min-w-[120px] sm:min-w-[150px] h-10 sm:h-12"
                  >
                    <img
                      src={logo.image}
                      alt={logo.name}
                      className="h-full w-auto object-contain opacity-70 hover:opacity-100 transition-opacity"
                    />
                  </div>
                ))}
                {/* Duplicate set for seamless loop */}
                {companyLogos.map((logo, index) => (
                  <div
                    key={`logo-2-${index}`}
                    className="flex-shrink-0 flex items-center justify-center min-w-[120px] sm:min-w-[150px] h-10 sm:h-12"
                  >
                    <img
                      src={logo.image}
                      alt={logo.name}
                      className="h-full w-auto object-contain opacity-70 hover:opacity-100 transition-opacity"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced CSS Animations */}
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(2deg); }
          }
          @keyframes float-delayed {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(15px) rotate(-2deg); }
          }
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
              transform: translateX(30px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes slide-in-left {
            from {
              opacity: 0;
              transform: translateX(-30px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes gradient-x {
            0%, 100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }
          @keyframes bounce-subtle {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-5px);
            }
          }
          @keyframes spin-slow {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
          .animate-float {
            animation: float 4s ease-in-out infinite;
          }
          .animate-float-delayed {
            animation: float-delayed 4s ease-in-out infinite;
            animation-delay: 2s;
          }
          /* Use fill-mode "both" — do NOT set opacity:0 here. iOS Safari can skip/fail
             animations; a static opacity:0 leaves the entire hero invisible (blank page). */
          .animate-fade-in-up {
            animation: fade-in-up 0.8s ease-out both;
          }
          .animate-fade-in-right {
            animation: fade-in-right 1s ease-out both;
          }
          .animate-slide-in-left {
            animation: slide-in-left 0.8s ease-out both;
          }
          .animate-gradient-text {
            animation: gradient-x 3s ease infinite;
          }
          .animate-bounce-subtle {
            animation: bounce-subtle 2s ease-in-out infinite;
          }
          .animate-spin-slow {
            animation: spin-slow 8s linear infinite;
          }
          .animate-fade-in {
            animation: fade-in-up 0.6s ease-out both;
            animation-delay: 1.4s;
          }
          @media (prefers-reduced-motion: reduce) {
            .animate-fade-in-up,
            .animate-fade-in-right,
            .animate-slide-in-left,
            .animate-fade-in {
              animation: none !important;
              opacity: 1 !important;
              transform: none !important;
            }
          }
          .animate-gradient-x {
            animation: gradient-x 3s ease infinite;
          }
          @keyframes scroll {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }
          .animate-scroll {
            animation: scroll 20s linear infinite;
          }
          .animate-scroll:hover {
            animation-play-state: paused;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </section>

      {/* Before & After Section */}
      <section className="py-8 sm:py-20 lg:py-24 xl:py-32 relative overflow-hidden">
        {/* Light Blue Grid Pattern Background */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(59, 130, 246, 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: "30px 30px",
          }}
        />
        {/* Light Blue Circular Shapes Overlay */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-32 h-32 bg-blue-200 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-blue-200 rounded-full blur-3xl"></div>
        </div>

        <div className={`${MARKETING_PAGE_SHELL} relative z-10`}>
        <div className="mx-auto max-w-4xl text-center mb-8 sm:mb-12 lg:mb-16 flex flex-col items-center px-4">
  <h2
    className="
      text-lg sm:text-2xl lg:text-3xl xl:text-4xl
      font-extrabold tracking-tight leading-tight
      mb-4 sm:mb-6
      whitespace-normal lg:whitespace-nowrap
    "
  >
    <span
      className="inline-block animate-fade-in-up text-center"
      style={{
        backgroundImage:
          "linear-gradient(to right, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      How Helicoptic Solutions API Transforms Communication
    </span>
  </h2>

  <p
    className="
      text-sm sm:text-lg lg:text-xl
      font-bold text-muted-foreground
      text-center
      whitespace-normal
      animate-fade-in-up
    "
    style={{ animationDelay: "0.4s" }}
  >
    See how our solution transforms challenges into seamless experiences
  </p>
</div>



          <div className="grid md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 max-w-5xl mx-auto">
            {/* Before Column */}
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 rounded-lg px-4 py-3 bg-white dark:bg-gray-900 border-2 border-red-500 text-gray-900 dark:text-white flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Before Helicoptic Solutions API
              </h3>
              <div className="space-y-3">
                {beforeAfter.before.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 bg-white dark:bg-white rounded-xl px-4 py-3 shadow-md transition-all duration-300 hover:shadow-lg"
                    style={{
                      animationDelay: `${0.3 + index * 0.1}s`,
                    }}
                  >
                    <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-800 dark:text-gray-800 text-sm leading-relaxed">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* After Column */}
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 rounded-lg px-4 py-3 bg-white dark:bg-gray-900 border-2 border-green-500 text-gray-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                After Helicoptic Solutions API
              </h3>
              <div className="space-y-3">
                {beforeAfter.after.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 bg-white dark:bg-white rounded-xl px-4 py-3 shadow-md transition-all duration-300 hover:shadow-lg"
                    style={{
                      animationDelay: `${0.5 + index * 0.1}s`,
                    }}
                  >
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-800 dark:text-gray-800 text-sm leading-relaxed">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10X Revenue Section - Flowchart Design */}
      <section className="py-12 sm:py-16 bg-gray-900 dark:bg-black relative overflow-hidden">
        <div className={MARKETING_PAGE_SHELL}>
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold mb-2 text-white">
              10X YOUR REVENUE
            </h2>
            <p className="text-sm sm:text-base text-gray-300 max-w-2xl mx-auto">
              with the Power of AI & WhatsApp
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            {/* Lead Sources Row */}
            <div className="flex justify-center items-center gap-2 sm:gap-3 mb-4 flex-wrap">
              {/* Facebook */}
              <a
                href="https://www.facebook.com/holosoft.llc"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center hover:scale-110 transition-transform duration-300"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-600 flex items-center justify-center mb-1 cursor-pointer">
                  <Facebook className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div className="w-0.5 h-6 sm:h-8 animate-flow-line"></div>
              </a>
              {/* Instagram */}
              <a
                href="https://www.instagram.com/helicopticsolutions/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center hover:scale-110 transition-transform duration-300"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mb-1 cursor-pointer">
                  <Instagram className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div className="w-0.5 h-6 sm:h-8 animate-flow-line"></div>
              </a>
              {/* Google */}
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-yellow-500 flex items-center justify-center mb-1">
                  <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div className="w-0.5 h-6 sm:h-8 animate-flow-line"></div>
              </div>
              {/* WhatsApp */}
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-600 flex items-center justify-center mb-1">
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div className="w-0.5 h-6 sm:h-8 animate-flow-line"></div>
              </div>
              {/* Email */}
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-600 flex items-center justify-center mb-1">
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div className="w-0.5 h-6 sm:h-8 animate-flow-line"></div>
              </div>
            </div>

            {/* Lead Capture Box */}
            <div className="flex justify-center mb-3">
              <div className="bg-purple-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg transform -skew-x-12 shadow-lg">
                <h3 className="font-bold text-sm sm:text-base transform skew-x-12">
                  Lead Capture
                </h3>
              </div>
            </div>

            {/* Connection Line */}
            <div className="flex justify-center mb-3">
              <div className="w-0.5 h-8 sm:h-10 animate-flow-line"></div>
            </div>

            {/* AI Zapy Automation Box */}
            <div className="flex justify-center mb-4">
              <div className="bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg transform -skew-x-12 shadow-lg">
                <h3 className="font-bold text-xs sm:text-sm transform skew-x-12">
                  Helicoptic Solutions Automation
                </h3>
              </div>
            </div>

            {/* Communication Channels Row */}
            <div className="flex justify-center items-center gap-2 sm:gap-3 mb-4 flex-wrap">
              {/* AI Chat */}
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-6 sm:h-8 animate-flow-line mb-1"></div>
                <div className="bg-blue-600 text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-lg min-w-[80px] sm:min-w-[100px] text-center">
                  <Facebook className="h-3 w-3 sm:h-4 sm:w-4 text-white mx-auto mb-0.5" />
                  <p className="text-xs font-semibold">AI Chat</p>
                </div>
              </div>
              {/* AI Calling */}
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-6 sm:h-8 animate-flow-line mb-1"></div>
                <div className="bg-green-600 text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-lg min-w-[80px] sm:min-w-[100px] text-center">
                  <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-white mx-auto mb-0.5" />
                  <p className="text-xs font-semibold">AI Calling</p>
                </div>
              </div>
              {/* Chatbot */}
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-6 sm:h-8 animate-flow-line mb-1"></div>
                <div className="bg-purple-600 text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-lg min-w-[80px] sm:min-w-[100px] text-center">
                  <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-white mx-auto mb-0.5" />
                  <p className="text-xs font-semibold">Chatbot</p>
                </div>
              </div>
              {/* WhatsApp */}
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-6 sm:h-8 animate-flow-line mb-1"></div>
                <div className="bg-green-600 text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-lg min-w-[80px] sm:min-w-[100px] text-center">
                  <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 text-white mx-auto mb-0.5" />
                  <p className="text-xs font-semibold">WhatsApp</p>
                </div>
              </div>
              {/* Email */}
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-6 sm:h-8 animate-flow-line mb-1"></div>
                <div className="bg-red-600 text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-lg min-w-[80px] sm:min-w-[100px] text-center">
                  <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-white mx-auto mb-0.5" />
                  <p className="text-xs font-semibold">Email</p>
                </div>
              </div>
            </div>

            {/* Horizontal Connection Line */}
            <div className="flex justify-center mb-3">
              <div className="w-full max-w-3xl h-0.5 animate-flow-line-horizontal relative">
                <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0.5 h-8 sm:h-10 animate-flow-line -mt-0.5"></div>
              </div>
            </div>

            {/* Auto Qualify Lead Box */}
            <div className="flex justify-center mb-3">
              <div className="bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg transform -skew-x-12 shadow-lg">
                <h3 className="font-bold text-sm sm:text-base transform skew-x-12">
                  Auto Qualify Lead
                </h3>
              </div>
            </div>

            {/* Connection Line */}
            <div className="flex justify-center mb-3">
              <div className="w-0.5 h-8 sm:h-10 animate-flow-line"></div>
            </div>

            {/* Auto Nurture Box with Day Badges */}
            <div className="flex flex-col items-center mb-4">
              <div className="bg-orange-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg transform -skew-x-12 shadow-lg mb-3">
                <h3 className="font-bold text-sm sm:text-base transform skew-x-12">
                  Auto Nurture
                </h3>
              </div>

              {/* Day Badges */}
              <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
                {[1, 2, 3, 4].map((day) => (
                  <div key={day} className="flex flex-col items-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-600 flex items-center justify-center mb-1 shadow-lg">
                      <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <Badge className="bg-green-600 text-white border-0 px-2 py-0.5 text-xs">
                      Day {String(day).padStart(2, "0")}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Connection Lines from Auto Nurture */}
            <div className="flex justify-center gap-8 sm:gap-12 mb-3">
              <div className="w-0.5 h-8 sm:h-10 animate-flow-line"></div>
              <div className="w-0.5 h-8 sm:h-10 animate-flow-line"></div>
            </div>

            {/* Outcomes Row */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6 max-w-xl mx-auto">
              {/* Positive Outcome */}
              <div className="flex flex-col items-center">
                <div className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg shadow-lg mb-1 w-full text-center">
                  <p className="font-semibold text-xs sm:text-sm">Positive</p>
                </div>
                <div className="w-0.5 h-6 sm:h-8 animate-flow-line mb-1"></div>
                <div className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg shadow-lg w-full text-center">
                  <p className="font-semibold text-xs sm:text-sm">Lead Won</p>
                </div>
              </div>

              {/* Negative Outcome */}
              <div className="flex flex-col items-center">
                <div className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg shadow-lg mb-1 w-full text-center">
                  <p className="font-semibold text-xs sm:text-sm">Negative</p>
                </div>
                <div className="w-0.5 h-6 sm:h-8 animate-flow-line mb-1"></div>
                <div className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg shadow-lg w-full text-center">
                  <p className="font-semibold text-xs sm:text-sm">
                    Long Nurture
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="py-12 sm:py-20 lg:py-24 xl:py-32 bg-white dark:bg-gray-900">
        <div className={MARKETING_PAGE_SHELL}>
     <div className="mx-auto max-w-2xl text-center mb-8 sm:mb-12 lg:mb-16 px-4">
  <h2
    className="
      font-extrabold tracking-tight
      whitespace-nowrap
      text-center
      leading-none
      text-[clamp(14px,4vw,48px)]
    "
  >
    <span
      className="inline-block"
      style={{
        backgroundImage:
          "linear-gradient(to right, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      Built for any industry effortlessly
    </span>
  </h2>
</div>




          <div className="max-w-7xl mx-auto relative">
            <Carousel
              setApi={setApi}
              opts={{
                align: "start",
                loop: true,
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {industries.map((industry, index) => {
                  const Icon = industry.icon;
                  // Color schemes for different industries
                  const colorSchemes = [
                    {
                      bg: "bg-green-50 dark:bg-green-950/20",
                      border: "border-green-300 dark:border-green-700",
                      iconBg: "bg-green-100 dark:bg-green-900/50",
                      iconColor: "text-green-600 dark:text-green-400",
                      blur1: "bg-green-200/30 dark:bg-green-800/20",
                      blur2: "bg-green-300/20 dark:bg-green-700/20",
                    },
                    {
                      bg: "bg-blue-50 dark:bg-blue-950/20",
                      border: "border-blue-300 dark:border-blue-700",
                      iconBg: "bg-blue-100 dark:bg-blue-900/50",
                      iconColor: "text-blue-600 dark:text-blue-400",
                      blur1: "bg-blue-200/30 dark:bg-blue-800/20",
                      blur2: "bg-blue-300/20 dark:bg-blue-700/20",
                    },
                    {
                      bg: "bg-yellow-50 dark:bg-yellow-950/20",
                      border: "border-yellow-300 dark:border-yellow-700",
                      iconBg: "bg-yellow-100 dark:bg-yellow-900/50",
                      iconColor: "text-yellow-600 dark:text-yellow-400",
                      blur1: "bg-yellow-200/30 dark:bg-yellow-800/20",
                      blur2: "bg-yellow-300/20 dark:bg-yellow-700/20",
                    },
                    {
                      bg: "bg-purple-50 dark:bg-purple-950/20",
                      border: "border-purple-300 dark:border-purple-700",
                      iconBg: "bg-purple-100 dark:bg-purple-900/50",
                      iconColor: "text-purple-600 dark:text-purple-400",
                      blur1: "bg-purple-200/30 dark:bg-purple-800/20",
                      blur2: "bg-purple-300/20 dark:bg-purple-700/20",
                    },
                    {
                      bg: "bg-pink-50 dark:bg-pink-950/20",
                      border: "border-pink-300 dark:border-pink-700",
                      iconBg: "bg-pink-100 dark:bg-pink-900/50",
                      iconColor: "text-pink-600 dark:text-pink-400",
                      blur1: "bg-pink-200/30 dark:bg-pink-800/20",
                      blur2: "bg-pink-300/20 dark:bg-pink-700/20",
                    },
                    {
                      bg: "bg-indigo-50 dark:bg-indigo-950/20",
                      border: "border-indigo-300 dark:border-indigo-700",
                      iconBg: "bg-indigo-100 dark:bg-indigo-900/50",
                      iconColor: "text-indigo-600 dark:text-indigo-400",
                      blur1: "bg-indigo-200/30 dark:bg-indigo-800/20",
                      blur2: "bg-indigo-300/20 dark:bg-indigo-700/20",
                    },
                    {
                      bg: "bg-teal-50 dark:bg-teal-950/20",
                      border: "border-teal-300 dark:border-teal-700",
                      iconBg: "bg-teal-100 dark:bg-teal-900/50",
                      iconColor: "text-teal-600 dark:text-teal-400",
                      blur1: "bg-teal-200/30 dark:bg-teal-800/20",
                      blur2: "bg-teal-300/20 dark:bg-teal-700/20",
                    },
                    {
                      bg: "bg-orange-50 dark:bg-orange-950/20",
                      border: "border-orange-300 dark:border-orange-700",
                      iconBg: "bg-orange-100 dark:bg-orange-900/50",
                      iconColor: "text-orange-600 dark:text-orange-400",
                      blur1: "bg-orange-200/30 dark:bg-orange-800/20",
                      blur2: "bg-orange-300/20 dark:bg-orange-700/20",
                    },
                    {
                      bg: "bg-cyan-50 dark:bg-cyan-950/20",
                      border: "border-cyan-300 dark:border-cyan-700",
                      iconBg: "bg-cyan-100 dark:bg-cyan-900/50",
                      iconColor: "text-cyan-600 dark:text-cyan-400",
                      blur1: "bg-cyan-200/30 dark:bg-cyan-800/20",
                      blur2: "bg-cyan-300/20 dark:bg-cyan-700/20",
                    },
                    {
                      bg: "bg-rose-50 dark:bg-rose-950/20",
                      border: "border-rose-300 dark:border-rose-700",
                      iconBg: "bg-rose-100 dark:bg-rose-900/50",
                      iconColor: "text-rose-600 dark:text-rose-400",
                      blur1: "bg-rose-200/30 dark:bg-rose-800/20",
                      blur2: "bg-rose-300/20 dark:bg-rose-700/20",
                    },
                    {
                      bg: "bg-emerald-50 dark:bg-emerald-950/20",
                      border: "border-emerald-300 dark:border-emerald-700",
                      iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
                      iconColor: "text-emerald-600 dark:text-emerald-400",
                      blur1: "bg-emerald-200/30 dark:bg-emerald-800/20",
                      blur2: "bg-emerald-300/20 dark:bg-emerald-700/20",
                    },
                    {
                      bg: "bg-violet-50 dark:bg-violet-950/20",
                      border: "border-violet-300 dark:border-violet-700",
                      iconBg: "bg-violet-100 dark:bg-violet-900/50",
                      iconColor: "text-violet-600 dark:text-violet-400",
                      blur1: "bg-violet-200/30 dark:bg-violet-800/20",
                      blur2: "bg-violet-300/20 dark:bg-violet-700/20",
                    },
                  ];

                  const colors = colorSchemes[index % colorSchemes.length];

                  // Random floating icons for each card
                  const floatingIcons = [
                    [MessageSquare, Calendar],
                    [MessageSquare, Calendar],
                    [ShoppingCart, MessageSquare],
                    [Megaphone, MessageSquare, Star],
                    [MessageSquare, Phone],
                    [MessageSquare, Calendar],
                    [MessageSquare, ShoppingCart],
                    [MessageSquare, Calendar],
                    [MessageSquare, Phone],
                    [MessageSquare, ShoppingCart],
                    [MessageSquare, Calendar],
                    [MessageSquare, Star],
                  ];

                  const icons = floatingIcons[index % floatingIcons.length];

                  return (
                    <CarouselItem
                      key={index}
                      className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
                    >
                      <div
                        className={`relative ${colors.bg} rounded-xl border-2 border-dashed ${colors.border} p-3 md:p-4 transition-all duration-300 overflow-visible h-full flex flex-col`}
                      >
                        {/* Person Image */}
                        <div className="relative mb-4 flex-1 min-h-[160px] md:min-h-[180px] flex items-center justify-center">
                          {/* Person Image */}
                          <div className="relative w-full max-w-[140px] md:max-w-[160px] lg:max-w-[180px]">
                            <img
                              src={
                                industry.image ||
                                `https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop&auto=format&q=80`
                              }
                              alt={industry.title}
                              className="w-full h-auto object-cover object-center rounded-lg"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src =
                                  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop&auto=format&q=80";
                              }}
                            />
                          </div>

                          {/* Floating Icons - Top Left */}
                          <div className="absolute top-1 left-1 md:top-2 md:left-2 z-10">
                            <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-md border border-gray-200 dark:border-gray-700">
                              <MessageSquare
                                className={`h-2.5 w-2.5 md:h-3 md:w-3 text-green-600 dark:text-green-400`}
                              />
                            </div>
                          </div>

                          {/* Floating Icons - Bottom Right */}
                          {icons.length > 0 && (
                            <div className="absolute bottom-2 right-1 md:bottom-3 md:right-2 z-10 flex flex-col gap-1.5">
                              {icons
                                .slice(0, 2)
                                .map((FloatingIcon, iconIndex) => (
                                  <div
                                    key={iconIndex}
                                    className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-md border border-gray-200 dark:border-gray-700"
                                  >
                                    <FloatingIcon
                                      className={`h-2.5 w-2.5 md:h-3 md:w-3 ${colors.iconColor}`}
                                    />
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>

                        {/* Title and Description */}
                        <div className="relative z-10 mt-auto pt-1">
                          <h3 className="text-base md:text-lg font-bold mb-1.5 text-gray-900 dark:text-white text-center">
                            {industry.title}
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-300 text-center leading-relaxed px-1">
                            {industry.description}
                          </p>
                        </div>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>

            {/* Pagination Dots */}
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: count }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    api?.scrollTo(index);
                  }}
                  className={`h-2 rounded-full transition-all ${
                    current === index + 1
                      ? "w-8 bg-primary"
                      : "w-2 bg-gray-300 dark:bg-gray-600"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Integrations Section - Enhanced with attractive square icons */}
      <section
        id="integrations"
        className="py-12 sm:py-20 lg:py-24 xl:py-32 bg-gradient-to-b from-background via-muted/20 to-background relative overflow-hidden"
      >
        {/* Grid Pattern Background */}
        <div
          className="absolute inset-0 -z-10 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>
        </div>

        <div className={`${MARKETING_PAGE_SHELL} relative z-10`}>
        <div className="mx-auto grid max-w-7xl items-center gap-8 sm:gap-10 md:grid-cols-[1.4fr_1fr] lg:gap-12">
            {/* Left Section - Text and CTA */}
            <div className="min-w-0 space-y-4 sm:space-y-5 lg:space-y-6">
       <h2
  className="
    font-extrabold tracking-tight leading-tight
    whitespace-normal sm:whitespace-nowrap
    text-center sm:text-left
  "
  style={{
    fontSize: "clamp(1.4rem, 5vw, 3.6rem)",
    backgroundImage:
      "linear-gradient(to right, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  }}
>
  All Tools Integrations At One Place
</h2>


              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">
                Automate your notification, alerts, and nurturing messages. Send
                appointment reminders, feedback requests, ecommerce order
                alerts, lead qualification, nurturing & promotion to your
                customers.
              </p>
              <div className="pt-2 sm:pt-3 lg:pt-4">
                <Link
                  href="/signup"
                  className="group inline-block w-full sm:w-auto"
                >
                  <div
                    className="inline-block rounded-lg p-[2px] w-full sm:w-auto"
                    style={{
                      backgroundImage:
                        "linear-gradient(to top, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                      boxShadow:
                        "0 4px 15px -3px rgba(0, 0, 0, 0.2), 0 2px 6px -2px rgba(0, 0, 0, 0.1)",
                    }}
                  >
                    <Button
                      size="sm"
                      className="text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 h-auto text-white rounded-lg transition-all duration-300 font-semibold transform hover:scale-105 bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                    >
                      Get Started
                    </Button>
                  </div>
                </Link>
              </div>
            </div>

            {/* Right Section - Icons Grid */}
            <div className="grid min-w-0 grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2 lg:gap-2.5">
              {integrations.map((integration, index) => {
                // Social media links
                const getSocialLink = (name: string) => {
                  switch (name) {
                    case "Facebook":
                      return "https://www.facebook.com/holosoft.llc";
                    case "Instagram":
                      return "https://www.instagram.com/helicopticsolutions/";
                    default:
                      return null;
                  }
                };

                const socialLink = getSocialLink(integration.name);
                const iconPath = getIconPath(integration.name);

                const iconContent = (
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-lg ${
                      integration.bgColor || "bg-white"
                    } flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:scale-105 border border-gray-100 dark:border-gray-200 p-1.5`}
                  >
                    {/* Original app icon - smaller size, rounded like app store icons */}
                    <img
                      src={iconPath}
                      alt={integration.name}
                      className="w-10 h-10 sm:w-12 sm:h-12 object-contain transition-all duration-300 rounded-lg"
                      width="48"
                      height="48"
                      loading="lazy"
                      onError={(e) => {
                        // Try alternative file names/extensions if current one fails
                        const img = e.target as HTMLImageElement;
                        const currentSrc = img.src;
                        const basePath = currentSrc.substring(
                          0,
                          currentSrc.lastIndexOf("/") + 1
                        );
                        const currentFile = currentSrc.substring(
                          currentSrc.lastIndexOf("/") + 1
                        );

                        // Try alternative extensions
                        if (currentFile.endsWith(".png")) {
                          img.src =
                            basePath + currentFile.replace(".png", ".ico");
                        } else if (currentFile.endsWith(".ico")) {
                          img.src =
                            basePath + currentFile.replace(".ico", ".svg");
                        } else if (currentFile.endsWith(".svg")) {
                          // Try base name variations
                          const baseName = currentFile.replace(".svg", "");
                          img.src = basePath + baseName + ".png";
                        } else {
                          // Final fallback: show placeholder with first letter
                          img.style.display = "none";
                          if (
                            !img.parentElement?.querySelector(".icon-fallback")
                          ) {
                            const fallback = document.createElement("div");
                            fallback.className =
                              "icon-fallback w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center text-gray-500 text-xs font-medium";
                            fallback.textContent = integration.name.charAt(0);
                            img.parentElement?.appendChild(fallback);
                          }
                        }
                      }}
                    />
                  </div>
                );

                if (socialLink) {
                  return (
                    <a
                      key={index}
                      href={socialLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col items-center justify-center cursor-pointer"
                    >
                      {iconContent}
                    </a>
                  );
                }

                return (
                  <div
                    key={index}
                    className="group flex flex-col items-center justify-center cursor-pointer"
                  >
                    {iconContent}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-20 lg:py-24 xl:py-32">
        <div className={MARKETING_PAGE_SHELL}>
     <div className="mx-auto max-w-6xl text-center mb-8 sm:mb-12 lg:mb-16 px-4">
  <h2
    className="font-extrabold tracking-tight leading-tight text-center"
    style={{
      fontSize: "clamp(0.9rem, 3.2vw, 3rem)",
      backgroundImage:
        "linear-gradient(to right, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    }}
  >
    <span className="inline lg:block">
      Why Helicoptic Solutions API
    </span>{" "}
    <span className="inline lg:block">
      is the Ultimate Platform for Your Business?
    </span>
  </h2>
</div>



          <div className="space-y-12 sm:space-y-16 lg:space-y-24">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className={`grid md:grid-cols-2 gap-12 items-center ${
                    index % 2 === 1 ? "md:flex-row-reverse" : ""
                  }`}
                >
                  <div className={index % 2 === 1 ? "md:order-2" : ""}>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
                      {feature.title}
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                      {feature.description}
                    </p>
                    <ul className="space-y-2 mb-6">
                      {feature.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/signup">
                      <Button>
                        Start Now
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <div className={index % 2 === 1 ? "md:order-1" : ""}>
                    <div className="relative w-full h-[250px] sm:h-[300px] lg:h-[400px] rounded-xl sm:rounded-2xl overflow-hidden border">
                      <img
                        src={feature.imageUrl}
                        alt={feature.title}
                        className="w-full h-full object-contain bg-muted"
                        onError={(e) => {
                          // Fallback if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          if (target.parentElement) {
                            target.parentElement.innerHTML = `
                              <div class="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                <Icon class="h-24 w-24 text-primary/30" />
                              </div>
                            `;
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section className="py-12 sm:py-20 lg:py-24 xl:py-32 bg-green-50 dark:bg-green-950/20">
        <div className={MARKETING_PAGE_SHELL}>
          <div className="mx-auto max-w-2xl text-center mb-8 sm:mb-12 lg:mb-16">
            <h2
              className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold tracking-tight mb-3 sm:mb-4"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Customer Review
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto mb-6 sm:mb-8 transition-opacity duration-300">
            {currentReviews.map((review, index) => (
              <Card
                key={startIndex + index}
                className="bg-white dark:bg-gray-900 shadow-md hover:shadow-lg transition-all duration-300"
              >
                <CardContent className="p-4 sm:p-5 lg:p-6">
                  {/* Star Rating */}
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => {
                      const starValue = i + 1;
                      if (starValue <= Math.floor(review.rating)) {
                        // Full star
                        return (
                          <Star
                            key={i}
                            className="h-5 w-5 fill-yellow-400 text-yellow-400"
                          />
                        );
                      } else if (
                        starValue === Math.ceil(review.rating) &&
                        review.rating % 1 !== 0
                      ) {
                        // Half star
                        return (
                          <div key={i} className="relative h-5 w-5">
                            <Star className="h-5 w-5 text-gray-300 dark:text-gray-600" />
                            <div
                              className="absolute inset-0 overflow-hidden"
                              style={{ width: "50%" }}
                            >
                              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                            </div>
                          </div>
                        );
                      } else {
                        // Empty star
                        return (
                          <Star
                            key={i}
                            className="h-5 w-5 text-gray-300 dark:text-gray-600"
                          />
                        );
                      }
                    })}
                  </div>

                  {/* Review Text */}
                  <p className="text-gray-700 dark:text-gray-300 mb-6 text-sm leading-relaxed">
                    "{review.text}"
                  </p>

                  {/* Reviewer Info */}
                  <div className="flex items-center gap-3">
                    <img
                      src={review.image}
                      alt={review.name}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          review.name
                        )}&background=random&size=150`;
                      }}
                    />
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100">
                        {review.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {review.role}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination Dots */}
          <div className="flex justify-center gap-2">
            {Array.from({ length: totalReviewPages }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentReviewPage(index)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  index === currentReviewPage
                    ? "w-8 bg-green-600 dark:bg-green-500"
                    : "w-2 bg-green-300 dark:bg-green-700 hover:bg-green-400 dark:hover:bg-green-600"
                }`}
                aria-label={`Go to review page ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How to Get API Section */}
      <section className="py-12 sm:py-20 lg:py-24 xl:py-32">
        <div className={MARKETING_PAGE_SHELL}>
          <div className="mx-auto max-w-2xl text-center mb-8 sm:mb-12 lg:mb-16">
            <h2
              className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold tracking-tight mb-3 sm:mb-4"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              How to Get API
            </h2>
            <p className="text-base sm:text-lg lg:text-xl font-semibold text-muted-foreground">
              Just Follow These 3 Steps and Get Your API Live Just in 1 hour.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-5xl mx-auto">
            <Card className="group hover:shadow-2xl hover:shadow-primary/20 transition-all duration-500 hover:scale-105 hover:-translate-y-2 border-2 border-gray-200 dark:border-gray-700 hover:border-primary/50 bg-gradient-to-br from-white via-primary/5 to-white dark:from-gray-900 dark:via-primary/10 dark:to-gray-900 shadow-lg hover:shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <CardContent className="p-6 sm:p-8 lg:p-10 text-center relative z-10">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl opacity-50"></div>
                <div className="relative z-10">
                  <div
                    className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-4 sm:mb-6 drop-shadow-lg"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, #4fb576 0%, #44c489 50%, #28a9ae 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    01.
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-300">
                    Select Plan
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Select Best Plan For Your Business Needs.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="group hover:shadow-2xl hover:shadow-primary/20 transition-all duration-500 hover:scale-105 hover:-translate-y-2 border-2 border-gray-200 dark:border-gray-700 hover:border-primary/50 bg-gradient-to-br from-white via-primary/5 to-white dark:from-gray-900 dark:via-primary/10 dark:to-gray-900 shadow-lg hover:shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <CardContent className="p-6 sm:p-8 lg:p-10 text-center relative z-10">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl opacity-50"></div>
                <div className="relative z-10">
                  <div
                    className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-4 sm:mb-6 drop-shadow-lg"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, #4fb576 0%, #44c489 50%, #28a9ae 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    02.
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-300">
                    Submit Documents
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Submit KYC & Business Details.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="group hover:shadow-2xl hover:shadow-primary/20 transition-all duration-500 hover:scale-105 hover:-translate-y-2 border-2 border-gray-200 dark:border-gray-700 hover:border-primary/50 bg-gradient-to-br from-white via-primary/5 to-white dark:from-gray-900 dark:via-primary/10 dark:to-gray-900 shadow-lg hover:shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <CardContent className="p-6 sm:p-8 lg:p-10 text-center relative z-10">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl opacity-50"></div>
                <div className="relative z-10">
                  <div
                    className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-4 sm:mb-6 drop-shadow-lg"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, #4fb576 0%, #44c489 50%, #28a9ae 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    03.
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-300">
                    Setup & Go Live
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Get API Access & Start Using.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 sm:py-20 lg:py-24 xl:py-32 bg-muted/30">
        <div className={MARKETING_PAGE_SHELL}>
          <div className="mx-auto max-w-3xl">
            <div className="text-center mb-8 sm:mb-12 lg:mb-16">
              <h2
                className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold tracking-tight mb-3 sm:mb-4"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Want To Know More?
              </h2>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-8 sm:py-12 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
        <div className={MARKETING_PAGE_SHELL}>
         <div className="mx-auto max-w-5xl text-center">
<h2
  className="font-extrabold tracking-tight leading-tight mb-3 whitespace-nowrap"
  style={{
    fontSize: "clamp(1rem, 3.2vw, 2.6rem)",
    backgroundImage:
      "linear-gradient(to right, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  }}
>
  Broadcast Messages, Automate, Engage, Sell
</h2>


  <p className="text-xs sm:text-sm lg:text-base font-semibold text-muted-foreground mb-4">
    Do Everything with India’s No.1 WhatsApp Official API Platform
  </p>

  <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
    <Link href="/signup">
      <Button
        size="sm"
        className="text-xs sm:text-sm px-4 py-2 h-auto"
      >
        Start Free Trial
        <ArrowRight className="ml-2 h-3 w-3" />
      </Button>
    </Link>

    <Link href="/contact">
      <Button
        size="sm"
        variant="outline"
        className="text-xs sm:text-sm px-4 py-2 h-auto"
      >
        Contact Sales
      </Button>
    </Link>
  </div>
</div>

        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 text-white overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl"></div>
        </div>

        <div className={`${MARKETING_PAGE_SHELL} relative z-10 py-8 sm:py-12 lg:py-16`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8 lg:gap-8 mb-8 sm:mb-10 lg:mb-12">
            {/* Company Info */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                {/* Logo - Light Mode */}
                <img
                  src="/logo-main.png"
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
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-gray-800 hover:bg-blue-600 dark:bg-gray-700 dark:hover:bg-blue-600 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg group"
                  aria-label="Facebook"
                >
                  <Facebook className="h-5 w-5 text-gray-300 group-hover:text-white transition-colors" />
                </a>
                <a
                  href="https://www.instagram.com/helicopticsolutions/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 w-10 rounded-lg bg-gray-800 hover:bg-gradient-to-br hover:from-purple-600 hover:to-pink-600 dark:bg-gray-700 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg group"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5 text-gray-300 group-hover:text-white transition-colors" />
                </a>
                <a
                  href="https://www.linkedin.com/in/helicoptic-solutions-610ba6282/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 w-10 rounded-lg bg-gray-800 hover:bg-blue-700 dark:bg-gray-700 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg group"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-5 w-5 text-gray-300 group-hover:text-white transition-colors" />
                </a>
                <a
                  href="https://www.youtube.com/@HelicopticSolutions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 w-10 rounded-lg bg-gray-800 hover:bg-red-600 dark:bg-gray-700 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg group"
                  aria-label="YouTube"
                >
                  <Youtube className="h-5 w-5 text-gray-300 group-hover:text-white transition-colors" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
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
                  <a
                    href="#pricing"
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>Pricing</span>
                  </a>
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
                  <a
                    href="#"
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>Partner With Us</span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Important Links */}
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
                    href="#features"
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>Features</span>
                  </a>
                </li>
                <li>
                  <a
                    href="#integrations"
                    className="text-gray-300 hover:text-white transition-colors flex items-center gap-2 group text-sm"
                  >
                    <span className="w-0 group-hover:w-2 h-0.5 bg-green-500 transition-all duration-300"></span>
                    <span>Integrations</span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
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
                  <a
                    href="tel:+919931210401"
                    className="hover:text-white transition-colors"
                  >
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

            {/* Registration */}
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

          {/* Bottom Bar */}
          <div className="mt-8 sm:mt-10 lg:mt-12 pt-6 sm:pt-8 border-t border-gray-700">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
              <p className="text-gray-400 text-xs sm:text-sm text-center md:text-left">
                Copyright©{" "}
                <span className="text-white font-semibold">Helicoptic</span>{" "}
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
    </div>
  );
}