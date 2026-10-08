import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface IOrganizationDocument extends Document {
  id: string;
  name: string;
  ownerId?: string;
  slug?: string;
  logo?: string;
  logoUrl?: string;
  industry?: string;
  website?: string;
  settings?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganizationDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    name: { type: String, required: true },
    ownerId: { type: String, index: true },
    slug: { type: String, index: true },
    logo: { type: String },
    logoUrl: { type: String },
    industry: { type: String },
    website: { type: String },
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

OrganizationSchema.virtual("id").get(function () {
  return this._id;
});

export const OrganizationModel =
  mongoose.models.Organization || mongoose.model<IOrganizationDocument>("Organization", OrganizationSchema);

export interface IOrganizationMemberDocument extends Document {
  id: string;
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  permissions?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationMemberSchema = new Schema<IOrganizationMemberDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
    permissions: { type: Schema.Types.Mixed, default: {} },
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

OrganizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
OrganizationMemberSchema.virtual("id").get(function () {
  return this._id;
});

export const OrganizationMemberModel =
  mongoose.models.OrganizationMember ||
  mongoose.model<IOrganizationMemberDocument>("OrganizationMember", OrganizationMemberSchema);

export interface IOrganizationThemeDocument extends Document {
  id: string;
  organizationId: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  faviconUrl?: string;
  themeMode?: "light" | "dark" | "system";
  customCss?: string;
  config?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationThemeSchema = new Schema<IOrganizationThemeDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, unique: true, index: true },
    primaryColor: { type: String },
    secondaryColor: { type: String },
    accentColor: { type: String },
    logoUrl: { type: String },
    faviconUrl: { type: String },
    themeMode: { type: String, enum: ["light", "dark", "system"], default: "system" },
    customCss: { type: String },
    config: { type: Schema.Types.Mixed, default: {} },
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

OrganizationThemeSchema.virtual("id").get(function () {
  return this._id;
});

export const OrganizationThemeModel =
  mongoose.models.OrganizationTheme ||
  mongoose.model<IOrganizationThemeDocument>("OrganizationTheme", OrganizationThemeSchema);

export interface IWebsiteBuilderPageDocument extends Document {
  id: string;
  organizationId: string;
  slug: string;
  title: string;
  content?: Record<string, any>;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WebsiteBuilderPageSchema = new Schema<IWebsiteBuilderPageDocument>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    organizationId: { type: String, required: true, index: true },
    slug: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: Schema.Types.Mixed, default: {} },
    isPublished: { type: Boolean, default: false },
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

WebsiteBuilderPageSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
WebsiteBuilderPageSchema.virtual("id").get(function () {
  return this._id;
});

export const WebsiteBuilderPageModel =
  mongoose.models.WebsiteBuilderPage ||
  mongoose.model<IWebsiteBuilderPageDocument>("WebsiteBuilderPage", WebsiteBuilderPageSchema);
