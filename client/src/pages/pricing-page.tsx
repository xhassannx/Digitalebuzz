// @ts-nocheck
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketingSiteHeader } from "@/components/marketing-site-header";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing-layout";
import { MessageSquare, Users, Target, Zap, Shield, CheckCircle, Phone, Mail, Cloud, Eye, Rocket, Building2, Globe, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function PricingPage() {

const platformIcons = {
  Wati: "https://aizapy.com/wp-content/uploads/2025/10/Wati-logo-green-Xkgz8q6m.svg",
  AiSensy: "https://aizapy.com/wp-content/uploads/2025/10/Aisensy-DlxB96tQ.jpeg",
  Interakt: "https://aizapy.com/wp-content/uploads/2025/10/download.png",
  QuickPro: "https://aizapy.com/wp-content/uploads/2025/10/download-1.png",
  Sublideo: "https://aizapy.com/wp-content/uploads/2025/10/download-2.png",
};

  return (
   
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <MarketingSiteHeader />

    {/* Hero Section */}
      <section className="py-12 md:py-20 bg-gradient-to-b from-background to-muted/20">
        <div className={MARKETING_PAGE_SHELL}>
         <div className="text-center mb-12">
  <h1
    className="
      text-xl sm:text-2xl md:text-4xl lg:text-5xl
      font-bold mb-3 sm:mb-4
      whitespace-normal md:whitespace-nowrap
      leading-tight
    "
    style={{
      backgroundImage:
        "linear-gradient(to right, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    }}
  >
    Compare & Save with Helicoptic
  </h1>

  <p className="
    text-base sm:text-lg md:text-2xl
    font-bold
    text-muted-foreground
    max-w-xl md:max-w-none
    mx-auto
  ">
    Get more value with our all-in-one platform at a fraction of the cost
  </p>
</div>


          {/* Platform Comparison */}
          <div className="max-w-6xl mx-auto mb-16">
            <div className="relative grid md:grid-cols-2 gap-6 items-center">

              {/* Left Card - Other Platforms */}
             <Card className="border-2 bg-white dark:bg-[#0b1220] dark:border-gray-700 rounded-2xl">
      <CardContent className="p-0">

        {/* HEADER */}
        <div className="flex items-center justify-between
          bg-gradient-to-r from-[#0b1220] to-[#111827]
          rounded-t-2xl px-6 py-5
          border-b border-gray-200 dark:border-gray-700">

          {/* LEFT TEXT */}
          <div>
            <h3 className="text-white text-xl font-bold">
              Other Platforms
            </h3>
            <p className="text-sm text-gray-300">
              For the same features as Helicoptic
            </p>
          </div>

          {/* RIGHT ICON STACK */}
          <div className="flex items-center">
            {Object.values(platformIcons).map((icon, index) => (
              <div
                key={index}
                className={`w-10 h-10 rounded-full
                bg-white dark:bg-[#0f172a]
                border-2 border-green-400
                flex items-center justify-center
                ${index !== 0 ? "-ml-3" : ""}`}
              >
                <img
                  src={icon}
                  alt="platform"
                  className="w-5 h-5 object-contain"
                />
              </div>
            ))}
          </div>
        </div>

        {/* PLATFORM LIST */}
        <div className="p-6 space-y-4">
          {[
            { name: "Wati", price: "₹62,000" },
            { name: "AiSensy", price: "₹62,000" },
            { name: "Interakt", price: "₹29,999" },
            { name: "QuickPro", price: "₹25,000" },
            { name: "Sublideo", price: "₹14,000" },
          ].map((platform, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-3 px-4 rounded-md
              bg-gray-100 dark:bg-[#0f172a]
              border border-gray-200 dark:border-gray-700
              shadow-sm dark:shadow-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full
                  bg-white dark:bg-[#020617]
                  border border-green-400
                  flex items-center justify-center">
                  <img
                    src={platformIcons[platform.name]}
                    alt={platform.name}
                    className="w-4 h-4 object-contain"
                  />
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {platform.name}
                </span>
              </div>

              <span className="font-bold text-lg text-gray-900 dark:text-gray-100">
                {platform.price}
              </span>
            </div>
          ))}
        </div>

        {/* TOTAL */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-900 dark:text-gray-100">
              Total Cost
            </span>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                ₹35,000
              </div>
              <div className="text-red-600 text-sm">
                +Additional Taxes
              </div>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>

              {/* VS Badge */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block z-10">
                <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  VS
                </div>
              </div>

              {/* Right Card - ACasaty */}
             {/* Right Card - AiZapy Style */}
<Card className="bg-gradient-to-br from-[#0b1220] to-[#111827] text-white border border-white/10 rounded-2xl overflow-hidden">
  <CardContent className="p-8">

    {/* Top Badges */}
  {/* <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
  <span className="px-4 py-1 text-xs font-semibold rounded-full bg-green-500 text-black shadow-md">
    MOST POPULAR
  </span>
</div> */}
<div className="absolute -top-3 inset-x-0 left-1/2 flex justify-center z-30">
  <span className="
    px-5 py-1
    text-xs font-semibold
    rounded-full
    bg-green-600
    text-black
    shadow-lg
    
  ">
    MOST POPULAR
  </span>
</div>
    <div className="absolute top-4 right-4">
      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-600 border border-green-400/30">
        BEST VALUE
      </span>
    </div>

    {/* Heading */}
    <h3 className="text-2xl font-bold text-green-600 mb-1">
     Helicoptic API
    </h3>
    <p className="text-sm text-gray-400 mb-6">
      All-in-one solution
    </p>

    {/* Yearly Badge */}
    <div className="mb-6 justify-center left-1/2 flex ">
      <span className="inline-block px-4 py-1 rounded-full bg-green-500 text-black text-sm font-semibold">
        Yearly (Save 30%)
      </span>
    </div>

    {/* Price */}
    <div className="mb-6 ">
      <div className="text-4xl font-bold left-1/2 flex justify-center">
        ₹29,000<span className="text-base font-medium text-gray-400"> / year</span>
      </div>
      <div className="text-sm text-green-600 mt-1 left-1/2 flex justify-center">
        That’s just ₹749/month
      </div>
    </div>

    {/* Free Trial Button */}
   <Button
  variant="outline"
  className="w-full mb-6 border  text-green-400 bg-green-500/10 !border-green-400"
>
  🎁 Start FREE Trial
</Button>


    {/* Features */}
    <div className="space-y-4 text-sm mb-8">
      {[
        ["User-Friendly + Affordable Pricing", "Intuitive Interface With Cost-Effective Plans"],
        ["Unlimited No-Code Automation + Chatbot", "Powerful Automation Without Any Coding Required"],
        ["WhatsApp CRM With Sales Tracking", "Complete Customer Relationship Management"],
        ["Team Inbox & Task Automation", "Collaborate Efficiently With Your Team"],
        ["Broadcasting At Scale", "Reach Thousands With A Single Click"],
      ].map(([title, desc], i) => (
        <div key={i} className="flex gap-3">
          <div className="mt-1 w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <div className="font-medium">{title}</div>
            <div className="text-xs text-gray-400">{desc}</div>
          </div>
        </div>
      ))}
    </div>

    {/* Main CTA */}
    <Button className="w-full bg-green-600 hover:bg-green-600 text-black font-semibold py-6 rounded-xl">
      Get Started – Save 80% Today
    </Button>

    {/* Footer Text */}
    <div className="text-center text-xs text-gray-400 mt-4">
      Trusted by 50,000+ Businesses Worldwide
    </div>

  </CardContent>
</Card>

            </div>
          </div>

          {/* Pricing Tiers */}
          <div className="max-w-7xl mx-auto">
<div className="text-center mb-12">
  <h1
    className="
      text-xl sm:text-2xl md:text-4xl lg:text-4xl
      font-bold mb-3 sm:mb-4
      whitespace-normal md:whitespace-nowrap
      leading-tight
      px-2 sm:px-0
    "
    style={{
      backgroundImage:
        "linear-gradient(to right, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    }}
  >
    Best WhatsApp Marketing & Automation Tools with Affordable Plans
  </h1>

  <p className="
    text-base sm:text-lg md:text-2xl
    font-bold
    text-muted-foreground
    px-3 sm:px-0
  ">
    Affordable Pricing With Zero Setup Fee.
  </p>
</div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Basic Plan */}
              <Card className="border-2 border-yellow-500 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <h3 className="text-2xl font-bold mb-2 text-center">Basic</h3>
                  <p className="text-sm text-muted-foreground mb-6 text-center">
                    Everything you need to get started with<br />WhatsApp Marketing
                  </p>
                  
                  <div className="text-center mb-6">
                    <div className="text-4xl font-bold mb-2">29,000</div>
                    <div className="text-sm text-muted-foreground">/ Year + GST</div>
                  </div>

                  <Button className="w-full mb-6 bg-yellow-500 hover:bg-yellow-600">
                    Subscribe Now
                  </Button>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">25,000 Audience Management</div>
                        <div className="text-xs text-muted-foreground">Tag/Label, Custom Attributes, Segment Contacts</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">25,000 Broadcasting /month</div>
                        <div className="text-xs text-muted-foreground">Message Template, Broadcast Analytics</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">1 Admin + 2 Agents Agent</div>
                        <div className="text-xs text-muted-foreground">Additional User Rs.99/user</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Advance Chatbot Builder</div>
                        <div className="text-xs text-muted-foreground">Codeless bot, Smart bot with GPT, Unlimited Chats & Messages, Webhooks</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Auto Message Campaigns</div>
                        <div className="text-xs text-muted-foreground">Trigger Based Campaign</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Chat Inbox</div>
                        <div className="text-xs text-muted-foreground">Quick Reply, Saved Caned Message, Private Notes, Quick Assign, Chat Transfer, Ticket System</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Catalog Offering</div>
                        <div className="text-xs text-muted-foreground">Product Catalog, Cart System</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">WhatsApp Charges</div>
                        <div className="text-xs text-muted-foreground">As per Meta rate (₹0.25 - ₹1.1 / user)</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Standard attendance</div>
                        <div className="text-xs text-muted-foreground">Email and live chat support (8-12 hrs response time), Onboarding, Training & Strategic Guidance</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Acquire leads</div>
                        <div className="text-xs text-muted-foreground">Enquiry Forms link and QR code leads to WhatsApp</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Dedicated Customer Support Manger</div>
                        <div className="text-xs text-muted-foreground">Onboarding, Training & Strategic Guidance</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Integrations</div>
                        <div className="text-xs text-muted-foreground">Shopify, WooCommerce, Google Sheets, Razorpay/Cashfree, Zoho CRM, Make(Integromat), Pabbly Connect</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Premium Plan */}
              <Card className="border-2 border-green-600 hover:shadow-xl transition-shadow relative">
                
                <CardContent className="p-6">
                  <h3 className="text-2xl font-bold mb-2 text-center">Premium</h3>
                  <p className="text-sm text-muted-foreground mb-6 text-center">
                    Highly Recommended for 10+ in small-mid<br />sized business for everyday use
                  </p>
                  
                  <div className="text-center mb-6">
                    <div className="text-4xl font-bold mb-2">35,000</div>
                    <div className="text-sm text-muted-foreground">/ Year + GST</div>
                  </div>

                  <Button className="w-full mb-6 bg-green-500 hover:bg-green-600">
                    Subscribe Now
                  </Button>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">100000 Audience Management</div>
                        <div className="text-xs text-muted-foreground">Tag/Label, Custom Attributes, Segment Contacts</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">100000 Broadcasting /month</div>
                        <div className="text-xs text-muted-foreground">Message Template, Broadcast Analytics</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">1 Admin + 4 Agents Agent</div>
                        <div className="text-xs text-muted-foreground">Additional User Rs.99/user</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Advance Chatbot Builder</div>
                        <div className="text-xs text-muted-foreground">Codeless bot, Smart bot with GPT, Unlimited Chats & Messages, Webhooks</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Auto Message Campaigns</div>
                        <div className="text-xs text-muted-foreground">Trigger Based Campaign</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Chat Inbox</div>
                        <div className="text-xs text-muted-foreground">Quick Reply, Saved Caned Message, Private Notes, Quick Assign, Chat Transfer, Ticket System</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Catalog Offering</div>
                        <div className="text-xs text-muted-foreground">Product Catalog, Cart System, Payment Gateway, Send Quotations</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">WhatsApp Charges</div>
                        <div className="text-xs text-muted-foreground">As per Meta rate (₹0.25 - ₹1.1 / user)</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">24/7/365 attendance</div>
                        <div className="text-xs text-muted-foreground">Email and live chat support (2-4 hrs response time)</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Acquire leads</div>
                        <div className="text-xs text-muted-foreground">Enquiry Forms link and QR code leads to WhatsApp</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Dedicated Customer Support Manger</div>
                        <div className="text-xs text-muted-foreground">Onboarding, Training & Strategic Guidance</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Integrations</div>
                        <div className="text-xs text-muted-foreground">Shopify, WooCommerce, Google Sheets, Razorpay/Cashfree, Zoho CRM, Make(Integromat), Pabbly Connect</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Enterprise Plan */}
              <Card className="border-2 border-blue-500 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <h3 className="text-2xl font-bold mb-2 text-center">Enterprises</h3>
                  <p className="text-sm text-muted-foreground mb-6 text-center">
                    For large-scale and multi-team<br />organizations
                  </p>
                  
                  <div className="text-center mb-6">
                    <div className="text-4xl font-bold mb-2">38,000</div>
                    <div className="text-sm text-muted-foreground">/ Year + GST</div>
                  </div>

                  <Button className="w-full mb-6 bg-blue-500 hover:bg-blue-600">
                    Subscribe Now
                  </Button>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">500,000+ Audience Management</div>
                        <div className="text-xs text-muted-foreground">Tag/Label, Custom Attributes, Segment Contacts</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Unlimited Broadcasting /month</div>
                        <div className="text-xs text-muted-foreground">Message Template, Broadcast Analytics</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Unlimited Admin & agent</div>
                        <div className="text-xs text-muted-foreground">Unlimited Users</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Advance Chatbot Builder</div>
                        <div className="text-xs text-muted-foreground">Codeless bot, Smart bot with GPT, Unlimited Chats & Messages, Webhooks</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Auto Message Campaigns</div>
                        <div className="text-xs text-muted-foreground">Trigger Based Campaign</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Chat Inbox</div>
                        <div className="text-xs text-muted-foreground">Quick Reply, Saved Caned Message, Private Notes, Quick Assign, Chat Transfer, Ticket System</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Catalog Offering</div>
                        <div className="text-xs text-muted-foreground">Product Catalog, Cart System, Payment Gateway, Send Quotations</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">WhatsApp Charges</div>
                        <div className="text-xs text-muted-foreground">As per Meta rate (₹0.17 - ₹1.1 / user)</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">24/7/365 attendance</div>
                        <div className="text-xs text-muted-foreground">Email, Phone and live chat (1-2 hrs response time)</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Acquire leads</div>
                        <div className="text-xs text-muted-foreground">Enquiry Forms link and QR code leads to WhatsApp</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Dedicated Customer Support Manger</div>
                        <div className="text-xs text-muted-foreground">Onboarding, Training & Strategic Guidance</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Integrations</div>
                        <div className="text-xs text-muted-foreground">Shopify, WooCommerce, Google Sheets, Razorpay/Cashfree, Zoho CRM, Make(Integromat), Pabbly Connect, Custom API</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
  


      {/* Platform Feature Comparison */}
      <section className="py-12 md:py-20 bg-muted/30">
        <div className={MARKETING_PAGE_SHELL}>
         
   <div className="text-center mb-12">
             <h1
  className="text-2xl sm:text-3xl md:text-4xl lg:text-4xl font-bold mb-4 whitespace-nowrap"
  style={{
    backgroundImage:
      "linear-gradient(to right, #4fb576 0%, #44c489 30%, #28a9ae 46%, #28a2b7 59%, #4c7788 71%, #6c4f63 86%, #432c39 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  }}
>
 Platform Feature Comparison
</h1>

            <p className="text-muted-foreground text-2xl font-bold">
               Compare the most popular WhatsApp Business API providers
            </p>
            </div>
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* AiZagy */}
              <Card>
                <div className="bg-green-600 p-4 flex items-center justify-center gap-2">
                  <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="text-white font-bold text-lg"></h3>
                </div>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {[
                      'Unlimited Audience Management',
                      'Unlimited Broadcasting',
                      'AiZagy API Scheduler Drip-wise Campaign APIs',
                      'Unlimited Users Access',
                      'Advance Chatflow Builder',
                      'Collect data, trigger automation, route chats, integrate CRM, get alerts',
                      'Key Message Campaigns & Trigger Based Campaigns',
                      'Chat Inbox with Role Based / Round Robin Chats',
                      'Catalog Ordering with WhatsApp Catalog & Shopify',
                      'Marketing: ₹0.78 /sales, Utility: ₹0.11 /sales',
                      'Shortlink Promotional (Multi media campaigns, Open & Read Rate Tracking)',
                      'Acquire Leads via CRM ads',
                      'Dedicated Customer Success Manager',
                      'Integrations: Facebook, Instagram, Shopify, WooCommerce, Indiamart, JustDial, Zoam, Google Sheets +25 more',
                      'Calls Tracking (Upto 20 Phones)',
                      'Zero fee WhatsApp Setup',
                      'Official WhatsApp API + Blue Tick Verification Help',
                      'AI Automation (Answer queries, reminders, info collection, etc.)',
                      'Drip Campaigning, Advanced Messaging API, Campaign Scheduler',
                      'Campaign Analytics, Smart Agent Routing, Budget Analytics',
                      'Preject APIs, Custom Agent Rules',
                      'Broadcasting & Retargeting with Higher Rate Limits'
                    ].map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AiSensy */}
              <Card>
                <div className="bg-green-600 p-4 flex items-center justify-center gap-2">
                  <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="text-white font-bold text-lg">AiSensy</h3>
                </div>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {[
                      'Per Template Message Charges',
                      'Marketing: ₹0.88, Utility: ₹0.125, Authentication: ₹0.125',
                      'Unlimited Broadcasting',
                      'Unlimited Pre-Service Conversations',
                      '1 Owner + 5 FREE Agents (extra @ ₹750/month)',
                      'Smart Audience Segregation',
                      'Broadcasting & Retargeting',
                      'Drip Campaign Marketing APIs',
                      'Multi-Agent Live Chat',
                      'Chat Inbox with Role Based / Round Robin Chats',
                      'Agent Transfer & Manager Monitoring',
                      'WhatsApp Charges: Marketing ₹0.80, Utility & Authentication ₹0.13',
                      'AiSensy Marketplace Integrations',
                      '2400 Messages/min',
                      'Shopify & WooCommerce Integrations',
                      'DialogFlow Chatbot Integration',
                      'Shared Team Inbox',
                      'Click-to-WhatsApp Ads Manager',
                      'Upto 100 Tags, 20 Custom Attributes',
                      'AI Automation (Answer queries, reminders, info collection, etc.)',
                      'Campaign Scheduler & Click Tracking',
                      'Campaign Analytics, Smart Agent Routing, Budget Analytics',
                      'Smart Agent Routing, Custom Agent Rules',
                      'Carousel Template Click Tracking',
                      'User Access Control, Automatic Retry',
                      'Chatbot Flows (5 Flows = 2500 messages separately charged)'
                    ].map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Interakt */}
              <Card>
                <div className="bg-green-600 p-4 flex items-center justify-center gap-2">
                  <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-green-500" />
                  </div>
                  <h3 className="text-white font-bold text-lg">Interakt</h3>
                </div>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {[
                      'Advanced chatbot flows with branching & API',
                      'Data Auto-assignment, Advanced Webhooks',
                      'Unlimited Broadcasting',
                      'PCS active charges',
                      '20 Users Access',
                      'Higher Rate Limits & Better Campaign Speeds',
                      'No Template Markups',
                      'Personalised Support',
                      'Unlimited messages (per WhatsApp number)',
                      'Unlimited Contacts',
                      'Catalog Ordering with WhatsApp Catalog & Shopify',
                      'Custom Fields, Tags, Events (varies by plan)',
                      'Template Charges: Marketing ₹0.882, Auth ₹0.125, Utility ₹0.180, Service FREE'
                    ].map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Gallabox */}
              <Card>
                <div className="bg-green-600 p-4 flex items-center justify-center gap-2">
                  <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="text-white font-bold text-lg">Gallabox</h3>
                </div>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {[
                      'Chatbot builder with drag-and-drop connections',
                      'Connectors include Google Sheets, Razorpay & Shopify',
                      'Unlimited Broadcasting',
                      'Messaging & chatbot analytics',
                      'Broadcast to segmented contacts',
                      'Shared team inbox with collaboration',
                      'WhatsApp Flow/Forms',
                      'Basic messaging API',
                      '30+ Native integrations',
                      'WhatsApp catalogs & POS campaigns',
                      'Advanced messaging API',
                      'Multiple WhatsApp numbers/channels',
                      'AI Rewrite using Gallabox GPT'
                    ].map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
     </div>
    
  );
}


