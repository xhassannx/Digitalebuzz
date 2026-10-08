import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { MessageSquare, Menu, X } from "lucide-react";

export function WhiteLabelHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (path: string) => {
    if (path === "/white-label-2" && location === "/white-label-2") return true;
    return location.startsWith(path) && path !== "/white-label-2";
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/95 backdrop-blur-sm shadow-md"
          : "bg-transparent"
      }`}
    >
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link href="/white-label-2" className="flex items-center space-x-2 group">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center transform group-hover:scale-110 transition-transform">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              YourBrand
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            <Link href="/white-label/features">
              <span
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer block ${
                  isActive("/white-label/features")
                    ? "text-primary bg-primary/10"
                    : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Features
              </span>
            </Link>
            <Link href="/white-label/pricing">
              <span
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer block ${
                  isActive("/white-label/pricing")
                    ? "text-primary bg-primary/10"
                    : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Pricing
              </span>
            </Link>
            <Link href="/white-label/testimonials">
              <span
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer block ${
                  isActive("/white-label/testimonials")
                    ? "text-primary bg-primary/10"
                    : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Testimonials
              </span>
            </Link>
            <Link href="/white-label/contact">
              <span
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer block ${
                  isActive("/white-label/contact")
                    ? "text-primary bg-primary/10"
                    : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Contact
              </span>
            </Link>
            <div className="h-6 w-px bg-border mx-2" />
            <Link href="/white-label/login">
              <Button variant="ghost" size="sm" className="font-medium">
                Login
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 rounded-md text-foreground hover:bg-muted"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 space-y-1 border-t bg-background/95 backdrop-blur-sm">
            <Link href="/white-label/features" onClick={() => setMobileMenuOpen(false)}>
              <span
                className={`block px-4 py-3 text-base font-medium rounded-lg transition-colors cursor-pointer ${
                  isActive("/white-label/features")
                    ? "text-primary bg-primary/10"
                    : "text-foreground hover:text-primary hover:bg-muted"
                }`}
              >
                Features
              </span>
            </Link>
            <Link href="/white-label/pricing" onClick={() => setMobileMenuOpen(false)}>
              <span
                className={`block px-4 py-3 text-base font-medium rounded-lg transition-colors cursor-pointer ${
                  isActive("/white-label/pricing")
                    ? "text-primary bg-primary/10"
                    : "text-foreground hover:text-primary hover:bg-muted"
                }`}
              >
                Pricing
              </span>
            </Link>
            <Link href="/white-label/testimonials" onClick={() => setMobileMenuOpen(false)}>
              <span
                className={`block px-4 py-3 text-base font-medium rounded-lg transition-colors cursor-pointer ${
                  isActive("/white-label/testimonials")
                    ? "text-primary bg-primary/10"
                    : "text-foreground hover:text-primary hover:bg-muted"
                }`}
              >
                Testimonials
              </span>
            </Link>
            <Link href="/white-label/contact" onClick={() => setMobileMenuOpen(false)}>
              <span
                className={`block px-4 py-3 text-base font-medium rounded-lg transition-colors cursor-pointer ${
                  isActive("/white-label/contact")
                    ? "text-primary bg-primary/10"
                    : "text-foreground hover:text-primary hover:bg-muted"
                }`}
              >
                Contact
              </span>
            </Link>
            <div className="pt-4 mt-4 border-t">
              <Link href="/white-label/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full font-medium">
                  Login
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

