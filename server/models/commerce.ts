import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface IWaPayOrderDocument extends Document {
  id: string;
  organizationId: string;
  sessionId: string;
  customerPhone: string;
  orderStatus: string;
  paymentStatus: string;
  currency: string;
  totalAmountMinor: number;
  items?: any[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const WaPayOrderSchema = new Schema<IWaPayOrderDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    customerPhone: { type: String, required: true, index: true },
    orderStatus: { type: String, default: "pending" },
    paymentStatus: { type: String, default: "pending" },
    currency: { type: String, default: "INR" },
    totalAmountMinor: { type: Number, default: 0 },
    items: { type: Schema.Types.Mixed, default: [] },
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

WaPayOrderSchema.virtual("id").get(function () {
  return this._id;
});

export const WaPayOrderModel =
  mongoose.models.WaPayOrder || mongoose.model<IWaPayOrderDocument>("WaPayOrder", WaPayOrderSchema);

export interface IOrganizationInvoiceDocument extends Document {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  totalAmount: number;
  currency: string;
  status: string;
  items?: any[];
  pdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationInvoiceSchema = new Schema<IOrganizationInvoiceDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, index: true },
    invoiceNo: { type: String, index: true },
    customerName: { type: String },
    customerPhone: { type: String },
    customerEmail: { type: String },
    totalAmount: { type: Number },
    currency: { type: String, default: "INR" },
    status: { type: String, default: "unpaid" },
    items: { type: Schema.Types.Mixed, default: [] },
    pdfUrl: { type: String },
  },
  {
    strict: false,
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: any, ret: any) => {
        ret.id = ret._id;
        ret.invoiceNumber = ret.invoiceNumber || ret.invoiceNo;
        ret.invoiceNo = ret.invoiceNo || ret.invoiceNumber;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

OrganizationInvoiceSchema.pre("validate", function () {
  if (!this.invoiceNumber && (this as any).invoiceNo) {
    this.invoiceNumber = (this as any).invoiceNo;
  } else if (!(this as any).invoiceNo && this.invoiceNumber) {
    (this as any).invoiceNo = this.invoiceNumber;
  }
});

OrganizationInvoiceSchema.virtual("id").get(function () {
  return this._id;
});

export const OrganizationInvoiceModel =
  mongoose.models.OrganizationInvoice ||
  mongoose.model<IOrganizationInvoiceDocument>("OrganizationInvoice", OrganizationInvoiceSchema);

export interface IOrganizationLeadDocument extends Document {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  source?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationLeadSchema = new Schema<IOrganizationLeadDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true, index: true },
    email: { type: String },
    status: { type: String, default: "new", index: true },
    source: { type: String },
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

OrganizationLeadSchema.virtual("id").get(function () {
  return this._id;
});

export const OrganizationLeadModel =
  mongoose.models.OrganizationLead ||
  mongoose.model<IOrganizationLeadDocument>("OrganizationLead", OrganizationLeadSchema);

export interface IOrganizationCommerceSettingsDocument extends Document {
  id: string;
  organizationId: string;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationCommerceSettingsSchema = new Schema<IOrganizationCommerceSettingsDocument>(
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

OrganizationCommerceSettingsSchema.virtual("id").get(function () {
  return this._id;
});

export const OrganizationCommerceSettingsModel =
  mongoose.models.OrganizationCommerceSettings ||
  mongoose.model<IOrganizationCommerceSettingsDocument>(
    "OrganizationCommerceSettings",
    OrganizationCommerceSettingsSchema
  );

export interface IOrganizationLeadStatusDocument extends Document {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationLeadStatusSchema = new Schema<IOrganizationLeadStatusDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, index: true },
    color: { type: String, default: "#dbeafe" },
    sortOrder: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
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

OrganizationLeadStatusSchema.virtual("id").get(function () {
  return this._id;
});

export const OrganizationLeadStatusModel =
  mongoose.models.OrganizationLeadStatus ||
  mongoose.model<IOrganizationLeadStatusDocument>(
    "OrganizationLeadStatus",
    OrganizationLeadStatusSchema
  );


