import { useLayoutEffect } from "react";
import { useLocation } from "wouter";
import { getPublicTemplateId } from "@/lib/public-template";
import LandingPage from "@/pages/landing-page";
import PartnerWithusPage from "@/pages/partnerwithus-page";
import AboutPage from "@/pages/about-page";
import PricingPage from "@/pages/pricing-page";
import ContactPage from "@/pages/contact-page";
import PrivacyPage from "@/pages/privacy-page";
import TermsPage from "@/pages/terms-page";
import WhiteLabelFeaturesPage from "@/pages/white-label/landing-page-1/features-page";
import WhiteLabelPricingPage from "@/pages/white-label/landing-page-1/pricing-page";
import WhiteLabelAboutPage from "@/pages/white-label/landing-page-1/about";
import WhiteLabelTestimonialsPage from "@/pages/white-label/landing-page-1/testimonials-page";
import WhiteLabelContactPage from "@/pages/white-label/landing-page-1/contact-page";
import WhiteLabelPrivacyPage from "@/pages/white-label/landing-page-1/privacy";
import WhiteLabelTermsPage from "@/pages/white-label/landing-page-1/terms";
import WhiteLabelSubscribePage from "@/pages/white-label/landing-page-1/subscribe-page";
import PublicSubscribePageDefault from "@/pages/public-subscribe-page";

/** Shallow replace (e.g. `/white-label/pricing` → `/pricing` for template 4). */
export function ReplaceTo({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useLayoutEffect(() => {
    navigate(to, { replace: true });
  }, [to, navigate]);
  return null;
}

function ScrollToSectionLanding({ sectionId }: { sectionId: string }) {
  useLayoutEffect(() => {
    const id = window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [sectionId]);
  return <LandingPage />;
}

export function PublicFeaturesPage() {
  const id = getPublicTemplateId();
  if (id === 4) return <WhiteLabelFeaturesPage />;
  if (id === 2) return <PartnerWithusPage />;
  return <ScrollToSectionLanding sectionId="features" />;
}

export function PublicTestimonialsPage() {
  const id = getPublicTemplateId();
  if (id === 4) return <WhiteLabelTestimonialsPage />;
  if (id === 2) return <PartnerWithusPage />;
  return <ScrollToSectionLanding sectionId="testimonials" />;
}

export function PublicAboutPage() {
  return getPublicTemplateId() === 4 ? <WhiteLabelAboutPage /> : <AboutPage />;
}

export function PublicPricingPage() {
  return getPublicTemplateId() === 4 ? <WhiteLabelPricingPage /> : <PricingPage />;
}

export function PublicContactPage() {
  return getPublicTemplateId() === 4 ? <WhiteLabelContactPage /> : <ContactPage />;
}

export function PublicPrivacyPage() {
  return getPublicTemplateId() === 4 ? <WhiteLabelPrivacyPage /> : <PrivacyPage />;
}

export function PublicTermsPage() {
  return getPublicTemplateId() === 4 ? <WhiteLabelTermsPage /> : <TermsPage />;
}

export function PublicSubscribePage() {
  return getPublicTemplateId() === 4 ? <WhiteLabelSubscribePage /> : <PublicSubscribePageDefault />;
}
