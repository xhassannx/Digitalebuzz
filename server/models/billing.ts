import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface IPlanDocument extends Document {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number;
  priceQuarterly?: number;
  priceYearly?: number;
  messageLimit: number;
  sessionLimit: number;
  features?: Record<string, any>;
  isActive: boolean;
  isSystemDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlanDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    name: { type: String, required: true },
    slug: { type: String, sparse: true, index: true },
    priceMonthly: { type: Number, required: true },
    priceQuarterly: { type: Number },
    priceYearly: { type: Number },
    messageLimit: { type: Number, default: 1000 },
    sessionLimit: { type: Number, default: 1 },
    features: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
    isSystemDefault: { type: Boolean, default: false },
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

PlanSchema.virtual("id").get(function () {
  return this._id;
});

export const PlanModel = mongoose.models.Plan || mongoose.model<IPlanDocument>("Plan", PlanSchema);

export interface ISubscriptionDocument extends Document {
  id: string;
  userId: string;
  organizationId?: string;
  planId: string;
  billingCycle: "monthly" | "quarterly" | "yearly";
  status: "active" | "trial" | "cancelled" | "expired";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  paymentGateway?: string;
  gatewaySubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscriptionDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    planId: { type: String, required: true, index: true },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "yearly"],
      default: "monthly",
    },
    status: {
      type: String,
      enum: ["active", "trial", "cancelled", "expired"],
      default: "active",
      index: true,
    },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true, index: true },
    paymentGateway: { type: String },
    gatewaySubscriptionId: { type: String },
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

SubscriptionSchema.virtual("id").get(function () {
  return this._id;
});

export const SubscriptionModel =
  mongoose.models.Subscription ||
  mongoose.model<ISubscriptionDocument>("Subscription", SubscriptionSchema);

export interface IPaymentDocument extends Document {
  id: string;
  userId: string;
  organizationId?: string;
  planId?: string;
  amount: number;
  currency: string;
  paymentGateway: string;
  status: "pending" | "completed" | "failed" | "refunded";
  orderId?: string;
  paymentId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const PaymentSchema = new Schema<IPaymentDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    planId: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    paymentGateway: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    orderId: { type: String, index: true },
    paymentId: { type: String, index: true },
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

PaymentSchema.virtual("id").get(function () {
  return this._id;
});

export const PaymentModel =
  mongoose.models.Payment || mongoose.model<IPaymentDocument>("Payment", PaymentSchema);

export interface IUserSettingsDocument extends Document {
  id: string;
  userId: string;
  organizationId?: string;
  encryptedRazorpayKeyId?: string;
  encryptedRazorpayKeySecret?: string;
  encryptedStripePublishableKey?: string;
  encryptedStripeSecretKey?: string;
  encryptedMetaAccessToken?: string;
  metaPhoneNumberId?: string;
  metaBusinessAccountId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSettingsSchema = new Schema<IUserSettingsDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, index: true },
    encryptedRazorpayKeyId: { type: String },
    encryptedRazorpayKeySecret: { type: String },
    encryptedStripePublishableKey: { type: String },
    encryptedStripeSecretKey: { type: String },
    encryptedMetaAccessToken: { type: String },
    metaPhoneNumberId: { type: String },
    metaBusinessAccountId: { type: String },
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

UserSettingsSchema.virtual("id").get(function () {
  return this._id;
});

export const UserSettingsModel =
  mongoose.models.UserSettings ||
  mongoose.model<IUserSettingsDocument>("UserSettings", UserSettingsSchema);

export interface ISmtpSettingsDocument extends Document {
  id: string;
  userId: string;
  organizationId?: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  passwordEncrypted: string;
  fromEmail: string;
  fromName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SmtpSettingsSchema = new Schema<ISmtpSettingsDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, index: true },
    host: { type: String, required: true },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    username: { type: String, required: true },
    passwordEncrypted: { type: String, required: true },
    fromEmail: { type: String, required: true },
    fromName: { type: String },
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

SmtpSettingsSchema.virtual("id").get(function () {
  return this._id;
});

export const SmtpSettingsModel =
  mongoose.models.SmtpSettings ||
  mongoose.model<ISmtpSettingsDocument>("SmtpSettings", SmtpSettingsSchema);

export interface IPanelTransactionalEmailLogDocument extends Document {
  id: string;
  userId?: string;
  organizationId?: string;
  dedupeKey: string;
  notificationKind: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const PanelTransactionalEmailLogSchema = new Schema<IPanelTransactionalEmailLogDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String },
    organizationId: { type: String },
    dedupeKey: { type: String, required: true, index: true },
    notificationKind: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
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

PanelTransactionalEmailLogSchema.virtual("id").get(function () {
  return this._id;
});

export const PanelTransactionalEmailLogModel =
  mongoose.models.PanelTransactionalEmailLog ||
  mongoose.model<IPanelTransactionalEmailLogDocument>(
    "PanelTransactionalEmailLog",
    PanelTransactionalEmailLogSchema
  );

export interface IOrganizationInvoiceSettingsDocument extends Document {
  id: string;
  organizationId: string;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationInvoiceSettingsSchema = new Schema<IOrganizationInvoiceSettingsDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, unique: true, index: true },
    settings: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    strict: false,
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

OrganizationInvoiceSettingsSchema.virtual("id").get(function () {
  return this._id;
});

export const OrganizationInvoiceSettingsModel =
  mongoose.models.OrganizationInvoiceSettings ||
  mongoose.model<IOrganizationInvoiceSettingsDocument>(
    "OrganizationInvoiceSettings",
    OrganizationInvoiceSettingsSchema
  );

export interface IWhitelabelOnboardingFeeDocument extends Document {
  id: string;
  userId: string;
  subscriptionId?: string;
  subscriptionHistoryId?: string;
  trigger: "assigned" | "purchased" | "renewed" | "upgraded" | "monthly";
  amountMinor: number;
  currency: string;
  dueAt: Date;
  status: "pending" | "paid" | "waived" | "failed" | "cancelled";
  paidAt?: Date;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  paymentGateway?: string;
  gatewayPayload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const WhitelabelOnboardingFeeSchema = new Schema<IWhitelabelOnboardingFeeDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    subscriptionId: { type: String },
    subscriptionHistoryId: { type: String },
    trigger: {
      type: String,
      enum: ["assigned", "purchased", "renewed", "upgraded", "monthly"],
      required: true,
    },
    amountMinor: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    dueAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "paid", "waived", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    paidAt: { type: Date },
    gatewayOrderId: { type: String, index: true },
    gatewayPaymentId: { type: String },
    paymentGateway: { type: String },
    gatewayPayload: { type: Schema.Types.Mixed },
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

WhitelabelOnboardingFeeSchema.virtual("id").get(function () {
  return this._id;
});

export const WhitelabelOnboardingFeeModel =
  mongoose.models.WhitelabelOnboardingFee ||
  mongoose.model<IWhitelabelOnboardingFeeDocument>(
    "WhitelabelOnboardingFee",
    WhitelabelOnboardingFeeSchema
  );

export interface IWhitelabelOnboardingSettlementDocument extends Document {
  id: string;
  gateway: "razorpay" | "cashfree";
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  amountMinor: number;
  currency: string;
  feeIds: string[];
  status: "pending" | "paid" | "failed";
  rawGatewayResponse?: Record<string, unknown>;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WhitelabelOnboardingSettlementSchema = new Schema<IWhitelabelOnboardingSettlementDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    gateway: { type: String, enum: ["razorpay", "cashfree"], required: true },
    gatewayOrderId: { type: String, required: true, unique: true, index: true },
    gatewayPaymentId: { type: String },
    amountMinor: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    feeIds: [{ type: String }],
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
      index: true,
    },
    rawGatewayResponse: { type: Schema.Types.Mixed },
    paidAt: { type: Date },
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

WhitelabelOnboardingSettlementSchema.virtual("id").get(function () {
  return this._id;
});

export const WhitelabelOnboardingSettlementModel =
  mongoose.models.WhitelabelOnboardingSettlement ||
  mongoose.model<IWhitelabelOnboardingSettlementDocument>(
    "WhitelabelOnboardingSettlement",
    WhitelabelOnboardingSettlementSchema
  );



