import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface IWhatsappSessionDocument extends Document {
  id: string;
  userId: string;
  organizationId?: string;
  sessionId: string;
  alias?: string;
  status: "disconnected" | "connecting" | "connected" | "authenticated";
  qrCode?: string;
  deviceInfo?: Record<string, any>;
  connectionType: "unofficial" | "official";
  isActive: boolean;
  lastSeen?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsappSessionSchema = new Schema<IWhatsappSessionDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    sessionId: { type: String, required: true, unique: true, index: true },
    alias: { type: String },
    status: {
      type: String,
      enum: ["disconnected", "connecting", "connected", "authenticated"],
      default: "disconnected",
    },
    qrCode: { type: String },
    deviceInfo: { type: Schema.Types.Mixed, default: {} },
    connectionType: { type: String, enum: ["unofficial", "official"], default: "unofficial" },
    isActive: { type: Boolean, default: true },
    lastSeen: { type: Date },
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

WhatsappSessionSchema.virtual("id").get(function () {
  return this._id;
});

export const WhatsappSessionModel =
  mongoose.models.WhatsappSession ||
  mongoose.model<IWhatsappSessionDocument>("WhatsappSession", WhatsappSessionSchema);

export interface IChatDocument extends Document {
  id: string;
  sessionId: string;
  contactId?: string;
  whatsappChatId?: string;
  name?: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessageTimestamp?: Date;
  lastMessageText?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChatDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    sessionId: { type: String, required: true, index: true },
    contactId: { type: String, index: true },
    whatsappChatId: { type: String, index: true },
    name: { type: String },
    isGroup: { type: Boolean, default: false },
    unreadCount: { type: Number, default: 0 },
    lastMessageTimestamp: { type: Date, index: true },
    lastMessageText: { type: String },
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

ChatSchema.virtual("id").get(function () {
  return this._id;
});

export const ChatModel = mongoose.models.Chat || mongoose.model<IChatDocument>("Chat", ChatSchema);

export interface IMessageDocument extends Document {
  id: string;
  sessionId: string;
  chatId: string;
  organizationId?: string;
  whatsappMessageId?: string;
  from?: string;
  to?: string;
  body?: string;
  type: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  isFromMe: boolean;
  timestamp: Date;
  mediaUrl?: string;
  mediaType?: string;
  mediaCaption?: string;
  mediaFilename?: string;
  reactions?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessageDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    sessionId: { type: String, required: true, index: true },
    chatId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    whatsappMessageId: { type: String, index: true, sparse: true },
    from: { type: String },
    to: { type: String },
    body: { type: String },
    type: { type: String, default: "text" },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "failed"],
      default: "sent",
    },
    isFromMe: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now, index: true },
    mediaUrl: { type: String },
    mediaType: { type: String },
    mediaCaption: { type: String },
    mediaFilename: { type: String },
    reactions: { type: Schema.Types.Mixed, default: {} },
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

MessageSchema.index({ sessionId: 1, chatId: 1, timestamp: -1 });
MessageSchema.virtual("id").get(function () {
  return this._id;
});

export const MessageModel =
  mongoose.models.Message || mongoose.model<IMessageDocument>("Message", MessageSchema);

export interface IWebhookDocument extends Document {
  id: string;
  userId: string;
  organizationId?: string;
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
  failureCount: number;
  lastTriggeredAt?: Date;
  createdAt: Date;
}

const WebhookSchema = new Schema<IWebhookDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    url: { type: String, required: true },
    events: { type: [String], default: [] },
    secret: { type: String },
    isActive: { type: Boolean, default: true },
    failureCount: { type: Number, default: 0 },
    lastTriggeredAt: { type: Date },
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

WebhookSchema.virtual("id").get(function () {
  return this._id;
});

export const WebhookModel =
  mongoose.models.Webhook || mongoose.model<IWebhookDocument>("Webhook", WebhookSchema);

export interface ICannedMessageDocument extends Document {
  id: string;
  organizationId: string;
  shortcut: string;
  title: string;
  content: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CannedMessageSchema = new Schema<ICannedMessageDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    shortcut: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String },
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

CannedMessageSchema.virtual("id").get(function () {
  return this._id;
});

export const CannedMessageModel =
  mongoose.models.CannedMessage ||
  mongoose.model<ICannedMessageDocument>("CannedMessage", CannedMessageSchema);

export interface ICountryDialCodeDocument extends Document {
  id: number;
  countryName: string;
  countryCode: string;
  dialCode: string;
  flagEmoji?: string;
}

const CountryDialCodeSchema = new Schema<ICountryDialCodeDocument>(
  {
    _id: { type: Number, required: true },
    countryName: { type: String, required: true },
    countryCode: { type: String, required: true, index: true },
    dialCode: { type: String, required: true, index: true },
    flagEmoji: { type: String },
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

CountryDialCodeSchema.virtual("id").get(function () {
  return this._id;
});

export const CountryDialCodeModel =
  mongoose.models.CountryDialCode ||
  mongoose.model<ICountryDialCodeDocument>("CountryDialCode", CountryDialCodeSchema);

export interface IOptKeywordDocument extends Document {
  id: string;
  userId: string;
  organizationId?: string;
  type: string;
  keyword: string;
  createdAt: Date;
  updatedAt: Date;
}

const OptKeywordSchema = new Schema<IOptKeywordDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    type: { type: String, required: true, enum: ["opt_in", "opt_out"] },
    keyword: { type: String, required: true },
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

OptKeywordSchema.virtual("id").get(function () {
  return this._id;
});

export const OptKeywordModel =
  mongoose.models.OptKeyword ||
  mongoose.model<IOptKeywordDocument>("OptKeyword", OptKeywordSchema);

