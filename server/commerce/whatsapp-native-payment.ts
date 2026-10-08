import { businessAPIManager } from "../whatsapp/business-api-client";

export type NativePaymentItem = {
  name: string;
  amountMinor: number;
  quantity: number;
  retailerId?: string;
};

export type WaPayOrderType = "physical-goods" | "digital-goods";

export async function sendWhatsAppNativePaymentMessage(opts: {
  sessionId: string;
  to: string;
  referenceId: string;
  bodyText: string;
  currency: string;
  items: NativePaymentItem[];
  paymentConfigurationName: string;
  paymentGateway?: "razorpay" | "payu";
  orderType?: WaPayOrderType;
  catalogId?: string;
  beneficiaryName?: string;
  footerText?: string;
}): Promise<{ messageId: string }> {
  if (!businessAPIManager.isClientReady(opts.sessionId)) {
    throw new Error("WhatsApp Business session not ready");
  }

  const result = await businessAPIManager.sendOrderDetailsPaymentMessage(
    opts.sessionId,
    opts.to,
    {
      referenceId: opts.referenceId,
      bodyText: opts.bodyText,
      currency: opts.currency,
      items: opts.items,
      paymentConfigurationName: opts.paymentConfigurationName,
      paymentGateway: opts.paymentGateway,
      orderType: opts.orderType || "digital-goods",
      catalogId: opts.catalogId,
      beneficiaryName: opts.beneficiaryName,
      footerText: opts.footerText || "Pay securely in WhatsApp",
    }
  );

  return { messageId: result.id };
}
