import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface IIntegrationOAuthStateDocument extends Document {
  id: string;
  userId: string;
  organizationId?: string;
  integrationName: string;
  state: string;
  codeVerifier?: string;
  redirectUri?: string;
  clientId?: string;
  clientSecret?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationOAuthStateSchema = new Schema<IIntegrationOAuthStateDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    integrationName: { type: String, required: true, index: true },
    state: { type: String, required: true, unique: true, index: true },
    codeVerifier: { type: String },
    redirectUri: { type: String },
    clientId: { type: String },
    clientSecret: { type: String },
    expiresAt: { type: Date, required: true, index: true },
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

IntegrationOAuthStateSchema.virtual("id").get(function () {
  return this._id;
});

export const IntegrationOAuthStateModel =
  mongoose.models.IntegrationOAuthState ||
  mongoose.model<IIntegrationOAuthStateDocument>(
    "IntegrationOAuthState",
    IntegrationOAuthStateSchema
  );

export interface IIntegrationDocument extends Document {
  id: string;
  userId: string;
  organizationId?: string;
  name: string;
  displayName?: string;
  provider?: string;
  category: "featured" | "flow" | "helper";
  status: "connected" | "not_connected" | "error";
  authType: "oauth" | "api_key" | "webhook" | "none";
  config?: Record<string, any>;
  credentials?: Record<string, any>;
  lastSyncAt?: Date;
  errorMessage?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationSchema = new Schema<IIntegrationDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    name: { type: String, required: true, index: true },
    displayName: { type: String, default: "" },
    provider: { type: String },
    category: {
      type: String,
      enum: ["featured", "flow", "helper"],
      default: "featured",
    },
    status: {
      type: String,
      enum: ["connected", "not_connected", "error"],
      default: "not_connected",
    },
    authType: {
      type: String,
      enum: ["oauth", "api_key", "webhook", "none"],
      default: "none",
    },
    config: { type: Schema.Types.Mixed, default: {} },
    credentials: { type: Schema.Types.Mixed, default: {} },
    lastSyncAt: { type: Date },
    errorMessage: { type: String },
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

IntegrationSchema.index({ userId: 1, name: 1 });
IntegrationSchema.index({ organizationId: 1, name: 1 });

IntegrationSchema.virtual("id").get(function () {
  return this._id;
});

export const IntegrationModel =
  mongoose.models.Integration ||
  mongoose.model<IIntegrationDocument>("Integration", IntegrationSchema);
