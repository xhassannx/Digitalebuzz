import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  CalendarClock,
  LayoutDashboard,
  Zap,
} from "lucide-react";
import "./industrial-login.css";

function isUsableLogoUrl(url?: string): boolean {
  if (!url?.trim()) return false;
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("/") ||
    url.startsWith("data:image/")
  );
}

function LoginBrandMark({
  logoUrl,
  logoSize = 48,
}: {
  logoUrl?: string;
  logoSize?: number;
}) {
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  const showLogo = isUsableLogoUrl(logoUrl) && !logoFailed;

  if (showLogo) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="shrink-0 object-contain"
        style={{ width: logoSize, height: logoSize }}
        onError={() => setLogoFailed(true)}
      />
    );
  }

  return (
    <div className="w-12 h-12 shrink-0 bg-[var(--login-primary)] flex items-center justify-center rounded-full shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
      <Zap className="h-7 w-7 text-white font-bold" aria-hidden />
    </div>
  );
}

const LOGIN_HIGHLIGHTS = [
  {
    icon: LayoutDashboard,
    title: "Campaign Dashboard",
    description:
      "Manage and monitor all your WhatsApp campaigns in one smart, easy-to-use dashboard.",
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description:
      "Track your WhatsApp campaign performance in real time with actionable insights.",
  },
  {
    icon: CalendarClock,
    title: "Scheduled Messages",
    description:
      "Automate and schedule WhatsApp messages to reach your audience at the perfect time.",
  },
] as const;

export type IndustrialLoginLayoutProps = {
  tenantName: string;
  portalLabel?: string;
  heroTitleLine1?: string;
  heroTitleLine2?: string;
  loginCardLabel?: string;
  panelStatusText?: string;
  panelHeading?: string;
  logoUrl?: string;
  logoSize?: number;
  /** Allow the entire page to scroll (signup) instead of locking viewport height. */
  fullPageScroll?: boolean;
  children: ReactNode;
  footerExtra?: ReactNode;
};

export function IndustrialLoginLayout({
  tenantName,
  portalLabel = "User Portal",
  heroTitleLine1 = "Power of",
  heroTitleLine2 = "Meta API",
  loginCardLabel = "User Login",
  panelStatusText = "Awaiting Authentication",
  panelHeading = "Welcome Back",
  logoUrl,
  logoSize,
  fullPageScroll = false,
  children,
  footerExtra,
}: IndustrialLoginLayoutProps) {
  useEffect(() => {
    if (fullPageScroll) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [fullPageScroll]);

  return (
    <div
      className={`industrial-login flex flex-col lg:flex-row bg-[#080808] relative ${
        fullPageScroll
          ? "industrial-login--full-page min-h-[100dvh]"
          : "h-[100dvh] max-h-[100dvh] overflow-hidden"
      }`}
    >
      <div className="absolute inset-0 z-0 bg-[#050505] bg-grid animate-grid-drift pointer-events-none" />
      <div className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none overflow-hidden">
        <div
          className="w-full h-[400px] bg-gradient-to-b from-transparent via-[var(--login-primary)] to-transparent animate-scanline"
        />
      </div>

      {/* Left branding panel */}
      <div
        className={`hidden lg:flex lg:w-[50%] relative z-10 flex-col justify-center px-16 xl:px-24 ${
          fullPageScroll ? "py-12 xl:py-16" : "h-full overflow-hidden"
        }`}
      >
        <div className="space-y-8 xl:space-y-10">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <LoginBrandMark logoUrl={logoUrl} logoSize={logoSize} />
              <div className="flex flex-col">
                <h1 className="text-3xl xl:text-4xl font-black text-white tracking-widest uppercase">
                  {tenantName}
                </h1>
                <span className="text-xs sm:text-sm font-mono text-[var(--login-primary)] font-bold tracking-[0.3em] uppercase">
                  {portalLabel}
                </span>
              </div>
            </div>
            <div className="h-px w-full bg-gradient-to-r from-[var(--login-primary)] to-transparent opacity-20" />
          </div>

          <div className="space-y-6">
            <div className="inline-block px-3 py-1.5 border border-[color-mix(in_srgb,var(--login-primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--login-primary)_5%,transparent)] text-xs sm:text-sm font-mono text-[var(--login-primary)] font-bold uppercase tracking-widest">
              System Status: Operational
            </div>
            <h2 className="text-4xl xl:text-5xl 2xl:text-[3.75rem] font-black text-white leading-none tracking-tighter uppercase">
              <span className="block">{heroTitleLine1}</span>
              <span className="block text-[var(--login-primary)] pl-20 sm:pl-24 xl:pl-32 2xl:pl-40">
                {heroTitleLine2}
              </span>
            </h2>
            <p className="text-xs sm:text-sm font-mono text-white/20 uppercase font-black tracking-widest">
              Meta Business Partner • Certified Infrastructure
            </p>
            <p className="text-xl xl:text-2xl text-white font-semibold max-w-lg leading-relaxed">
              Sign in to manage your marketing campaigns
            </p>

            <ul className="login-highlights max-w-xl space-y-3 pt-1">
              {LOGIN_HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
                <li key={title} className="login-highlight-item">
                  <div className="login-highlight-icon" aria-hidden>
                    <Icon className="h-5 w-5 text-[var(--login-primary)]" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-base font-black text-white uppercase tracking-wide">
                      {title}
                    </h3>
                    <p className="text-base text-white/45 leading-relaxed">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div
        className={`w-full lg:w-[50%] flex flex-col items-center p-4 sm:p-6 lg:p-12 xl:p-16 relative z-20 ${
          fullPageScroll ? "justify-center py-8 lg:py-12" : "h-full justify-center overflow-hidden"
        }`}
      >
        <div className="w-full max-w-[440px] space-y-5 sm:space-y-6 my-auto">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-[var(--login-primary)] animate-pulse" />
              <span className="text-xs sm:text-sm font-mono text-[color-mix(in_srgb,var(--login-primary)_60%,transparent)] uppercase font-black tracking-widest">
                {panelStatusText}
              </span>
            </div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-tight">
              {panelHeading}
            </h2>
          </div>

          <div className="industrial-card p-1 shadow-[20px_20px_60px_-15px_rgba(0,0,0,0.8)]">
            <div className="absolute top-2 right-4 text-sm font-mono text-white uppercase font-black tracking-wide">
              {loginCardLabel}
            </div>
            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          </div>

          {footerExtra}

          {/* Distribution of this system is strictly limited to authorized resellers.
              Meta Business Partner • Certified Infrastructure — moved below hero on left panel */}
        </div>
      </div>
    </div>
  );
}
