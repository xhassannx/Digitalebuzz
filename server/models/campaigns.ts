import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface ICampaignDocument extends Document {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  sessionId: string;
  status: "draft" | "scheduled" | "processing" | "completed" | "failed" | "cancelled";
  scheduledAt?: Date;
  templateId?: string;
  templateName?: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  headerMediaUrl?: string;
  variables?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaignDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    sessionId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["draft", "scheduled", "processing", "completed", "failed", "cancelled"],
      default: "draft",
      index: true,
    },
    scheduledAt: { type: Date, index: true },
    templateId: { type: String },
    templateName: { type: String },
    totalRecipients: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    headerMediaUrl: { type: String },
    variables: { type: Schema.Types.Mixed, default: {} },
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

CampaignSchema.virtual("id").get(function () {
  return this._id;
});

export const CampaignModel =
  mongoose.models.Campaign || mongoose.model<ICampaignDocument>("Campaign", CampaignSchema);

export interface ICampaignRecipientDocument extends Document {
  id: string;
  campaignId: string;
  contactId?: string;
  phone: string;
  name?: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  variables?: Record<string, any>;
  sentAt?: Date;
  deliveredAt?: Date;
  errorMessage?: string;
  buttonClicks?: Array<{ buttonIndex: number; clickedAt: Date }>;
  createdAt: Date;
}

const CampaignRecipientSchema = new Schema<ICampaignRecipientDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    campaignId: { type: String, required: true, index: true },
    contactId: { type: String },
    phone: { type: String, required: true },
    name: { type: String },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "failed"],
      default: "pending",
      index: true,
    },
    variables: { type: Schema.Types.Mixed, default: {} },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    errorMessage: { type: String },
    buttonClicks: [
      {
        buttonIndex: { type: Number, required: true },
        clickedAt: { type: Date, default: Date.now },
      },
    ],
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

CampaignRecipientSchema.index({ campaignId: 1, status: 1 });
CampaignRecipientSchema.virtual("id").get(function () {
  return this._id;
});

export const CampaignRecipientModel =
  mongoose.models.CampaignRecipient ||
  mongoose.model<ICampaignRecipientDocument>("CampaignRecipient", CampaignRecipientSchema);

export interface IMessageTemplateDocument extends Document {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  category?: string;
  language?: string;
  status?: string;
  components?: any[];
  phoneNumberId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageTemplateSchema = new Schema<IMessageTemplateDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String },
    language: { type: String, default: "en_US" },
    status: { type: String, default: "PENDING" },
    components: { type: Schema.Types.Mixed, default: [] },
    phoneNumberId: { type: String, index: true },
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

MessageTemplateSchema.virtual("id").get(function () {
  return this._id;
});

export const MessageTemplateModel =
  mongoose.models.MessageTemplate ||
  mongoose.model<IMessageTemplateDocument>("MessageTemplate", MessageTemplateSchema);
