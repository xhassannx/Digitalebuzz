import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface ISupportTicketDocument extends Document {
  id: string;
  organizationId?: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  customerUserId?: string;
  customerPhone?: string;
  assignedToUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicketDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, index: true },
    ticketNumber: { type: String, required: true, unique: true, index: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    customerUserId: { type: String },
    customerPhone: { type: String },
    assignedToUserId: { type: String },
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

SupportTicketSchema.virtual("id").get(function () {
  return this._id;
});

export const SupportTicketModel =
  mongoose.models.SupportTicket ||
  mongoose.model<ISupportTicketDocument>("SupportTicket", SupportTicketSchema);

export interface ISupportMessageDocument extends Document {
  id: string;
  ticketId: string;
  authorType: "customer" | "staff" | "system";
  authorUserId?: string;
  body: string;
  createdAt: Date;
}

const SupportMessageSchema = new Schema<ISupportMessageDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    ticketId: { type: String, required: true, index: true },
    authorType: { type: String, enum: ["customer", "staff", "system"], default: "customer" },
    authorUserId: { type: String },
    body: { type: String, required: true },
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

SupportMessageSchema.virtual("id").get(function () {
  return this._id;
});

export const SupportMessageModel =
  mongoose.models.SupportMessage ||
  mongoose.model<ISupportMessageDocument>("SupportMessage", SupportMessageSchema);

export interface ISupportAttachmentDocument extends Document {
  id: string;
  ticketId: string;
  messageId: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedByUserId?: string;
  createdAt: Date;
}

const SupportAttachmentSchema = new Schema<ISupportAttachmentDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    ticketId: { type: String, required: true, index: true },
    messageId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    uploadedBy: { type: String, default: "customer" },
    uploadedByUserId: { type: String },
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

SupportAttachmentSchema.virtual("id").get(function () {
  return this._id;
});

export const SupportAttachmentModel =
  mongoose.models.SupportAttachment ||
  mongoose.model<ISupportAttachmentDocument>("SupportAttachment", SupportAttachmentSchema);

export interface IPlatformMasterSettingsDocument extends Document {
  id: string;
  platformName: string;
  supportEmail?: string;
  settings?: Record<string, any>;
  upstreamPayload?: Record<string, any>;
  revenueShareLocal?: Record<string, any>;
  walletBillingConfig?: Record<string, any>;
  creditLineProvidersConfig?: Record<string, any>;
  lastSyncAt?: Date;
  lastSyncStatus?: string;
  lastSyncError?: string;
  activePanelTemplateId: string;
  subscriptionDataRetentionMonths: number;
  updatedAt: Date;
  createdAt: Date;
}

const PlatformMasterSettingsSchema = new Schema<IPlatformMasterSettingsDocument>(
  {
    _id: { type: String, default: "singleton" },
    platformName: { type: String, default: "DigitaleBuzz" },
    supportEmail: { type: String },
    settings: { type: Schema.Types.Mixed, default: {} },
    upstreamPayload: { type: Schema.Types.Mixed, default: {} },
    revenueShareLocal: { type: Schema.Types.Mixed, default: {} },
    walletBillingConfig: { type: Schema.Types.Mixed, default: {} },
    creditLineProvidersConfig: { type: Schema.Types.Mixed, default: {} },
    lastSyncAt: { type: Date },
    lastSyncStatus: { type: String },
    lastSyncError: { type: String },
    activePanelTemplateId: { type: String, default: "default" },
    subscriptionDataRetentionMonths: { type: Number, default: 3 },
  },
  {
    strict: false,
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

PlatformMasterSettingsSchema.virtual("id").get(function () {
  return this._id;
});

export const PlatformMasterSettingsModel =
  mongoose.models.PlatformMasterSettings ||
  mongoose.model<IPlatformMasterSettingsDocument>(
    "PlatformMasterSettings",
    PlatformMasterSettingsSchema
  );
