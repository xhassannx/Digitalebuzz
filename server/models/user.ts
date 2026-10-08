import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface IUserDocument extends Document {
  id: string;
  email?: string;
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  tenantId?: string;
  profileImageUrl?: string;
  isSaaSOwner: boolean;
  isActive: boolean;
  emailVerified: boolean;
  accountStatus: "active" | "suspended" | "blocked";
  isTrialAccount: boolean;
  trialExpiresAt?: Date;
  onboardingNextChargeAt?: Date;
  onboardingMonthlyWaived: boolean;
  subscriptionDataPurgedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    phone: { type: String },
    tenantId: { type: String },
    profileImageUrl: { type: String },
    isSaaSOwner: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    accountStatus: { type: String, enum: ["active", "suspended", "blocked"], default: "active" },
    isTrialAccount: { type: Boolean, default: false },
    trialExpiresAt: { type: Date },
    onboardingNextChargeAt: { type: Date },
    onboardingMonthlyWaived: { type: Boolean, default: false },
    subscriptionDataPurgedAt: { type: Date },
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

UserSchema.virtual("id").get(function () {
  return this._id;
});

export const UserModel = mongoose.models.User || mongoose.model<IUserDocument>("User", UserSchema);

export interface IApiKeyDocument extends Document {
  id: string;
  userId: string;
  organizationId?: string;
  keyHash: string;
  keyPrefix: string;
  name: string;
  createdAt: Date;
  lastUsedAt?: Date;
  isActive: boolean;
}

const ApiKeySchema = new Schema<IApiKeyDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    keyHash: { type: String, required: true, index: true },
    keyPrefix: { type: String, required: true },
    name: { type: String, required: true },
    lastUsedAt: { type: Date },
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

ApiKeySchema.virtual("id").get(function () {
  return this._id;
});

export const ApiKeyModel = mongoose.models.ApiKey || mongoose.model<IApiKeyDocument>("ApiKey", ApiKeySchema);
