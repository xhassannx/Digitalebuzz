import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replitAuth";
import { resolveOrganizationContext, requirePermission } from "../middleware/organization-context";
import { storage } from "../storage";
import { sendWhatsAppNativePaymentMessage } from "./whatsapp-native-payment";
import { runWhatsAppCommerceDiagnostics, resolveWabaIdFromPhoneNumber } from "./meta-graph";
import { resolveOfficialCredentialsForSession, ensureOfficialSessionReadyForSend, normalizeRecipientPhoneForWhatsApp } from "./session-credentials";
import {
  createWaPayOrder,
  getWaPayOrderById,
  listWaPayOrdersForOrganization,
  normalizeWaPayReferenceId,
} from "./wa-pay-order-store";
import { lookupWhatsAppPayment } from "./wa-pay-meta-api";
import { sendWaPayOrderStatusUpdate } from "./wa-pay-payment-handler";
import { fetchMetaCatalogProductsResult, resolveCatalogProductForCheckout } from "./meta-graph";
import { parseMetaCatalogPriceMajor } from "./meta-catalog-product-fields";

function getUserId(req: { user?: { claims?: { sub?: string }; userId?: string } }): string {
  return req.user?.claims?.sub || req.user?.userId || "";
}

async function resolveCommerceWabaId(
  creds: { accessToken: string; phoneNumberId?: string; businessAccountId?: string },
  sessionId: string
): Promise<string | null> {
  const fromPhone = creds.phoneNumberId
    ? await resolveWabaIdFromPhoneNumber(creds.accessToken, creds.phoneNumberId)
    : null;
  if (fromPhone) return fromPhone;
  const session = await storage.getSession(sessionId);
  const fromSession =
    creds.businessAccountId ||
    (session?.deviceInfo as { wabaId?: string } | undefined)?.wabaId ||
    "";
  return fromSession ? String(fromSession) : null;
}

export function registerWaPayRoutes(app: Express) {
  const withAuth = [isAuthenticated, resolveOrganizationContext] as const;

  app.get(
    "/api/wa-pay/settings",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }
        const settings = await storage.getOrganizationCommerceSettings(organizationId);
        res.json({
          metaCatalogId: settings?.metaCatalogId || null,
          metaCatalogName: settings?.metaCatalogName || null,
          waPayCatalogCheckoutEnabled: settings?.waPayCatalogCheckoutEnabled ?? false,
          waPayOrderType: settings?.waPayOrderType || "physical-goods",
          metaPaymentConfigurationName: settings?.metaPaymentConfigurationName || null,
          metaPaymentGateway: settings?.metaPaymentGateway || "razorpay",
          lastWaPayCheckoutAt: settings?.lastWaPayCheckoutAt || null,
          lastWaPayCheckoutStatus: settings?.lastWaPayCheckoutStatus || null,
          lastWaPayCheckoutError: settings?.lastWaPayCheckoutError || null,
          shopifyCheckoutEnabled: settings?.shopifyCheckoutEnabled ?? false,
          woocommerceCheckoutEnabled: settings?.woocommerceCheckoutEnabled ?? false,
        });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Failed to load WA Pay settings",
        });
      }
    }
  );

  app.put(
    "/api/wa-pay/settings",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }

        const body = z
          .object({
            waPayCatalogCheckoutEnabled: z.boolean().optional(),
            waPayOrderType: z.enum(["physical-goods", "digital-goods"]).optional(),
            metaPaymentConfigurationName: z.string().optional(),
            metaPaymentGateway: z.enum(["razorpay", "payu"]).optional(),
          })
          .parse(req.body);

        const patch: Record<string, unknown> = {
          ...(body.waPayCatalogCheckoutEnabled !== undefined
            ? { waPayCatalogCheckoutEnabled: body.waPayCatalogCheckoutEnabled }
            : {}),
          ...(body.waPayOrderType !== undefined ? { waPayOrderType: body.waPayOrderType } : {}),
          ...(body.metaPaymentConfigurationName !== undefined
            ? { metaPaymentConfigurationName: body.metaPaymentConfigurationName.trim() || null }
            : {}),
          ...(body.metaPaymentGateway !== undefined
            ? { metaPaymentGateway: body.metaPaymentGateway }
            : {}),
        };

        if (body.waPayCatalogCheckoutEnabled) {
          patch.whatsappNativePayEnabled = true;
        }

        const settings = await storage.upsertOrganizationCommerceSettings(organizationId, patch);
        res.json({
          success: true,
          waPayCatalogCheckoutEnabled: settings.waPayCatalogCheckoutEnabled,
          waPayOrderType: settings.waPayOrderType,
          metaPaymentConfigurationName: settings.metaPaymentConfigurationName,
          metaPaymentGateway: settings.metaPaymentGateway,
        });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Failed to save WA Pay settings",
        });
      }
    }
  );

  app.get(
    "/api/wa-pay/diagnostics",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const userId = getUserId(req);
        const sessionId = String(req.query.sessionId || "").trim();
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }
        if (!sessionId) {
          return res.status(400).json({ message: "sessionId query is required" });
        }
        const creds = await resolveOfficialCredentialsForSession(
          sessionId,
          userId,
          organizationId
        );
        if (!creds?.accessToken || !creds.phoneNumberId) {
          return res.status(400).json({ message: "Could not load WhatsApp credentials." });
        }
        const wabaId = await resolveCommerceWabaId(creds, sessionId);
        if (!wabaId) {
          return res.status(400).json({ message: "No WABA id for this session." });
        }
        const settings = await storage.getOrganizationCommerceSettings(organizationId);
        const diagnostics = await runWhatsAppCommerceDiagnostics(creds.accessToken, {
          phoneNumberId: creds.phoneNumberId,
          wabaId,
          configuredCatalogId: settings?.metaCatalogId || undefined,
        });

        const issues: string[] = [];
        if (diagnostics.smbAccount) {
          issues.push(
            "SMB WhatsApp account detected. Native in-chat Review and pay (payment_gateway) may be blocked by Meta until your WABA is eligible for P2M payments. Email whatsappindia-bizpayments-support@meta.com or use Commerce external checkout."
          );
        }
        for (const check of diagnostics.checks || []) {
          if (!check.ok && check.detail) {
            issues.push(`${check.label}: ${check.detail}`);
          }
        }

        res.json({
          ...diagnostics,
          isCartEnabled: diagnostics.commerceSettings?.is_cart_enabled === true,
          isCatalogVisible: diagnostics.commerceSettings?.is_catalog_visible === true,
          configuredCatalogLinked: diagnostics.catalogLinkedToWaba === true,
          issues,
          waPayCatalogCheckoutEnabled: settings?.waPayCatalogCheckoutEnabled ?? false,
          metaPaymentConfigurationName: settings?.metaPaymentConfigurationName || null,
        });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Diagnostics failed",
        });
      }
    }
  );

  app.post(
    "/api/wa-pay/test-send",
    ...withAuth,
    requirePermission("inbox.send"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const data = z
          .object({
            sessionId: z.string(),
            to: z.string(),
            referenceId: z.string().optional(),
            bodyText: z.string().optional(),
            currency: z.string().default("INR"),
            amountMajor: z.number().positive().optional(),
            itemName: z.string().optional(),
            productRetailerId: z.string().optional(),
            beneficiaryName: z.string().optional(),
            orderType: z.enum(["physical-goods", "digital-goods"]).optional(),
          })
          .parse(req.body);

        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }

        const settings = await storage.getOrganizationCommerceSettings(organizationId);
        const configName = settings?.metaPaymentConfigurationName?.trim();
        if (!configName) {
          return res.status(400).json({
            message: "Set Meta payment configuration name on the WA Pay page",
          });
        }

        const userId = getUserId(req);
        await ensureOfficialSessionReadyForSend(data.sessionId, userId, organizationId);

        const to = normalizeRecipientPhoneForWhatsApp(data.to);
        const orderType =
          data.orderType ||
          (settings?.waPayOrderType as "physical-goods" | "digital-goods") ||
          "physical-goods";
        const catalogId = settings?.metaCatalogId?.trim() || "";
        const productRetailerId = data.productRetailerId?.trim() || "";

        if (orderType === "physical-goods" && catalogId && !productRetailerId) {
          return res.status(400).json({
            message:
              "Select a catalog product for physical-goods WA Pay. Meta requires catalog_id and retailer_id.",
          });
        }

        let itemName = data.itemName?.trim() || "Test order";
        let amountMajor = data.amountMajor;
        let retailerId: string | undefined;

        if (productRetailerId) {
          if (!catalogId) {
            return res.status(400).json({
              message: "Configure Meta catalog on the Commerce page before sending catalog WA Pay tests.",
            });
          }
          const creds = await resolveOfficialCredentialsForSession(
            data.sessionId,
            userId,
            organizationId
          );
          if (!creds?.accessToken) {
            return res.status(400).json({ message: "WhatsApp Business session not ready" });
          }

          const resolved = await resolveCatalogProductForCheckout(creds.accessToken, catalogId, {
            retailerIdGuess: productRetailerId,
            itemNameGuess: data.itemName,
          });

          if (resolved.product) {
            itemName = resolved.product.name || itemName;
            retailerId = resolved.product.retailerId;
            const priceMajor = parseMetaCatalogPriceMajor(resolved.product.price);
            if (priceMajor != null) {
              amountMajor = priceMajor;
            }
          } else if (resolved.retailerId) {
            retailerId = resolved.retailerId;
            if (!data.itemName?.trim() || data.amountMajor == null) {
              const hint = resolved.availableIds?.length
                ? ` Known products: ${resolved.availableIds.join("; ")}.`
                : "";
              return res.status(400).json({
                message:
                  `Catalog product "${productRetailerId}" not found.${hint} Pick from the dropdown or copy Content ID from Commerce Manager.`,
              });
            }
          }
        }

        if (amountMajor == null || !Number.isFinite(amountMajor) || amountMajor <= 0) {
          return res.status(400).json({ message: "Enter a valid amount or select a catalog product." });
        }
        if (amountMajor < 10) {
          return res.status(400).json({
            message: "Minimum test amount is ₹10 for WhatsApp native pay.",
          });
        }

        const amountMinor = Math.round(amountMajor * 100);
        const referenceId = normalizeWaPayReferenceId(
          data.referenceId || `tst${Date.now().toString(36)}`
        );

        const result = await sendWhatsAppNativePaymentMessage({
          sessionId: data.sessionId,
          to,
          referenceId,
          bodyText: data.bodyText || "Review your order and pay in WhatsApp",
          currency: data.currency,
          items: [
            {
              name: itemName,
              amountMinor,
              quantity: 1,
              retailerId,
            },
          ],
          paymentConfigurationName: configName,
          paymentGateway: settings?.metaPaymentGateway === "payu" ? "payu" : "razorpay",
          orderType,
          catalogId: catalogId || undefined,
          beneficiaryName: data.beneficiaryName?.trim() || undefined,
        });

        const order = await createWaPayOrder({
          organizationId,
          sessionId: data.sessionId,
          customerWaId: to.replace(/\D/g, ""),
          referenceId,
          paymentConfigurationName: configName,
          paymentGateway: settings?.metaPaymentGateway === "payu" ? "payu" : "razorpay",
          orderType,
          catalogId: catalogId || undefined,
          amountMinor,
          currency: data.currency,
          paymentStatus: "pending",
          orderStatus: "pending",
          orderDetailsMessageId: result.messageId,
          lineItems: [
            {
              retailerId,
              name: itemName,
              amountMinor,
              quantity: 1,
            },
          ],
        });

        res.json({
          success: true,
          messageId: result.messageId,
          referenceId,
          orderId: order.id,
          resolvedRetailerId: retailerId,
        });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "WA Pay test send failed",
        });
      }
    }
  );

  app.get(
    "/api/wa-pay/orders",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
        const orders = await listWaPayOrdersForOrganization(organizationId, limit);
        res.json({ orders });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Failed to list WA Pay orders",
        });
      }
    }
  );

  app.get(
    "/api/wa-pay/orders/:orderId/payment-lookup",
    ...withAuth,
    requirePermission("integrations.view"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const userId = getUserId(req);
        const orderId = String(req.params.orderId || "").trim();
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }
        const order = await getWaPayOrderById(organizationId, orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });

        const creds = await resolveOfficialCredentialsForSession(
          order.sessionId,
          userId,
          organizationId
        );
        if (!creds?.accessToken || !creds.phoneNumberId) {
          return res.status(400).json({ message: "Could not load WhatsApp credentials" });
        }

        const lookup = await lookupWhatsAppPayment(
          creds.accessToken,
          creds.phoneNumberId,
          order.paymentConfigurationName,
          order.referenceId
        );
        res.json({ lookup, order });
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Payment lookup failed",
        });
      }
    }
  );

  app.post(
    "/api/wa-pay/orders/:orderId/order-status",
    ...withAuth,
    requirePermission("inbox.send"),
    async (req: any, res) => {
      try {
        const organizationId = req.context?.organizationId;
        const orderId = String(req.params.orderId || "").trim();
        if (!organizationId) {
          return res.status(400).json({ message: "Organization context required" });
        }

        const body = z
          .object({
            orderStatus: z.enum([
              "processing",
              "partially_shipped",
              "shipped",
              "completed",
              "canceled",
            ]),
            bodyText: z.string().optional(),
            description: z.string().optional(),
          })
          .parse(req.body);

        const result = await sendWaPayOrderStatusUpdate({
          organizationId,
          orderId,
          orderStatus: body.orderStatus,
          bodyText: body.bodyText,
          description: body.description,
        });
        res.json(result);
      } catch (e: unknown) {
        res.status(500).json({
          message: e instanceof Error ? e.message : "Failed to update order status",
        });
      }
    }
  );
}
