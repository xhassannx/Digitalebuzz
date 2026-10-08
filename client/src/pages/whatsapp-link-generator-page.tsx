import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Check, Copy, Download, Link2, Loader2, MessageCircle, User } from "lucide-react";
import type { CountryDialEntry } from "@/lib/country-dial-codes";
import { cn } from "@/lib/utils";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { RhButton } from "@/panel-templates/ratehonk-v1/components/rh";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function buildWaMeLink(e164Digits: string, message: string): string {
  const base = `https://wa.me/${e164Digits}`;
  const text = message.trim();
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

function LinkSettingsCard({ className, ...props }: ComponentProps<typeof Card>) {
  const skin = useRatehonkPageSkin();
  return <Card className={cn(skin && "wa-link-rh-card", className)} {...props} />;
}

export default function WhatsAppLinkGeneratorPage({ embedded }: { embedded?: boolean } = {}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const skin = useRatehonkPageSkin();

  const [countryDial, setCountryDial] = useState("+91");
  const [localPhone, setLocalPhone] = useState("");
  const [message, setMessage] = useState("");
  const [resultOpen, setResultOpen] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: countryDialEntries = [] } = useQuery<CountryDialEntry[]>({
    queryKey: ["/api/country-dial-codes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/country-dial-codes");
      return res.json();
    },
  });

  const countries = useMemo(() => {
    const list = [...countryDialEntries];
    list.sort((a, b) => a.country.localeCompare(b.country));
    if (list.length === 0) {
      return [{ iso: "IN", country: "India", dial: "+91" }] as CountryDialEntry[];
    }
    return list;
  }, [countryDialEntries]);

  useEffect(() => {
    if (!countries.some((c) => c.dial === countryDial) && countries[0]) {
      setCountryDial(countries[0].dial);
    }
  }, [countries, countryDial]);

  const dialDigits = digitsOnly(countryDial);
  const phoneDigits = digitsOnly(localPhone);
  const e164Digits = `${dialDigits}${phoneDigits}`;
  const displayPhone = phoneDigits ? `${countryDial} ${localPhone.trim()}` : countryDial;
  const previewMessage = message.trim() || "Your custom message will appear here…";
  const liveLink = phoneDigits ? buildWaMeLink(e164Digits, message) : "";

  const selectedCountry =
    countries.find((c) => c.dial === countryDial) ||
    countries.find((c) => c.iso === "IN") ||
    countries[0];

  const brandBtnClass =
    "w-full h-12 text-base font-semibold text-white bg-[var(--rh-brand,#047857)] hover:bg-[var(--rh-brand-hover,#065f46)]";
  const brandTextClass = "text-[var(--rh-brand,#047857)]";
  const brandBorderSoft =
    "border-[color-mix(in_srgb,var(--rh-brand,#047857)_22%,#e5e7eb)] bg-[var(--rh-brand-soft,#ecfdf5)]";

  const handleGenerate = async () => {
    if (phoneDigits.length < 6) {
      toast({
        variant: "destructive",
        title: "Phone number required",
        description: "Enter a valid WhatsApp phone number (without country code in the number field).",
      });
      return;
    }
    setGenerating(true);
    try {
      const url = buildWaMeLink(e164Digits, message);
      const qr = await QRCode.toDataURL(url, {
        width: 280,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      setGeneratedUrl(url);
      setQrDataUrl(qr);
      setResultOpen(true);
      setCopied(false);
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Could not generate link",
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyUrl = async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      toast({ title: "Copied", description: "WhatsApp link copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Select the link and copy it manually.",
      });
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `whatsapp-qr-${e164Digits || "link"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const generateButton = skin ? (
    <RhButton
      className={cn(brandBtnClass, "rounded-lg")}
      disabled={generating}
      onClick={() => void handleGenerate()}
      data-testid="button-generate-wa-link"
    >
      {generating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating…
        </>
      ) : (
        <>
          <Link2 className="h-4 w-4" />
          Generate Link
        </>
      )}
    </RhButton>
  ) : (
    <Button
      type="button"
      className={brandBtnClass}
      disabled={generating}
      onClick={() => void handleGenerate()}
      data-testid="button-generate-wa-link"
    >
      {generating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating…
        </>
      ) : (
        <>
          <Link2 className="mr-2 h-4 w-4" />
          Generate Link
        </>
      )}
    </Button>
  );

  return (
    <div
      className={cn(
        "wa-link-generator-page mx-auto w-full max-w-6xl space-y-6",
        !embedded && "px-6 py-6 sm:px-8 lg:px-10 xl:px-12",
        skin && "wa-link-rh-page",
      )}
    >
      <div className="space-y-4">
        {skin ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted-foreground hover:text-foreground"
            onClick={() => setLocation("/integrations")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Integrations
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => setLocation("/integrations")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Integrations
          </Button>
        )}

        <div>
          <h1
            className={cn(
              "text-2xl font-semibold tracking-tight",
              skin && "wa-link-page-title text-[1.65rem]",
            )}
          >
            WhatsApp Link Generator
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            WhatsApp Link is your unique WhatsApp URL with a predefined message that you can share
            across social media, websites, and emails. When someone clicks it, WhatsApp opens with
            your number and a pre-filled message in their chat box.
          </p>
        </div>
      </div>

      <section
        className={cn(
          "wa-link-hero-banner rounded-xl border px-4 py-3 text-sm sm:px-5",
          skin ? brandBorderSoft : "border-[#cfe8cf] bg-[#eef9ee]",
        )}
      >
        <span className={cn("font-medium", skin ? "wa-link-hero-accent" : brandTextClass)}>
          Free WhatsApp link generator
        </span>
        <span className="text-muted-foreground">
          {" "}
          — Create WhatsApp links &amp; QR codes in 3 steps, share them, and grow your business.
        </span>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <LinkSettingsCard>
          <CardHeader>
            <CardTitle className="text-lg">Create your link</CardTitle>
            <CardDescription>
              Select country code, enter your WhatsApp number, add a message, then generate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Select your country code &amp; type your WhatsApp phone number</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={countryDial} onValueChange={setCountryDial}>
                  <SelectTrigger className="sm:w-[220px]">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {countries.map((c) => (
                      <SelectItem key={`${c.iso}-${c.dial}`} value={c.dial}>
                        {c.country} ({c.dial})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {countryDial}
                  </span>
                  <Input
                    className="pl-14"
                    inputMode="tel"
                    placeholder="Your phone number goes in here"
                    value={localPhone}
                    onChange={(e) => setLocalPhone(e.target.value.replace(/[^\d\s-]/g, ""))}
                    data-testid="input-wa-link-phone"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the number without the country code (e.g. for India: 9876543210).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Type your custom message with emojis &amp; WhatsApp text formatting 😊</Label>
              <Textarea
                rows={5}
                placeholder="Add your customer message that user will send to you"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                data-testid="input-wa-link-message"
              />
            </div>

            {generateButton}

            {liveLink ? (
              <p className="break-all text-xs text-muted-foreground">
                Preview URL: <span className="text-foreground">{liveLink}</span>
              </p>
            ) : null}
          </CardContent>
        </LinkSettingsCard>

        <LinkSettingsCard>
          <CardHeader>
            <CardTitle className="text-lg">Message Preview</CardTitle>
            <CardDescription>How the chat will look when someone opens your link.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <div className="w-full max-w-[320px] overflow-hidden rounded-2xl border shadow-lg bg-[#e5ddd5]">
              <div className="wa-link-preview-header flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{displayPhone}</p>
                  <p className="text-[11px] text-white/70">WhatsApp</p>
                </div>
              </div>
              <div
                className="min-h-[280px] p-4"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 20% 20%, rgba(0,0,0,0.03) 0, transparent 40%), radial-gradient(circle at 80% 60%, rgba(0,0,0,0.04) 0, transparent 35%)",
                }}
              >
                <div className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-lg rounded-tr-sm bg-[#dcf8c6] px-3 py-2 text-sm text-slate-800 shadow-sm">
                  {previewMessage}
                </div>
                <p className="mt-2 text-right text-[10px] text-slate-500">Pre-filled for the visitor</p>
              </div>
            </div>
          </CardContent>
        </LinkSettingsCard>
      </div>

      {!skin ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <LinkSettingsCard>
              <CardHeader>
                <CardTitle className="text-base">3 steps to create a WhatsApp link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">1. Enter your WhatsApp number</strong> — select
                  country/code and type the number where you want to receive messages
                  {selectedCountry ? ` (${selectedCountry.country}).` : "."}
                </p>
                <p>
                  <strong className="text-foreground">2. Add a custom message</strong> — e.g. “Hey, I
                  had a query.” Visitors will see it pre-filled when they open WhatsApp.
                </p>
                <p>
                  <strong className="text-foreground">3. Generate your WhatsApp link</strong> — get a
                  click-to-chat URL and a QR code you can put on packaging, posters, or your website.
                </p>
              </CardContent>
            </LinkSettingsCard>

            <LinkSettingsCard>
              <CardHeader>
                <CardTitle className="text-base">Benefits of sharing a WhatsApp link</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>Connect with users directly on WhatsApp with ease.</li>
                  <li>Start 1:1 real-time conversations and customer support instantly.</li>
                  <li>Use the same link in Instagram bio, stories, Facebook, YouTube, and more.</li>
                  <li>QR codes work offline on print materials and packaging.</li>
                </ul>
              </CardContent>
            </LinkSettingsCard>
          </div>

          <LinkSettingsCard>
            <CardHeader>
              <CardTitle className="text-base">WhatsApp Link FAQs</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="what">
                  <AccordionTrigger>What is a WhatsApp Link?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    WhatsApp Link is your unique WhatsApp URL with a predefined message that you can
                    share with your audience across all social media platforms. By clicking this
                    WhatsApp link, users are redirected to your WhatsApp with a pre-filled message in
                    their text box.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="instagram">
                  <AccordionTrigger>How to create WhatsApp Link on Instagram?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    1. Open Instagram → Profile → Edit profile. 2. Under Links, add your generated
                    WhatsApp link and save.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="cost">
                  <AccordionTrigger>
                    What do you need to pay to create one WhatsApp Link?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Nothing. You can generate unlimited click-to-chat WhatsApp links with this tool.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="where">
                  <AccordionTrigger>Where can I use the WhatsApp Link?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Social media bios, Instagram stories, YouTube descriptions, Pinterest, Facebook,
                    Twitter/X posts, email signatures, and websites.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </LinkSettingsCard>
        </>
      ) : null}

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Here is your WhatsApp link</DialogTitle>
            <DialogDescription>
              Copy and share it on your social media, website, emails, or anywhere you want to be
              contacted instantly by your customers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <MessageCircle className={cn("mt-0.5 h-5 w-5 shrink-0", brandTextClass)} />
              <a
                href={generatedUrl}
                target="_blank"
                rel="noreferrer"
                className={cn("break-all text-sm font-medium hover:underline", brandTextClass)}
                data-testid="text-generated-wa-link"
              >
                {generatedUrl}
              </a>
            </div>

            <div className="flex flex-col items-center gap-2">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="WhatsApp QR code"
                  className="h-56 w-56 rounded-md border bg-white p-2"
                  data-testid="img-wa-link-qr"
                />
              ) : null}
              <p className="text-center text-xs text-muted-foreground">
                Scan to open the same WhatsApp chat link
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {skin ? (
                <>
                  <RhButton className={cn(brandBtnClass, "h-11")} onClick={() => void copyUrl()}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy URL"}
                  </RhButton>
                  <RhButton
                    variant="outline"
                    className={cn("h-11", brandTextClass, "border-[var(--rh-brand,#047857)]")}
                    onClick={downloadQr}
                  >
                    <Download className="h-4 w-4" />
                    Download QR
                  </RhButton>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    className={brandBtnClass}
                    onClick={() => void copyUrl()}
                    data-testid="button-copy-wa-link"
                  >
                    {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                    {copied ? "Copied" : "Copy URL"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(brandTextClass, "border-[var(--rh-brand,#047857)] hover:bg-[var(--rh-brand-soft,#ecfdf5)]")}
                    onClick={downloadQr}
                    data-testid="button-download-wa-qr"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download QR
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
