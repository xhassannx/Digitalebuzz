import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Bot, Link2, Mail, Shield, Zap } from "lucide-react";

export const LP_FEATURE_ICON_THEMES = [
  { bg: "#eff6ff", border: "#dbeafe", iconBg: "#ffffff", iconColor: "#2563eb" },
  { bg: "#faf5ff", border: "#ede9fe", iconBg: "#ffffff", iconColor: "#7c3aed" },
  { bg: "#f0fdf4", border: "#bbf7d0", iconBg: "#ffffff", iconColor: "#16a34a" },
  { bg: "#ecfeff", border: "#a5f3fc", iconBg: "#ffffff", iconColor: "#0891b2" },
  { bg: "#fdf2f8", border: "#fbcfe8", iconBg: "#ffffff", iconColor: "#db2777" },
  { bg: "#fff7ed", border: "#fed7aa", iconBg: "#ffffff", iconColor: "#ea580c" },
] as const;

export const LP_FEATURE_ICONS: LucideIcon[] = [Mail, Bot, BarChart3, Zap, Shield, Link2];

type LpFeatureCardProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
  themeIndex?: number;
};

export function LpFeatureCard({ title, description, icon, themeIndex = 0 }: LpFeatureCardProps) {
  const Icon = icon ?? LP_FEATURE_ICONS[themeIndex % LP_FEATURE_ICONS.length];
  const theme = LP_FEATURE_ICON_THEMES[themeIndex % LP_FEATURE_ICON_THEMES.length];

  return (
    <article
      className="lp-feature-card lp-bento-cell"
      style={
        {
          "--lp-feature-bg": theme.bg,
          "--lp-feature-border": theme.border,
          "--lp-feature-icon-bg": theme.iconBg,
          "--lp-feature-icon-color": theme.iconColor,
        } as CSSProperties
      }
    >
      <div className="lp-feature-card-icon">
        <Icon className="h-5 w-5 lp-feature-card-icon-svg" strokeWidth={2.25} />
      </div>
      <h2 className="lp-feature-card-title">{title}</h2>
      <p className="lp-feature-card-desc">{description}</p>
    </article>
  );
}
