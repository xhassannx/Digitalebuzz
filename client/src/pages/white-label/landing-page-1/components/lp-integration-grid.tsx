import { CreditCard } from "lucide-react";
import { LANDING_INTEGRATION_ITEMS, getLandingIntegrationIconSrc } from "@/lib/landing-integrations";
import { isPaymentGateway } from "@/lib/integration-icons";
import { LpReveal } from "./lp-animations";

export function LpIntegrationGrid() {
  return (
    <div className="lp-integration-grid">
      {LANDING_INTEGRATION_ITEMS.map((item, i) => {
        const iconSrc = getLandingIntegrationIconSrc(item.name);
        const usePaymentGlyph = isPaymentGateway(item.name) && !iconSrc;

        return (
          <LpReveal
            key={item.name}
            direction={i % 3 === 0 ? "left" : i % 3 === 1 ? "up" : "right"}
            delay={0.04 * (i % 6)}
          >
            <div className="lp-integration-chip">
              <div className="lp-integration-chip-icon" aria-hidden>
                {iconSrc ? (
                  <>
                    <img
                      src={iconSrc}
                      alt=""
                      loading="lazy"
                      className="lp-integration-chip-img"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                    <span className="lp-integration-chip-fallback lp-integration-chip-fallback-hidden">
                      {item.displayName.charAt(0)}
                    </span>
                  </>
                ) : usePaymentGlyph ? (
                  <CreditCard className="h-6 w-6 text-[#414754]" strokeWidth={1.75} />
                ) : (
                  <span className="lp-integration-chip-fallback">{item.displayName.charAt(0)}</span>
                )}
              </div>
              <span className="lp-integration-chip-label">{item.displayName}</span>
            </div>
          </LpReveal>
        );
      })}
    </div>
  );
}
