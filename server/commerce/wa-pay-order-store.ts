import { db } from "../../db";
import { isMongoEnabled } from "../../db/mongo";
import { WaPayOrderModel } from "../models";
import { waPayOrders, type InsertWaPayOrder, type WaPayOrder } from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";

export type WaPayLineItem = {
  retailerId?: string;
  name: string;
  amountMinor: number;
  quantity: number;
};

export function normalizeWaPayReferenceId(raw: string): string {
  return String(raw || "")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .slice(0, 35);
}

function normalizeWaPayDoc(d: any): WaPayOrder {
  if (!d) return d;
  return { ...d, id: d.id || d._id } as any;
}

export async function createWaPayOrder(
  data: Omit<InsertWaPayOrder, "referenceId"> & { referenceId: string }
): Promise<WaPayOrder> {
  const referenceId = normalizeWaPayReferenceId(data.referenceId);
  if (!referenceId) throw new Error("reference_id is required");

  if (isMongoEnabled()) {
    const created = await WaPayOrderModel.create({
      ...data,
      referenceId,
      updatedAt: new Date(),
    });
    const doc = created.toObject();
    return normalizeWaPayDoc({ ...doc, id: doc._id });
  }

  const [row] = await db
    .insert(waPayOrders)
    .values({
      ...data,
      referenceId,
      updatedAt: new Date(),
    })
    .returning();
  if (!row) throw new Error("Failed to create WA Pay order");
  return row;
}

export async function getWaPayOrderByReference(
  organizationId: string,
  referenceId: string
): Promise<WaPayOrder | undefined> {
  const ref = normalizeWaPayReferenceId(referenceId);
  if (isMongoEnabled()) {
    const doc = await WaPayOrderModel.findOne({ organizationId, referenceId: ref }).lean();
    return doc ? normalizeWaPayDoc({ ...doc, id: doc._id }) : undefined;
  }
  const [row] = await db
    .select()
    .from(waPayOrders)
    .where(and(eq(waPayOrders.organizationId, organizationId), eq(waPayOrders.referenceId, ref)));
  return row;
}

export async function findWaPayOrderByReference(referenceId: string): Promise<WaPayOrder | undefined> {
  const ref = normalizeWaPayReferenceId(referenceId);
  if (isMongoEnabled()) {
    const doc = await WaPayOrderModel.findOne({ referenceId: ref }).lean();
    return doc ? normalizeWaPayDoc({ ...doc, id: doc._id }) : undefined;
  }
  const [row] = await db.select().from(waPayOrders).where(eq(waPayOrders.referenceId, ref));
  return row;
}

export async function listWaPayOrdersForOrganization(
  organizationId: string,
  limit = 25
): Promise<WaPayOrder[]> {
  if (isMongoEnabled()) {
    const docs = await WaPayOrderModel.find({ organizationId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((d: any) => normalizeWaPayDoc({ ...d, id: d._id }));
  }
  return db
    .select()
    .from(waPayOrders)
    .where(eq(waPayOrders.organizationId, organizationId))
    .orderBy(desc(waPayOrders.createdAt))
    .limit(limit);
}

export async function getWaPayOrderById(
  organizationId: string,
  orderId: string
): Promise<WaPayOrder | undefined> {
  if (isMongoEnabled()) {
    const doc = await WaPayOrderModel.findOne({
      $or: [{ _id: orderId }, { id: orderId }],
      organizationId,
    }).lean();
    return doc ? normalizeWaPayDoc({ ...doc, id: doc._id }) : undefined;
  }
  const [row] = await db
    .select()
    .from(waPayOrders)
    .where(and(eq(waPayOrders.organizationId, organizationId), eq(waPayOrders.id, orderId)));
  return row;
}

export async function updateWaPayOrder(
  id: string,
  patch: Partial<
    Pick<
      WaPayOrder,
      | "paymentStatus"
      | "orderStatus"
      | "orderDetailsMessageId"
      | "pgOrderId"
      | "pgTransactionId"
      | "paymentMethod"
      | "lastPaymentPayload"
      | "paidAt"
    >
  >
): Promise<WaPayOrder | undefined> {
  if (isMongoEnabled()) {
    const updated = await WaPayOrderModel.findOneAndUpdate(
      { $or: [{ _id: id }, { id }] },
      { $set: { ...patch, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return updated ? normalizeWaPayDoc({ ...updated, id: updated._id }) : undefined;
  }
  const [row] = await db
    .update(waPayOrders)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(waPayOrders.id, id))
    .returning();
  return row;
}

export function formatWaPayAmountInr(amountMinor: number): string {
  return `₹${(amountMinor / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
