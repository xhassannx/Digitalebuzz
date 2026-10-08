import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { WhiteLabelHeader } from "./header";
import "../lp-styles.css";

export function accentRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "22, 163, 74";
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

export const template4InputStyle: CSSProperties = {
  height: 44,
  borderRadius: 10,
  border: "1px solid var(--lp-border)",
  background: "#fff",
};

type Template4AuthLayoutProps = {
  brandName: string;
  accentColor?: string;
  maxWidth?: number;
  children: ReactNode;
};

export function Template4AuthLayout({
  brandName,
  accentColor = "#16a34a",
  maxWidth = 440,
  children,
}: Template4AuthLayoutProps) {
  const accent = accentRgb(accentColor);
  const rootStyle = { "--lp-accent-color": accentColor } as CSSProperties;

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  return (
    <div className="lp-root lp-auth-page" style={rootStyle}>
      <WhiteLabelHeader brandName={brandName} accentColor={accentColor} />

      <main className="lp-auth-main">
        <div className="lp-auth-main-bg" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              top: -80,
              right: -60,
              width: 420,
              height: 420,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(${accent},0.12) 0%, transparent 65%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -100,
              left: -80,
              width: 380,
              height: 380,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 65%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "radial-gradient(circle, rgba(140,140,140,0.35) 1.5px, transparent 1.5px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(68% 60% at 50% 47%, rgba(255,252,250,0.98) 30%, transparent 100%)",
            }}
          />
        </div>

        <div className="lp-auth-main-inner" style={{ maxWidth }}>{children}</div>
      </main>
    </div>
  );
}

type Template4AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  titleTestId?: string;
};

export function Template4AuthCard({ title, description, children, footer, titleTestId }: Template4AuthCardProps) {
  return (
    <>
      <div
        className="lp-bento-cell"
        style={{
          padding: 32,
          boxShadow: "0 12px 40px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <h1
            data-testid={titleTestId}
            style={{
              fontSize: 24,
              fontWeight: 840,
              color: "var(--lp-text)",
              marginBottom: 6,
              letterSpacing: -0.5,
            }}
          >
            {title}
          </h1>
          <p style={{ fontSize: 14, color: "var(--lp-text-2)", margin: 0 }}>{description}</p>
        </div>
        {children}
      </div>
      {footer ? <div style={{ marginTop: 20, textAlign: "center" }}>{footer}</div> : null}
    </>
  );
}
