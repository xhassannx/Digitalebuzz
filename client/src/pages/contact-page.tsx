import { useState } from "react";
import { Link } from "wouter";
import { Mail, MapPin, Phone } from "lucide-react";
import { MarketingSiteHeader } from "@/components/marketing-site-header";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing-layout";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const CONTACT_EMAIL = "info@helicopticsolutions.com";
const CONTACT_PHONE_DISPLAY = "+91-7011 772 828";
const CONTACT_PHONE_TEL = "+917011772828";
const CONTACT_ADDRESS = "R29, Laxmi Nagar, New Delhi - 110092";

const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent("R29 Laxmi Nagar New Delhi 110092");

const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "United Arab Emirates",
  "South Africa",
  "New Zealand",
  "Singapore",
  "Malaysia",
  "Other",
] as const;

const fieldClass =
  "h-12 rounded-lg border border-neutral-200 bg-white text-neutral-900 shadow-sm placeholder:text-neutral-400 focus-visible:ring-teal-600/30";

const selectClass = cn(
  fieldClass,
  "w-full px-3 text-sm appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat",
  "[background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]"
);

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    country: "",
    service: "",
    message: "",
    termsAccepted: false,
  });
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.country || !formData.service) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please select your country and the service you’re looking for.",
      });
      return;
    }
    if (!formData.termsAccepted) {
      toast({
        variant: "destructive",
        title: "Terms required",
        description: "Please accept the Terms & Conditions to continue.",
      });
      return;
    }
    toast({
      title: "Message sent!",
      description: "We'll get back to you soon.",
    });
    setFormData({
      name: "",
      phone: "",
      email: "",
      company: "",
      country: "",
      service: "",
      message: "",
      termsAccepted: false,
    });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap');
      `}</style>

      <div
        className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 text-neutral-900"
        style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
      >
        <MarketingSiteHeader />

        <main className={`${MARKETING_PAGE_SHELL} py-10 pb-20 lg:py-14`}>
          <div className="mb-8 lg:mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
              Let&apos;s get in touch.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600">
              Feel free to reach out to us using the options below, and our dedicated team will respond to
              your inquiries promptly.
            </p>
          </div>

          {/* Form + image panel */}
          <div
            className="min-w-0 overflow-hidden rounded-3xl p-6 sm:p-8 lg:grid lg:grid-cols-2 lg:gap-10 lg:p-10"
            style={{ backgroundColor: "#f7f1ed" }}
          >
            <div className="relative mb-8 min-h-[280px] overflow-hidden rounded-2xl lg:mb-0 lg:min-h-[420px]">
              <img
                src="/contact-us-customer-service-support-concept.jpeg"
                alt="Customer support"
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div className="flex flex-col justify-center">
              <p className="mb-6 text-sm leading-relaxed text-neutral-600 sm:text-base">
                Have a question or feedback? Fill out the form below, and we&apos;ll get back to you as soon
                as possible.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name" className="text-sm font-medium text-neutral-800">
                      Full name<span className="text-red-600">*</span>
                    </Label>
                    <Input
                      id="contact-name"
                      required
                      placeholder="Enter your full name"
                      className={fieldClass}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone" className="text-sm font-medium text-neutral-800">
                      Phone number<span className="text-red-600">*</span>
                    </Label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      required
                      placeholder="Enter your phone number"
                      className={fieldClass}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email" className="text-sm font-medium text-neutral-800">
                      Email address<span className="text-red-600">*</span>
                    </Label>
                    <Input
                      id="contact-email"
                      type="email"
                      required
                      placeholder="Enter your email"
                      className={fieldClass}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-company" className="text-sm font-medium text-neutral-800">
                      Company Name
                    </Label>
                    <Input
                      id="contact-company"
                      placeholder="Company name"
                      className={fieldClass}
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-country" className="text-sm font-medium text-neutral-800">
                    Country<span className="text-red-600">*</span>
                  </Label>
                  <select
                    id="contact-country"
                    required
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">Select your country</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-service" className="text-sm font-medium text-neutral-800">
                    What service are you looking for?<span className="text-red-600">*</span>
                  </Label>
                  <select
                    id="contact-service"
                    required
                    value={formData.service}
                    onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">Select...</option>
                    <option value="Chatbot">Chatbot</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-message" className="text-sm font-medium text-neutral-800">
                    Your message<span className="text-red-600">*</span>
                  </Label>
                  <Textarea
                    id="contact-message"
                    required
                    rows={6}
                    placeholder="Write your message here..."
                    className="min-h-[150px] resize-y rounded-lg border border-neutral-200 bg-white text-neutral-900 shadow-sm placeholder:text-neutral-400 focus-visible:ring-teal-600/30"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <Checkbox
                    id="contact-terms"
                    checked={formData.termsAccepted}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, termsAccepted: checked === true })
                    }
                    className="mt-0.5 border-2 border-neutral-600 bg-white data-[state=checked]:border-[#1d705a] data-[state=checked]:bg-[#1d705a]"
                  />
                  <label
                    htmlFor="contact-terms"
                    className="cursor-pointer text-sm font-medium leading-snug text-neutral-800"
                  >
                    I agree to the{" "}
                    <Link
                      href="/terms"
                      className="font-semibold text-teal-600 underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms &amp; Conditions
                    </Link>
                    <span className="text-red-600" aria-hidden>
                      {" "}
                      *
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="mt-1 w-full rounded-lg py-3 text-base font-semibold text-white transition-colors hover:opacity-95"
                  style={{ backgroundColor: "#1d705a" }}
                >
                  Send message
                </button>

                <p className="text-center text-sm text-neutral-600 sm:text-left">
                  Or drop us a message via{" "}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="font-semibold text-teal-600 underline-offset-2 hover:underline"
                  >
                    email
                  </a>
                  .
                </p>
              </form>
            </div>
          </div>

          {/* Other ways — single beige card grid (Lexend-style: outline teal icons, no heavy bars) */}
          <section
            className="mt-14 lg:mt-20"
            aria-labelledby="contact-other-ways-heading"
          >
            <h2
              id="contact-other-ways-heading"
              className="text-left text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl"
            >
              Other ways to reach us
            </h2>

            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {(
                [
                  {
                    icon: Mail,
                    title: "Email Us",
                    body: CONTACT_EMAIL,
                    href: `mailto:${CONTACT_EMAIL}`,
                    linkLabel: "Send email →",
                  },
                  {
                    icon: Phone,
                    title: "Call Us",
                    body: CONTACT_PHONE_DISPLAY,
                    href: `tel:${CONTACT_PHONE_TEL}`,
                    linkLabel: "Call now →",
                  },
                  {
                    icon: MapPin,
                    title: "Visit Us",
                    body: CONTACT_ADDRESS,
                    href: MAPS_URL,
                    external: true,
                    linkLabel: "View on maps →",
                  },
                ] as const
              ).map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="flex h-full min-h-[272px] flex-col items-center rounded-[1.75rem] px-6 py-10 text-center sm:px-7 sm:py-11"
                    style={{ backgroundColor: "#f9f5f2" }}
                  >
                    <div
                      className="mb-6 flex shrink-0 items-center justify-center text-[#0d9488]"
                      aria-hidden
                    >
                      <Icon className="h-14 w-14" strokeWidth={1.35} />
                    </div>
                    <h3 className="text-[1.05rem] font-bold leading-snug text-neutral-950">{item.title}</h3>
                    <p className="mt-2 max-w-[17rem] text-[0.9375rem] font-bold leading-relaxed text-neutral-800">
                      {item.body}
                    </p>
                    <div className="mt-auto pt-6">
                      <a
                        href={item.href}
                        {...("external" in item && item.external
                          ? ({ target: "_blank", rel: "noopener noreferrer" } as const)
                          : {})}
                        className="text-sm font-bold text-[#0d9488] transition-colors hover:text-[#0f766e] hover:underline"
                      >
                        {item.linkLabel}
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
