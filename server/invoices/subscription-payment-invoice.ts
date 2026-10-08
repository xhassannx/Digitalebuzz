import { jsPDF } from "jspdf";
import { eq } from "drizzle-orm";
import { payments, subscriptions, type Payment, type Plan, type Subscription, type User } from "@shared/schema";
import { formatPlanMinorAmount, type PlanCheckoutBreakdown } from "@shared/plan-pricing";
import { db } from "../../db";
import { storage } from "../storage";
import { sendEmail } from "../utils/email";
import { deliverInvoiceToRecipient, type InvoiceDeliveryResult } from "./invoice-delivery";

type SubscriptionInvoiceDetails = {
  invoiceNo: string;
  companyName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  planName: string;
  billingCycle: string;
  paymentGateway: string;
  transactionId: string;
  paidAt: Date;
  currency: string;
  amountMinor: number;
  breakdown?: PlanCheckoutBreakdown | null;
};

function formatBillingCycle(cycle: string): string {
  const c = cycle.toLowerCase();
  if (c === "monthly") return "Monthly";
  if (c === "quarterly") return "Quarterly";
  if (c === "yearly") return "Yearly";
  return cycle;
}

function gatewayLabel(gateway: string): string {
  if (gateway === "razorpay") return "Razorpay";
  if (gateway === "stripe") return "Stripe";
  return gateway;
}

export function buildSubscriptionPaymentInvoicePdf(details: SubscriptionInvoiceDetails): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 18;
  const margin = 14;

  doc.setFillColor(0, 89, 187);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("Subscription Payment Invoice", 105, 14, { align: "center" });
  doc.setFontSize(10);
  doc.text(details.companyName, 105, 22, { align: "center" });

  doc.setTextColor(30, 30, 30);
  y = 38;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Invoice No: ${details.invoiceNo}`, margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${details.paidAt.toLocaleDateString("en-IN")}`, margin, y);
  y += 7;
  doc.text("Payment Status: Paid", margin, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Bill To", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(details.customerName, margin, y);
  y += 5;
  doc.text(details.customerEmail, margin, y);
  if (details.customerPhone) {
    y += 5;
    doc.text(details.customerPhone, margin, y);
  }
  y += 10;

  doc.setFillColor(0, 89, 187);
  doc.rect(margin, y, 182, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Description", margin + 2, y + 5.5);
  doc.text("Amount", 196, y + 5.5, { align: "right" });
  y += 12;

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  const lineDesc = `${details.planName} — ${formatBillingCycle(details.billingCycle)} subscription`;
  doc.text(lineDesc, margin + 2, y);
  doc.text(formatPlanMinorAmount(details.amountMinor, details.currency), 196, y, { align: "right" });
  y += 10;

  if (details.breakdown) {
    const b = details.breakdown;
    const rows: [string, number][] = [
      ["Plan price", b.baseMinor],
      ...(b.serviceChargeMinor > 0 ? [["Service charge", b.serviceChargeMinor] as [string, number]] : []),
      ...(b.gstMinor > 0 ? [[`GST (${b.gstPercent}%)`, b.gstMinor] as [string, number]] : []),
    ];
    for (const [label, minor] of rows) {
      doc.setFontSize(9);
      doc.text(label, margin + 4, y);
      doc.text(formatPlanMinorAmount(minor, details.currency), 196, y, { align: "right" });
      y += 5;
    }
    doc.setFontSize(11);
    y += 3;
  }

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, 196, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.text("Total", margin + 2, y);
  doc.text(formatPlanMinorAmount(details.amountMinor, details.currency), 196, y, { align: "right" });
  y += 8;

  doc.setFillColor(236, 253, 245);
  doc.rect(margin, y, 182, 8, "F");
  doc.setTextColor(4, 120, 87);
  doc.text("Amount Paid", margin + 2, y + 5.5);
  doc.text(formatPlanMinorAmount(details.amountMinor, details.currency), 196, y + 5.5, { align: "right" });
  y += 10;

  doc.setFillColor(254, 242, 242);
  doc.rect(margin, y, 182, 8, "F");
  doc.setTextColor(185, 28, 28);
  doc.text("Amount Pending", margin + 2, y + 5.5);
  doc.text(formatPlanMinorAmount(0, details.currency), 196, y + 5.5, { align: "right" });
  y += 14;

  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Payment method: ${gatewayLabel(details.paymentGateway)}`, margin, y);
  y += 5;
  doc.text(`Transaction ID: ${details.transactionId}`, margin, y);
  y += 10;
  doc.setFontSize(9);
  doc.text("Thank you for your payment.", margin, y);

  return Buffer.from(doc.output("arraybuffer"));
}

async function loadSubscriptionPaymentContext(payment: Payment): Promise<{
  user: User;
  subscription: Subscription;
  plan: Plan;
  organizationId: string;
  organizationName: string;
} | null> {
  const user = await storage.getUser(payment.userId);
  if (!user) return null;

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, payment.subscriptionId))
    .limit(1);
  if (!subscription) return null;

  const plan = await storage.getPlan(subscription.planId);
  if (!plan) return null;

  const orgs = await storage.getOrganizationsByUser(payment.userId);
  const owned = orgs.find((o) => o.ownerId === payment.userId) ?? orgs[0];
  const organizationName =
    owned?.name?.trim() ||
    process.env.APP_BRAND_NAME?.trim() ||
    "Helicoptic Solutions";

  return {
    user,
    subscription,
    plan,
    organizationId: owned?.id ?? payment.userId,
    organizationName,
  };
}

function buildInvoiceNo(payment: Payment): string {
  const tx = payment.gatewayPaymentId || payment.gatewayOrderId || payment.id;
  const safe = String(tx).replace(/[^a-zA-Z0-9]/g, "").slice(-12) || payment.id.slice(0, 8);
  return `SUB-${safe.toUpperCase()}`;
}

export async function deliverSubscriptionPaymentInvoice(
  paymentId: string,
): Promise<InvoiceDeliveryResult | { skipped: true; reason: string }> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) {
    return { skipped: true, reason: "Payment not found" };
  }
  if (payment.status !== "completed") {
    return { skipped: true, reason: "Payment not completed" };
  }

  const meta = (payment.metadata && typeof payment.metadata === "object"
    ? payment.metadata
    : {}) as Record<string, unknown>;
  if (meta.subscriptionInvoiceDelivered) {
    return { skipped: true, reason: "Invoice already delivered" };
  }

  const ctx = await loadSubscriptionPaymentContext(payment);
  if (!ctx) {
    return { skipped: true, reason: "Missing subscription context" };
  }

  const { user, subscription, plan, organizationId, organizationName } = ctx;
  const customerName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.email ||
    "Customer";
  const customerEmail = user.email?.trim();
  if (!customerEmail) {
    return { skipped: true, reason: "User has no email address" };
  }

  const breakdown = meta.pricingBreakdown as PlanCheckoutBreakdown | undefined;
  const invoiceNo = buildInvoiceNo(payment);
  const pdfBuffer = buildSubscriptionPaymentInvoicePdf({
    invoiceNo,
    companyName: organizationName,
    customerName,
    customerEmail,
    customerPhone: user.phone?.trim() || undefined,
    planName: plan.displayName,
    billingCycle: subscription.billingCycle,
    paymentGateway: payment.paymentGateway,
    transactionId: payment.gatewayPaymentId || payment.gatewayOrderId || payment.id,
    paidAt: payment.completedAt ?? new Date(),
    currency: payment.currency,
    amountMinor: payment.amount,
    breakdown: breakdown ?? null,
  });

  const paidMajor = payment.amount / 100;

  const delivery = await deliverInvoiceToRecipient({
    userId: payment.userId,
    organizationId,
    organizationName,
    invoiceNo,
    pdfBuffer,
    email: customerEmail,
    phone: user.phone?.trim() || undefined,
    customerName,
    currency: payment.currency,
    totalAmount: paidMajor,
    amountPaid: paidMajor,
    amountPending: 0,
    invoiceStatus: "paid",
  });

  if (!delivery.email?.sent) {
    const { buildInvoiceEmailContent } = await import("./invoice-message-templates");
    const { subject, text, html } = buildInvoiceEmailContent({
      organizationName,
      invoiceNo,
      customerName,
      currency: payment.currency,
      totalAmount: paidMajor,
      amountPaid: paidMajor,
      amountPending: 0,
      invoiceStatus: "paid",
    });
    const sent = await sendEmail({
      userId: payment.userId,
      to: customerEmail,
      subject,
      text,
      html,
      attachments: [
        {
          filename: `invoice-${invoiceNo.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
    if (sent) {
      delivery.email = { attempted: true, sent: true };
    } else if (!delivery.email) {
      delivery.email = { attempted: true, sent: false, error: "Email SMTP is not configured" };
    }
  }

  await storage.updatePayment(payment.id, {
    metadata: {
      ...meta,
      subscriptionInvoiceDelivered: true,
      subscriptionInvoiceDeliveredAt: new Date().toISOString(),
      subscriptionInvoiceNo: invoiceNo,
      subscriptionInvoiceDelivery: delivery,
    },
  });

  console.log(
    `[Subscription invoice] ${invoiceNo} — email=${delivery.email?.sent ? "ok" : delivery.email?.error || "no"}, ` +
      `whatsapp=${delivery.whatsapp?.sent ? "ok" : delivery.whatsapp?.error || "no"}`,
  );

  return delivery;
}
