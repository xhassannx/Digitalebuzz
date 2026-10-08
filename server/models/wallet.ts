import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface IOrganizationWalletDocument extends Document {
  id: string;
  organizationId: string;
  balanceMinor: number;
  currency: string;
  status: "active" | "suspended";
  lowBalanceThresholdMinor?: number;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationWalletSchema = new Schema<IOrganizationWalletDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, unique: true, index: true },
    balanceMinor: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    lowBalanceThresholdMinor: { type: Number, default: 10000 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: any, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

OrganizationWalletSchema.virtual("id").get(function () {
  return this._id;
});

export const OrganizationWalletModel =
  mongoose.models.OrganizationWallet ||
  mongoose.model<IOrganizationWalletDocument>("OrganizationWallet", OrganizationWalletSchema);

export interface IWalletTransactionDocument extends Document {
  id: string;
  organizationId: string;
  type: string;
  amountMinor: number;
  balanceAfterMinor: number;
  currency: string;
  metaCategory?: string;
  metaCostMinor?: number;
  markupMinor?: number;
  chargedMinor?: number;
  recipientCountryIso?: string;
  rateVersionId?: string;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  createdByUserId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransactionDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    amountMinor: { type: Number, required: true },
    balanceAfterMinor: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    metaCategory: { type: String },
    metaCostMinor: { type: Number },
    markupMinor: { type: Number },
    chargedMinor: { type: Number },
    recipientCountryIso: { type: String },
    rateVersionId: { type: String },
    description: { type: String },
    referenceType: { type: String },
    referenceId: { type: String, index: true },
    createdByUserId: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    toJSON: {
      virtuals: true,
      transform: (_doc: any, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

WalletTransactionSchema.index({ organizationId: 1, createdAt: -1 });
WalletTransactionSchema.virtual("id").get(function () {
  return this._id;
});

export const WalletTransactionModel =
  mongoose.models.WalletTransaction ||
  mongoose.model<IWalletTransactionDocument>("WalletTransaction", WalletTransactionSchema);

export interface IWalletReloadOrderDocument extends Document {
  id: string;
  organizationId: string;
  amountMinor: number;
  currency: string;
  status: "pending" | "completed" | "failed";
  gateway?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const WalletReloadOrderSchema = new Schema<IWalletReloadOrderDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
    gateway: { type: String },
    gatewayOrderId: { type: String, index: true },
    gatewayPaymentId: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: any, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

WalletReloadOrderSchema.virtual("id").get(function () {
  return this._id;
});

export const WalletReloadOrderModel =
  mongoose.models.WalletReloadOrder ||
  mongoose.model<IWalletReloadOrderDocument>("WalletReloadOrder", WalletReloadOrderSchema);
