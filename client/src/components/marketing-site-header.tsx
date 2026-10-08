import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import {
  MARKETING_LOGO_IMG_CLASS,
  MARKETING_PAGE_SHELL,
} from "@/lib/marketing-layout";

function scrollToSectionId(id: string) {
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  }
}

type BookDemoLink = {
  configured?: boolean;
  path?: string | null;
  url?: string | null;
  slug?: string | null;
};

export function MarketingSiteHeader() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isHome = location === "/" || location === "";

  const { data: bookDemo } = useQuery<BookDemoLink>({
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

  const onFeaturesClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isHome) {
      e.preventDefault();
      scrollToSectionId("tour");
    }
    setMobileMenuOpen(false);
  };

  const onIntegrationsClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isHome) {
      e.preventDefault();
      scrollToSectionId("integrations");
    }
    setMobileMenuOpen(false);
  };

  const featuresHref = isHome ? "#features" : "/#features";
  const integrationsHref = isHome ? "#integrations" : "/#integrations";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className={MARKETING_PAGE_SHELL}>
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            <img
              src="/logo-main.png"
              alt="Helicoptic Logo"
              className={MARKETING_LOGO_IMG_CLASS}
            />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <a
              href={featuresHref}
              onClick={onFeaturesClick}
              className="text-sm font-bold text-black transition-colors hover:text-neutral-800"
            >
              Features
            </a>
            <a
              href={integrationsHref}
              onClick={onIntegrationsClick}
              className="text-sm font-bold text-black transition-colors hover:text-neutral-800"
            >
              Integrations
            </a>
            <Link href="/about">
              <span className="cursor-pointer text-sm font-bold text-black transition-colors hover:text-neutral-800">
                About Us
              </span>
            </Link>
            <Link href="/contact">
              <span className="cursor-pointer text-sm font-bold text-black transition-colors hover:text-neutral-800">
                Contact Us
              </span>
            </Link>
            {bookDemoHref && (
              <Link href={bookDemoHref}>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-600 font-bold text-green-700 hover:bg-green-50 hover:text-green-800"
                >
                  Book a Demo
                </Button>
              </Link>
            )}
            <Link href="/white-label">
              <Button
                variant="default"
                size="sm"
                className="border-0 bg-green-600 font-bold text-white shadow-none hover:bg-green-700 hover:text-white"
              >
                White Label
              </Button>
            </Link>
            <Link href="/login">
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer text-sm font-bold text-black transition-colors hover:text-neutral-800"
              >
                Log In
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="w-full border-t bg-background md:hidden">
          <nav
            className={`${MARKETING_PAGE_SHELL} flex flex-col items-stretch gap-1 py-4`}
            aria-label="Mobile primary"
          >
            <a
              href={featuresHref}
              className="block py-2.5 text-left text-sm font-bold text-black"
              onClick={(e) => {
                if (isHome) {
                  e.preventDefault();
                  scrollToSectionId("features");
                }
                setMobileMenuOpen(false);
              }}
            >
              Features
            </a>
            <a
              href={integrationsHref}
              className="block py-2.5 text-left text-sm font-bold text-black"
              onClick={(e) => {
                if (isHome) {
                  e.preventDefault();
                  scrollToSectionId("integrations");
                }
                setMobileMenuOpen(false);
              }}
            >
              Integrations
            </a>
            <Link href="/about" onClick={() => setMobileMenuOpen(false)}>
              <span className="block cursor-pointer py-2.5 text-left text-sm font-bold text-black">
                About Us
              </span>
            </Link>
            <Link href="/contact" onClick={() => setMobileMenuOpen(false)}>
              <span className="block cursor-pointer py-2.5 text-left text-sm font-bold text-black">
                Contact Us
              </span>
            </Link>
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
              {bookDemoHref && (
                <Link href={bookDemoHref} className="block">
                  <Button
                    variant="outline"
                    className="h-11 w-full justify-start border-green-600 px-4 font-bold text-green-700 hover:bg-green-50 hover:text-green-800"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Book a Demo
                  </Button>
                </Link>
              )}
              <Link href="/white-label" className="block">
                <Button
                  variant="default"
                  className="h-11 w-full justify-start border-0 bg-green-600 px-4 font-bold text-white shadow-none hover:bg-green-700 hover:text-white"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  White Label
                </Button>
              </Link>
              <Link href="/login" className="block">
                <Button
                  variant="ghost"
                  className="h-11 w-full justify-start px-4 font-bold text-black hover:bg-muted hover:text-black"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Log In
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
