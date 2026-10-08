import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface IChatbotDocument extends Document {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  triggerKeywords?: string[];
  isActive: boolean;
  nodes?: any[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatbotSchema = new Schema<IChatbotDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    triggerKeywords: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    nodes: { type: Schema.Types.Mixed, default: [] },
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

ChatbotSchema.virtual("id").get(function () {
  return this._id;
});

export const ChatbotModel =
  mongoose.models.Chatbot || mongoose.model<IChatbotDocument>("Chatbot", ChatbotSchema);

export interface IAiAssistantDocument extends Document {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  model: string;
  instructions: string;
  isActive: boolean;
  settings?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const AiAssistantSchema = new Schema<IAiAssistantDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    model: { type: String, default: "gpt-4o" },
    instructions: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    settings: { type: Schema.Types.Mixed, default: {} },
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

AiAssistantSchema.virtual("id").get(function () {
  return this._id;
});

export const AiAssistantModel =
  mongoose.models.AiAssistant ||
  mongoose.model<IAiAssistantDocument>("AiAssistant", AiAssistantSchema);

export interface IFaqItemDocument extends Document {
  id: string;
  organizationId: string;
  question: string;
  answer: string;
  keywords?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FaqItemSchema = new Schema<IFaqItemDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    keywords: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
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

FaqItemSchema.virtual("id").get(function () {
  return this._id;
});

export const FaqItemModel =
  mongoose.models.FaqItem || mongoose.model<IFaqItemDocument>("FaqItem", FaqItemSchema);

export interface IFaqBotSettingsDocument extends Document {
  id: string;
  organizationId: string;
  isEnabled: boolean;
  matchThreshold: number;
  fallbackMessage: string;
  welcomeMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FaqBotSettingsSchema = new Schema<IFaqBotSettingsDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, unique: true, index: true },
    isEnabled: { type: Boolean, default: true },
    matchThreshold: { type: Number, default: 0.7 },
    fallbackMessage: { type: String, default: "Sorry, I couldn't understand that. A representative will contact you soon." },
    welcomeMessage: { type: String },
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

FaqBotSettingsSchema.virtual("id").get(function () {
  return this._id;
});

export const FaqBotSettingsModel =
  mongoose.models.FaqBotSettings ||
  mongoose.model<IFaqBotSettingsDocument>("FaqBotSettings", FaqBotSettingsSchema);

