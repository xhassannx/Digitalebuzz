import type { Request, Response, NextFunction } from "express";
import { getWalletBillingConfig, isWalletBillingEnabled } from "./config";
import { storage } from "../storage";

/**
 * When wallet billing is enabled and skipSaasSubscriptionForOfficialMessages is true,
 * bypass SaaS subscription checks for message limit middleware (official API billed via wallet).
 */
export function skipUsageLimitsWhenWalletBilling() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const enabled = await isWalletBillingEnabled();
      if (!enabled) return next();
      const config = await getWalletBillingConfig();
      if (!config.skipSaasSubscriptionForOfficialMessages) return next();

      const sessionId =
        (req.body as { sessionId?: string })?.sessionId ||
        (req.query as { sessionId?: string })?.sessionId;
      if (!sessionId) return next();

      const session = await storage.getSession(sessionId);
      if (session?.connectionType === "official") {
        (req as any).skipUsageLimitsForWallet = true;
      }
    } catch (_) {}
    next();
  };
}
